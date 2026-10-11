"""Cálculos del dashboard · F05-T01.

Referencia: 02_Documento_Tecnico.md §7.1 · General §12.2, §52

Los cuatro criterios de aceptación de la tarea, cada uno con su
prueba: tasa de ahorro con ingresos en cero da `None`
(`test_tasa_de_ahorro_con_ingresos_en_cero_da_none`), un mes vacío da
ceros (`test_un_mes_sin_movimientos_da_todo_en_cero`), la serie diaria
de un mes histórico es `None`
(`test_la_serie_diaria_de_un_mes_historico_es_none`), y cada función
es pura: nada de acá toca la base ni recibe algo que no sea un
`Decimal`, una lista de `Decimal` o un `str` de estado.
"""

from __future__ import annotations

import decimal

import pytest
from api.app.services import calc
from api.app.services.months import ABIERTO, HISTORICO

D = decimal.Decimal


# ===================================================================
#  money · redondeo contable
# ===================================================================


@pytest.mark.unit
def test_money_redondea_a_dos_decimales() -> None:
    assert calc.money(D("100.005")) == D("100.01")
    assert calc.money(D("100.004")) == D("100.00")


@pytest.mark.unit
def test_money_redondea_el_medio_hacia_arriba() -> None:
    # ROUND_HALF_UP, no el "banker's rounding" por defecto de Python.
    assert calc.money(D("0.125")) == D("0.13")


# ===================================================================
#  ahorro_del_mes · Reglas 5 y 6
# ===================================================================


@pytest.mark.unit
def test_el_ahorro_es_ingresos_menos_egresos() -> None:
    assert calc.ahorro_del_mes(D("100000.00"), D("35000.00")) == D("65000.00")


@pytest.mark.unit
def test_el_ahorro_puede_dar_negativo() -> None:
    # Técnico §7.1: gastar más de lo que entró es un resultado válido,
    # no un error — se muestra con signo menos.
    assert calc.ahorro_del_mes(D("10000.00"), D("40000.00")) == D("-30000.00")


@pytest.mark.unit
def test_un_mes_sin_movimientos_da_todo_en_cero() -> None:
    # Criterio de aceptación de la tarea.
    assert calc.ahorro_del_mes(D("0"), D("0")) == D("0.00")


# ===================================================================
#  participacion · la forma general detrás de tasa_de_ahorro y share
# ===================================================================


@pytest.mark.unit
def test_participacion_con_total_en_cero_da_none() -> None:
    assert calc.participacion(D("500"), D("0")) is None


@pytest.mark.unit
def test_participacion_calcula_el_porcentaje() -> None:
    assert calc.participacion(D("553000.00"), D("2419425.00")) == D("22.86")


# ===================================================================
#  variacion_porcentual · el vs_previous del dashboard
# ===================================================================


@pytest.mark.unit
def test_variacion_con_el_mes_anterior_en_cero_da_none() -> None:
    assert calc.variacion_porcentual(D("1000"), D("0")) is None


@pytest.mark.unit
def test_variacion_positiva_cuando_sube() -> None:
    assert calc.variacion_porcentual(D("110"), D("100")) == D("10.00")


@pytest.mark.unit
def test_variacion_negativa_cuando_baja() -> None:
    assert calc.variacion_porcentual(D("90"), D("100")) == D("-10.00")


@pytest.mark.unit
def test_variacion_con_base_negativa_usa_el_valor_absoluto() -> None:
    # Pasar de -$100.000 a -$50.000 de ahorro es una mejora: tiene que
    # dar positivo, no negativo (si se dividiera por el -100 tal cual
    # daría -50%, lo contrario de lo que pasó).
    assert calc.variacion_porcentual(D("-50"), D("-100")) == D("50.00")


# ===================================================================
#  tasa_de_ahorro · el caso borde central de la tarea
# ===================================================================


@pytest.mark.unit
def test_tasa_de_ahorro_con_ingresos_en_cero_da_none() -> None:
    # Criterio de aceptación de la tarea: None, nunca 0% ni una
    # ZeroDivisionError.
    assert calc.tasa_de_ahorro(D("0"), D("0")) is None
    assert calc.tasa_de_ahorro(D("0"), D("-5000")) is None


@pytest.mark.unit
def test_tasa_de_ahorro_se_calcula_sobre_cien() -> None:
    assert calc.tasa_de_ahorro(D("100000.00"), D("31700.00")) == D("31.70")


@pytest.mark.unit
def test_tasa_de_ahorro_negativa_cuando_el_ahorro_es_negativo() -> None:
    assert calc.tasa_de_ahorro(D("100000.00"), D("-25000.00")) == D("-25.00")


# ===================================================================
#  ahorro_acumulado
# ===================================================================


@pytest.mark.unit
def test_ahorro_acumulado_parte_del_saldo_inicial() -> None:
    assert calc.ahorro_acumulado(D("500000.00"), []) == D("500000.00")


@pytest.mark.unit
def test_ahorro_acumulado_suma_los_ahorros_mensuales() -> None:
    ahorros = [D("50000.00"), D("-10000.00"), D("30000.00")]
    assert calc.ahorro_acumulado(D("100000.00"), ahorros) == D("170000.00")


# ===================================================================
#  total_de_inversiones
# ===================================================================


@pytest.mark.unit
def test_total_de_inversiones_suma_el_valor_actual_de_cada_posicion() -> None:
    assert calc.total_de_inversiones([D("1200000.50"), D("37714542.50")]) == D("38914543.00")


@pytest.mark.unit
def test_total_de_inversiones_sin_posiciones_da_cero() -> None:
    assert calc.total_de_inversiones([]) == D("0.00")


# ===================================================================
#  patrimonio_neto
# ===================================================================


@pytest.mark.unit
def test_patrimonio_sin_pasivos_es_ahorros_mas_inversiones() -> None:
    # Criterio de aceptación de la tarea.
    assert calc.patrimonio_neto(D("8649377.00"), D("37714543.00")) == D("46363920.00")


@pytest.mark.unit
def test_patrimonio_resta_los_pasivos() -> None:
    assert calc.patrimonio_neto(D("100000.00"), D("50000.00"), pasivos=D("20000.00")) == D(
        "130000.00"
    )


@pytest.mark.unit
def test_comprar_una_inversion_no_cambia_el_patrimonio() -> None:
    # Regla del documento general: comprar una inversión mueve el
    # dinero de ahorro a inversión, no es un gasto. Se prueba acá en
    # la forma más directa: el mismo total repartido distinto entre
    # ahorros e inversiones da el mismo patrimonio.
    antes = calc.patrimonio_neto(D("1000000.00"), D("0.00"))
    despues = calc.patrimonio_neto(D("700000.00"), D("300000.00"))
    assert antes == despues


# ===================================================================
#  serie_de_ahorro_diaria · el gráfico principal
# ===================================================================


@pytest.mark.unit
def test_la_serie_diaria_de_un_mes_historico_es_none() -> None:
    # Criterio de aceptación de la tarea (Regla 4: un mes consolidado
    # no tiene movimientos individuales que repartir por día).
    serie = calc.serie_de_ahorro_diaria(HISTORICO, [D("1000")], [D("500")])
    assert serie is None


@pytest.mark.unit
def test_la_serie_diaria_de_un_mes_vacio_da_ceros() -> None:
    serie = calc.serie_de_ahorro_diaria(ABIERTO, [D("0"), D("0"), D("0")], [D("0"), D("0"), D("0")])
    assert serie == [D("0.00"), D("0.00"), D("0.00")]


@pytest.mark.unit
def test_la_serie_diaria_acumula_dia_a_dia() -> None:
    ingresos = [D("500000.00"), D("0"), D("0")]
    egresos = [D("0"), D("15000.00"), D("20000.00")]
    serie = calc.serie_de_ahorro_diaria(ABIERTO, ingresos, egresos)
    assert serie == [D("500000.00"), D("485000.00"), D("465000.00")]


@pytest.mark.unit
def test_la_serie_diaria_puede_bajar_de_cero() -> None:
    ingresos = [D("0"), D("0")]
    egresos = [D("10000.00"), D("5000.00")]
    serie = calc.serie_de_ahorro_diaria(ABIERTO, ingresos, egresos)
    assert serie == [D("-10000.00"), D("-15000.00")]


@pytest.mark.unit
def test_la_serie_diaria_exige_las_dos_listas_del_mismo_largo() -> None:
    with pytest.raises(ValueError):
        calc.serie_de_ahorro_diaria(ABIERTO, [D("1"), D("2")], [D("1")])


# ===================================================================
#  serie_acumulada · modo "Acumulado" del gráfico diario (F06-T02)
# ===================================================================


@pytest.mark.unit
def test_serie_acumulada_suma_dia_a_dia() -> None:
    serie = calc.serie_acumulada([D("500000.00"), D("0"), D("15000.00")])
    assert serie == [D("500000.00"), D("500000.00"), D("515000.00")]


@pytest.mark.unit
def test_serie_acumulada_con_la_lista_vacia_da_la_lista_vacia() -> None:
    assert calc.serie_acumulada([]) == []


@pytest.mark.unit
def test_serie_acumulada_con_puros_ceros_da_ceros() -> None:
    assert calc.serie_acumulada([D("0"), D("0")]) == [D("0.00"), D("0.00")]
