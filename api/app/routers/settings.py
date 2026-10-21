"""Preferencias · F11-T01.

Referencia: 02_Documento_Tecnico.md §9.1 · General §42

    GET /api/settings   la preferencia guardada (hoy, el tema)
    PUT /api/settings   la guarda o la borra

`theme: null` en el `PUT` borra la preferencia: la cuenta vuelve a
seguir el tema del dispositivo en vez de guardar un valor vacío.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..core.db import SesionDeUsuario
from ..core.security import UsuarioDelToken
from ..schemas.settings import CambioDePreferencias, RespuestaPreferencias
from ..services import settings as servicio
from .me import asegurar_perfil_y_categorias

router = APIRouter(prefix="/settings", tags=["preferencias"])


@router.get("", response_model=RespuestaPreferencias, summary="La preferencia guardada")
def leer_preferencias(sesion: SesionDeUsuario, usuario: UsuarioDelToken) -> RespuestaPreferencias:
    asegurar_perfil_y_categorias(sesion, usuario)
    return RespuestaPreferencias(theme=servicio.tema_guardado(sesion))


@router.put("", response_model=RespuestaPreferencias, summary="Guardarla o borrarla")
def guardar_preferencias(
    cambios: CambioDePreferencias, sesion: SesionDeUsuario, usuario: UsuarioDelToken
) -> RespuestaPreferencias:
    asegurar_perfil_y_categorias(sesion, usuario)
    servicio.guardar_tema(sesion, usuario.id, cambios.theme)
    return RespuestaPreferencias(theme=servicio.tema_guardado(sesion))
