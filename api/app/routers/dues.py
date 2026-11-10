"""Vencimientos · F13-T03.

Referencia: 02_Documento_Tecnico.md §9.1 · General §29

    GET /api/dues                   los ítems con su estado de hoy
    PUT /api/dues/{category_id}     prender, apagar o reconfigurar uno

No hay `POST` ni `DELETE`, y es a propósito: no se agregan ni se borran
vencimientos, se prenden y se apagan los ítems que ya existen. El
`PUT` es un upsert —la primera vez crea la fila, después la
actualiza—, que es lo que hace que el interruptor de la pantalla sea
un solo pedido en los dos casos.

El estado (falta tanto, vence hoy, ya venció) lo calcula el servidor
con el día de hoy en `America/Argentina/Buenos_Aires`, nunca el
cliente: con dos dispositivos de relojes distintos, cada uno vería una
alerta diferente.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from ..core.db import SesionDeUsuario
from ..core.errors import NOT_FOUND, ErrorDeApi
from ..core.security import UsuarioDelToken
from ..repos import categories as repos_categorias
from ..repos import category_dues as repos
from ..schemas.dues import CambioDeVencimiento, ItemConVencimiento
from ..services import dues as servicio
from .me import asegurar_perfil_y_categorias

router = APIRouter(prefix="/dues", tags=["vencimientos"])


def _sin_categoria() -> ErrorDeApi:
    """404 también para la categoría de otra cuenta: no se revela que
    existe (mismo criterio que `routers/categories.py`)."""
    return ErrorDeApi(status.HTTP_404_NOT_FOUND, NOT_FOUND, "No se encontró la categoría.")


@router.get("", response_model=list[ItemConVencimiento], summary="Los ítems y sus vencimientos")
def listar_vencimientos(
    sesion: SesionDeUsuario, usuario: UsuarioDelToken
) -> list[servicio.ItemDeVencimiento]:
    # Misma red de seguridad que `GET /api/categories`: una cuenta sin
    # categorías todavía no tendría ningún ítem para mostrar.
    asegurar_perfil_y_categorias(sesion, usuario)
    return servicio.armar(sesion)


@router.put(
    "/{category_id}",
    response_model=ItemConVencimiento,
    summary="Configurar el vencimiento de un ítem",
)
def guardar_vencimiento(
    category_id: int,
    cambios: CambioDeVencimiento,
    sesion: SesionDeUsuario,
    usuario: UsuarioDelToken,
) -> servicio.ItemDeVencimiento:
    categoria = repos_categorias.buscar_por_id(sesion, category_id)
    if categoria is None:
        raise _sin_categoria()

    # Un ingreso no vence (General §29: lo que se avisa es lo que hay
    # que pagar). Da el mismo 404 que una categoría ajena: la pantalla
    # nunca ofrece una categoría de ingreso acá, así que llegar con una
    # es un pedido armado a mano.
    if categoria.type != servicio.TIPO_EGRESO:
        raise _sin_categoria()

    repos.guardar(
        sesion,
        user_id=usuario.id,
        category_id=category_id,
        enabled=cambios.enabled,
        due_day=cambios.due_day,
        notice_days=cambios.notice_days,
    )

    # Se devuelve el ítem recién armado y no la fila guardada: la
    # pantalla necesita el estado de hoy (falta tanto, vence hoy) y el
    # estimado, que no están en la tabla.
    item = next(
        (i for i in servicio.armar(sesion) if i.category_id == category_id),
        None,
    )
    if item is None:  # pragma: no cover - la categoría existe y es de egreso
        raise _sin_categoria()
    return item
