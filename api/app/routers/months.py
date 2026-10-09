"""Meses · F03-T05. `GET /api/months` abre el mes actual desde F03-T10.

Referencia: 02_Documento_Tecnico.md §9.1, §6.6

    GET  /api/months       la lista, con su saldo acumulado
    GET  /api/months/{id}  el detalle, respetando las dos naturalezas

Ninguno de los dos filtra por usuario en su consulta: la sesión que
llega acá es una `SesionDeUsuario` (F02-T05), así que RLS ya deja ver
sólo lo del usuario del token — el mismo patrón que `GET`/`PATCH
/api/me`.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from ..core.db import SesionDeUsuario
from ..core.errors import NOT_FOUND, ErrorDeApi
from ..core.security import UsuarioDelToken
from ..models import Month
from ..repos import months as repos
from ..schemas.months import MesDetalle, MesResumen
from ..services.months import abrir_mes_actual, transacciones_del_mes
from .me import asegurar_perfil_y_categorias

router = APIRouter(prefix="/months", tags=["meses"])


def _sin_mes() -> ErrorDeApi:
    """404 también para el mes de otro usuario: no se revela que
    existe (Técnico §17, mismo criterio que `_sin_perfil` en
    `routers/me.py`). RLS ya lo sacó de la consulta; esto sólo traduce
    "no encontré nada" al código correcto — nunca es un 403."""
    return ErrorDeApi(status.HTTP_404_NOT_FOUND, NOT_FOUND, "No se encontró el mes.")


@router.get("", response_model=list[MesResumen], summary="Los meses del usuario")
def listar_meses(sesion: SesionDeUsuario, usuario: UsuarioDelToken) -> list[Month]:
    # `months.user_id` referencia `profiles.id`: sin perfil, abrir el
    # mes actual de una cuenta nueva fallaría con una violación de
    # clave foránea (un 500 sin explicación). `asegurar_perfil_y_categorias`
    # es la misma red de seguridad de `POST /api/me/bootstrap`, acá
    # obligatoria y no opcional — ninguna cuenta puede depender de
    # haberla llamado antes a mano (Técnico §6.2; encontrado en
    # F03-T10 con la cuenta real de Gustavo).
    asegurar_perfil_y_categorias(sesion, usuario)
    # Sin esto, la cuenta más nueva de todas —la que todavía no tiene
    # ni un mes— recibiría una lista vacía, y la barra de mes (F03-T10)
    # no tendría nada que mostrar al abrir la aplicación por primera
    # vez. `abrir_mes_actual` ya es idempotente (F03-T03): en cualquier
    # visita posterior esto no inserta una fila de más, sólo encuentra
    # la que ya estaba.
    abrir_mes_actual(sesion, usuario.id)
    return repos.listar(sesion)


@router.get("/{month_id}", response_model=MesDetalle, summary="El detalle de un mes")
def leer_mes(month_id: int, sesion: SesionDeUsuario) -> MesDetalle:
    mes = sesion.get(Month, month_id)
    if mes is None:
        raise _sin_mes()

    detalle = MesDetalle.model_validate(mes, from_attributes=True)
    # Sin movimientos todavía (F04 crea `transactions`): un mes abierto
    # devuelve la lista vacía que ya resuelve `transacciones_del_mes`
    # para "sin movimientos que pasarle", y uno histórico sigue dando
    # `None` sin importar qué se le pase.
    return detalle.model_copy(update={"transactions": transacciones_del_mes(mes.status, None)})
