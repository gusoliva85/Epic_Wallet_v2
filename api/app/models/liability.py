"""Pasivos · F09-T03.

Referencia: 02_Documento_Tecnico.md §6.2 · General §5.3

La tabla se crea vacía y preparada, pero no se muestra en la
interfaz en el MVP: General §5.3 pide que "la arquitectura deje el
concepto de pasivos preparado para el futuro, aunque no se muestre
inicialmente". `patrimonio_neto` ya la resta de verdad desde que esta
tabla existe (`services.calc.total_de_pasivos`), así que el día que
haya una pantalla para cargar un pasivo no hace falta tocar ningún
cálculo — sólo dejar de estar siempre vacía.
"""

from __future__ import annotations

import datetime as dt
import decimal

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, esquema_actual


class Liability(Base):
    """Un pasivo del usuario. Hoy, en la práctica, no tiene filas."""

    __tablename__ = "liabilities"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey(
            f"{esquema_actual()}.profiles.id" if esquema_actual() else "profiles.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    name: Mapped[str] = mapped_column(Text, nullable=False)
    # numeric(14,2): nunca float con plata de por medio.
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(14, 2), nullable=False, server_default="0")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<Liability {self.name}>"
