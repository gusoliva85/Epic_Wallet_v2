"""Repositorio de preferencias · F11-T01.

Sólo consultas y escrituras lisas; ninguna decide qué claves existen
ni qué valores son válidos (`services.settings`). Ninguna filtra por
`user_id`: RLS hace el resto.
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AppSetting


def listar(sesion: Session) -> dict[str, Any]:
    filas = sesion.scalars(select(AppSetting))
    return {fila.key: fila.value for fila in filas}


def guardar(sesion: Session, *, user_id: str, key: str, value: Any) -> None:
    """Upsert por `(user_id, key)`: la pide la base con su índice único,
    acá sólo se busca la fila para decidir si crea o pisa."""
    fila = sesion.scalars(select(AppSetting).where(AppSetting.key == key)).one_or_none()
    if fila is None:
        sesion.add(AppSetting(user_id=user_id, key=key, value=value))
    else:
        fila.value = value
    sesion.flush()


def borrar(sesion: Session, key: str) -> None:
    fila = sesion.scalars(select(AppSetting).where(AppSetting.key == key)).one_or_none()
    if fila is not None:
        sesion.delete(fila)
        sesion.flush()
