"""Repositorio de totales por categoría · F04-T05.

Referencia: 02_Documento_Tecnico.md §5.1, §6.2

Sólo lo que hace falta para que `services.transactions` deje
`monthly_category_totals` coincidiendo con lo recién recalculado.
Nada decide acá: los totales ya vienen calculados por
`services.transactions.recalcular_mes`, esto sólo los guarda.
"""

from __future__ import annotations

import decimal

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..models import MonthlyCategoryTotal


def listar_por_mes(sesion: Session, month_id: int) -> list[MonthlyCategoryTotal]:
    return list(
        sesion.scalars(
            select(MonthlyCategoryTotal).where(MonthlyCategoryTotal.month_id == month_id)
        )
    )


def reemplazar_automaticos(
    sesion: Session,
    *,
    user_id: str,
    month_id: int,
    totales: dict[int, decimal.Decimal],
) -> None:
    """Deja las filas automáticas de ese mes coincidiendo con
    `totales`: borra las que había y vuelve a insertar las que
    corresponden. Nunca toca `is_manual_summary = true` —esas son las
    de un mes histórico (Fase 8), que no pasan por acá.

    Recalcular desde cero, en vez de ajustar fila por fila, es lo que
    garantiza que una categoría que se quedó sin movimientos (se borró
    el último, o se editó a otra categoría) desaparece de la tabla en
    vez de quedar con un total viejo.
    """
    sesion.execute(
        delete(MonthlyCategoryTotal).where(
            MonthlyCategoryTotal.month_id == month_id,
            MonthlyCategoryTotal.is_manual_summary.is_(False),
        )
    )
    for category_id, total in totales.items():
        sesion.add(
            MonthlyCategoryTotal(
                user_id=user_id,
                month_id=month_id,
                category_id=category_id,
                total_amount=total,
                is_manual_summary=False,
            )
        )
    sesion.flush()
