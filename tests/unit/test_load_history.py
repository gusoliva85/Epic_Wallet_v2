"""Parseo del CSV de carga histórica · F08-T06.

Referencia: General §18, §23, §50 (R7)

No usa el CSV real de Gustavo (ni existe en el repositorio: queda
afuera de git a propósito, es su información financiera) — un texto de
ejemplo chico, con la misma forma, alcanza para probar el parseo.

Los casos que importan, cada uno con su prueba: una fila con ingreso y
egreso a la vez (un reintegro anotado junto a un gasto del mismo
nombre), "Inversiones" excluida del egreso del mes (Regla 7), y varios
meses encadenados en el mismo archivo.
"""

from __future__ import annotations

from decimal import Decimal

import pytest
from scripts.load_history import (
    armar_vista_previa,
    normalizar,
    parsear_csv,
    parsear_monto,
    resolver_categoria,
)

D = Decimal

CSV_DE_EJEMPLO = """\
Saldo anterior,"$ 4,140,505",
,,
Mes,Enero,
Sueldo,"$ 2,993,978",
Alquiler,,"$ 500,000"
Otros,"$ 96,917","$ 191,900"
Inversiones,,"$ 500,000"
,,
Mes,Febrero,
Sueldo,"$ 3,325,981",
Alquiler,,"$ 490,000"
Mercaderia,,"$ 182,596"
"""


# ===================================================================
#  parsear_monto
# ===================================================================


@pytest.mark.unit
def test_parsea_un_monto_con_signo_pesos_y_comas() -> None:
    assert parsear_monto('"$ 2,993,978"'.strip('"')) == D("2993978.00")


@pytest.mark.unit
def test_un_monto_vacio_es_cero() -> None:
    assert parsear_monto("") == D("0.00")
    assert parsear_monto("   ") == D("0.00")


@pytest.mark.unit
def test_un_monto_invalido_lanza_value_error() -> None:
    with pytest.raises(ValueError):
        parsear_monto("no es un número")


# ===================================================================
#  normalizar
# ===================================================================


@pytest.mark.unit
def test_normalizar_saca_acentos_y_pasa_a_minuscula() -> None:
    assert normalizar("Mercadería") == normalizar("Mercaderia") == "mercaderia"
    assert normalizar("Carnicería / Pollería") == normalizar("Carniceria / Polleria")


@pytest.mark.unit
def test_resolver_categoria_aplica_el_alias_conocido() -> None:
    assert resolver_categoria("Da Vincci") == "Da Vinci"
    assert resolver_categoria("DA VINCCI") == "Da Vinci"


@pytest.mark.unit
def test_resolver_categoria_sin_alias_devuelve_tal_cual() -> None:
    assert resolver_categoria("Mercaderia") == "Mercaderia"


# ===================================================================
#  parsear_csv
# ===================================================================


@pytest.mark.unit
def test_parsea_el_saldo_anterior() -> None:
    historial = parsear_csv(CSV_DE_EJEMPLO, 2026)
    assert historial.saldo_anterior == D("4140505.00")


@pytest.mark.unit
def test_separa_los_dos_meses_en_orden() -> None:
    historial = parsear_csv(CSV_DE_EJEMPLO, 2026)
    assert [(m.year, m.month) for m in historial.meses] == [(2026, 1), (2026, 2)]


@pytest.mark.unit
def test_el_sueldo_es_el_ingreso_principal() -> None:
    historial = parsear_csv(CSV_DE_EJEMPLO, 2026)
    enero = historial.meses[0]
    assert enero.income_total == D("2993978.00") + D("96917.00")  # sueldo + el ingreso suelto de "Otros"


@pytest.mark.unit
def test_una_fila_con_ingreso_y_egreso_a_la_vez_suma_los_dos() -> None:
    """Criterio central: "Otros" trae un ingreso suelto (un reintegro)
    Y un gasto, en la misma fila, y los dos tienen que contarse."""
    historial = parsear_csv(CSV_DE_EJEMPLO, 2026)
    enero = historial.meses[0]
    assert enero.ingresos_extra == {"Otros": D("96917.00")}
    assert enero.categorias["Otros"] == D("191900.00")


@pytest.mark.unit
def test_inversiones_no_se_suma_al_egreso_del_mes() -> None:
    """Regla 7 del documento general: comprar una inversión no es un
    gasto de consumo. No puede inflar `expense_total` ni aparecer en
    `categorias` (que es lo que se manda a la API)."""
    historial = parsear_csv(CSV_DE_EJEMPLO, 2026)
    enero = historial.meses[0]
    assert enero.inversiones == D("500000.00")
    assert "Inversiones" not in enero.categorias
    # Egreso real: sólo Alquiler + Otros, sin las inversiones.
    assert enero.expense_total == D("500000.00") + D("191900.00")


@pytest.mark.unit
def test_el_ahorro_del_mes_no_resta_las_inversiones() -> None:
    """Consecuencia directa de la regla anterior: el ahorro del mes es
    ingresos menos egresos de CONSUMO —la plata invertida sigue siendo
    ahorro, sólo cambió de forma (General §23)."""
    historial = parsear_csv(CSV_DE_EJEMPLO, 2026)
    enero = historial.meses[0]
    assert enero.saving_total == enero.income_total - enero.expense_total
    # Si las inversiones restaran del ahorro, este número sería distinto.
    assert enero.saving_total == D("2993978.00") + D("96917.00") - D("500000.00") - D("191900.00")


@pytest.mark.unit
def test_un_mes_sin_filas_sueltas_de_ingreso_no_tiene_ingresos_extra() -> None:
    historial = parsear_csv(CSV_DE_EJEMPLO, 2026)
    febrero = historial.meses[1]
    assert febrero.ingresos_extra == {}
    assert febrero.categorias == {"Alquiler": D("490000.00"), "Mercaderia": D("182596.00")}


@pytest.mark.unit
def test_un_mes_invalido_lanza_value_error() -> None:
    with pytest.raises(ValueError, match="no reconozco el mes"):
        parsear_csv("Mes,Mesnoexistente,\nSueldo,\"$ 1\",\n", 2026)


@pytest.mark.unit
def test_una_fila_antes_de_cualquier_mes_lanza_value_error() -> None:
    with pytest.raises(ValueError, match="antes de cualquier"):
        parsear_csv('Alquiler,,"$ 1"\n', 2026)


# ===================================================================
#  armar_vista_previa — que no explote y que muestre lo importante
# ===================================================================


@pytest.mark.unit
def test_la_vista_previa_marca_las_categorias_nuevas() -> None:
    historial = parsear_csv(CSV_DE_EJEMPLO, 2026)
    texto = armar_vista_previa(historial, existentes=set())
    assert "Alquiler" in texto
    assert "(nueva)" in texto


@pytest.mark.unit
def test_la_vista_previa_no_marca_como_nueva_una_categoria_existente() -> None:
    historial = parsear_csv(CSV_DE_EJEMPLO, 2026)
    texto = armar_vista_previa(historial, existentes={"alquiler", "otros", "mercaderia"})
    assert "No hace falta crear ninguna categoría nueva." in texto
