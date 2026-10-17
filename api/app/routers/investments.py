"""Inversiones · F10-T04 (el servicio), F10-T06 (estos endpoints).

Referencia: 02_Documento_Tecnico.md §9.1, §7.3 · General §20, §21, §22, §23, §24

    GET    /api/investments       la cartera, con sus indicadores (F10-T01)
    POST   /api/investments       comprar (alta de una posición)
    PUT    /api/investments/{id}  nombre y actualización manual de valor
    DELETE /api/investments/{id}  vender (baja, sin bitácora — General §21)

`POST` y `DELETE` mueven plata entre el ahorro y la cartera por
defecto (Regla 7, `affect_savings=True`): comprar resta del ahorro del
mes actual, vender lo acredita, bajo la categoría "Inversiones" —que
se crea sola la primera vez que hace falta—. `PUT` nunca toca el
ahorro: sólo cambia `current_value`/`current_unit_price`, así que
cambia el patrimonio y no el ahorro del mes (criterio de aceptación de
la tarea).
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
    RespuestaVenta,
    respuesta_cartera_desde,
    respuesta_desde_posicion,
)
from ..services import calc
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
    # La categoría "Inversiones" se crea sola la primera vez (Técnico
    # §7.3): sin perfil, esa alta fallaría con una violación de clave
    # foránea en vez de resolverse sola, mismo motivo que en
    # routers/categories.py y routers/dashboard.py.
    asegurar_perfil_y_categorias(sesion, usuario)
    posicion = servicio.comprar_posicion(
        sesion,
        usuario.id,
        symbol=datos.symbol,
        name=datos.name,
        investment_type=datos.investment_type,
        valuation_mode=datos.valuation_mode,
        nominal_quantity=datos.nominal_quantity,
        current_unit_price=datos.current_unit_price,
        valor_manual=datos.manual_value,
        affect_savings=datos.affect_savings,
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

    # Nunca los dos a la vez tienen sentido real, pero si llegaran
    # juntos gana el precio unitario: es el dato "más de la fuente", y
    # recalcula `current_value` con los nominales que la posición ya
    # tiene — nunca se multiplica a ciegas por un valor viejo.
    if cambios.current_unit_price is not None:
        posicion.current_unit_price = cambios.current_unit_price
        posicion.current_value = calc.valor_de_inversion(
            "unit_price", posicion.nominal_quantity, cambios.current_unit_price, posicion.current_value
        )
    elif cambios.current_value is not None:
        posicion.current_value = cambios.current_value

    sesion.flush()
    sesion.refresh(posicion)
    return respuesta_desde_posicion(posicion)


@router.delete("/{investment_id}", response_model=RespuestaVenta, summary="Vender (baja de una posición)")
def vender_inversion(
    investment_id: int, sesion: SesionDeUsuario, affect_savings: bool = True
) -> RespuestaVenta:
    posicion = repos.buscar_por_id(sesion, investment_id)
    if posicion is None:
        raise _sin_posicion()

    valor = servicio.vender_posicion(sesion, posicion, affect_savings=affect_savings)
    return RespuestaVenta(amount=f"{valor:.2f}", affected_savings=affect_savings and valor > 0)
