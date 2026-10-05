"""Categorías de ingreso y egreso · F02-T04 (adelantada de F03-T07).

Referencia: 02_Documento_Tecnico.md §6.2 · General §7.1, §7.2

La tabla se crea acá y no en F03-T07 porque el trigger que da de alta
una cuenta inserta sus 21 categorías iniciales: sin la tabla, el
trigger no puede existir. El roadmap lo quedó anotado.

Dos reglas del documento general que viven en la estructura:

- **Una categoría no se borra si tiene histórico, se desactiva.** Por
  eso `active` y no un `delete`: borrarla se llevaría los movimientos
  por la cascada, que es justo lo que no se quiere.
- **El mismo nombre puede existir en los dos tipos.** «Otros» es
  ingreso y es egreso. Por eso la restricción única incluye el tipo.
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, esquema_actual

TIPOS = ("income", "expense")


class Category(Base):
    """Una categoría de movimientos, propia de cada usuario."""

    __tablename__ = "categories"

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
    type: Mapped[str] = mapped_column(Text, nullable=False)

    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint("type in ('income','expense')", name="categories_type"),
        UniqueConstraint("user_id", "type", "name", name="categories_unique_name_per_type"),
        # El índice que usan todas las consultas de la aplicación:
        # «las categorías activas de este usuario, de este tipo, en
        # orden». Sin él, cada pantalla hace un recorrido completo.
        Index("categories_user_type_idx", "user_id", "type", "active", "sort_order"),
    )

    def __repr__(self) -> str:
        return f"<Category {self.type}:{self.name}>"
