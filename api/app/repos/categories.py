"""Repositorio de categorías · F03-T08.

Referencia: 02_Documento_Tecnico.md §5.1

Sólo consultas; nada decide acá. Igual que `repos/months.py`, ninguna
filtra por `user_id`: la sesión que llega es una `SesionDeUsuario`
(F02-T05) y RLS ya deja ver sólo lo del usuario del token.
"""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Category


def listar(sesion: Session, *, type_: str | None = None, active: bool | None = None) -> list[Category]:
    """En el orden en que se muestran siempre: `sort_order` primero,
    que es el que fija el trigger al crear la cuenta y el que respeta
    el reordenamiento manual del día que exista."""
    consulta = select(Category).order_by(Category.sort_order)
    if type_ is not None:
        consulta = consulta.where(Category.type == type_)
    if active is not None:
        consulta = consulta.where(Category.active == active)
    return list(sesion.scalars(consulta))


def buscar_por_id(sesion: Session, category_id: int) -> Category | None:
    return sesion.get(Category, category_id)


def siguiente_orden(sesion: Session, type_: str) -> int:
    """Una categoría nueva se agrega al final de su tipo, nunca en
    medio: usar el máximo de `sort_order` de ese tipo y sumarle uno es
    lo mismo que ya hace el trigger de F02-T04 al sembrar las 21
    iniciales, sólo que acá el tipo ya trae categorías puestas."""
    maximo = sesion.scalar(
        select(func.max(Category.sort_order)).where(Category.type == type_)
    )
    return (maximo or 0) + 1


def crear(
    sesion: Session, *, user_id: str, name: str, type_: str, sort_order: int
) -> Category:
    categoria = Category(user_id=user_id, name=name, type=type_, sort_order=sort_order)
    sesion.add(categoria)
    sesion.flush()
    return categoria


def eliminar(sesion: Session, categoria: Category) -> None:
    """Borra de verdad. Si algún día existe un movimiento que la
    referencia, la restricción `on delete restrict` de `transactions`
    (F04) hace que esto falle con un `IntegrityError` — el router es
    quien lo traduce a un 409 con un mensaje que lo explica, no esta
    función."""
    sesion.delete(categoria)
    sesion.flush()
