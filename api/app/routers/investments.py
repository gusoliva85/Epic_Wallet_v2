"""Inversiones · F10-T04 (el servicio), F10-T06 (estos endpoints).

Referencia: 02_Documento_Tecnico.md §9.1, §7.3 · General §20, §21, §22, §23, §24

    GET    /api/investments       la cartera, con sus indicadores (F10-T01)
    POST   /api/investments       comprar (alta de una posición)
    PUT    /api/investments/{id}  nombre y actualización manual de valor
    DELETE /api/investments/{id}  vender (baja, sin bitácora — General §21)

Ninguno de los cuatro toca el ahorro del mes (revisado 2026-10-17): la
cartera es información, no bitácora de gastos, y lo que se deposita en
la cuenta de inversión se carga aparte, a mano, en Movimientos — ver
`services/investments.py`.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from ..core.db import SesionDeUsuario
from ..core.errors import ErrorDeApi, no_encontrado
from ..core.security import UsuarioDelToken
from ..repos import investments as repos
from ..schemas.investments import (
    AltaDeInversion,
    EdicionDeInversion,
    RespuestaCartera,
    RespuestaInversion,
    respuesta_cartera_desde,
    respuesta_desde_posicion,
)
from ..services import investments as servicio
from .me import asegurar_perfil_y_categorias

router = APIRouter(prefix="/investments", tags=["inversiones"])


def _sin_posicion() -> ErrorDeApi:
    return no_encontrado("No se encontró la posición.")


@router.get("", response_model=RespuestaCartera, summary="La cartera, con sus indicadores")
def listar_cartera(sesion: SesionDeUsuario, usuario: UsuarioDelToken) -> RespuestaCartera:
    asegurar_perfil_y_categorias(sesion, usuario)
    posiciones = servicio.listar_cartera(sesion)
    indicadores = servicio.indicadores_de_cartera(posiciones)
    return respuesta_cartera_desde(indicadores, posiciones)


@router.post(
    "",
    response_model=RespuestaInversion,
    status_code=status.HTTP_201_CREATED,
    summary="Comprar (alta de una posición)",
)
def comprar_inversion(
    datos: AltaDeInversion, sesion: SesionDeUsuario, usuario: UsuarioDelToken
) -> RespuestaInversion:
    # `investments.user_id` referencia `profiles.id` (FK directa): sin
    # perfil, esta alta fallaría con una violación de clave foránea,
    # mismo motivo que en routers/categories.py y routers/dashboard.py.
    asegurar_perfil_y_categorias(sesion, usuario)
    posicion = servicio.comprar_posicion(
        sesion,
        usuario.id,
        symbol=datos.symbol,
        name=datos.name,
        investment_type=datos.investment_type,
        initial_value=datos.initial_value,
        nominal_quantity=datos.nominal_quantity,
    )
    return respuesta_desde_posicion(posicion)


@router.put("/{investment_id}", response_model=RespuestaInversion, summary="Editar o actualizar el valor")
def editar_inversion(
    investment_id: int, cambios: EdicionDeInversion, sesion: SesionDeUsuario
) -> RespuestaInversion:
    posicion = repos.buscar_por_id(sesion, investment_id)
    if posicion is None:
        raise _sin_posicion()

    if cambios.name is not None:
        posicion.name = cambios.name
    if cambios.active is not None:
        posicion.active = cambios.active
    if cambios.current_value is not None:
        posicion.current_value = cambios.current_value

    sesion.flush()
    sesion.refresh(posicion)
    return respuesta_desde_posicion(posicion)


@router.delete(
    "/{investment_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Vender (baja de una posición)"
)
def vender_inversion(investment_id: int, sesion: SesionDeUsuario) -> None:
    posicion = repos.buscar_por_id(sesion, investment_id)
    if posicion is None:
        raise _sin_posicion()

    servicio.vender_posicion(sesion, posicion)
