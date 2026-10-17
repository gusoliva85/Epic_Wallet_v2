"""Inversiones · F10-T04.

Referencia: 02_Documento_Tecnico.md §6.2 · General §20, §21, §22

Cartera actual, sin bitácora: General §21 es explícito —"no se
conservará un historial financiero de compras y ventas"—, así que
vender es un `DELETE` de verdad (`repos.eliminar`), no un `active =
false`. La columna `active` que sí existe acá es para el día de F10
en que una posición pueda quedar pausada sin venderse (p. ej., un
instrumento sin cotización por un tiempo), no para guardar historial.

Dos formas de valuación (`valuation_mode`): por precio unitario
(`current_unit_price` por `nominal_quantity`, el caso con cotización) o
por un valor cargado a mano. `current_unit_price` admite `NULL`: una
posición recién creada en modo "unit_price" todavía no tiene cotización
hasta la primera actualización (automática, después del MVP, o
manual, F10-T06) — `services.calc.valor_de_inversion` (F10-T01) ya
resuelve ese caso cayendo al valor manual.
"""

from __future__ import annotations

import datetime as dt
import decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, esquema_actual

TIPOS = ("obligacion_negociable", "bono", "cedear", "accion", "fci", "otro")
MODOS_DE_VALUACION = ("unit_price", "manual")


def _esquema_punto() -> str:
    e = esquema_actual()
    return f"{e}." if e else ""


class Investment(Base):
    """Una posición de la cartera, propia de cada usuario."""

    __tablename__ = "investments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey(f"{_esquema_punto()}profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    symbol: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    investment_type: Mapped[str] = mapped_column(Text, nullable=False)

    # numeric(18,4): nominales con más decimales que la plata (FCI,
    # cripto futura), nunca float.
    nominal_quantity: Mapped[decimal.Decimal] = mapped_column(
        Numeric(18, 4), nullable=False, server_default="0"
    )
    # numeric(14,2): plata, igual que el resto de la aplicación.
    initial_value: Mapped[decimal.Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default="0"
    )
    current_unit_price: Mapped[decimal.Decimal | None] = mapped_column(Numeric(18, 6))
    current_value: Mapped[decimal.Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default="0"
    )
    valuation_mode: Mapped[str] = mapped_column(Text, nullable=False, server_default="unit_price")

    price_source: Mapped[str | None] = mapped_column(Text)
    price_updated_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))

    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "investment_type in ('obligacion_negociable','bono','cedear','accion','fci','otro')",
            name="ck_investments_investment_type",
        ),
        CheckConstraint("nominal_quantity >= 0", name="ck_investments_nominal_quantity"),
        CheckConstraint("initial_value >= 0", name="ck_investments_initial_value"),
        CheckConstraint(
            "valuation_mode in ('unit_price','manual')", name="ck_investments_valuation_mode"
        ),
    )

    def __repr__(self) -> str:
        return f"<Investment {self.symbol}>"
