"""Vencimiento de un ítem · F13-T03.

Referencia: 02_Documento_Tecnico.md §6.2 · General §29

Una fila por categoría **configurada**, no por categoría: la pantalla
de Vencimientos muestra todas las categorías de egreso del usuario y
sólo las que tienen vencimiento dejan fila acá. Una categoría sin fila
es una categoría sin vencimiento, que es el estado inicial de todas —
así una cuenta nueva no arranca con veintiún filas en cero.

`enabled` existe además de «tener fila o no» porque apagar un
vencimiento no puede perder su configuración: se apaga en marzo, se
prende en abril y el día 10 y los 3 días de aviso siguen ahí.
"""

from __future__ import annotations

import datetime as dt

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, esquema_actual


def _esquema_punto() -> str:
    e = esquema_actual()
    return f"{e}." if e else ""


class CategoryDue(Base):
    """El vencimiento mensual de una categoría de egreso."""

    __tablename__ = "category_dues"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey(f"{_esquema_punto()}profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    # `cascade` y no `restrict` como en `monthly_category_totals`: esto
    # es configuración, no histórico. Si alguna vez se borra una
    # categoría —sólo se puede si no tiene movimientos—, su vencimiento
    # no tiene nada que proteger.
    category_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey(f"{_esquema_punto()}categories.id", ondelete="CASCADE"),
        nullable=False,
    )

    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    # Día del mes. El 31 es válido: en un mes que no lo tiene, el
    # servicio lo recorta al último día (`services.vencimientos`).
    due_day: Mapped[int] = mapped_column(Integer, nullable=False)
    # Cuántos días antes avisar. 0 significa "el día que vence".
    notice_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="3")

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        # Una categoría tiene a lo sumo un vencimiento. Es lo que hace
        # que `PUT /api/dues/{category_id}` pueda ser un upsert sin
        # carreras: dos pedidos a la vez no pueden crear dos filas.
        UniqueConstraint("user_id", "category_id", name="category_dues_unique"),
        CheckConstraint("due_day between 1 and 31", name="category_dues_day"),
        CheckConstraint("notice_days between 0 and 30", name="category_dues_notice"),
    )

    def __repr__(self) -> str:
        return f"<CategoryDue categoria={self.category_id} dia={self.due_day}>"
