"""Esquemas de inversiones · F10-T04, F10-T06.

Referencia: 02_Documento_Tecnico.md §6.2, §9.1 · General §20, §21, §22

Importes como string decimal, mismo motivo que el resto de la
aplicación: JSON no distingue enteros de flotantes y JavaScript
convierte todo a `double`.
"""

from __future__ import annotations

import datetime as dt
import decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..models.investment import TIPOS as TIPOS_DE_INVERSION
from ..models.investment import Investment
from ..services import calc
from ..services.investments import IndicadoresDeCartera


def _importe(valor: decimal.Decimal) -> str:
    return f"{valor:.2f}"


def _porcentaje_opcional(valor: decimal.Decimal | None) -> str | None:
    return None if valor is None else f"{valor:.1f}"


class RespuestaInversion(BaseModel):
    """Una posición, con su rendimiento ya calculado (F10-T01).

    `initial_value` es el precio de compra; `current_value`, el
    precio actual —los dos, importe total de la posición, nunca por
    unidad (revisado 2026-10-20). `nominal_quantity` es informativo."""

    id: int
    symbol: str
    name: str
    investment_type: str
    nominal_quantity: str
    initial_value: str
    current_value: str
    return_amount: str
    return_percentage: str | None
    active: bool
    created_at: dt.datetime
    updated_at: dt.datetime


def respuesta_desde_posicion(p: Investment) -> RespuestaInversion:
    return RespuestaInversion(
        id=p.id,
        symbol=p.symbol,
        name=p.name,
        investment_type=p.investment_type,
        nominal_quantity=f"{p.nominal_quantity:.4f}",
        initial_value=_importe(p.initial_value),
        current_value=_importe(p.current_value),
        return_amount=_importe(calc.rendimiento_de_inversion(p.current_value, p.initial_value)),
        return_percentage=_porcentaje_opcional(
            calc.rendimiento_porcentual(p.current_value, p.initial_value)
        ),
        active=p.active,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


class IndicadoresDeCarteraRespuesta(BaseModel):
    current_value: str
    total_invested: str
    return_amount: str
    return_percentage: str | None
    position_count: int


class RespuestaCartera(BaseModel):
    """`GET /api/investments`: la cartera entera en una sola llamada,
    mismo criterio que `GET /api/dashboard` (F05-T04)."""

    indicators: IndicadoresDeCarteraRespuesta
    positions: list[RespuestaInversion]


def respuesta_cartera_desde(
    indicadores: IndicadoresDeCartera, posiciones: list[Investment]
) -> RespuestaCartera:
    return RespuestaCartera(
        indicators=IndicadoresDeCarteraRespuesta(
            current_value=_importe(indicadores.valor_actual),
            total_invested=_importe(indicadores.total_invertido),
            return_amount=_importe(indicadores.rendimiento),
            return_percentage=_porcentaje_opcional(indicadores.rendimiento_porcentual),
            position_count=indicadores.cantidad_de_posiciones,
        ),
        positions=[respuesta_desde_posicion(p) for p in posiciones],
    )


class AltaDeInversion(BaseModel):
    """`POST /api/investments`: comprar (General §20.1, §23).

    Sin efecto sobre el ahorro (revisado 2026-10-17): la cartera es
    información, no bitácora de gastos. Lo que se deposita en la
    cuenta de inversión se carga aparte, a mano, en Movimientos.

    `initial_value` es el precio de compra: el importe total que
    salió toda la posición (revisado 2026-10-20, no hay modo de
    valuación ni precio unitario). `nominal_quantity` es informativo,
    opcional."""

    model_config = ConfigDict(extra="forbid")

    symbol: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=120)
    investment_type: str
    initial_value: decimal.Decimal = Field(gt=0)
    nominal_quantity: decimal.Decimal = decimal.Decimal("0")

    @field_validator("investment_type")
    @classmethod
    def _tipo(cls, v: str) -> str:
        if v not in TIPOS_DE_INVERSION:
            raise ValueError(f"el tipo tiene que ser uno de {TIPOS_DE_INVERSION}")
        return v


class EdicionDeInversion(BaseModel):
    """`PUT /api/investments/{id}`: nombre y actualización manual del
    precio actual (F10-T06, no toca el ahorro del mes — nunca pasa por
    `transactions`)."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    current_value: decimal.Decimal | None = Field(default=None, gt=0)
    active: bool | None = None

