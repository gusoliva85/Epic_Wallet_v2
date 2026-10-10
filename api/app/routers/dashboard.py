"""Dashboard · F05-T04.

Referencia: 02_Documento_Tecnico.md §9.2

    GET /api/dashboard?year&month   el contrato completo del tablero

Sin `year`/`month` responde con el mes actual — el mismo que abre
`GET /api/months` si todavía no existe. Con los dos, el mes que se
pida; si no existe, 404 (nunca se inventa un mes que no sea el
actual, Técnico §6.6).

Todo el trabajo de verdad —qué pedir, cómo combinarlo— vive en
`services.dashboard.armar`; este router sólo traduce la entrada y la
salida.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..core.db import SesionDeUsuario
from ..core.errors import no_encontrado
from ..core.security import UsuarioDelToken
from ..schemas.dashboard import RespuestaDashboard, respuesta_desde
from ..services import dashboard as servicio
from .me import asegurar_perfil_y_categorias

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=RespuestaDashboard, summary="El contrato completo del tablero")
def leer_dashboard(
    sesion: SesionDeUsuario,
    usuario: UsuarioDelToken,
    year: int | None = None,
    month: int | None = None,
) -> RespuestaDashboard:
    # Mismo motivo que en `routers/months.py` y `routers/categories.py`:
    # sin perfil, abrir el mes actual fallaría con una violación de
    # clave foránea en vez de resolverse solo.
    asegurar_perfil_y_categorias(sesion, usuario)

    resultado = servicio.armar(sesion, usuario.id, year=year, month=month)
    if resultado is None:
        raise no_encontrado("No se encontró el mes.")

    return respuesta_desde(resultado)
