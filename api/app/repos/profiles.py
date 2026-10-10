"""Repositorio de perfiles · F05-T04.

Referencia: 02_Documento_Tecnico.md §5.1

Sólo una consulta: el dashboard necesita `opening_balance` para el
ahorro acumulado. El resto de `profiles` (`GET`/`PATCH /api/me`) sigue
consultando directo desde `routers/me.py`, sin pasar por acá — no hace
falta tocar ese archivo para agregar esto.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Profile


def buscar(sesion: Session) -> Profile | None:
    return sesion.scalars(select(Profile)).one_or_none()
