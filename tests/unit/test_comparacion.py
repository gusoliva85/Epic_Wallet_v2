"""Las cifras de la comparación de un ítem · F13-T02.

`resumen_de_comparacion` es la función que da los números del pie del
gráfico, así que entra de lleno en la política de pruebas del proyecto
(«se testea lo que da un número»). Lo que se prueba acá es sobre todo
lo que la pantalla NO mostraría: que un mes sin dato no se confunda con
un cero, y que un período demasiado corto devuelva `None` en vez de
inventar un promedio.
"""

from __future__ import annotations

import decimal

from app.services.calc import resumen_de_comparacion

D = decimal.Decimal


def test_el_ultimo_mes_queda_afuera_del_promedio() -> None:
    """El último de la lista es el mes en curso y va parcial: si entrara
    en el promedio, el promedio bajaría todos los meses al empezar el
    mes y subiría al terminarlo."""
    r = resumen_de_comparacion([D("100000"), D("120000"), D("20000")])
    # (100.000 + 120.000) / 2, sin los 20.000 del mes en curso.
    assert r["average"] == D("110000.00")
    assert r["maximum"] == D("120000")
    assert r["minimum"] == D("100000")
    assert r["last_closed"] == D("120000")


def test_un_mes_sin_dato_no_es_un_cero() -> None:
    """La facultad en enero: no se cursa, no hay nada que pagar. Si ese
    `None` se tomara como cero, el promedio se hundiría y el mínimo
    pasaría a ser cero — dos números falsos que el gráfico mostraría sin
    que se note."""
    r = resumen_de_comparacion([D("100000"), None, D("120000"), D("130000")])
    assert r["average"] == D("110000.00")
    assert r["minimum"] == D("100000")


def test_la_diferencia_y_la_variacion_son_contra_el_mes_anterior() -> None:
    """No contra el primero del período: es lo que Gustavo pidió ver
    (2026-11-10), «cuánto es la diferencia de un mes al otro»."""
    r = resumen_de_comparacion([D("50000"), D("100000"), D("125000")])
    assert r["difference"] == D("25000.00")
    assert r["variation"] == D("25.00")


def test_una_baja_da_diferencia_y_variacion_negativas() -> None:
    r = resumen_de_comparacion([D("100000"), D("80000")])
    assert r["difference"] == D("-20000.00")
    assert r["variation"] == D("-20.00")


def test_con_el_mes_anterior_sin_dato_no_hay_variacion() -> None:
    """Saltea el mes de vacaciones y compara contra el último cerrado
    que SÍ tuvo dato: comparar contra la nada daría una variación
    inventada."""
    r = resumen_de_comparacion([D("90000"), None, D("99000")])
    assert r["last_closed"] == D("90000")
    assert r["difference"] == D("9000.00")
    assert r["variation"] == D("10.00")


def test_un_solo_mes_no_tiene_promedio_ni_variacion() -> None:
    """Y las seis cifras vienen en `None`, no en cero: un cero se leería
    como «no gastó nada»."""
    r = resumen_de_comparacion([D("100000")])
    assert all(v is None for v in r.values())


def test_sin_meses_no_rompe() -> None:
    r = resumen_de_comparacion([])
    assert set(r) == {
        "average",
        "maximum",
        "minimum",
        "last_closed",
        "difference",
        "variation",
    }
    assert all(v is None for v in r.values())


def test_todos_los_meses_sin_dato_no_rompe() -> None:
    """Una categoría recién creada: existe, pero nunca se usó."""
    r = resumen_de_comparacion([None, None, None])
    assert all(v is None for v in r.values())


def test_un_mes_en_cero_si_es_un_cero() -> None:
    """Lo contrario del caso de arriba: un mes con la categoría cargada
    en cero es un dato, y entra en la cuenta."""
    r = resumen_de_comparacion([D("0.00"), D("100000"), D("50000")])
    assert r["average"] == D("50000.00")
    assert r["minimum"] == D("0.00")
    # Variación desde cero: no se divide por cero, se devuelve `None`.
    assert resumen_de_comparacion([D("0.00"), D("10000")])["variation"] is None
