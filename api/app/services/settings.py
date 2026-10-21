"""Servicio de preferencias · F11-T01.

Referencia: 02_Documento_Tecnico.md §6.2 · General §42

La tabla `app_settings` es una clave/valor abierta, pero la cuenta
sólo tiene hoy una preferencia real: el tema. Este servicio es el
único lugar que sabe eso — el repositorio no distingue una clave de
otra, y el esquema de la API (`schemas/settings.py`) sólo tipa lo que
entra y sale por HTTP.
"""

from __future__ import annotations

from typing import Literal

from sqlalchemy.orm import Session

from ..repos import app_settings as repos

CLAVE_TEMA = "theme"

Tema = Literal["light", "dark"]


def tema_guardado(sesion: Session) -> Tema | None:
    valor = repos.listar(sesion).get(CLAVE_TEMA)
    return valor if valor in ("light", "dark") else None


def guardar_tema(sesion: Session, user_id: str, tema: Tema | None) -> None:
    """`None` borra la preferencia: la cuenta vuelve a seguir el tema
    del dispositivo, en vez de guardar un valor vacío sin sentido."""
    if tema is None:
        repos.borrar(sesion, CLAVE_TEMA)
    else:
        repos.guardar(sesion, user_id=user_id, key=CLAVE_TEMA, value=tema)
