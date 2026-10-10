"""Movimientos · F04-T03.

Referencia: 02_Documento_Tecnico.md §6.2 · General §8

Sólo existen para meses `open`: un mes `historical` no tiene filas
acá, tiene sus totales cargados a mano en `months` y
`monthly_category_totals` (`services.months` ya resuelve esa
distinción). El repositorio que arme `services.transactions.Movimiento`
a partir de estas filas llega en F04-T05.

`transaction_type` repite el mismo literal que `category.TIPOS`
(`income`/`expense`) en vez de importarlo: mismo criterio que
`month.py` con `ESTADOS` — evita un acoplamiento que no hace falta
para dos valores que no van a cambiar.
"""

from __future__ import annotations

import datetime as dt
import decimal

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, esquema_actual

TIPOS = ("income", "expense")
ORIGENES = ("manual", "mercado_pago", "system", "import")


def _esquema_punto() -> str:
    e = esquema_actual()
    return f"{e}." if e else ""


class Transaction(Base):
    """Un movimiento de ingreso o egreso, siempre dentro de un mes
    `open`. El importe es siempre positivo: el signo contable lo
    decide `transaction_type`, nunca el número (General §8.4)."""

    __tablename__ = "transactions"

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
    # on delete restrict: una categoría con movimientos no se puede
    # borrar (F03-T08 ya lo exige desde el lado de categories; esto es
    # lo que lo hace cumplir desde el lado de transactions).
    category_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(f"{_esquema_punto()}categories.id", ondelete="RESTRICT"),
        nullable=False,
    )

    transaction_date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    transaction_type: Mapped[str] = mapped_column(Text, nullable=False)

    # numeric(14,2): nunca float con plata de por medio.
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    description: Mapped[str | None] = mapped_column(Text)

    source: Mapped[str] = mapped_column(Text, nullable=False, server_default="manual")
    # Anti-duplicación de importaciones futuras (Mercado Pago, Excel):
    # el identificador de origen, único junto con user_id y source.
    external_id: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("transaction_type in ('income','expense')", name="transaction_type"),
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint(
            "source in ('manual','mercado_pago','system','import')", name="source"
        ),
        UniqueConstraint("user_id", "source", "external_id", name="transactions_external_unique"),
    )

    def __repr__(self) -> str:
        return f"<Transaction {self.transaction_type} {self.amount} ({self.transaction_date})>"


Index(
    "transactions_month_idx",
    Transaction.user_id,
    Transaction.month_id,
    Transaction.transaction_date.desc(),
    Transaction.id.desc(),
)
Index(
    "transactions_category_idx",
    Transaction.user_id,
    Transaction.category_id,
    Transaction.transaction_date.desc(),
)
Index("transactions_search_idx", Transaction.user_id, Transaction.description)
