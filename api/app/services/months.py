"""Lógica de meses: identidad, estado y las dos naturalezas · F03-T01.
Mes actual con base de datos desde F03-T03.

Referencia: 02_Documento_Tecnico.md §5.1, §6.6 · General §6, §12.1, §50 (R1, R3)

Casi todo el archivo es cálculo puro, sin base de datos: recibe
números (o una fecha, para `mes_actual`) y devuelve números. Se
testeó así, antes de que existiera la tabla `months` (F03-T01).

La excepción es `abrir_mes_actual`, al final: la única función de acá
que toca la base, porque orquesta una regla de negocio —crear el mes o
devolver el que ya hay— y no una consulta suelta. Por eso vive en el
servicio y no en el repositorio (`app.repos.months`), que sólo sabe
consultar y no decide nada.
"""

from __future__ import annotations

import calendar
import datetime as dt
import decimal
from collections.abc import Sequence
from typing import Literal, NamedTuple
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from ..models import Month
from ..repos import months as repos

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


def dias_transcurridos(periodo: Periodo, ahora: dt.datetime | None = None) -> int:
    """Cuántos días de `periodo` ya pasaron — lo que necesita el
    gráfico diario del dashboard (F05-T04, Técnico §9.2, campo
    `daily.days`) para saber hasta qué día armar la serie.

    El mes en curso da el día de hoy (no tiene sentido mostrar días
    que todavía no llegaron); cualquier otro mes —siempre anterior,
    porque no hay meses futuros (Regla 1)— ya terminó entero, así que
    da la cantidad total de días de ese mes.

    `ahora` es para las pruebas, igual que en `mes_actual`.
    """
    if periodo == mes_actual(ahora):
        momento = ahora if ahora is not None else dt.datetime.now(ZONA_APP)
        if momento.tzinfo is None:
            momento = momento.replace(tzinfo=ZONA_APP)
        else:
            momento = momento.astimezone(ZONA_APP)
        return momento.day
    return calendar.monthrange(periodo.year, periodo.month)[1]


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
    status: str, movimientos: Sequence[object] | None
) -> Sequence[object] | None:
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

    `Sequence` y no `list` en la entrada (F07-T01): así acepta
    `list[Transaction]` de verdad —`list` es invariante para el
    chequeo de tipos, y una función pensada para cualquier llamador no
    puede pedir el tipo exacto que use cada uno."""
    if status == HISTORICO:
        return None
    return movimientos if movimientos is not None else []


def totales_historicos_son_validos(
    income_total: decimal.Decimal,
    expense_total: decimal.Decimal,
    saving_total: decimal.Decimal,
) -> bool:
    """`income_total` y `expense_total` de un mes histórico (General
    §18, Técnico §9.4) se cargan a mano, no se suman desde
    `transactions` —no hay un `CHECK` de la base que los proteja
    todavía como al importe de un movimiento (Técnico §6.2, F08-T03)—,
    así que se valida acá antes de guardar: ninguno de los dos puede
    ser negativo. Cero es válido —un mes sin ingresos o sin gastos
    cargados es un dato real, no un error.

    `saving_total` NO se valida contra cero: un mes donde se gastó más
    de lo que entró da un ahorro negativo, y es un resultado válido
    que se muestra con signo menos, no un error (Técnico §7.1, mismo
    criterio que `calc.ahorro_del_mes`). Bug encontrado por Gustavo
    cargando un mes real: esta función lo rechazaba sin motivo."""
    return income_total >= 0 and expense_total >= 0


def requiere_confirmacion_para_historico(status_actual: str | None, tiene_movimientos: bool) -> bool:
    """Si hace falta un aviso explícito antes de convertir el mes en
    histórico consolidado (General §6.3, Regla 4 de la §50 — criterio
    de aceptación de F08-T01: "un mes `open` con movimientos no se
    puede convertir en consolidado sin aviso explícito").

    Un mes `open` con movimientos cargados perdería esos movimientos
    individuales en favor de los totales manuales que trae la carga
    histórica: no se pisan datos sin que el usuario lo decida a
    propósito. Un mes que todavía no existe (`status_actual is None`)
    o que ya es histórico —se lo está corrigiendo, General §6.3— no
    tiene movimientos individuales que perder, así que no hace falta
    pedir nada."""
    return status_actual == ABIERTO and tiene_movimientos


# ===================================================================
#  Desde acá, la única función que toca la base · F03-T03
# ===================================================================


def abrir_mes(sesion: Session, user_id: str, periodo: Periodo) -> Month:
    """El mes de `periodo`: lo busca y, si es la primera vez que se lo
    pide, lo crea abierto con los totales en cero.

    Generaliza `abrir_mes_actual` a cualquier período, no sólo el de
    hoy: la hace falta `POST /api/transactions` (F04-T06) para poder
    cargar un movimiento con una fecha de un mes que todavía no tiene
    fila en `months`, sin que el usuario tenga que pasar por la barra
    de mes primero.

    Llamarla dos veces seguidas no duplica nada —la segunda encuentra
    el mes que creó la primera—, y eso es justo lo que garantiza
    `months_unique_per_user` del lado de la base: aunque dos pedidos
    llegaran a la vez, el segundo `insert` fallaría por la restricción
    en lugar de crear un duplicado.
    """
    existente = repos.buscar_por_periodo(sesion, periodo.year, periodo.month)
    if existente is not None:
        return existente
    return repos.crear(
        sesion, user_id=user_id, year=periodo.year, month=periodo.month, status=ABIERTO
    )


def abrir_mes_actual(sesion: Session, user_id: str, *, ahora: dt.datetime | None = None) -> Month:
    """El mes actual del usuario. `ahora` es para las pruebas, igual
    que en `mes_actual`."""
    return abrir_mes(sesion, user_id, mes_actual(ahora))


def recalcular_saldos_acumulados(sesion: Session, user_id: str) -> None:
    """Recalcula y guarda `opening_balance`/`closing_balance` de TODOS
    los meses del usuario, encadenados desde el saldo inicial del
    perfil (Técnico §7.2, punto 3). F08-T03 es la tarea que empieza a
    escribir esto de verdad en la base; antes, esas dos columnas
    quedaban en cero sin que nada las tocara (F03-T05).

    Se llama después de crear o corregir un mes histórico: ese cambio
    puede correr el acumulado de cualquier mes posterior (criterio de
    aceptación de F08-T01), y recalcular todos juntos —en vez de
    adivinar cuáles cambiaron— es más simple y no se puede desalinear.
    Con el volumen real del proyecto (algunos años de meses por
    cuenta) es una lectura y una escritura chicas.

    No la llama el recálculo de movimientos (F04-T05): el mes en curso
    es siempre el último cronológicamente, así que su acumulado vuelve
    a quedar al día en cuanto se carga o corrige cualquier mes
    histórico; mientras tanto, `GET /api/dashboard` y
    `GET /api/months/savings-evolution` lo calculan al vuelo y nunca
    quedan desactualizados."""
    # Import local: `services.calc` importa `HISTORICO` de este mismo
    # módulo, así que importarlo arriba de todo crearía un ciclo.
    from ..repos import profiles as repos_perfiles
    from . import calc

    perfil = repos_perfiles.buscar(sesion)
    saldo_inicial = perfil.opening_balance if perfil else decimal.Decimal("0")

    meses = sorted(repos.listar(sesion), key=lambda m: (m.year, m.month))
    serie = calc.serie_de_ahorro_acumulado(saldo_inicial, [m.saving_total for m in meses])

    anterior = saldo_inicial
    for mes, saldo in zip(meses, serie, strict=True):
        mes.opening_balance = anterior
        mes.closing_balance = saldo
        anterior = saldo
    sesion.flush()
