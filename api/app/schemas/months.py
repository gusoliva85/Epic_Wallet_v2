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

from pydantic import BaseModel, ConfigDict, field_serializer


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
    # Es "el saldo acumulado" que pide la Técnico §9.1: hoy sale tal
    # cual de la columna, porque todavía no existe el servicio de
    # recálculo (F04) que lo encadena entre meses. No está mal, está
    # incompleto a propósito: esta tarea no lo calcula, lo expone.
    closing_balance: decimal.Decimal

    @field_serializer("income_total", "expense_total", "saving_total", "closing_balance")
    def _importe_como_texto(self, valor: decimal.Decimal) -> str:
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
