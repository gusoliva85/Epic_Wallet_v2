"""Repositorio de pasivos · F09-T03. `crear`/`listar_todos` desde F11-T02.

Referencia: 02_Documento_Tecnico.md §6.2

Nadie da de alta un pasivo desde la interfaz todavía —no hay pantalla
propia en el MVP—, pero un respaldo puede traer uno (otro origen de
escritura, F11-T02: `POST /api/import`), así que hace falta `crear`
para poder restaurarlo.
"""

from __future__ import annotations

import decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Liability


def listar_activos(sesion: Session) -> list[Liability]:
    return list(sesion.scalars(select(Liability).where(Liability.active.is_(True))))


def listar_todos(sesion: Session) -> list[Liability]:
    return list(sesion.scalars(select(Liability)))


def crear(
    sesion: Session, *, user_id: str, name: str, amount: decimal.Decimal, active: bool = True
) -> Liability:
    pasivo = Liability(user_id=user_id, name=name, amount=amount, active=active)
    sesion.add(pasivo)
    sesion.flush()
    return pasivo
