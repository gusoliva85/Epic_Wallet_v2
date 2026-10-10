"""Totales por categoría de un mes · F04-T03.

Referencia: 02_Documento_Tecnico.md §6.2

Una fila por categoría con movimiento en el mes. `is_manual_summary`
distingue de dónde sale el número, no cuántas filas hay:

- mes `open`: `false`, el total lo recalcula F04-T05 desde
  `transactions` cada vez que algo cambia.
- mes `historical`: `true`, lo cargó el usuario a mano al consolidar
  el mes (Fase 8) y no hay `transactions` detrás.
"""

from __future__ import annotations

import datetime as dt
import decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, esquema_actual


def _esquema_punto() -> str:
    e = esquema_actual()
    return f"{e}." if e else ""


class MonthlyCategoryTotal(Base):
    """El total de una categoría dentro de un mes, abierto o histórico."""

    __tablename__ = "monthly_category_totals"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey(f"{_esquema_punto()}profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    month_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(f"{_esquema_punto()}months.id", ondelete="CASCADE"),
        nullable=False,
    )
    category_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(f"{_esquema_punto()}categories.id", ondelete="RESTRICT"),
        nullable=False,
    )

    # numeric(14,2): nunca float con plata de por medio.
    total_amount: Mapped[decimal.Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default="0"
    )
    is_manual_summary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (UniqueConstraint("month_id", "category_id", name="mct_unique"),)

    def __repr__(self) -> str:
        return f"<MonthlyCategoryTotal month={self.month_id} category={self.category_id}>"


Index(
    "mct_month_idx",
    MonthlyCategoryTotal.user_id,
    MonthlyCategoryTotal.month_id,
)
