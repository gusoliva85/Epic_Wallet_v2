"""Lógica de movimientos: validación y recálculo del mes · F04-T01.
Servicio de recálculo transaccional desde F04-T05.

Referencia: 02_Documento_Tecnico.md §6.2, §7.2, §9.4 · General §8
(entidad, fecha, importe, descripción), Reglas 5 y 6 (ingreso aumenta
el ahorro, egreso lo disminuye)

La parte de arriba es cálculo puro, sin base de datos — mismo
criterio que `services/months.py` y `services/categories.py`: reciben
números (o una lista de movimientos ya armada) y devuelven números.

Desde "Escribir un movimiento y recalcular" para abajo, la excepción:
`crear_movimiento`, `actualizar_movimiento` y `borrar_movimiento`
tocan la base, igual que `services.months.abrir_mes_actual` es la
única función de ese archivo que lo hace. No validan nada de
`category_id` ni de tipo —eso es `tipo_coincide` de
`services/categories.py`, y lo llama el router (F04-T06): acá sólo se
garantiza que escribir y recalcular pasa junto, en la misma
transacción.
"""

from __future__ import annotations

import datetime as dt
import decimal
from typing import NamedTuple

from sqlalchemy.orm import Session

from ..models import Month, Transaction
from ..repos import monthly_category_totals as repos_totales
from ..repos import transactions as repos_movimientos
from .months import Periodo

# General §8.5: la descripción es opcional y no tiene mínimo, sólo
# este máximo (Técnico §9.4).
LARGO_MAXIMO_DESCRIPCION = 500


def importe_valido(amount: decimal.Decimal) -> bool:
    """General §8.4: el importe es siempre positivo. El signo contable
    —ingreso o egreso— lo decide `transaction_type`, nunca el número."""
    return amount > 0


def fecha_en_el_mes(fecha: dt.date, periodo: Periodo) -> bool:
    """La fecha del movimiento tiene que caer en el año y mes del
    `months` al que se lo quiere asociar. No alcanza con que sea una
    fecha válida: un movimiento de septiembre no puede cargarse contra
    el mes de octubre."""
    return (fecha.year, fecha.month) == (periodo.year, periodo.month)


def descripcion_valida(description: str | None) -> bool:
    """Ausente es válido —es opcional—; presente, hasta 500 caracteres
    (Técnico §9.4). Se mide sin los espacios de los bordes, mismo
    criterio que el nombre de una categoría."""
    if description is None:
        return True
    return len(description.strip()) <= LARGO_MAXIMO_DESCRIPCION


class Movimiento(NamedTuple):
    """Lo mínimo que necesita el recálculo. No es el modelo de
    `transactions` —que todavía no existe—, es sólo la forma que hace
    falta para sumar. Cuando `transactions` exista, el repositorio
    arma una lista de éstos antes de llamar a `recalcular_mes`, igual
    que `routers/months.py` ya hace pasándole movimientos sueltos a
    `transacciones_del_mes`."""

    category_id: int
    transaction_type: str
    amount: decimal.Decimal


class TotalesDelMes(NamedTuple):
    """Lo que un mes necesita guardar (Técnico §6.2, columnas de
    `months`) más el desglose por categoría (`monthly_category_totals`,
    F04-T03)."""

    income_total: decimal.Decimal
    expense_total: decimal.Decimal
    saving_total: decimal.Decimal
    por_categoria: dict[int, decimal.Decimal]


def recalcular_mes(movimientos: list[Movimiento]) -> TotalesDelMes:
    """Los totales de un mes a partir de sus movimientos.

    Sin movimientos, todos los totales dan cero — nunca un error ni una
    división (criterio de aceptación de la tarea): un mes recién
    abierto no tiene nada que sumar todavía, y eso no es un caso raro,
    es el estado inicial de cualquier mes.
    """
    income_total = decimal.Decimal("0.00")
    expense_total = decimal.Decimal("0.00")
    por_categoria: dict[int, decimal.Decimal] = {}

    for m in movimientos:
        if m.transaction_type == "income":
            income_total += m.amount
        else:
            expense_total += m.amount
        por_categoria[m.category_id] = por_categoria.get(m.category_id, decimal.Decimal("0.00")) + m.amount

    return TotalesDelMes(
        income_total=income_total,
        expense_total=expense_total,
        # Reglas 5 y 6: ingreso aumenta el ahorro, egreso lo disminuye.
        saving_total=income_total - expense_total,
        por_categoria=por_categoria,
    )


# ===================================================================
#  Escribir un movimiento y recalcular · F04-T05
# ===================================================================


def recalcular_y_guardar_mes(sesion: Session, mes: Month) -> TotalesDelMes:
    """Relee los movimientos de `mes` desde la base, los recalcula con
    `recalcular_mes` y deja el resultado guardado en `months` y en
    `monthly_category_totals`.

    No hace `sesion.commit()`: vive en la misma sesión que la
    escritura que la llamó (`crear_movimiento`, etc.), así que si algo
    de esto falla —la base abajo, una restricción— la excepción sube
    y el `rollback` de `sesion_de_usuario` deshace también el
    movimiento que lo disparó. Es lo que pide el criterio de
    aceptación de la tarea: nunca un movimiento guardado a medias.
    """
    filas = repos_movimientos.listar_por_mes(sesion, mes.id)
    movimientos = [
        Movimiento(category_id=f.category_id, transaction_type=f.transaction_type, amount=f.amount)
        for f in filas
    ]
    totales = recalcular_mes(movimientos)

    mes.income_total = totales.income_total
    mes.expense_total = totales.expense_total
    mes.saving_total = totales.saving_total

    repos_totales.reemplazar_automaticos(
        sesion, user_id=mes.user_id, month_id=mes.id, totales=totales.por_categoria
    )
    sesion.flush()
    return totales


def crear_movimiento(
    sesion: Session,
    mes: Month,
    *,
    user_id: str,
    category_id: int,
    transaction_date: dt.date,
    transaction_type: str,
    amount: decimal.Decimal,
    description: str | None = None,
) -> Transaction:
    """Inserta el movimiento y recalcula `mes` en la misma transacción."""
    movimiento = repos_movimientos.crear(
        sesion,
        user_id=user_id,
        month_id=mes.id,
        category_id=category_id,
        transaction_date=transaction_date,
        transaction_type=transaction_type,
        amount=amount,
        description=description,
    )
    recalcular_y_guardar_mes(sesion, mes)
    return movimiento


def actualizar_movimiento(
    sesion: Session, mes: Month, movimiento: Transaction, cambios: dict[str, object]
) -> Transaction:
    """Aplica `cambios` sobre `movimiento` y recalcula `mes`.

    `cambios` ya viene filtrado por quien llama (el router de
    F04-T06, con `exclude_unset`) — acá no se decide qué campos son
    válidos, sólo se asignan y se recalcula."""
    for campo, valor in cambios.items():
        setattr(movimiento, campo, valor)
    sesion.flush()
    recalcular_y_guardar_mes(sesion, mes)
    return movimiento


def borrar_movimiento(sesion: Session, mes: Month, movimiento: Transaction) -> None:
    """Borra el movimiento y recalcula `mes` en la misma transacción."""
    repos_movimientos.eliminar(sesion, movimiento)
    recalcular_y_guardar_mes(sesion, mes)
