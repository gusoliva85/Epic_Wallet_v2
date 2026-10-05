"""Las tablas de Supabase que nuestras tablas referencian.

Acá se declara **sólo lo imprescindible** de `auth.users`: la columna a
la que apunta `profiles.id`. No es nuestra tabla, no se migra desde
acá y no se consulta desde acá.

Por qué hace falta declararla: SQLAlchemy necesita conocer la tabla
destino de una clave foránea para resolver el orden de las operaciones
al guardar. Sin esto, cualquier `UPDATE` sobre `profiles` falla con
«could not find table 'auth.users'» — y falla en tiempo de ejecución,
no al arrancar, así que el primer `PATCH /api/me` se encuentra con un
500 que no dice nada de lo que pasa.

Alembic no la toca: `migrations/env.py` descarta todo lo que no viva en
nuestro esquema.
"""

from __future__ import annotations

import os

from sqlalchemy import Column, Table
from sqlalchemy.dialects.postgresql import UUID

from .base import metadata

# Se decide por el MOTOR, no por `esquema_actual()`: esa función
# devuelve None también cuando `DB_SCHEMA` no está en el entorno del
# proceso —algo normal al correr las pruebas, que leen la
# configuración del .env por otro camino—, y entonces la tabla no se
# declaraba y el error volvía.
#
# En SQLite no existe Supabase ni la clave foránea, así que no falta.
_es_sqlite = os.getenv("DATABASE_URL", "").startswith("sqlite")

usuarios_de_supabase: Table | None = None

if not _es_sqlite:
    usuarios_de_supabase = Table(
        "users",
        metadata,
        Column("id", UUID(as_uuid=False), primary_key=True),
        schema="auth",
    )
