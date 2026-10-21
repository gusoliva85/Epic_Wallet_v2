"""Servicio de cartera · F10-T04 (alta, baja, indicadores).

Referencia: 02_Documento_Tecnico.md §6.2, §7.3 · General §20, §21, §22

**Revisado 2026-10-20:** una posición no se valúa por nominales por
precio unitario. `initial_value` y `current_value` son siempre el
importe total que Gustavo carga a mano —"precio de compra" y "precio
actual"—; `nominal_quantity` es sólo informativo. Se sacó
`calc.valor_de_inversion` entero, no hace falta ninguna cuenta para
armar el valor de una posición nueva.

La cartera es información, no bitácora de gastos (decisión de Gustavo,
2026-10-17, revisa lo que decía antes el técnico §7.3 — incluida una
primera versión de este mismo servicio que sí transfería plata con el
ahorro, F10-T06): comprar o vender una posición acá **no mueve un peso
del ahorro del mes**. El dinero que entra o sale de la cuenta de
inversión se carga aparte, a mano, en Movimientos, bajo una categoría
"Inversiones" como cualquier otra — porque lo que se deposita en la
cuenta de inversión no coincide con lo que se termina comprando (queda
plata sin invertir, por cobrar, etc.), así que no hay un importe de
cartera del que derivar un movimiento automático sin inventar un
número.

La sesión por pedido ya hace `commit()` al terminar y `rollback()` si
algo tira una excepción (`core/db.py`) — nadie acá llama `commit()` a
mano, así que una compra o venta a medio camino deja todo como estaba
antes, nunca a medias (criterio de aceptación de F10-T04).
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
    initial_value: decimal.Decimal,
    nominal_quantity: decimal.Decimal = decimal.Decimal("0"),
) -> Investment:
    """Alta de una posición nueva (General §20.1). El precio de compra
    con el que se carga es, a la vez, el valor inicial y el valor
    actual del día cero —todavía no pasó tiempo para que rinda ni
    pierda nada."""
    return repos.crear(
        sesion,
        user_id=user_id,
        symbol=symbol,
        name=name,
        investment_type=investment_type,
        nominal_quantity=nominal_quantity,
        initial_value=initial_value,
        current_value=initial_value,
    )


def vender_posicion(sesion: Session, posicion: Investment) -> None:
    """Venta: borra la posición — General §21, sin bitácora de compra
    ni venta."""
    repos.eliminar(sesion, posicion)
