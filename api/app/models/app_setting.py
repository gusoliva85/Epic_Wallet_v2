"""Preferencias · F11-T01.

Referencia: 02_Documento_Tecnico.md §6.2 · General §42

Tabla de clave/valor: cada fila es una preferencia (`key`) de una
cuenta, con su valor en JSON. No hay un modelo por preferencia —sería
una migración por cada una— ni una columna por preferencia —la
mayoría quedaría siempre en null—. El esquema expuesto en la API
(`schemas/settings.py`) es el que decide qué claves existen de
verdad; esta tabla sólo las guarda.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

from sqlalchemy import BigInteger, DateTime, ForeignKey, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, esquema_actual


def _esquema_punto() -> str:
    e = esquema_actual()
    return f"{e}." if e else ""


class AppSetting(Base):
    """Una preferencia guardada de una cuenta."""

    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey(f"{_esquema_punto()}profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    key: Mapped[str] = mapped_column(Text, nullable=False)
    value: Mapped[Any] = mapped_column(JSONB, nullable=False)

    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (UniqueConstraint("user_id", "key", name="app_settings_unique"),)

    def __repr__(self) -> str:
        return f"<AppSetting {self.key}>"
