"""Repositorio de inversiones · F10-T04.

Referencia: 02_Documento_Tecnico.md §6.2

Sólo consultas y escrituras lisas; ninguna decide nada —ni cómo se
valúa una posición (`services.calc.valor_de_inversion`, F10-T01) ni
qué pasa con el ahorro al comprar o vender (`services.investments`).
Ninguna filtra por `user_id`: `SesionDeUsuario` ya deja a Postgres
actuando como `auth.uid()` del token, RLS hace el resto.
"""

from __future__ import annotations

import decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Investment


def listar(sesion: Session, *, active: bool | None = True) -> list[Investment]:
    """Por símbolo, igual que el índice de la tabla (Técnico §6.2).
    `active=None` trae también las pausadas; el default (`True`) es lo
    que necesita la cartera que se muestra."""
    consulta = select(Investment).order_by(Investment.symbol)
    if active is not None:
        consulta = consulta.where(Investment.active == active)
    return list(sesion.scalars(consulta))


def buscar_por_id(sesion: Session, investment_id: int) -> Investment | None:
    return sesion.get(Investment, investment_id)


def crear(
    sesion: Session,
    *,
    user_id: str,
    symbol: str,
    name: str,
    investment_type: str,
    nominal_quantity: decimal.Decimal,
    initial_value: decimal.Decimal,
    current_value: decimal.Decimal,
) -> Investment:
    posicion = Investment(
        user_id=user_id,
        symbol=symbol,
        name=name,
        investment_type=investment_type,
        nominal_quantity=nominal_quantity,
        initial_value=initial_value,
        current_value=current_value,
    )
    sesion.add(posicion)
    sesion.flush()
    return posicion


def eliminar(sesion: Session, posicion: Investment) -> None:
    """Borra de verdad. General §21: "no se conservará una bitácora de
    operaciones de compra/venta" — vender una posición no dura como
    fila desactivada, desaparece, igual que en F02-T04/`categories`
    cuando SÍ hay histórico que proteger (acá no hay ninguno que
    proteger: por diseño, la inversión no deja rastro financiero más
    allá de la metadata técnica que la propia auditoría de Postgres
    guarda aparte)."""
    sesion.delete(posicion)
    sesion.flush()
