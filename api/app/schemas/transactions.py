"""Esquemas de movimientos · F04-T06.

Referencia: 02_Documento_Tecnico.md §6.2, §9.1, §9.4

Importes como string decimal, mismo motivo que `schemas/months.py`:
JSON no distingue enteros de flotantes y JavaScript redondea a
`double`, así que un importe puede volver con un centavo de
diferencia. Como string, lo que sale es exactamente lo que había.
"""

from __future__ import annotations

import datetime as dt
import decimal

from pydantic import BaseModel, ConfigDict, field_serializer, field_validator

from ..services.transactions import LARGO_MAXIMO_DESCRIPCION, descripcion_valida, importe_valido

TIPOS = ("income", "expense")


def _importe_como_texto(valor: decimal.Decimal) -> str:
    return f"{valor:.2f}"


class Movimiento(BaseModel):
    """Lo que devuelven `GET`, dentro de `RespuestaDeMovimiento`."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    month_id: int
    category_id: int
    transaction_date: dt.date
    transaction_type: str
    amount: decimal.Decimal
    description: str | None
    source: str
    created_at: dt.datetime
    updated_at: dt.datetime

    @field_serializer("amount")
    def _serializar_importe(self, valor: decimal.Decimal) -> str:
        return _importe_como_texto(valor)


class TotalesDelMes(BaseModel):
    """Los tres totales que cambian con cada escritura — el criterio
    de aceptación de la tarea pide devolverlos siempre, para que el
    frontend actualice los indicadores sin pedir el mes de nuevo."""

    income_total: decimal.Decimal
    expense_total: decimal.Decimal
    saving_total: decimal.Decimal

    @field_serializer("income_total", "expense_total", "saving_total")
    def _serializar(self, valor: decimal.Decimal) -> str:
        return _importe_como_texto(valor)


class RespuestaDeMovimiento(BaseModel):
    """Lo que devuelven `POST` y `PUT`."""

    transaction: Movimiento
    month_totals: TotalesDelMes


class RespuestaDeBaja(BaseModel):
    """Lo que devuelve `DELETE`: sin `transaction` —ya no existe—,
    pero con los totales nuevos, mismo criterio que arriba."""

    month_totals: TotalesDelMes


def _validar_tipo(valor: str) -> str:
    if valor not in TIPOS:
        raise ValueError("el tipo tiene que ser 'income' o 'expense'")
    return valor


def _validar_importe(valor: decimal.Decimal) -> decimal.Decimal:
    if not importe_valido(valor):
        raise ValueError("el importe tiene que ser mayor que cero")
    return valor


def _validar_descripcion(valor: str | None) -> str | None:
    limpio = valor.strip() if valor else None
    if not descripcion_valida(limpio):
        raise ValueError(f"la descripción no puede superar los {LARGO_MAXIMO_DESCRIPCION} caracteres")
    return limpio or None


class _DatosDeMovimiento(BaseModel):
    """Los campos en común entre alta y edición: `PUT` reemplaza todos
    los editables, no es un `PATCH` parcial — el formulario de edición
    los manda siempre completos (F04-T12)."""

    model_config = ConfigDict(extra="forbid")

    category_id: int
    transaction_date: dt.date
    transaction_type: str
    amount: decimal.Decimal
    description: str | None = None

    @field_validator("transaction_type")
    @classmethod
    def _tipo(cls, v: str) -> str:
        return _validar_tipo(v)

    @field_validator("amount")
    @classmethod
    def _importe(cls, v: decimal.Decimal) -> decimal.Decimal:
        return _validar_importe(v)

    @field_validator("description")
    @classmethod
    def _descripcion(cls, v: str | None) -> str | None:
        return _validar_descripcion(v)


class AltaDeMovimiento(_DatosDeMovimiento):
    """Lo que acepta `POST /api/transactions`."""


class CambioDeMovimiento(_DatosDeMovimiento):
    """Lo que acepta `PUT /api/transactions/{id}`."""
