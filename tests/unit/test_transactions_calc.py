"""Lógica de movimientos: validación y recálculo del mes · F04-T01."""

from __future__ import annotations

import datetime as dt
import decimal

import pytest
from api.app.services import transactions as servicio
from api.app.services.categories import tipo_coincide
from api.app.services.months import Periodo

D = decimal.Decimal


# ===================================================================
#  Validación · amount
# ===================================================================


@pytest.mark.unit
@pytest.mark.parametrize("amount", [D("0.01"), D("1"), D("999999999999.99")])
def test_un_importe_positivo_es_valido(amount: decimal.Decimal) -> None:
    assert servicio.importe_valido(amount) is True


@pytest.mark.unit
@pytest.mark.parametrize("amount", [D("0"), D("-0.01"), D("-100")])
def test_cero_o_negativo_no_es_valido(amount: decimal.Decimal) -> None:
    # Criterio de aceptación de la tarea.
    assert servicio.importe_valido(amount) is False


# ===================================================================
#  Validación · fecha dentro del mes
# ===================================================================


@pytest.mark.unit
def test_una_fecha_del_mes_indicado_es_valida() -> None:
    periodo = Periodo(2026, 10)
    assert servicio.fecha_en_el_mes(dt.date(2026, 10, 1), periodo) is True
    assert servicio.fecha_en_el_mes(dt.date(2026, 10, 31), periodo) is True


@pytest.mark.unit
def test_una_fecha_de_otro_mes_no_es_valida() -> None:
    # Criterio de aceptación de la tarea.
    periodo = Periodo(2026, 10)
    assert servicio.fecha_en_el_mes(dt.date(2026, 9, 30), periodo) is False
    assert servicio.fecha_en_el_mes(dt.date(2026, 11, 1), periodo) is False


@pytest.mark.unit
def test_una_fecha_del_mismo_mes_de_otro_anio_no_es_valida() -> None:
    periodo = Periodo(2026, 10)
    assert servicio.fecha_en_el_mes(dt.date(2025, 10, 15), periodo) is False


# ===================================================================
#  Validación · descripción
# ===================================================================


@pytest.mark.unit
def test_sin_descripcion_es_valido() -> None:
    # General §8.5: es opcional.
    assert servicio.descripcion_valida(None) is True


@pytest.mark.unit
def test_una_descripcion_vacia_es_valida() -> None:
    # Opcional, y sin un mínimo: a diferencia del nombre de una
    # categoría, acá vacío no es "sin sentido", es "no se cargó".
    assert servicio.descripcion_valida("") is True
    assert servicio.descripcion_valida("   ") is True


@pytest.mark.unit
def test_una_descripcion_de_500_caracteres_es_valida() -> None:
    assert servicio.descripcion_valida("x" * 500) is True


@pytest.mark.unit
def test_una_descripcion_de_501_caracteres_no_es_valida() -> None:
    # Criterio de aceptación de la tarea.
    assert servicio.descripcion_valida("x" * 501) is False


@pytest.mark.unit
def test_el_largo_se_mide_sin_los_espacios_de_los_bordes() -> None:
    assert servicio.descripcion_valida("  " + "x" * 500 + "  ") is True


# ===================================================================
#  Validación · la categoría tiene que servirle a ese tipo de movimiento
# ===================================================================


@pytest.mark.unit
def test_una_categoria_de_ingreso_no_sirve_para_un_egreso() -> None:
    # Criterio de aceptación de la tarea. La función la construyó
    # F03-T08 (`tipo_coincide`) justo para este uso; acá se confirma
    # que el camino de movimientos de verdad la usa.
    assert tipo_coincide("income", "expense") is False
    assert tipo_coincide("expense", "income") is False


@pytest.mark.unit
def test_una_categoria_del_mismo_tipo_sirve() -> None:
    assert tipo_coincide("income", "income") is True
    assert tipo_coincide("expense", "expense") is True


# ===================================================================
#  Recálculo del mes
# ===================================================================


@pytest.mark.unit
def test_un_mes_sin_movimientos_da_todos_los_totales_en_cero() -> None:
    # Criterio de aceptación de la tarea: cero, no un error ni una
    # división.
    totales = servicio.recalcular_mes([])
    assert totales.income_total == D("0.00")
    assert totales.expense_total == D("0.00")
    assert totales.saving_total == D("0.00")
    assert totales.por_categoria == {}


@pytest.mark.unit
def test_suma_ingresos_y_egresos_por_separado() -> None:
    movimientos = [
        servicio.Movimiento(category_id=1, transaction_type="income", amount=D("100000.00")),
        servicio.Movimiento(category_id=2, transaction_type="expense", amount=D("30000.00")),
        servicio.Movimiento(category_id=2, transaction_type="expense", amount=D("5000.00")),
    ]
    totales = servicio.recalcular_mes(movimientos)
    assert totales.income_total == D("100000.00")
    assert totales.expense_total == D("35000.00")


@pytest.mark.unit
def test_el_ahorro_es_ingresos_menos_egresos() -> None:
    # Reglas 5 y 6 del documento general.
    movimientos = [
        servicio.Movimiento(category_id=1, transaction_type="income", amount=D("100000.00")),
        servicio.Movimiento(category_id=2, transaction_type="expense", amount=D("35000.00")),
    ]
    totales = servicio.recalcular_mes(movimientos)
    assert totales.saving_total == D("65000.00")


@pytest.mark.unit
def test_el_ahorro_puede_dar_negativo_sin_romperse() -> None:
    movimientos = [
        servicio.Movimiento(category_id=1, transaction_type="income", amount=D("10000.00")),
        servicio.Movimiento(category_id=2, transaction_type="expense", amount=D("40000.00")),
    ]
    totales = servicio.recalcular_mes(movimientos)
    assert totales.saving_total == D("-30000.00")


@pytest.mark.unit
def test_el_total_por_categoria_agrupa_varios_movimientos_de_la_misma() -> None:
    movimientos = [
        servicio.Movimiento(category_id=7, transaction_type="expense", amount=D("18700.00")),
        servicio.Movimiento(category_id=7, transaction_type="expense", amount=D("22500.00")),
        servicio.Movimiento(category_id=9, transaction_type="income", amount=D("500000.00")),
    ]
    totales = servicio.recalcular_mes(movimientos)
    assert totales.por_categoria == {
        7: D("41200.00"),
        9: D("500000.00"),
    }
