"""Lógica de meses: identidad, estado y las dos naturalezas · F03-T01.

Referencia: 02_Documento_Tecnico.md §6.6 · 01_Documento_General.md §6, §12.1, §50 (R1, R3)

Funciones puras, sin base de datos: reciben números (o una fecha, para
`mes_actual`) y devuelven números. Se testean antes de que exista la
tabla `months`, que es F03-T03, y antes de que exista el endpoint, que
es F03-T05 — el orden que pide el roadmap en cada tarea.

Lo que NO vive acá: nada que lea o escriba `months` o `transactions`.
Eso es el repositorio y el servicio con base de datos de F03-T03, que
van a llamar a `origen_de_totales` y a `transacciones_del_mes` de este
archivo para decidir qué consulta correr y qué devolver — no van a
repetir el `if status == ...` por su cuenta.
"""

from __future__ import annotations

import datetime as dt
from typing import Literal, NamedTuple
from zoneinfo import ZoneInfo

# La aplicación muestra todo en esta zona (Técnico §6.1), no en la del
# servidor: Vercel corre en UTC, y sin esto el mes cambiaría unas horas
# antes o después de la medianoche real en Argentina.
ZONA_APP = ZoneInfo("America/Argentina/Buenos_Aires")

# Los dos únicos valores de `months.status` (General §6.1, §6.2).
ABIERTO: Literal["open"] = "open"
HISTORICO: Literal["historical"] = "historical"


class Periodo(NamedTuple):
    """Un año y un mes. No valida nada por sí solo —es sólo el par—;
    `es_mes_valido` es la función que decide si el mes está en rango."""

    year: int
    month: int


def es_mes_valido(month: int) -> bool:
    """Un mes tiene que estar entre 1 y 12. No hay nada más que
    validar acá: el año no tiene un rango propio del dominio."""
    return 1 <= month <= 12


def estado_valido(status: str) -> bool:
    """Los dos únicos valores que puede tener `months.status`. La base
    los obliga con un `check` propio; esto es para validar antes de
    llegar hasta ahí —por ejemplo, el `status` que venga en el cuerpo
    de un alta de mes histórico (F08)."""
    return status in (ABIERTO, HISTORICO)


def mes_actual(ahora: dt.datetime | None = None) -> Periodo:
    """El mes de hoy, en la zona de la aplicación.

    `ahora` es para las pruebas: sin él, usa el reloj real. Pasado sin
    zona horaria, se lo toma como si ya fuera la hora de Argentina
    —nunca como UTC—, que es el error que se busca evitar con `ZONA_APP`
    en primer lugar.
    """
    momento = ahora if ahora is not None else dt.datetime.now(ZONA_APP)
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=ZONA_APP)
    else:
        momento = momento.astimezone(ZONA_APP)
    return Periodo(momento.year, momento.month)


def mes_siguiente(periodo: Periodo) -> Periodo:
    """Diciembre → siguiente da enero del año que viene."""
    if periodo.month == 12:
        return Periodo(periodo.year + 1, 1)
    return Periodo(periodo.year, periodo.month + 1)


def mes_anterior(periodo: Periodo) -> Periodo:
    """Enero → anterior da diciembre del año pasado."""
    if periodo.month == 1:
        return Periodo(periodo.year - 1, 12)
    return Periodo(periodo.year, periodo.month - 1)


def es_mes_futuro(periodo: Periodo, referencia: Periodo) -> bool:
    """`referencia` es el mes actual; `periodo` es el que se quiere
    mostrar o cargar. No se permite seleccionar un mes que todavía no
    existió (General §12.1): la barra de mes deshabilita "siguiente" y
    "Hoy" cuando esto da `True` (skill, "Barra de mes").
    """
    return (periodo.year, periodo.month) > (referencia.year, referencia.month)


def origen_de_totales(status: str) -> Literal["transactions", "stored"]:
    """De dónde tienen que salir `income_total`/`expense_total`/
    `saving_total`: de sumar `transactions` si el mes está abierto, o
    de los campos propios del mes (`months.income_total`, etc.) si es
    histórico (Técnico §6.6, fila "Origen de los totales").

    Esta función no suma nada —no tiene con qué, no recibe
    movimientos—: sólo dice qué camino tomar. Es la "resolución en un
    único lugar del backend" que pide el documento técnico: a partir de
    acá, el repositorio de F03-T03 llama a esto en vez de escribir su
    propio `if status == "open"`.
    """
    return "transactions" if status == ABIERTO else "stored"


def transacciones_del_mes(
    status: str, movimientos: list[object] | None
) -> list[object] | None:
    """Lo que la API tiene que mandar en el campo `transactions`.

    El contrato es explícito y no es simétrico (Técnico §6.6): un mes
    abierto siempre devuelve su lista, aunque esté vacía (`[]`). Un mes
    histórico siempre devuelve `None` —nunca una lista, ni vacía—, sin
    importar qué se le pase en `movimientos`: un histórico no tiene
    movimientos individuales y no se inventan (Regla 4), así que ni
    vale la pena mirarlos.

    `None` significa "este mes no tiene movimientos individuales";
    `[]` significa "los tiene, y no hay ninguno este mes". Confundir
    los dos es el bug que esta función existe para que no se escriba
    dos veces en el repositorio y en el router.
    """
    if status == HISTORICO:
        return None
    return movimientos if movimientos is not None else []
