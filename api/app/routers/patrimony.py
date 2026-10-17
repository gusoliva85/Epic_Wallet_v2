"""Patrimonio · F09-T03.

Referencia: 02_Documento_Tecnico.md §9.1

    GET /api/patrimony   ahorros, inversiones, pasivos, patrimonio neto y composición

Sin parámetros: es una foto de ahora, no navega por mes (a diferencia
de `GET /api/dashboard`). Todo el trabajo vive en
`services.patrimony.armar`; este router sólo traduce la salida.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..core.db import SesionDeUsuario
from ..core.security import UsuarioDelToken
from ..schemas.patrimony import RespuestaPatrimonio, respuesta_desde
from ..services import patrimony as servicio
from .me import asegurar_perfil_y_categorias

router = APIRouter(prefix="/patrimony", tags=["patrimonio"])


@router.get("", response_model=RespuestaPatrimonio, summary="Ahorros, inversiones, pasivos y patrimonio neto")
def leer_patrimonio(sesion: SesionDeUsuario, usuario: UsuarioDelToken) -> RespuestaPatrimonio:
    # Mismo motivo que en `routers/dashboard.py`: sin perfil, abrir el
    # mes actual fallaría con una violación de clave foránea en vez de
    # resolverse solo.
    asegurar_perfil_y_categorias(sesion, usuario)

    resultado = servicio.armar(sesion, usuario.id)
    return respuesta_desde(resultado)
