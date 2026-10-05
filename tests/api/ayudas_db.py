"""Ayudas para las pruebas que tocan Postgres.

Existe por una razón concreta y aprendida a los golpes: el pooler de
Supabase está en **modo transacción** y reparte las conexiones del
servidor entre clientes. Si alguien deja un `set role` de sesión
puesto, esa conexión vuelve al pool con el rol cambiado y se la entrega
a quien siga.

Pasó de verdad mientras se escribía F02-T05: una prueba de mutación
cambió `set local role` por `set role` para comprobar que la diferencia
importa, y dejó **todas** las conexiones del proyecto como
`authenticated`. Las pruebas siguientes fallaban con «permission denied
for table users» sin que nada estuviera mal en el código.

`api/app/core/db.py` se defiende solo desde entonces. Estas ayudas
hacen lo mismo para las pruebas, que abren sus propias conexiones.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.pool import NullPool


@contextmanager
def lectura(motor: Engine) -> Iterator[Any]:
    """Transacción de sólo lectura con el rol de la aplicación.

    El `reset role` va **dentro** de la transacción: el pooler asigna
    la conexión del servidor por transacción, así que limpiarla al
    conectarse no alcanza.
    """
    with motor.begin() as con:
        con.execute(text("reset role"))
        yield con


@contextmanager
def escritura(motor: Engine) -> Iterator[Any]:
    """Igual que `lectura`, pero el nombre dice que modifica."""
    with motor.begin() as con:
        con.execute(text("reset role"))
        yield con


def motor_de_pruebas(url: str) -> Engine:
    """Motor con las mismas precauciones que el de la aplicación.

    `prepare_threshold=None` es obligatorio detrás del pooler en modo
    transacción: psycopg3 prepara las consultas repetidas y la sentencia
    queda en la conexión del servidor, que después se le entrega a otro
    cliente. El error que sale es «prepared statement "_pg3_0" already
    exists», y no dice nada de lo que realmente pasa.
    """
    return create_engine(
        url,
        poolclass=NullPool,
        connect_args={"prepare_threshold": None, "connect_timeout": 10},
    )
