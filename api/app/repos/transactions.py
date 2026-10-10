"""Repositorio de movimientos · F04-T05.

Referencia: 02_Documento_Tecnico.md §5.1

Sólo consultas; nada decide acá — mismo criterio que
`repos/months.py` y `repos/categories.py`. Ninguna filtra por
`user_id`: la sesión que llega siempre es una `SesionDeUsuario`
(F02-T05) y RLS ya deja ver sólo lo del usuario del token.
"""

from __future__ import annotations

import datetime as dt
import decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Transaction


def crear(
    sesion: Session,
    *,
    user_id: str,
    month_id: int,
    category_id: int,
    transaction_date: dt.date,
    transaction_type: str,
    amount: decimal.Decimal,
    description: str | None = None,
) -> Transaction:
    movimiento = Transaction(
        user_id=user_id,
        month_id=month_id,
        category_id=category_id,
        transaction_date=transaction_date,
        transaction_type=transaction_type,
        amount=amount,
        description=description,
    )
    sesion.add(movimiento)
    sesion.flush()
    return movimiento


def buscar_por_id(sesion: Session, transaction_id: int) -> Transaction | None:
    return sesion.get(Transaction, transaction_id)


def listar_por_mes(sesion: Session, month_id: int) -> list[Transaction]:
    """Los movimientos de un mes, del más nuevo al más viejo — mismo
    orden que `transactions_month_idx`, el que va a usar la lista del
    mes (F04-T12)."""
    return list(
        sesion.scalars(
            select(Transaction)
            .where(Transaction.month_id == month_id)
            .order_by(Transaction.transaction_date.desc(), Transaction.id.desc())
        )
    )


def eliminar(sesion: Session, movimiento: Transaction) -> None:
    sesion.delete(movimiento)
    sesion.flush()
