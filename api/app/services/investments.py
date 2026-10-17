"""Servicio de cartera · F10-T04 (alta, baja, indicadores), F10-T06
(la transferencia con el ahorro).

Referencia: 02_Documento_Tecnico.md §6.2, §7.3 · General §20, §21, §22, §23, §24

Comprar o vender además mueve plata entre el ahorro y la cartera
(Regla 7): un movimiento `source='system'`, categoría "Inversiones"
—una de tipo `expense` para comprar, una de tipo `income` para
vender, se crean solas la primera vez que hacen falta—. Decisión de
Gustavo (2026-10-17), pisa lo que decía antes el técnico §7.3: esto SÍ
cuenta en "Total gastado"/"Total ingresado este mes" y SÍ aparece en
el desglose por categoría, no queda afuera — "sino no se entiende por
qué tenés plata de menos". El detalle de qué se compró vive en la
cartera, no en el desglose del dashboard.

`affect_savings=False` es la salida para cargar una posición que ya
existía antes de usar la aplicación (se está poniendo al día la
cartera, no hay plata "nueva" saliendo del ahorro ahora mismo) o para
sacar una mal cargada sin tocar un peso del ahorro.

La sesión por pedido ya hace `commit()` al terminar y `rollback()` si
algo tira una excepción (`core/db.py`) — nadie acá llama `commit()` a
mano, así que una compra o venta a medio camino deja todo como estaba
antes, nunca a medias (criterio de aceptación de F10-T04).
"""

from __future__ import annotations

import datetime as dt
import decimal
from typing import NamedTuple

from sqlalchemy.orm import Session

from ..models import Category, Investment
from ..repos import categories as repos_categorias
from ..repos import investments as repos
from . import calc
from .months import ZONA_APP, abrir_mes_actual
from .transactions import crear_movimiento

NOMBRE_CATEGORIA_TRANSFERENCIA = "Inversiones"


class IndicadoresDeCartera(NamedTuple):
    valor_actual: decimal.Decimal
    total_invertido: decimal.Decimal
    rendimiento: decimal.Decimal
    rendimiento_porcentual: decimal.Decimal | None
    cantidad_de_posiciones: int


def listar_cartera(sesion: Session) -> list[Investment]:
    return repos.listar(sesion)


def indicadores_de_cartera(posiciones: list[Investment]) -> IndicadoresDeCartera:
    """General §22: los cuatro números de la cartera entera, a partir
    de las posiciones ya guardadas —acá no se valúa nada, cada
    posición ya trae su `current_value`/`initial_value` resueltos
    desde que se creó o se actualizó (`valor_de_inversion`, F10-T01)."""
    valor_actual = calc.total_de_inversiones([p.current_value for p in posiciones])
    total_invertido = calc.total_invertido([p.initial_value for p in posiciones])
    return IndicadoresDeCartera(
        valor_actual=valor_actual,
        total_invertido=total_invertido,
        rendimiento=calc.rendimiento_de_inversion(valor_actual, total_invertido),
        rendimiento_porcentual=calc.rendimiento_porcentual(valor_actual, total_invertido),
        cantidad_de_posiciones=len(posiciones),
    )


def _categoria_de_transferencia(sesion: Session, user_id: str, tipo: str) -> Category:
    """La categoría "Inversiones" del tipo pedido. Se crea sola la
    primera vez que hace falta —mismo criterio que
    `routers.me.asegurar_perfil_y_categorias`: nadie tiene que darla
    de alta a mano antes de poder comprar algo."""
    existente = repos_categorias.buscar_por_nombre_y_tipo(sesion, NOMBRE_CATEGORIA_TRANSFERENCIA, tipo)
    if existente is not None:
        return existente
    orden = repos_categorias.siguiente_orden(sesion, tipo)
    return repos_categorias.crear(
        sesion, user_id=user_id, name=NOMBRE_CATEGORIA_TRANSFERENCIA, type_=tipo, sort_order=orden
    )


def _hoy(ahora: dt.datetime | None) -> dt.date:
    """La fecha de hoy en la zona de la aplicación — mismo criterio
    que `months.mes_actual`: sin zona horaria, se toma como si ya
    fuera la hora de Argentina, nunca como UTC."""
    momento = ahora if ahora is not None else dt.datetime.now(ZONA_APP)
    if momento.tzinfo is None:
        momento = momento.replace(tzinfo=ZONA_APP)
    else:
        momento = momento.astimezone(ZONA_APP)
    return momento.date()


def comprar_posicion(
    sesion: Session,
    user_id: str,
    *,
    symbol: str,
    name: str,
    investment_type: str,
    valuation_mode: str,
    nominal_quantity: decimal.Decimal = decimal.Decimal("0"),
    current_unit_price: decimal.Decimal | None = None,
    valor_manual: decimal.Decimal = decimal.Decimal("0"),
    affect_savings: bool = True,
    ahora: dt.datetime | None = None,
) -> Investment:
    """Alta de una posición nueva (General §20.1). El valor con el que
    se compra es, a la vez, el valor inicial y el valor actual del día
    cero —todavía no pasó tiempo para que rinda ni pierda nada."""
    valor = calc.valor_de_inversion(valuation_mode, nominal_quantity, current_unit_price, valor_manual)
    posicion = repos.crear(
        sesion,
        user_id=user_id,
        symbol=symbol,
        name=name,
        investment_type=investment_type,
        nominal_quantity=nominal_quantity,
        initial_value=valor,
        valuation_mode=valuation_mode,
        current_unit_price=current_unit_price,
        current_value=valor,
    )

    if affect_savings and valor > 0:
        categoria = _categoria_de_transferencia(sesion, user_id, "expense")
        mes = abrir_mes_actual(sesion, user_id, ahora=ahora)
        crear_movimiento(
            sesion,
            mes,
            user_id=user_id,
            category_id=categoria.id,
            transaction_date=_hoy(ahora),
            transaction_type="expense",
            amount=valor,
            description=f"Compra de {symbol}",
            source="system",
        )

    return posicion


def vender_posicion(
    sesion: Session,
    posicion: Investment,
    *,
    affect_savings: bool = True,
    ahora: dt.datetime | None = None,
) -> decimal.Decimal:
    """Venta: borra la posición —General §21, sin bitácora de
    compra/venta— y devuelve su valor actual, el mismo importe que
    acredita al ahorro si `affect_savings` es `True`."""
    valor = posicion.current_value
    user_id = posicion.user_id
    symbol = posicion.symbol
    repos.eliminar(sesion, posicion)

    if affect_savings and valor > 0:
        categoria = _categoria_de_transferencia(sesion, user_id, "income")
        mes = abrir_mes_actual(sesion, user_id, ahora=ahora)
        crear_movimiento(
            sesion,
            mes,
            user_id=user_id,
            category_id=categoria.id,
            transaction_date=_hoy(ahora),
            transaction_type="income",
            amount=valor,
            description=f"Venta de {symbol}",
            source="system",
        )

    return valor
