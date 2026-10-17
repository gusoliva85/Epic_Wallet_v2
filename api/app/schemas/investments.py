"""Esquemas de inversiones · F10-T04, F10-T06.

Referencia: 02_Documento_Tecnico.md §6.2, §9.1 · General §20, §21, §22

Importes como string decimal, mismo motivo que el resto de la
aplicación: JSON no distingue enteros de flotantes y JavaScript
convierte todo a `double`.
"""

from __future__ import annotations

import datetime as dt
import decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from ..models.investment import MODOS_DE_VALUACION, Investment
from ..models.investment import TIPOS as TIPOS_DE_INVERSION
from ..services import calc
from ..services.investments import IndicadoresDeCartera


def _importe(valor: decimal.Decimal) -> str:
    return f"{valor:.2f}"


def _importe_opcional(valor: decimal.Decimal | None) -> str | None:
    return None if valor is None else f"{valor:.6f}"


def _porcentaje_opcional(valor: decimal.Decimal | None) -> str | None:
    return None if valor is None else f"{valor:.1f}"


class RespuestaInversion(BaseModel):
    """Una posición, con su rendimiento ya calculado (F10-T01)."""

    id: int
    symbol: str
    name: str
    investment_type: str
    nominal_quantity: str
    initial_value: str
    current_unit_price: str | None
    current_value: str
    valuation_mode: str
    return_amount: str
    return_percentage: str | None
    price_source: str | None
    price_updated_at: dt.datetime | None
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
        current_unit_price=_importe_opcional(p.current_unit_price),
        current_value=_importe(p.current_value),
        valuation_mode=p.valuation_mode,
        return_amount=_importe(calc.rendimiento_de_inversion(p.current_value, p.initial_value)),
        return_percentage=_porcentaje_opcional(
            calc.rendimiento_porcentual(p.current_value, p.initial_value)
        ),
        price_source=p.price_source,
        price_updated_at=p.price_updated_at,
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

    `affect_savings` por defecto `True` —el caso normal, comprás algo
    nuevo con plata que tenías ahorrada—; en `False` es para cargar
    una posición que ya tenías antes de usar la aplicación, sin que
    eso reste del ahorro del mes actual."""

    model_config = ConfigDict(extra="forbid")

    symbol: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=120)
    investment_type: str
    valuation_mode: str
    nominal_quantity: decimal.Decimal = decimal.Decimal("0")
    current_unit_price: decimal.Decimal | None = Field(default=None, gt=0)
    manual_value: decimal.Decimal = decimal.Decimal("0")
    affect_savings: bool = True

    @field_validator("investment_type")
    @classmethod
    def _tipo(cls, v: str) -> str:
        if v not in TIPOS_DE_INVERSION:
            raise ValueError(f"el tipo tiene que ser uno de {TIPOS_DE_INVERSION}")
        return v

    @field_validator("valuation_mode")
    @classmethod
    def _modo(cls, v: str) -> str:
        if v not in MODOS_DE_VALUACION:
            raise ValueError(f"valuation_mode tiene que ser uno de {MODOS_DE_VALUACION}")
        return v

    @model_validator(mode="after")
    def _valor_coherente(self) -> AltaDeInversion:
        if self.valuation_mode == "unit_price":
            if self.nominal_quantity <= 0 or self.current_unit_price is None:
                raise ValueError(
                    "con valuation_mode 'unit_price' hacen falta nominal_quantity y "
                    "current_unit_price, los dos mayores que cero"
                )
        elif self.manual_value <= 0:
            raise ValueError("con valuation_mode 'manual' hace falta manual_value mayor que cero")
        return self


class EdicionDeInversion(BaseModel):
    """`PUT /api/investments/{id}`: nombre y actualización manual de
    valor (F10-T06, no toca el ahorro del mes — nunca pasa por
    `transactions`). Mandar `current_unit_price` recalcula
    `current_value` con los nominales ya cargados; mandar
    `current_value` lo pisa directo (el caso de una posición
    `valuation_mode: manual`)."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=120)
    current_value: decimal.Decimal | None = Field(default=None, gt=0)
    current_unit_price: decimal.Decimal | None = Field(default=None, gt=0)
    active: bool | None = None


class RespuestaVenta(BaseModel):
    """`DELETE /api/investments/{id}`: cuánto se acreditó (o no) al
    ahorro."""

    amount: str
    affected_savings: bool
