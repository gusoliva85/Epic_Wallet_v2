"""Meses · F03-T03.

Referencia: 02_Documento_Tecnico.md §6.2, §6.6 · General §6, §33, §50 (R1)

Las dos naturalezas del mes —de dónde salen los totales, qué se
devuelve en `transactions`— viven en `app.services.months`, no acá:
este archivo sólo declara la columna `status` y su `check`. Los
valores van literales (`"open"`, `"historical"`) y no importados de
`services.months`, aunque son los mismos dos: importar de ahí crearía
un ciclo (`services.months` necesita este modelo para la función que
abre el mes, y este modelo necesitaría `services.months` para los
literales). Es la misma solución que ya usa `category.py` con sus
`TIPOS` propios.

Si alguna vez cambia alguno de los dos nombres, hay que tocar los dos
lugares: `test_months_repo.py` lo nota si se olvida uno.
"""

from __future__ import annotations

import datetime as dt
import decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, esquema_actual

# Mismos dos valores que `ABIERTO`/`HISTORICO` en services/months.py.
ESTADOS = ("open", "historical")


class Month(Base):
    """Un mes de un usuario: abierto (transaccional) o histórico
    (consolidado). Cuál es cuál, y qué implica cada uno, está en
    `app.services.months` — acá sólo la forma de la fila."""

    __tablename__ = "months"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey(
            f"{esquema_actual()}.profiles.id" if esquema_actual() else "profiles.id",
            ondelete="CASCADE",
        ),
        nullable=False,
    )

    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="open")

    # numeric(14,2): nunca float con plata de por medio (Técnico §6.1).
    income_total: Mapped[decimal.Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default="0"
    )
    expense_total: Mapped[decimal.Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default="0"
    )
    saving_total: Mapped[decimal.Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default="0"
    )
    opening_balance: Mapped[decimal.Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default="0"
    )
    closing_balance: Mapped[decimal.Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default="0"
    )

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        # Sin el prefijo "months_" en el `name`: la convención de
        # `base.py` ya antepone "ck_months_" sola. Escribirlo las dos
        # veces da "ck_months_months_year_range" —es lo que le pasa hoy
        # a `category.py` con su check de `type`, verificado al
        # compilar el modelo; no se repite acá.
        CheckConstraint("year between 2000 and 2100", name="year_range"),
        CheckConstraint("month between 1 and 12", name="month_range"),
        CheckConstraint("status in ('open','historical')", name="status"),
        # Regla 1 del documento general: un mes por año/mes, por usuario.
        UniqueConstraint("user_id", "year", "month", name="months_unique_per_user"),
    )

    def __repr__(self) -> str:
        return f"<Month {self.year}-{self.month:02d} ({self.status})>"


# El índice que usa la barra de mes y el historial: "los meses de este
# usuario, del más nuevo al más viejo" (Técnico §6.2). Va fuera de
# `__table_args__` porque el orden descendente se expresa con
# `Column.desc()`, y eso recién existe sobre el atributo de la clase ya
# declarada, no dentro de su propio cuerpo.
Index("months_user_period_idx", Month.user_id, Month.year.desc(), Month.month.desc())
