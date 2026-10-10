"""Movimientos · F04-T06.

Referencia: 02_Documento_Tecnico.md §9.1, §9.4 · General §8, §34, §37, §51

    GET    /api/transactions          filtros: year, month, type,
                                       category_id, date_from, date_to,
                                       q, limit, offset
    POST   /api/transactions          alta — recalcula el mes
    PUT    /api/transactions/{id}     edición — recalcula el mes
    DELETE /api/transactions/{id}     baja — recalcula el mes

El importe y la descripción los valida `services.transactions`
(F04-T01, a través de los esquemas); que la categoría exista y le
sirva al tipo del movimiento —`tipo_coincide`, construida en F03-T08
para esto— se valida acá, porque hace falta la base para buscarla. El
recálculo en sí —escribir y volver a sumar el mes, en la misma
transacción— es `services.transactions` desde F04-T05; este router
sólo arma los datos, decide qué mes corresponde y traduce errores.
"""

from __future__ import annotations

import datetime as dt
import logging

from fastapi import APIRouter, Query, status

from ..core.db import SesionDeUsuario
from ..core.errors import ErrorDeApi, error_de_validacion, no_encontrado
from ..core.security import UsuarioDelToken
from ..models import Month, Transaction
from ..repos import categories as repos_categorias
from ..repos import months as repos_meses
from ..repos import transactions as repos_movimientos
from ..schemas.transactions import (
    AltaDeMovimiento,
    CambioDeMovimiento,
    Movimiento,
    RespuestaDeBaja,
    RespuestaDeMovimiento,
    TotalesDelMes,
)
from ..services import transactions as servicio
from ..services.categories import tipo_coincide
from ..services.months import HISTORICO, Periodo, abrir_mes, es_mes_futuro, mes_actual
from .me import asegurar_perfil_y_categorias

log = logging.getLogger("epic_wallet")

router = APIRouter(prefix="/transactions", tags=["movimientos"])


def _sin_movimiento() -> ErrorDeApi:
    """404 también para el movimiento de otro usuario: no se revela
    que existe (mismo criterio que `_sin_mes` en `routers/months.py`).
    """
    return no_encontrado("No se encontró el movimiento.")


def _totales(mes: Month) -> TotalesDelMes:
    return TotalesDelMes(
        income_total=mes.income_total,
        expense_total=mes.expense_total,
        saving_total=mes.saving_total,
    )


def _validar_categoria(sesion: SesionDeUsuario, category_id: int, transaction_type: str) -> None:
    categoria = repos_categorias.buscar_por_id(sesion, category_id)
    if categoria is None:
        # RLS ya la sacó de la consulta si es de otra cuenta: esto no
        # distingue "no existe" de "no es tuya", mismo criterio de no
        # revelar que existe.
        raise error_de_validacion(
            "La categoría no existe.", [{"field": "category_id"}]
        )
    if not tipo_coincide(categoria.type, transaction_type):
        raise error_de_validacion(
            f"«{categoria.name}» es una categoría de "
            f"{'ingreso' if categoria.type == 'income' else 'egreso'} "
            f"y no sirve para un {'ingreso' if transaction_type == 'income' else 'egreso'}.",
            [{"field": "category_id"}],
        )


@router.get("", response_model=list[Movimiento], summary="Los movimientos del usuario")
def listar_movimientos(
    sesion: SesionDeUsuario,
    year: int | None = None,
    month: int | None = None,
    type: str | None = None,
    category_id: int | None = None,
    date_from: dt.date | None = None,
    date_to: dt.date | None = None,
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[Transaction]:
    month_id: int | None = None
    if year is not None and month is not None:
        mes = repos_meses.buscar_por_periodo(sesion, year, month)
        if mes is None:
            # Un mes que todavía no existe no tiene movimientos: lista
            # vacía, no 404 — `GET` nunca crea el mes, a diferencia de
            # `POST` (Técnico §6.6, un mes se abre al escribir, no al
            # consultar).
            return []
        month_id = mes.id

    return repos_movimientos.listar(
        sesion,
        month_id=month_id,
        type_=type,
        category_id=category_id,
        date_from=date_from,
        date_to=date_to,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=RespuestaDeMovimiento,
    status_code=status.HTTP_201_CREATED,
    summary="Cargar un movimiento",
)
def crear_movimiento(
    datos: AltaDeMovimiento, usuario: UsuarioDelToken, sesion: SesionDeUsuario
) -> RespuestaDeMovimiento:
    # Sin perfil, abrir el mes de esta fecha fallaría con una violación
    # de clave foránea (mismo motivo que ya resuelve `asegurar_perfil_y_categorias`
    # en `routers/months.py` y `routers/categories.py`).
    asegurar_perfil_y_categorias(sesion, usuario)
    _validar_categoria(sesion, datos.category_id, datos.transaction_type)

    periodo = Periodo(datos.transaction_date.year, datos.transaction_date.month)
    if es_mes_futuro(periodo, mes_actual()):
        raise error_de_validacion("No se puede cargar un movimiento en un mes futuro.")

    mes = abrir_mes(sesion, usuario.id, periodo)
    if mes.status == HISTORICO:
        # Regla que no se negocia (CLAUDE.md): un mes consolidado no
        # inventa ni recibe movimientos individuales.
        raise error_de_validacion(
            "Ese mes ya está consolidado como histórico; no se le pueden agregar movimientos."
        )

    movimiento = servicio.crear_movimiento(
        sesion,
        mes,
        user_id=usuario.id,
        category_id=datos.category_id,
        transaction_date=datos.transaction_date,
        transaction_type=datos.transaction_type,
        amount=datos.amount,
        description=datos.description,
    )
    return RespuestaDeMovimiento(
        transaction=Movimiento.model_validate(movimiento), month_totals=_totales(mes)
    )


@router.put("/{transaction_id}", response_model=RespuestaDeMovimiento, summary="Editar un movimiento")
def editar_movimiento(
    transaction_id: int, datos: CambioDeMovimiento, sesion: SesionDeUsuario
) -> RespuestaDeMovimiento:
    movimiento = repos_movimientos.buscar_por_id(sesion, transaction_id)
    if movimiento is None:
        raise _sin_movimiento()

    _validar_categoria(sesion, datos.category_id, datos.transaction_type)

    mes = sesion.get(Month, movimiento.month_id)
    assert mes is not None, "un movimiento siempre tiene su mes (fk not null)"

    periodo = Periodo(mes.year, mes.month)
    if not servicio.fecha_en_el_mes(datos.transaction_date, periodo):
        # Editar no mueve un movimiento de mes: ese mismo cambio
        # recalcularía dos meses y acá sólo se recalcula uno. Para
        # cambiarlo de mes hay que borrarlo y cargarlo de nuevo.
        raise error_de_validacion(
            "La fecha tiene que caer dentro del mes de este movimiento "
            "(para moverlo a otro mes, borralo y cargalo de nuevo).",
            [{"field": "transaction_date"}],
        )

    servicio.actualizar_movimiento(
        sesion,
        mes,
        movimiento,
        {
            "category_id": datos.category_id,
            "transaction_date": datos.transaction_date,
            "transaction_type": datos.transaction_type,
            "amount": datos.amount,
            "description": datos.description,
        },
    )
    return RespuestaDeMovimiento(
        transaction=Movimiento.model_validate(movimiento), month_totals=_totales(mes)
    )


@router.delete("/{transaction_id}", response_model=RespuestaDeBaja, summary="Borrar un movimiento")
def borrar_movimiento(transaction_id: int, sesion: SesionDeUsuario) -> RespuestaDeBaja:
    movimiento = repos_movimientos.buscar_por_id(sesion, transaction_id)
    if movimiento is None:
        raise _sin_movimiento()

    mes = sesion.get(Month, movimiento.month_id)
    assert mes is not None, "un movimiento siempre tiene su mes (fk not null)"

    # Auditoría técnica de la baja (General §59): `transactions` no
    # tiene borrado lógico —la fila se va de verdad—, así que lo único
    # que puede conservar su metadata técnica después de que no esté
    # más es el log del servidor: quién, qué fila, cuándo.
    log.info(
        "baja de movimiento id=%s usuario=%s mes=%s-%02d categoria=%s tipo=%s importe=%s fecha=%s",
        movimiento.id,
        movimiento.user_id,
        mes.year,
        mes.month,
        movimiento.category_id,
        movimiento.transaction_type,
        movimiento.amount,
        movimiento.transaction_date,
    )

    servicio.borrar_movimiento(sesion, mes, movimiento)
    return RespuestaDeBaja(month_totals=_totales(mes))
