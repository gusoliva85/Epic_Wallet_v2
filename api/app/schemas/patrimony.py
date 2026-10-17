"""Esquema de `GET /api/patrimony` · F09-T03.

Referencia: 02_Documento_Tecnico.md §9.1

Mismo criterio que `schemas/dashboard.py`: importes como string decimal
con dos decimales, porcentajes con uno, y `None` donde no corresponde
un número —nunca "0.0" en lugar de "no hay nada que repartir".
"""

from __future__ import annotations

import decimal

from pydantic import BaseModel

from ..services import patrimony as servicio


def _importe(valor: decimal.Decimal) -> str:
    return f"{valor:.2f}"


def _porcentaje_opcional(valor: decimal.Decimal | None) -> str | None:
    return None if valor is None else f"{valor:.1f}"


class ComposicionDelPatrimonio(BaseModel):
    savings_share: str | None
    investments_share: str | None


class RespuestaPatrimonio(BaseModel):
    savings_balance: str
    investments_value: str
    liabilities_total: str
    net_worth: str
    composition: ComposicionDelPatrimonio


def respuesta_desde(p: servicio.Patrimonio) -> RespuestaPatrimonio:
    return RespuestaPatrimonio(
        savings_balance=_importe(p.ahorro),
        investments_value=_importe(p.inversiones),
        liabilities_total=_importe(p.pasivos),
        net_worth=_importe(p.total),
        composition=ComposicionDelPatrimonio(
            savings_share=_porcentaje_opcional(p.porcentaje_ahorro),
            investments_share=_porcentaje_opcional(p.porcentaje_inversiones),
        ),
    )
