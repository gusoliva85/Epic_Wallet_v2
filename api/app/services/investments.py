"""Servicio de cartera · F10-T04.

Referencia: 02_Documento_Tecnico.md §6.2, §7.3 · General §20, §21, §22

Sólo la cartera: alta, baja e indicadores. Mover la plata entre ahorro
e inversión —Regla 7, un movimiento `source='system'` con una
categoría de transferencia (Técnico §7.3)— es del endpoint, no de
acá: "el endpoint es uno solo y hace las dos puntas en una
transacción", textual del técnico. F10-T06 arma esa parte encima de
`comprar_posicion`/`vender_posicion`.

La sesión por pedido ya hace `commit()` al terminar y `rollback()` si
algo tira una excepción (`core/db.py`) — nadie acá llama `commit()` a
mano, así que una falla a mitad de camino deja la cartera como estaba
antes, nunca a medias (criterio de aceptación de la tarea).
"""

from __future__ import annotations

import decimal
from typing import NamedTuple

from sqlalchemy.orm import Session

from ..models import Investment
from ..repos import investments as repos
from . import calc


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
) -> Investment:
    """Alta de una posición nueva (General §20.1). El valor con el que
    se compra es, a la vez, el valor inicial y el valor actual del día
    cero —todavía no pasó tiempo para que rinda ni pierda nada."""
    valor = calc.valor_de_inversion(valuation_mode, nominal_quantity, current_unit_price, valor_manual)
    return repos.crear(
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


def vender_posicion(sesion: Session, posicion: Investment) -> decimal.Decimal:
    """Venta: borra la posición —General §21, sin bitácora de
    compra/venta— y devuelve su valor actual, el importe que el
    endpoint acredita al ahorro con la transferencia del otro lado
    (Técnico §7.3)."""
    valor = posicion.current_value
    repos.eliminar(sesion, posicion)
    return valor
