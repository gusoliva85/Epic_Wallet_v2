"""Esquemas de exportación y respaldo · F11-T02.

Referencia: 02_Documento_Tecnico.md §18 · General §58

Importes como string decimal, mismo motivo que el resto de la API.

`id` en categorías, meses, inversiones y pasivos no es el identificador
real de ninguna fila futura: es sólo la clave con la que `month_id` y
`category_id`, dentro de este mismo archivo, se refieren unos a otros.
Al importar, cada fila nace con un `id` nuevo (`services.respaldo`
arma el mapeo); el de acá se descarta en cuanto se usó para conectar
las referencias.
"""

from __future__ import annotations

import datetime as dt
import decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from ..services.settings import Tema

SCHEMA_VERSION = 1


class PerfilRespaldo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    username: str
    display_name: str | None = None
    opening_balance: decimal.Decimal
    timezone: str

    @field_serializer("opening_balance")
    def _importe(self, v: decimal.Decimal) -> str:
        return f"{v:.2f}"


class CategoriaRespaldo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    active: bool
    sort_order: int


class TotalPorCategoriaRespaldo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category_id: int
    total_amount: decimal.Decimal

    @field_serializer("total_amount")
    def _importe(self, v: decimal.Decimal) -> str:
        return f"{v:.2f}"


class MesRespaldo(BaseModel):
    """Un mes exportado. `category_totals` sólo trae filas para un mes
    histórico —son el único dato ahí que no se puede derivar de otra
    cosa—; uno abierto la deja vacía porque `transactions` ya alcanza
    para reconstruirla al importar (`recalcular_y_guardar_mes`)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    year: int
    month: int
    status: str
    income_total: decimal.Decimal
    expense_total: decimal.Decimal
    saving_total: decimal.Decimal
    category_totals: list[TotalPorCategoriaRespaldo] = []

    @field_serializer("income_total", "expense_total", "saving_total")
    def _importe(self, v: decimal.Decimal) -> str:
        return f"{v:.2f}"


class MovimientoRespaldo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    month_id: int
    category_id: int
    transaction_date: dt.date
    transaction_type: str
    amount: decimal.Decimal
    description: str | None = None
    source: str = "manual"

    @field_serializer("amount")
    def _importe(self, v: decimal.Decimal) -> str:
        return f"{v:.2f}"


class InversionRespaldo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    symbol: str
    name: str
    investment_type: str
    nominal_quantity: decimal.Decimal
    initial_value: decimal.Decimal
    current_value: decimal.Decimal
    active: bool

    @field_serializer("nominal_quantity")
    def _nominales(self, v: decimal.Decimal) -> str:
        return f"{v:.4f}"

    @field_serializer("initial_value", "current_value")
    def _importe(self, v: decimal.Decimal) -> str:
        return f"{v:.2f}"


class PasivoRespaldo(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    amount: decimal.Decimal
    active: bool

    @field_serializer("amount")
    def _importe(self, v: decimal.Decimal) -> str:
        return f"{v:.2f}"


class PreferenciasRespaldo(BaseModel):
    theme: Tema | None = None


class Respaldo(BaseModel):
    """`GET /api/export` y el cuerpo de `POST /api/import`."""

    schema_version: int = SCHEMA_VERSION
    exported_at: dt.datetime
    profile: PerfilRespaldo
    categories: list[CategoriaRespaldo] = []
    months: list[MesRespaldo] = []
    transactions: list[MovimientoRespaldo] = []
    investments: list[InversionRespaldo] = []
    liabilities: list[PasivoRespaldo] = []
    settings: PreferenciasRespaldo = Field(default_factory=PreferenciasRespaldo)


class PedidoDeImportacion(BaseModel):
    """`POST /api/import`. `confirm: false` (el valor por defecto) sólo
    valida y devuelve la vista previa, sin escribir nada."""

    model_config = ConfigDict(extra="forbid")

    backup: Respaldo
    confirm: bool = False


class VistaPreviaDeImportacion(BaseModel):
    """Cuántas filas de cada tabla trae el respaldo. `applied` dice si
    ya se escribieron (`confirm: true`) o si esto es sólo la vista
    previa."""

    categories: int
    months: int
    transactions: int
    investments: int
    liabilities: int
    applied: bool
