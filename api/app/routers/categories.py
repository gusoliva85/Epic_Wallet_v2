"""Categorías · F03-T08.

Referencia: 02_Documento_Tecnico.md §9.1 · General §7, §34, §51

    GET    /api/categories           lista, filtros `type` y `active`
    POST   /api/categories           alta, al final de su tipo
    PATCH  /api/categories/{id}      nombre, activar/desactivar, orden
    DELETE /api/categories/{id}      baja — restringida si tiene histórico

Dos traducciones de `IntegrityError` a un 409 con mensaje, no dos
validaciones hechas a mano por este router: la restricción que
rechaza el nombre repetido ya existe desde F02-T04
(`categories_unique_name_per_type`), y la que algún día va a rechazar
el borrado de una categoría con movimientos es `on delete restrict` en
`transactions.category_id` (Técnico §6.2), que F04 todavía no creó.
Hoy el segundo camino nunca se dispara —no hay nada que referencie una
categoría—, y el día que exista `transactions` va a funcionar solo, sin
tocar este archivo.
"""

from __future__ import annotations

from fastapi import APIRouter, status
from psycopg.errors import ForeignKeyViolation, UniqueViolation
from sqlalchemy.exc import IntegrityError

from ..core.db import SesionDeUsuario
from ..core.errors import NOT_FOUND, ErrorDeApi, conflicto
from ..core.security import UsuarioDelToken
from ..models import Category
from ..repos import categories as repos
from ..schemas.categories import AltaDeCategoria, CambioDeCategoria, Categoria
from .me import asegurar_perfil_y_categorias

router = APIRouter(prefix="/categories", tags=["categorías"])


def _sin_categoria() -> ErrorDeApi:
    """404 también para la categoría de otro usuario: no se revela
    que existe (mismo criterio que `_sin_mes` en `routers/months.py`).
    """
    return ErrorDeApi(status.HTTP_404_NOT_FOUND, NOT_FOUND, "No se encontró la categoría.")


@router.get("", response_model=list[Categoria], summary="Las categorías del usuario")
def listar_categorias(
    sesion: SesionDeUsuario,
    usuario: UsuarioDelToken,
    type: str | None = None,
    active: bool | None = None,
) -> list[Category]:
    # Misma red de seguridad que `GET /api/months`: una cuenta creada
    # antes del trigger de F02-T04 no tiene perfil ni categorías, y acá
    # es donde F03-T10 la deja ver las 21 iniciales sin tener que saber
    # que existe `/api/me/bootstrap`.
    asegurar_perfil_y_categorias(sesion, usuario)
    return repos.listar(sesion, type_=type, active=active)


@router.post(
    "",
    response_model=Categoria,
    status_code=status.HTTP_201_CREATED,
    summary="Crear una categoría",
)
def crear_categoria(datos: AltaDeCategoria, usuario: UsuarioDelToken, sesion: SesionDeUsuario) -> Category:
    # Sin perfil, este insert fallaría con una violación de clave
    # foránea (`categories.user_id` referencia `profiles.id`) en vez de
    # crear la categoría. No alcanza con que `listar_categorias` ya la
    # llame: nada garantiza que el cliente haya pedido la lista antes
    # de dar de alta.
    asegurar_perfil_y_categorias(sesion, usuario)
    try:
        orden = repos.siguiente_orden(sesion, datos.type)
        # `user_id` sale del token, nunca de la entrada: no hay un
        # campo para eso en `AltaDeCategoria` a propósito, la misma
        # disciplina que `bootstrap` en routers/me.py.
        return repos.crear(
            sesion, user_id=usuario.id, name=datos.name, type_=datos.type, sort_order=orden
        )
    except IntegrityError as exc:
        if isinstance(exc.orig, UniqueViolation):
            raise conflicto("Ya existe una categoría con ese nombre para ese tipo.") from exc
        raise


@router.patch("/{category_id}", response_model=Categoria, summary="Cambiar una categoría")
def cambiar_categoria(
    category_id: int, cambios: CambioDeCategoria, sesion: SesionDeUsuario
) -> Category:
    categoria = repos.buscar_por_id(sesion, category_id)
    if categoria is None:
        raise _sin_categoria()

    pedidos = cambios.model_dump(exclude_unset=True)
    for campo, valor in pedidos.items():
        setattr(categoria, campo, valor)

    try:
        sesion.flush()
    except IntegrityError as exc:
        if isinstance(exc.orig, UniqueViolation):
            raise conflicto("Ya existe una categoría con ese nombre para ese tipo.") from exc
        raise
    sesion.refresh(categoria)
    return categoria


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Borrar una categoría")
def borrar_categoria(category_id: int, sesion: SesionDeUsuario) -> None:
    categoria = repos.buscar_por_id(sesion, category_id)
    if categoria is None:
        raise _sin_categoria()

    try:
        repos.eliminar(sesion, categoria)
    except IntegrityError as exc:
        if isinstance(exc.orig, ForeignKeyViolation):
            raise conflicto(
                "No se puede borrar: tiene movimientos cargados. Desactivala en su lugar."
            ) from exc
        raise
