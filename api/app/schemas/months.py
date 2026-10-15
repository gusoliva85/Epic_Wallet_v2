"""Esquemas de meses · F03-T05.

Referencia: 02_Documento_Tecnico.md §6.6, §9.1

Importes como string decimal, igual que `schemas/me.py` y por el mismo
motivo: JSON no distingue enteros de flotantes y JavaScript convierte
todo a `double`, así que un importe puede volver con un centavo de
diferencia. Como string, lo que sale es exactamente lo que había.
"""

from __future__ import annotations

import datetime as dt
import decimal

from pydantic import BaseModel, ConfigDict, field_serializer, field_validator, model_validator

from ..services.months import totales_historicos_son_validos


class MesResumen(BaseModel):
    """Una fila de `GET /api/months`: lo que la lista necesita, sin
    movimientos ni totales por categoría —eso es el detalle."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    year: int
    month: int
    status: str
    income_total: decimal.Decimal
    expense_total: decimal.Decimal
    saving_total: decimal.Decimal
    # Es "el saldo acumulado" que pide la Técnico §9.1: sale tal cual
    # de la columna. Queda al día en cuanto se carga o corrige un mes
    # histórico (F08-T03, `services.months.recalcular_saldos_acumulados`
    # lo encadena y lo guarda); si después cambia un movimiento del mes
    # en curso sin que se toque ningún histórico, este número puede
    # quedar atrás hasta la próxima carga histórica —el mes en curso es
    # siempre el último cronológicamente, así que mientras tanto
    # `GET /api/dashboard` y `GET /api/months/savings-evolution` siguen
    # mostrando el acumulado real, calculado al vuelo.
    closing_balance: decimal.Decimal

    @field_serializer("income_total", "expense_total", "saving_total", "closing_balance")
    def _importe_como_texto(self, valor: decimal.Decimal) -> str:
        return f"{valor:.2f}"


class SaldoMensual(BaseModel):
    """Un punto de `GET /api/months/savings-evolution`: el saldo
    acumulado al final de ese mes, para el gráfico de evolución del
    ahorro (General §54, Gráfico 4)."""

    model_config = ConfigDict(from_attributes=True)

    year: int
    month: int
    balance: decimal.Decimal

    @field_serializer("balance")
    def _balance_como_texto(self, valor: decimal.Decimal) -> str:
        return f"{valor:.2f}"


class MesDetalle(MesResumen):
    """`GET /api/months/{id}`: lo del resumen, más lo que falta para
    ver el mes entero."""

    opening_balance: decimal.Decimal
    created_at: dt.datetime
    updated_at: dt.datetime

    # El contrato de la Técnico §6.6, textual: `None` para un mes
    # histórico ("no tiene movimientos individuales"), una lista para
    # uno abierto (vacía mientras no exista `transactions`, que es
    # F04). Default en `None` para que `model_validate(mes,
    # from_attributes=True)` no falle buscando un atributo que el
    # modelo de SQLAlchemy no tiene —el router lo pisa después con
    # `transacciones_del_mes()`, nunca lo dejan puesto por descuido.
    transactions: list[dict[str, object]] | None = None

    @field_serializer("opening_balance")
    def _opening_como_texto(self, valor: decimal.Decimal) -> str:
        return f"{valor:.2f}"


class TotalDeCategoriaHistorico(BaseModel):
    """Un total manual por categoría, parte de la carga de un mes
    histórico (General §18)."""

    model_config = ConfigDict(extra="forbid")

    category_id: int
    total_amount: decimal.Decimal

    @field_validator("total_amount")
    @classmethod
    def _total_no_negativo(cls, v: decimal.Decimal) -> decimal.Decimal:
        if v < 0:
            raise ValueError("el total de una categoría no puede ser negativo")
        return v


class CargaDeMesHistorico(BaseModel):
    """Lo que acepta `POST /api/months/historical` (Técnico §9.1):
    crea el mes consolidado si no existe, o lo actualiza si ya existe
    como histórico."""

    model_config = ConfigDict(extra="forbid")

    year: int
    month: int
    income_total: decimal.Decimal
    expense_total: decimal.Decimal
    saving_total: decimal.Decimal
    categories: list[TotalDeCategoriaHistorico] = []
    # True para reemplazar un mes `open` que ya tiene movimientos
    # cargados (General §6.3, Regla 4 de la §50): sin esto, la API
    # rechaza la carga en vez de pisarlos en silencio
    # (F08-T01, `requiere_confirmacion_para_historico`). Los
    # movimientos no se borran —quedan en la base, sin mostrarse—,
    # sólo deja de leerlos el contrato de mes histórico (Técnico §6.6).
    confirm: bool = False

    @model_validator(mode="after")
    def _totales_no_negativos(self) -> CargaDeMesHistorico:
        if not totales_historicos_son_validos(self.income_total, self.expense_total, self.saving_total):
            raise ValueError("los totales de un mes histórico no pueden ser negativos")
        return self


class CorreccionDeMesHistorico(BaseModel):
    """Lo que acepta `PATCH /api/months/{id}`: corrige los totales de
    un mes que ya es histórico (General §6.3 — "un mes histórico podrá
    editarse si el usuario detecta un error")."""

    model_config = ConfigDict(extra="forbid")

    income_total: decimal.Decimal
    expense_total: decimal.Decimal
    saving_total: decimal.Decimal
    categories: list[TotalDeCategoriaHistorico] = []

    @model_validator(mode="after")
    def _totales_no_negativos(self) -> CorreccionDeMesHistorico:
        if not totales_historicos_son_validos(self.income_total, self.expense_total, self.saving_total):
            raise ValueError("los totales de un mes histórico no pueden ser negativos")
        return self
