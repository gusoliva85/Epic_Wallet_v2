"""Repositorio de vencimientos · F13-T03.

Referencia: 02_Documento_Tecnico.md §5.1

Sólo consultas, sin decidir nada: qué estado tiene un vencimiento lo
decide `services.vencimientos`, y cuándo se da por pagado lo decide
`routers/dues.py` con lo que lee del mes en curso.

Ninguna consulta filtra por `user_id`, igual que el resto de los
repositorios: la sesión es una `SesionDeUsuario` y RLS filtra sola.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import CategoryDue


def listar(sesion: Session) -> list[CategoryDue]:
    """Los vencimientos configurados del usuario, prendidos y apagados.

    Apagados incluidos a propósito: la pantalla de Vencimientos tiene
    que poder mostrar el día y el aviso que quedaron guardados cuando
    se vuelve a prender uno.
    """
    return list(sesion.scalars(select(CategoryDue).order_by(CategoryDue.due_day)))


def buscar_por_categoria(sesion: Session, category_id: int) -> CategoryDue | None:
    return sesion.scalars(
        select(CategoryDue).where(CategoryDue.category_id == category_id)
    ).one_or_none()


def guardar(
    sesion: Session,
    *,
    user_id: str,
    category_id: int,
    enabled: bool,
    due_day: int,
    notice_days: int,
) -> CategoryDue:
    """Crea el vencimiento de esa categoría o actualiza el que ya está.

    Un solo camino para las dos cosas porque del lado de la pantalla
    también es uno: el interruptor de un ítem que nunca se configuró y
    el de uno que ya tenía día son el mismo interruptor.
    """
    fila = buscar_por_categoria(sesion, category_id)
    if fila is None:
        fila = CategoryDue(
            user_id=user_id,
            category_id=category_id,
            enabled=enabled,
            due_day=due_day,
            notice_days=notice_days,
        )
        sesion.add(fila)
    else:
        fila.enabled = enabled
        fila.due_day = due_day
        fila.notice_days = notice_days

    sesion.flush()
    sesion.refresh(fila)
    return fila
