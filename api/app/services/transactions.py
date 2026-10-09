"""Lógica de movimientos: validación y recálculo del mes · F04-T01.

Referencia: 02_Documento_Tecnico.md §6.2, §9.4 · General §8 (entidad,
fecha, importe, descripción), Reglas 5 y 6 (ingreso aumenta el
ahorro, egreso lo disminuye)

Funciones puras, sin base de datos — mismo criterio que
`services/months.py` y `services/categories.py`: reciben números (o
una lista de movimientos ya armada) y devuelven números. Lo que SÍ
necesita la base —que la categoría exista y esté activa— no vive
acá; eso lo valida el repositorio cuando `transactions` exista
(F04-T03).

Si una categoría le sirve a un movimiento de cierto tipo ya lo
resuelve `tipo_coincide` en `services/categories.py` (construida en
F03-T08 justo para esto): no se repite acá, se importa.
"""

from __future__ import annotations

import datetime as dt
import decimal
from typing import NamedTuple

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
