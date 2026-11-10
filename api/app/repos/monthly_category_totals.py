"""Repositorio de totales por categoría · F04-T05.

Referencia: 02_Documento_Tecnico.md §5.1, §6.2

Sólo lo que hace falta para que `services.transactions` deje
`monthly_category_totals` coincidiendo con lo recién recalculado.
Nada decide acá: los totales ya vienen calculados por
`services.transactions.recalcular_mes`, esto sólo los guarda.
"""

from __future__ import annotations

import decimal

from sqlalchemy import and_, delete, select
from sqlalchemy.orm import Session

from ..models import Month, MonthlyCategoryTotal


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


def reemplazar_manuales(
    sesion: Session,
    *,
    user_id: str,
    month_id: int,
    totales: dict[int, decimal.Decimal],
) -> None:
    """Deja las filas de un mes histórico coincidiendo con `totales`
    (F08-T03): borra TODAS las filas que hubiera para ese mes —
    automáticas o manuales— y vuelve a insertar las manuales que
    correspondan.

    Borra sin distinguir `is_manual_summary` a propósito, a diferencia
    de `reemplazar_automaticos`: un mes que se consolida puede traer
    filas automáticas viejas de cuando todavía era `open` (F04-T05 las
    dejó ahí antes de convertirlo), y esas filas quedarían huérfanas
    —ningún `transactions` detrás— si no se limpian. Esto borra el
    resumen por categoría, nunca los movimientos individuales: esos no
    se tocan (General §6.3, §50 R4; CLAUDE.md "no se eliminan datos
    reales")."""
    sesion.execute(delete(MonthlyCategoryTotal).where(MonthlyCategoryTotal.month_id == month_id))
    for category_id, total in totales.items():
        sesion.add(
            MonthlyCategoryTotal(
                user_id=user_id,
                month_id=month_id,
                category_id=category_id,
                total_amount=total,
                is_manual_summary=True,
            )
        )
    sesion.flush()


def historial_de_categoria(
    sesion: Session, category_id: int
) -> list[tuple[int, int, str, decimal.Decimal | None]]:
    """El total de una categoría en CADA mes del usuario, del más viejo
    al más nuevo: `(year, month, status, total)` · F13-T02.

    `outerjoin` y no `join`: los meses en los que esa categoría no tuvo
    nada tienen que venir igual, con `total` en `None`. Con un join
    interno desaparecerían de la serie y el gráfico mostraría doce
    meses seguidos de facultad donde en realidad hubo dos de vacaciones
    — un `None` acá es lo que deja decir "sin dato" en vez de "cero"
    (`services.calc.resumen_de_comparacion` depende de esa distinción).

    Una sola consulta para todo el histórico: la alternativa —un pedido
    por mes— son veinte viajes a São Paulo para dibujar un gráfico.

    Sin filtro por `user_id`, igual que el resto de los repositorios:
    la sesión es una `SesionDeUsuario` y RLS filtra sola.
    """
    filas = sesion.execute(
        select(Month.year, Month.month, Month.status, MonthlyCategoryTotal.total_amount)
        .select_from(Month)
        .outerjoin(
            MonthlyCategoryTotal,
            and_(
                MonthlyCategoryTotal.month_id == Month.id,
                MonthlyCategoryTotal.category_id == category_id,
            ),
        )
        .order_by(Month.year, Month.month)
    ).all()
    return [(f.year, f.month, f.status, f.total_amount) for f in filas]
