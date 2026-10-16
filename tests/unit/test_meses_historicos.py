"""Lógica de mes histórico y saldo acumulado en cadena · F08-T01.

Referencia: 02_Documento_Tecnico.md §7, §9.4 · General §18, §19, §50 (R4)

Los tres criterios de aceptación de la tarea, cada uno con su prueba:
cargar un mes histórico recalcula el acumulado de todos los meses
posteriores, un mes `open` con movimientos no se puede convertir en
consolidado sin aviso explícito, y el acumulado parte del saldo
inicial del perfil. La cadena en sí (`ahorro_acumulado` /
`serie_de_ahorro_acumulado`) ya existe desde F05-T01 — acá se prueba
que esas funciones alcanzan para el caso de F08, y se agregan las dos
validaciones nuevas que les faltaban a los meses históricos.
"""

from __future__ import annotations

import decimal

import pytest
from api.app.services import calc, months
from api.app.services.months import ABIERTO, HISTORICO

D = decimal.Decimal


# ===================================================================
#  totales_historicos_son_validos
# ===================================================================


@pytest.mark.unit
def test_totales_positivos_son_validos() -> None:
    assert months.totales_historicos_son_validos(D("100000.00"), D("40000.00"), D("60000.00")) is True


@pytest.mark.unit
def test_totales_en_cero_son_validos() -> None:
    # Un mes histórico sin ingresos ni gastos cargados es un dato real
    # (por ejemplo, un mes en blanco del Excel), no un error.
    assert months.totales_historicos_son_validos(D("0"), D("0"), D("0")) is True


@pytest.mark.unit
@pytest.mark.parametrize(
    "income,expense",
    [
        (D("-1"), D("0")),
        (D("0"), D("-1")),
    ],
)
def test_ingreso_o_egreso_negativo_no_es_valido(
    income: decimal.Decimal, expense: decimal.Decimal
) -> None:
    assert months.totales_historicos_son_validos(income, expense, D("0")) is False


@pytest.mark.unit
def test_el_ahorro_negativo_es_valido() -> None:
    """Criterio de aceptación de la tarea (bug real, encontrado por
    Gustavo cargando un mes donde gastó más de lo que ganó): el
    ahorro negativo no es un error, ingresos y egresos siguen siendo
    los dos no negativos."""
    assert months.totales_historicos_son_validos(D("100000.00"), D("150000.00"), D("-50000.00")) is True


# ===================================================================
#  requiere_confirmacion_para_historico
# ===================================================================


@pytest.mark.unit
def test_un_mes_abierto_con_movimientos_requiere_confirmacion() -> None:
    # Criterio de aceptación de la tarea: convertirlo pisaría los
    # movimientos individuales con los totales manuales de la carga.
    assert months.requiere_confirmacion_para_historico(ABIERTO, tiene_movimientos=True) is True


@pytest.mark.unit
def test_un_mes_abierto_sin_movimientos_no_requiere_confirmacion() -> None:
    # No hay nada que pisar: convertirlo es gratis.
    assert months.requiere_confirmacion_para_historico(ABIERTO, tiene_movimientos=False) is False


@pytest.mark.unit
def test_un_mes_que_todavia_no_existe_no_requiere_confirmacion() -> None:
    assert months.requiere_confirmacion_para_historico(None, tiene_movimientos=False) is False


@pytest.mark.unit
def test_corregir_un_mes_ya_historico_no_requiere_confirmacion() -> None:
    # General §6.3: un mes histórico se puede corregir si el usuario
    # detecta un error. No tiene movimientos individuales que perder.
    assert months.requiere_confirmacion_para_historico(HISTORICO, tiene_movimientos=False) is False


# ===================================================================
#  El acumulado parte del saldo inicial del perfil
# ===================================================================


@pytest.mark.unit
def test_el_acumulado_parte_del_saldo_inicial_del_perfil() -> None:
    # Criterio de aceptación de la tarea. Con un solo mes histórico
    # cargado, el acumulado es el saldo inicial más el ahorro de ese
    # mes — nada más.
    saldo_inicial = D("3892869.00")
    ahorro_del_mes = D("150000.00")
    assert calc.ahorro_acumulado(saldo_inicial, [ahorro_del_mes]) == D("4042869.00")


# ===================================================================
#  Cargar un mes histórico recalcula el acumulado de los posteriores
# ===================================================================


@pytest.mark.unit
def test_corregir_un_mes_del_medio_cambia_el_acumulado_de_los_posteriores() -> None:
    """Criterio de aceptación de la tarea. Enero, febrero y marzo ya
    estaban cargados; se detecta un error en febrero y se lo corrige.
    El acumulado de enero no cambia —es anterior—, pero el de febrero
    Y el de marzo sí, porque el saldo acumulado es una suma corrida
    (Técnico §7.2, punto 3): no alcanza con recalcular el mes propio.
    """
    saldo_inicial = D("1000000.00")
    ahorros_originales = [D("100000.00"), D("50000.00"), D("80000.00")]  # ene, feb, mar
    serie_original = calc.serie_de_ahorro_acumulado(saldo_inicial, ahorros_originales)

    # Se corrige el ahorro de febrero: estaba mal cargado.
    ahorros_corregidos = [D("100000.00"), D("20000.00"), D("80000.00")]
    serie_corregida = calc.serie_de_ahorro_acumulado(saldo_inicial, ahorros_corregidos)

    assert serie_corregida[0] == serie_original[0]  # enero: no cambia
    assert serie_corregida[1] != serie_original[1]  # febrero: el propio mes
    assert serie_corregida[2] != serie_original[2]  # marzo: el posterior también
    assert serie_corregida[1] == D("1120000.00")
    assert serie_corregida[2] == D("1200000.00")
