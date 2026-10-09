"""El perfil del usuario · F02-T06.

Referencia: 02_Documento_Tecnico.md §9.1

    GET    /api/me             tu perfil
    PATCH  /api/me             nombre visible y saldo inicial
    POST   /api/me/bootstrap   red de seguridad: crea lo que falte

Todo pasa por `SesionDeUsuario`, así que las consultas van con el token
propagado y RLS filtra sola. Ninguna lleva `where user_id = ...`: si
alguna vez un filtro se olvida, la base sigue devolviendo únicamente lo
de quien pregunta.
"""

from __future__ import annotations

from typing import NamedTuple

from fastapi import APIRouter, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.categorias_iniciales import INICIALES
from ..core.db import SesionDeUsuario
from ..core.errors import NOT_FOUND, ErrorDeApi
from ..core.security import Usuario, UsuarioDelToken
from ..models import Category, Profile
from ..schemas.me import CambioDePerfil, Perfil, ResultadoDeBootstrap

# Sin `/api`: lo pone el enrutador privado de `main.py`, que es el que
# además exige la sesión. Un router que se registre por su cuenta se
# saltearía esa exigencia.
router = APIRouter(prefix="/me", tags=["perfil"])


def _sin_perfil() -> ErrorDeApi:
    """404 con una salida, no un callejón.

    Pasa con las cuentas creadas **antes** del trigger de F02-T04 —la
    de Gustavo, creada desde el panel en F00—. El mensaje dice qué
    hacer, así el frontend puede resolverlo solo.
    """
    return ErrorDeApi(
        status.HTTP_404_NOT_FOUND,
        NOT_FOUND,
        "Esta cuenta todavía no tiene perfil. Llamá a /api/me/bootstrap.",
    )


@router.get("", response_model=Perfil, summary="Tu perfil")
def leer_perfil(sesion: SesionDeUsuario) -> Profile:
    perfil = sesion.scalars(select(Profile)).one_or_none()
    if perfil is None:
        raise _sin_perfil()
    return perfil


@router.patch("", response_model=Perfil, summary="Cambiar nombre y saldo inicial")
def cambiar_perfil(cambios: CambioDePerfil, sesion: SesionDeUsuario) -> Profile:
    perfil = sesion.scalars(select(Profile)).one_or_none()
    if perfil is None:
        raise _sin_perfil()

    # `exclude_unset` es la diferencia entre «no mandé el nombre» y
    # «mandé el nombre en null para borrarlo». Sin esto, cambiar sólo el
    # saldo borraría el nombre visible.
    pedidos = cambios.model_dump(exclude_unset=True)
    for campo, valor in pedidos.items():
        setattr(perfil, campo, valor)

    sesion.flush()
    sesion.refresh(perfil)
    return perfil


class _Bootstrap(NamedTuple):
    perfil: Profile
    perfil_creado: bool
    categorias_creadas: int
    total_categorias: int


def asegurar_perfil_y_categorias(sesion: Session, usuario: Usuario) -> _Bootstrap:
    """Crea el perfil y las categorías que falten. Idempotente.

    Es una red de seguridad para dos casos: una cuenta creada antes de
    que existiera el trigger —la de Gustavo, creada desde el panel en
    F00— y la hipótesis de que el trigger no corra. Llamarla dos veces
    seguidas no duplica nada.

    No es sólo el cuerpo de `POST /api/me/bootstrap`: cualquier
    escritura que dependa de que el perfil ya exista tiene que llamar a
    esto primero, no sólo confiar en que alguien haya llamado a
    bootstrap antes. `months.user_id` referencia `profiles.id`
    (`on delete cascade`), así que abrir el mes actual de una cuenta sin
    perfil fallaba con una violación de clave foránea — un 500 sin
    explicación, en vez de arreglarse solo como debería (Técnico
    §6.2; encontrado en F03-T10 con la cuenta real de Gustavo, que
    nunca pasó por el trigger).
    """
    perfil = sesion.scalars(select(Profile)).one_or_none()
    perfil_creado = False

    if perfil is None:
        base = (usuario.email or "").split("@")[0].strip() or "usuario"
        perfil = Profile(id=usuario.id, username=_username_libre(sesion, base), display_name=base)
        sesion.add(perfil)
        sesion.flush()
        perfil_creado = True

    # Las que ya tiene, por (nombre, tipo). La consulta no filtra por
    # usuario: lo hace RLS.
    existentes = {
        (nombre, tipo) for nombre, tipo in sesion.execute(select(Category.name, Category.type))
    }

    creadas = 0
    # El orden arranca después de la última que haya, para no pisar el
    # que el usuario pudo haber acomodado.
    orden = len(existentes)
    for nombre, tipo in INICIALES:
        if (nombre, tipo) in existentes:
            continue
        orden += 1
        sesion.add(Category(user_id=usuario.id, name=nombre, type=tipo, sort_order=orden))
        creadas += 1

    sesion.flush()
    total = len(existentes) + creadas

    return _Bootstrap(
        perfil=perfil,
        perfil_creado=perfil_creado,
        categorias_creadas=creadas,
        total_categorias=total,
    )


@router.post(
    "/bootstrap",
    response_model=ResultadoDeBootstrap,
    summary="Crear lo que falte de la cuenta",
)
def bootstrap(usuario: UsuarioDelToken, sesion: SesionDeUsuario) -> ResultadoDeBootstrap:
    r = asegurar_perfil_y_categorias(sesion, usuario)
    return ResultadoDeBootstrap(
        perfil_creado=r.perfil_creado,
        categorias_creadas=r.categorias_creadas,
        total_categorias=r.total_categorias,
    )


def _username_libre(sesion: SesionDeUsuario, base: str) -> str:
    """El mismo criterio que el trigger: si está ocupado, sufijo.

    `username` es único en toda la tabla, así que dos cuentas con la
    misma parte de adelante del correo —`alguien@live.com` y
    `alguien@gmail.com`— chocarían.

    OJO: esta consulta mira **todos** los perfiles, no sólo el propio, y
    con RLS activo sólo ve el suyo. O sea que acá no puede detectar un
    choque con otra cuenta. Lo resuelve el `unique` de la base: si
    chocara, la inserción falla y el endpoint devuelve 409 en lugar de
    crear un perfil con un nombre repetido.
    """
    candidato = base
    intento = 0
    while sesion.scalars(select(Profile).where(Profile.username == candidato)).first():
        intento += 1
        candidato = f"{base}{intento}"
    return candidato
