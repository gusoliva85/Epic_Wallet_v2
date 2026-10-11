"""Esquema de `GET /api/dashboard` · F05-T04.

Referencia: 02_Documento_Tecnico.md §9.2

Importes como string decimal con dos decimales, porcentajes con uno
—mismo formato que trae el ejemplo de la sección 9.2 ("31.7", no
"31.70")—, mismo motivo que el resto de los esquemas: JSON no
distingue enteros de flotantes y JavaScript redondea a `double`.
"""

from __future__ import annotations

import datetime as dt
import decimal

from pydantic import BaseModel, ConfigDict

from ..services import dashboard as servicio


def _importe(valor: decimal.Decimal) -> str:
    return f"{valor:.2f}"


def _importe_opcional(valor: decimal.Decimal | None) -> str | None:
    return None if valor is None else _importe(valor)


def _porcentaje_opcional(valor: decimal.Decimal | None) -> str | None:
    return None if valor is None else f"{valor:.1f}"


class MesDelDashboard(BaseModel):
    """El mes que se está mostrando — lo mismo que ya trae
    `GET /api/months/{id}`, más `label`, `consolidated` e `is_current`,
    que ahí no hacen falta y acá sí."""

    id: int
    year: int
    month: int
    label: str
    status: str
    consolidated: bool
    income_total: str
    expense_total: str
    saving_total: str
    saving_rate: str | None
    is_current: bool


class PeriodoDelDashboard(BaseModel):
    year: int
    month: int


class NavegacionDelDashboard(BaseModel):
    previous: PeriodoDelDashboard | None
    next: PeriodoDelDashboard | None
    current: PeriodoDelDashboard


class VariacionesDelDashboard(BaseModel):
    income: str | None
    expense: str | None
    saving: str | None


class IndicadoresDelDashboard(BaseModel):
    """Los seis indicadores de General §12.2. `income`/`expense`/
    `saving` repiten los totales de `month` bajo el nombre con el que
    los pide el contrato de indicadores — es la misma cifra, dos
    lugares, a propósito (Técnico §9.2)."""

    income: str
    expense: str
    saving: str
    savings_balance: str
    investments_value: str
    net_worth: str
    vs_previous: VariacionesDelDashboard


class PicoDeGastoDelDashboard(BaseModel):
    day: int
    amount: str


class DiarioDelDashboard(BaseModel):
    days: int
    income: list[str]
    expense: list[str]
    saving_cumulative: list[str]
    income_cumulative: list[str]
    expense_cumulative: list[str]
    peak_expense: PicoDeGastoDelDashboard | None
    days_without_expense: int


class MesComparativoDelDashboard(BaseModel):
    year: int
    month: int
    label: str
    income: str
    expense: str
    saving: str
    saving_rate: str | None


class CategoriaDelDashboard(BaseModel):
    category_id: int
    name: str
    type: str
    total: str
    share: str | None
    transaction_count: int
    last_date: dt.date | None


class MovimientoDelDashboard(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: dt.date
    type: str
    category_id: int
    category_name: str
    amount: str
    description: str | None
    source: str


class AlertaDelDashboard(BaseModel):
    """Todavía no hay de dónde sacar alertas de verdad —quedaron
    después del MVP (03_Roadmap.md)—, así que el campo existe en el
    contrato pero la lista siempre llega vacía. El día que existan, el
    router las arma con esta misma forma sin tocar el esquema."""

    id: int
    type: str
    severity: str
    title: str
    message: str


class RespuestaDashboard(BaseModel):
    month: MesDelDashboard
    navigation: NavegacionDelDashboard
    indicators: IndicadoresDelDashboard
    daily: DiarioDelDashboard | None
    last_six_months: list[MesComparativoDelDashboard]
    categories: list[CategoriaDelDashboard]
    recent_transactions: list[MovimientoDelDashboard] | None
    alerts: list[AlertaDelDashboard]


def _periodo(periodo: servicio.Periodo | None) -> PeriodoDelDashboard | None:
    return None if periodo is None else PeriodoDelDashboard(year=periodo.year, month=periodo.month)


def _diario(diario: servicio.SerieDiaria | None) -> DiarioDelDashboard | None:
    if diario is None:
        return None
    return DiarioDelDashboard(
        days=diario.days,
        income=[_importe(v) for v in diario.income],
        expense=[_importe(v) for v in diario.expense],
        saving_cumulative=[_importe(v) for v in diario.saving_cumulative],
        income_cumulative=[_importe(v) for v in diario.income_cumulative],
        expense_cumulative=[_importe(v) for v in diario.expense_cumulative],
        peak_expense=(
            PicoDeGastoDelDashboard(day=diario.peak_expense.day, amount=_importe(diario.peak_expense.amount))
            if diario.peak_expense is not None
            else None
        ),
        days_without_expense=diario.days_without_expense,
    )


def respuesta_desde(d: servicio.Dashboard) -> RespuestaDashboard:
    """Traduce el `Dashboard` del servicio (Decimal, `NamedTuple`) al
    esquema de la API (`str`, Pydantic). Separado del servicio a
    propósito: `services/dashboard.py` no sabe que existe JSON."""
    mes = d.mes
    return RespuestaDashboard(
        month=MesDelDashboard(
            id=mes.id,
            year=mes.year,
            month=mes.month,
            label=servicio.etiqueta_de_mes(mes.year, mes.month),
            status=mes.status,
            consolidated=mes.status != "open",
            income_total=_importe(mes.income_total),
            expense_total=_importe(mes.expense_total),
            saving_total=_importe(mes.saving_total),
            saving_rate=_porcentaje_opcional(d.tasa_de_ahorro),
            is_current=d.es_el_mes_actual,
        ),
        navigation=NavegacionDelDashboard(
            previous=_periodo(d.anterior),
            next=_periodo(d.siguiente),
            current=PeriodoDelDashboard(year=d.actual.year, month=d.actual.month),
        ),
        indicators=IndicadoresDelDashboard(
            income=_importe(mes.income_total),
            expense=_importe(mes.expense_total),
            saving=_importe(mes.saving_total),
            savings_balance=_importe(d.ahorro_acumulado),
            investments_value=_importe(d.valor_de_inversiones),
            net_worth=_importe(d.patrimonio_neto),
            vs_previous=VariacionesDelDashboard(
                income=_porcentaje_opcional(d.variaciones.income),
                expense=_porcentaje_opcional(d.variaciones.expense),
                saving=_porcentaje_opcional(d.variaciones.saving),
            ),
        ),
        daily=_diario(d.diario),
        last_six_months=[
            MesComparativoDelDashboard(
                year=m.year,
                month=m.month,
                label=m.label,
                income=_importe(m.income),
                expense=_importe(m.expense),
                saving=_importe(m.saving),
                saving_rate=_porcentaje_opcional(m.saving_rate),
            )
            for m in d.ultimos_seis_meses
        ],
        categories=[
            CategoriaDelDashboard(
                category_id=c.category_id,
                name=c.name,
                type=c.type,
                total=_importe(c.total),
                share=_porcentaje_opcional(c.share),
                transaction_count=c.transaction_count,
                last_date=c.last_date,
            )
            for c in d.categorias
        ],
        recent_transactions=(
            None
            if d.movimientos_recientes is None
            else [
                MovimientoDelDashboard(
                    id=t.id,
                    date=t.transaction_date,
                    type=t.transaction_type,
                    category_id=t.category_id,
                    category_name=_nombre_categoria(d, t.category_id),
                    amount=_importe(t.amount),
                    description=t.description,
                    source=t.source,
                )
                for t in d.movimientos_recientes
            ]
        ),
        alerts=[],
    )


def _nombre_categoria(d: servicio.Dashboard, category_id: int) -> str:
    """El nombre de la categoría de un movimiento reciente. Sale de
    `d.categorias` —el desglose del mes— cuando esa categoría tiene
    movimientos en el mes (el caso normal); si no, es una categoría
    sin total en `monthly_category_totals` por alguna razón rara, y se
    muestra "Categoría" en vez de romper la respuesta entera."""
    coincidencia = next((c for c in d.categorias if c.category_id == category_id), None)
    return coincidencia.name if coincidencia else "Categoría"
