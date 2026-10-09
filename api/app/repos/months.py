"""Repositorio de meses · F03-T03.

Referencia: 02_Documento_Tecnico.md §5.1

Sólo consultas SQLAlchemy, sin decidir nada: el servicio de
`app.services.months` es quien decide si hay que crear un mes o
devolver el que ya existe.

Ninguna consulta filtra por `user_id`. No es un descuido: la sesión
que llega acá siempre es una `SesionDeUsuario` (F02-T05), que ya deja
a Postgres actuando como el usuario del token, y RLS filtra sola —el
mismo patrón que ya usan `GET`/`PATCH /api/me`. Agregar un filtro
propio no sumaría una barrera, sumaría una línea que puede tener un
bug y desalinearse de la que de verdad protege.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Month


def buscar_por_periodo(sesion: Session, year: int, month: int) -> Month | None:
    """El mes de ese año y mes del usuario de la sesión, o `None` si
    todavía no existe."""
    return sesion.scalars(
        select(Month).where(Month.year == year, Month.month == month)
    ).one_or_none()


def crear(sesion: Session, *, user_id: str, year: int, month: int, status: str) -> Month:
    """Inserta un mes nuevo y lo devuelve con el `id` ya asignado.

    `user_id` va explícito porque la fila lo necesita como valor de
    columna: RLS comprueba que coincida con `auth.uid()` al escribir,
    no lo completa por su cuenta.
    """
    mes = Month(user_id=user_id, year=year, month=month, status=status)
    sesion.add(mes)
    sesion.flush()
    return mes


def listar(sesion: Session) -> list[Month]:
    """Los meses del usuario de la sesión, del más nuevo al más viejo
    —el orden que usa la barra de mes y el historial."""
    return list(
        sesion.scalars(select(Month).order_by(Month.year.desc(), Month.month.desc()))
    )
