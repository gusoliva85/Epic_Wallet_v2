"""Servicio del dashboard · F05-T04.

Referencia: 02_Documento_Tecnico.md §9.2

Arma el contrato único de `GET /api/dashboard`: una sola llamada con
todo lo que el tablero necesita, para no multiplicar peticiones en
una conexión de celular (menos de 400 ms, criterio de aceptación de
la tarea). Por eso toda la función pide los meses UNA vez
(`repos.months.listar`) y resuelve de ahí la navegación, el acumulado
y los últimos seis, en vez de una consulta por cada pieza.

Lo que todavía no existe en la base —inversiones (F10) y pasivos
(F09-T03)— entra en cero: el contrato ya tiene el lugar
(`investments_value`, y `patrimonio_neto` ya acepta pasivos), así que
cuando esas fases agreguen datos de verdad no hay que tocar esta
función, sólo dejar de pasarle ceros.
"""

from __future__ import annotations

import datetime as dt
import decimal
from typing import NamedTuple

from sqlalchemy.orm import Session

from ..models import Category, Month, MonthlyCategoryTotal, Transaction
from ..repos import categories as repos_categorias
from ..repos import monthly_category_totals as repos_totales
from ..repos import months as repos_meses
from ..repos import profiles as repos_perfiles
from ..repos import transactions as repos_movimientos
from . import calc
from .months import HISTORICO, Periodo, abrir_mes, dias_transcurridos, mes_actual

# Cuántos meses entran en el panel de "últimos seis" (Técnico §9.2).
MESES_EN_COMPARATIVA = 6

MESES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)  # fmt: skip


def etiqueta_de_mes(year: int, month: int) -> str:
    """«Octubre 2026» — el mismo formato que ya arma `barra-mes.js`
    del lado del cliente, pero del lado del servidor, en español, sin
    depender de la configuración regional del sistema operativo."""
    return f"{MESES[month - 1].capitalize()} {year}"


class PicoDeGasto(NamedTuple):
    day: int
    amount: decimal.Decimal


class SerieDiaria(NamedTuple):
    days: int
    income: list[decimal.Decimal]
    expense: list[decimal.Decimal]
    saving_cumulative: list[decimal.Decimal]
    peak_expense: PicoDeGasto | None
    days_without_expense: int


class VariacionesMensuales(NamedTuple):
    income: decimal.Decimal | None
    expense: decimal.Decimal | None
    saving: decimal.Decimal | None


class MesComparativo(NamedTuple):
    year: int
    month: int
    label: str
    income: decimal.Decimal
    expense: decimal.Decimal
    saving: decimal.Decimal
    saving_rate: decimal.Decimal | None


class CategoriaDelMes(NamedTuple):
    category_id: int
    name: str
    type: str
    total: decimal.Decimal
    share: decimal.Decimal | None
    variation: decimal.Decimal | None
    transaction_count: int
    last_date: dt.date | None


class Dashboard(NamedTuple):
    """Todo lo que `routers/dashboard.py` necesita para armar la
    respuesta — sin Pydantic de por medio, eso es trabajo del router y
    del esquema, no de este servicio."""

    mes: Month
    es_el_mes_actual: bool
    anterior: Periodo | None
    siguiente: Periodo | None
    actual: Periodo
    tasa_de_ahorro: decimal.Decimal | None
    ahorro_acumulado: decimal.Decimal
    valor_de_inversiones: decimal.Decimal
    patrimonio_neto: decimal.Decimal
    variaciones: VariacionesMensuales
    diario: SerieDiaria | None
    ultimos_seis_meses: list[MesComparativo]
    categorias: list[CategoriaDelMes]


def _por_dia(
    movimientos: list[Transaction], dias: int
) -> tuple[list[decimal.Decimal], list[decimal.Decimal]]:
    cero = decimal.Decimal("0.00")
    ingresos = [cero] * dias
    egresos = [cero] * dias
    for m in movimientos:
        indice = m.transaction_date.day - 1
        if not 0 <= indice < dias:
            # No debería pasar —el movimiento es de este mes—, pero no
            # es motivo para que el dashboard entero falle.
            continue
        if m.transaction_type == "income":
            ingresos[indice] += m.amount
        else:
            egresos[indice] += m.amount
    return ingresos, egresos


def _pico_de_gasto(egresos_por_dia: list[decimal.Decimal]) -> PicoDeGasto | None:
    """El día de mayor gasto del mes, para el pie del gráfico diario
    (Técnico §9.2, `daily.peak_expense`). `None` sin ningún gasto
    todavía — un pico de $0 no dice nada."""
    mayor = max(egresos_por_dia, default=decimal.Decimal("0"))
    if mayor == 0:
        return None
    dia = egresos_por_dia.index(mayor) + 1
    return PicoDeGasto(day=dia, amount=mayor)


def _desglose_por_categoria(
    totales: list[MonthlyCategoryTotal],
    categorias_por_id: dict[int, Category],
    movimientos: list[Transaction],
    mes: Month,
    totales_anteriores_por_categoria: dict[int, decimal.Decimal],
) -> list[CategoriaDelMes]:
    """Combina `monthly_category_totals` —que ya trae el total
    correcto para las dos naturalezas del mes (F04-T05 lo recalcula
    para uno abierto; F08 va a cargarlo a mano para uno histórico)—
    con lo único que sólo se puede sacar de los movimientos
    individuales: cuántos hubo y cuándo fue el último. Un mes
    histórico no tiene movimientos, así que esas dos quedan en 0 y
    `None` — nunca se inventan (Regla 4).

    `share` sale de `calc.porcentajes_de_categorias`, una vez por tipo
    (ingreso y egreso son dos grupos de 100% separados, nunca uno
    mezclado con el otro) y no de `calc.participacion` categoría por
    categoría: así la suma de los porcentajes de cada grupo da
    exactamente 100 (F07-T01), en vez de quedar 99,99 o 100,01 por el
    redondeo independiente de cada uno.
    """
    cantidad: dict[int, int] = {}
    ultima_fecha: dict[int, dt.date] = {}
    for m in movimientos:
        cantidad[m.category_id] = cantidad.get(m.category_id, 0) + 1
        vigente = ultima_fecha.get(m.category_id)
        if vigente is None or m.transaction_date > vigente:
            ultima_fecha[m.category_id] = m.transaction_date

    # Defensivo: la FK no debería permitir una fila de
    # `monthly_category_totals` sin categoría, pero filtrarlas acá
    # (una sola vez) y no en el loop de abajo es lo que deja agrupar
    # por tipo sin repetir el chequeo.
    totales_validos = [t for t in totales if t.category_id in categorias_por_id]

    shares: dict[int, decimal.Decimal | None] = {}
    for tipo, total_del_tipo in (("income", mes.income_total), ("expense", mes.expense_total)):
        del_tipo = [t for t in totales_validos if categorias_por_id[t.category_id].type == tipo]
        porcentajes = calc.porcentajes_de_categorias(
            [t.total_amount for t in del_tipo], total_del_tipo
        )
        for total, porcentaje in zip(del_tipo, porcentajes, strict=True):
            shares[total.category_id] = porcentaje

    salida = []
    for total in totales_validos:
        categoria = categorias_por_id[total.category_id]
        anterior = totales_anteriores_por_categoria.get(total.category_id, decimal.Decimal("0"))
        salida.append(
            CategoriaDelMes(
                category_id=categoria.id,
                name=categoria.name,
                type=categoria.type,
                total=total.total_amount,
                share=shares[total.category_id],
                variation=calc.variacion_porcentual(total.total_amount, anterior),
                transaction_count=cantidad.get(total.category_id, 0),
                last_date=ultima_fecha.get(total.category_id),
            )
        )
    return salida


def _ultimos_seis(meses_hasta_aqui: list[Month]) -> list[MesComparativo]:
    """Los últimos `MESES_EN_COMPARATIVA` meses hasta el que se está
    mostrando, inclusive — no siempre los últimos seis de la cuenta:
    si se está mirando un mes viejo, el panel acompaña a ESE mes, no
    salta al presente. `meses_hasta_aqui` ya viene del más nuevo al
    más viejo; acá se toman los primeros seis y se da vuelta el orden,
    para que el gráfico los lea de izquierda a derecha en el tiempo."""
    recientes = meses_hasta_aqui[:MESES_EN_COMPARATIVA]
    return [
        MesComparativo(
            year=m.year,
            month=m.month,
            label=etiqueta_de_mes(m.year, m.month),
            income=m.income_total,
            expense=m.expense_total,
            saving=m.saving_total,
            saving_rate=calc.tasa_de_ahorro(m.income_total, m.saving_total),
        )
        for m in reversed(recientes)
    ]


def armar(
    sesion: Session,
    user_id: str,
    *,
    year: int | None,
    month: int | None,
    ahora: dt.datetime | None = None,
) -> Dashboard | None:
    """El contrato completo de `GET /api/dashboard`. `None` si
    `year`/`month` apuntan a un mes que no existe — el router lo
    traduce a 404, igual que `GET /api/months/{id}` (nunca se inventa
    un mes que no sea el actual; ese sí se abre solo, como ya hace
    `GET /api/months`)."""
    periodo_actual = mes_actual(ahora)
    abrir_mes(sesion, user_id, periodo_actual)

    periodo_pedido = Periodo(year, month) if year is not None and month is not None else periodo_actual

    meses = repos_meses.listar(sesion)  # del más nuevo al más viejo, F03-T03
    mes = next((m for m in meses if (m.year, m.month) == periodo_pedido), None)
    if mes is None:
        return None

    indice = meses.index(mes)
    # El índice 0 es el más nuevo (F03-T03): "siguiente" está un
    # índice más atrás en la lista, "anterior" uno más adelante.
    siguiente_mes = meses[indice - 1] if indice > 0 else None
    anterior_mes = meses[indice + 1] if indice + 1 < len(meses) else None

    perfil = repos_perfiles.buscar(sesion)
    saldo_inicial = perfil.opening_balance if perfil else decimal.Decimal("0")

    # Todos los meses desde el principio hasta el que se pide,
    # inclusive, en el orden que ya trae la lista (desc.): alcanza con
    # filtrar, la suma no depende del orden.
    hasta_aqui = [m for m in meses if (m.year, m.month) <= periodo_pedido]
    acumulado = calc.ahorro_acumulado(saldo_inicial, [m.saving_total for m in hasta_aqui])

    # F10 (inversiones) y F09-T03 (pasivos) todavía no existen: el
    # patrimonio da exactamente el ahorro acumulado hasta que los
    # haya, sin que nadie tenga que acordarse de sumarlos a mano.
    valor_inversiones = decimal.Decimal("0.00")
    patrimonio = calc.patrimonio_neto(acumulado, valor_inversiones)

    variaciones = VariacionesMensuales(
        income=calc.variacion_porcentual(mes.income_total, anterior_mes.income_total)
        if anterior_mes
        else None,
        expense=calc.variacion_porcentual(mes.expense_total, anterior_mes.expense_total)
        if anterior_mes
        else None,
        saving=calc.variacion_porcentual(mes.saving_total, anterior_mes.saving_total)
        if anterior_mes
        else None,
    )

    categorias = repos_categorias.listar(sesion)
    categorias_por_id = {c.id: c for c in categorias}
    totales_por_categoria = repos_totales.listar_por_mes(sesion, mes.id)
    # Para la variación de cada categoría contra el mes anterior
    # (F07-T01): sin mes anterior, o con una categoría que no tuvo
    # total ese mes, el diccionario no tiene esa clave y
    # `_desglose_por_categoria` la trata como cero —mismo "nunca hubo
    # nada con qué comparar" que ya usa `variaciones` unas líneas
    # arriba, sólo que acá por categoría en vez de por mes entero.
    totales_anteriores_por_categoria = (
        {t.category_id: t.total_amount for t in repos_totales.listar_por_mes(sesion, anterior_mes.id)}
        if anterior_mes
        else {}
    )

    if mes.status == HISTORICO:
        # Regla 4: un mes consolidado no tiene movimientos
        # individuales, y no se inventan.
        movimientos: list[Transaction] = []
        diario = None
    else:
        movimientos = repos_movimientos.listar_por_mes(sesion, mes.id)
        dias = dias_transcurridos(periodo_pedido, ahora)
        ingresos_por_dia, egresos_por_dia = _por_dia(movimientos, dias)
        serie = calc.serie_de_ahorro_diaria(mes.status, ingresos_por_dia, egresos_por_dia)
        assert serie is not None  # mes.status == ABIERTO acá, nunca None
        diario = SerieDiaria(
            days=dias,
            income=ingresos_por_dia,
            expense=egresos_por_dia,
            saving_cumulative=serie,
            peak_expense=_pico_de_gasto(egresos_por_dia),
            days_without_expense=sum(1 for e in egresos_por_dia if e == 0),
        )

    return Dashboard(
        mes=mes,
        es_el_mes_actual=periodo_pedido == periodo_actual,
        anterior=Periodo(anterior_mes.year, anterior_mes.month) if anterior_mes else None,
        siguiente=Periodo(siguiente_mes.year, siguiente_mes.month) if siguiente_mes else None,
        actual=periodo_actual,
        tasa_de_ahorro=calc.tasa_de_ahorro(mes.income_total, mes.saving_total),
        ahorro_acumulado=acumulado,
        valor_de_inversiones=valor_inversiones,
        patrimonio_neto=patrimonio,
        variaciones=variaciones,
        diario=diario,
        ultimos_seis_meses=_ultimos_seis(hasta_aqui),
        categorias=_desglose_por_categoria(
            totales_por_categoria, categorias_por_id, movimientos, mes, totales_anteriores_por_categoria
        ),
    )
