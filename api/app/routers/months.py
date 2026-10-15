"""Meses · F03-T05. `GET /api/months` abre el mes actual desde F03-T10.
Carga y corrección de meses históricos desde F08-T03.

Referencia: 02_Documento_Tecnico.md §9.1, §6.6, §7.2 · General §6.3, §18, §50 (R4)

    GET   /api/months                   la lista, con su saldo acumulado
    GET   /api/months/savings-evolution el acumulado real, mes a mes (F06-T07)
    GET   /api/months/{id}              el detalle, respetando las dos naturalezas
    POST  /api/months/historical        crear o actualizar un mes histórico
    PATCH /api/months/{id}              corregir un mes histórico

Ninguno filtra por usuario en su consulta: la sesión que llega acá es
una `SesionDeUsuario` (F02-T05), así que RLS ya deja ver sólo lo del
usuario del token — el mismo patrón que `GET`/`PATCH /api/me`.
"""

from __future__ import annotations

import decimal

from fastapi import APIRouter, status

from ..core.db import SesionDeUsuario
from ..core.errors import NOT_FOUND, ErrorDeApi, conflicto, error_de_validacion
from ..core.security import UsuarioDelToken
from ..models import Month
from ..repos import categories as repos_categorias
from ..repos import monthly_category_totals as repos_totales
from ..repos import months as repos
from ..repos import profiles as repos_perfiles
from ..repos import transactions as repos_movimientos
from ..schemas.months import (
    CargaDeMesHistorico,
    CorreccionDeMesHistorico,
    MesDetalle,
    MesResumen,
    SaldoMensual,
    TotalDeCategoriaHistorico,
)
from ..services import calc
from ..services.months import (
    HISTORICO,
    Periodo,
    abrir_mes_actual,
    es_mes_futuro,
    es_mes_valido,
    mes_actual,
    recalcular_saldos_acumulados,
    requiere_confirmacion_para_historico,
    transacciones_del_mes,
)
from .me import asegurar_perfil_y_categorias

router = APIRouter(prefix="/months", tags=["meses"])


def _sin_mes() -> ErrorDeApi:
    """404 también para el mes de otro usuario: no se revela que
    existe (Técnico §17, mismo criterio que `_sin_perfil` en
    `routers/me.py`). RLS ya lo sacó de la consulta; esto sólo traduce
    "no encontré nada" al código correcto — nunca es un 403."""
    return ErrorDeApi(status.HTTP_404_NOT_FOUND, NOT_FOUND, "No se encontró el mes.")


def _totales_por_categoria(
    sesion: SesionDeUsuario, items: list[TotalDeCategoriaHistorico]
) -> dict[int, decimal.Decimal]:
    """Valida que cada categoría exista y sea del usuario —RLS ya la
    saca de la consulta si es de otra cuenta, mismo criterio que
    `_validar_categoria` en `routers/transactions.py`— y devuelve el
    total por `category_id`, listo para `repos_totales.reemplazar_manuales`."""
    totales: dict[int, decimal.Decimal] = {}
    for item in items:
        categoria = repos_categorias.buscar_por_id(sesion, item.category_id)
        if categoria is None:
            raise error_de_validacion("La categoría no existe.", [{"field": "category_id"}])
        totales[item.category_id] = item.total_amount
    return totales


def _detalle_de(mes: Month) -> MesDetalle:
    detalle = MesDetalle.model_validate(mes, from_attributes=True)
    return detalle.model_copy(update={"transactions": transacciones_del_mes(mes.status, None)})


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


@router.get(
    "/savings-evolution",
    response_model=list[SaldoMensual],
    summary="La evolución del ahorro acumulado, mes a mes",
)
def ver_evolucion_del_ahorro(sesion: SesionDeUsuario, usuario: UsuarioDelToken) -> list[SaldoMensual]:
    # Antes de `/{month_id}` a propósito: con el otro orden, FastAPI
    # intenta leer "savings-evolution" como el `int` de esa ruta y
    # nunca llega hasta acá.
    #
    # El saldo acumulado real (General §54, Gráfico 4) sale de sumar
    # `saving_total` mes a mes (F04-T05 ya lo mantiene al día) sobre el
    # saldo inicial del perfil — la misma cuenta que ya usa
    # `services.dashboard.armar()` para el indicador, acá con un punto
    # por mes en vez de sólo el último. A propósito no lee
    # `months.closing_balance` (F08-T03 ya la encadena, pero sólo al
    # cargar o corregir un mes histórico): calculándolo siempre al
    # vuelo, este gráfico nunca puede quedar desactualizado por un
    # movimiento nuevo del mes en curso.
    asegurar_perfil_y_categorias(sesion, usuario)
    abrir_mes_actual(sesion, usuario.id)

    meses = sorted(repos.listar(sesion), key=lambda m: (m.year, m.month))
    perfil = repos_perfiles.buscar(sesion)
    saldo_inicial = perfil.opening_balance if perfil else decimal.Decimal("0")

    serie = calc.serie_de_ahorro_acumulado(saldo_inicial, [m.saving_total for m in meses])
    return [
        SaldoMensual(year=m.year, month=m.month, balance=saldo)
        for m, saldo in zip(meses, serie, strict=True)
    ]


@router.get("/{month_id}", response_model=MesDetalle, summary="El detalle de un mes")
def leer_mes(month_id: int, sesion: SesionDeUsuario) -> MesDetalle:
    mes = sesion.get(Month, month_id)
    if mes is None:
        raise _sin_mes()
    # Sin movimientos todavía (F04 crea `transactions`): un mes abierto
    # devuelve la lista vacía que ya resuelve `transacciones_del_mes`
    # para "sin movimientos que pasarle", y uno histórico sigue dando
    # `None` sin importar qué se le pase.
    return _detalle_de(mes)


@router.post(
    "/historical",
    response_model=MesDetalle,
    status_code=status.HTTP_201_CREATED,
    summary="Crear o actualizar un mes histórico consolidado",
)
def cargar_mes_historico(
    datos: CargaDeMesHistorico, usuario: UsuarioDelToken, sesion: SesionDeUsuario
) -> MesDetalle:
    """General §18: carga manual de un mes consolidado, con sus
    totales por categoría marcados como manuales (`is_manual_summary`,
    F04-T03). Si el mes ya existe como `open` con movimientos, hace
    falta `confirm: true` (General §6.3, Regla 4 de la §50) — los
    movimientos no se borran, sólo dejan de leerse (Técnico §6.6)."""
    asegurar_perfil_y_categorias(sesion, usuario)

    periodo = Periodo(datos.year, datos.month)
    if not es_mes_valido(periodo.month):
        raise error_de_validacion("El mes tiene que estar entre 1 y 12.", [{"field": "month"}])
    if es_mes_futuro(periodo, mes_actual()):
        raise error_de_validacion(
            "No se puede cargar un mes que todavía no existió.", [{"field": "month"}]
        )

    totales_categorias = _totales_por_categoria(sesion, datos.categories)

    existente = repos.buscar_por_periodo(sesion, periodo.year, periodo.month)
    tiene_movimientos = existente is not None and bool(
        repos_movimientos.listar_por_mes(sesion, existente.id)
    )
    status_actual = existente.status if existente else None
    if requiere_confirmacion_para_historico(status_actual, tiene_movimientos) and not datos.confirm:
        raise conflicto(
            "Ese mes todavía está en curso y tiene movimientos cargados. "
            "Repetí la carga con confirm=true para reemplazarlos por los totales históricos."
        )

    if existente is not None:
        mes = existente
        mes.status = HISTORICO
    else:
        mes = repos.crear(
            sesion, user_id=usuario.id, year=periodo.year, month=periodo.month, status=HISTORICO
        )

    mes.income_total = datos.income_total
    mes.expense_total = datos.expense_total
    mes.saving_total = datos.saving_total

    repos_totales.reemplazar_manuales(
        sesion, user_id=usuario.id, month_id=mes.id, totales=totales_categorias
    )
    recalcular_saldos_acumulados(sesion, usuario.id)

    return _detalle_de(mes)


@router.patch("/{month_id}", response_model=MesDetalle, summary="Corregir un mes histórico")
def corregir_mes_historico(
    month_id: int, datos: CorreccionDeMesHistorico, usuario: UsuarioDelToken, sesion: SesionDeUsuario
) -> MesDetalle:
    """General §6.3: un mes histórico se puede corregir si se detecta
    un error. No sirve para convertir un mes `open` —para eso está
    `POST /historical` con `confirm: true`—, sólo para retocar uno que
    ya es consolidado."""
    mes = sesion.get(Month, month_id)
    if mes is None:
        raise _sin_mes()
    if mes.status != HISTORICO:
        raise error_de_validacion(
            "Ese mes todavía está en curso; no se puede corregir como histórico "
            "(cargalo primero con POST /api/months/historical)."
        )

    totales_categorias = _totales_por_categoria(sesion, datos.categories)

    mes.income_total = datos.income_total
    mes.expense_total = datos.expense_total
    mes.saving_total = datos.saving_total

    repos_totales.reemplazar_manuales(
        sesion, user_id=usuario.id, month_id=mes.id, totales=totales_categorias
    )
    recalcular_saldos_acumulados(sesion, usuario.id)

    return _detalle_de(mes)
