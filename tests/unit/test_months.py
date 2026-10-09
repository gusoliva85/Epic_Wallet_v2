"""Lógica de meses: identidad, estado y las dos naturalezas · F03-T01.

Los tres criterios de aceptación de la tarea están acá, cada uno con
su propia prueba: diciembre → siguiente da enero del año que viene, un
mes futuro se rechaza, y un mes histórico devuelve `transactions: null`
—como `None` de Python, que es lo que el serializador de FastAPI
convierte en `null`—, nunca `[]`.
"""

from __future__ import annotations

import datetime as dt
from zoneinfo import ZoneInfo

import pytest
from api.app.services import months

# ------------------------------------------------------------- Periodo


@pytest.mark.unit
def test_periodo_es_year_y_month() -> None:
    p = months.Periodo(2026, 10)
    assert p.year == 2026
    assert p.month == 10


# -------------------------------------------------------- es_mes_valido


@pytest.mark.unit
@pytest.mark.parametrize("mes", [1, 6, 12])
def test_meses_del_uno_al_doce_son_validos(mes: int) -> None:
    assert months.es_mes_valido(mes) is True


@pytest.mark.unit
@pytest.mark.parametrize("mes", [0, 13, -1, 100])
def test_fuera_de_rango_no_es_valido(mes: int) -> None:
    assert months.es_mes_valido(mes) is False


# ---------------------------------------------------------- mes_actual


@pytest.mark.unit
def test_mes_actual_con_fecha_naive_se_toma_como_hora_de_argentina() -> None:
    # Sin zona: se asume que ya es la hora de Argentina, no se la
    # reinterpreta como UTC. El caso naive es a propósito de esta
    # prueba, por eso el `noqa`: cualquier otro `datetime()` sin zona
    # en el proyecto sí tiene que seguir fallando el lint.
    naive = dt.datetime(2026, 3, 15, 10, 0)  # noqa: DTZ001
    assert months.mes_actual(naive) == months.Periodo(2026, 3)


@pytest.mark.unit
def test_mes_actual_convierte_una_fecha_con_otra_zona() -> None:
    """El caso real que justifica `ZONA_APP`: pasada la medianoche en
    UTC, en Argentina (UTC-3) todavía puede ser el día -y el mes-
    anterior. 2026-10-01 01:00 UTC es 2026-09-30 22:00 en Argentina."""
    en_utc = dt.datetime(2026, 10, 1, 1, 0, tzinfo=ZoneInfo("UTC"))
    assert months.mes_actual(en_utc) == months.Periodo(2026, 9)


@pytest.mark.unit
def test_mes_actual_sin_argumento_usa_el_reloj_real() -> None:
    # No se puede saber qué mes es sin fijar la fecha, pero sí que no
    # explota y que devuelve algo con la forma correcta.
    p = months.mes_actual()
    assert months.es_mes_valido(p.month)
    assert p.year > 2000


# ------------------------------------------------- mes_siguiente/anterior


@pytest.mark.unit
def test_diciembre_siguiente_es_enero_del_proximo_anio() -> None:
    # Criterio de aceptación de la tarea.
    assert months.mes_siguiente(months.Periodo(2026, 12)) == months.Periodo(2027, 1)


@pytest.mark.unit
def test_un_mes_cualquiera_siguiente_suma_uno() -> None:
    assert months.mes_siguiente(months.Periodo(2026, 3)) == months.Periodo(2026, 4)


@pytest.mark.unit
def test_enero_anterior_es_diciembre_del_anio_pasado() -> None:
    assert months.mes_anterior(months.Periodo(2027, 1)) == months.Periodo(2026, 12)


@pytest.mark.unit
def test_un_mes_cualquiera_anterior_resta_uno() -> None:
    assert months.mes_anterior(months.Periodo(2026, 4)) == months.Periodo(2026, 3)


@pytest.mark.unit
def test_siguiente_y_anterior_son_inversas() -> None:
    p = months.Periodo(2026, 10)
    assert months.mes_anterior(months.mes_siguiente(p)) == p
    assert months.mes_siguiente(months.mes_anterior(p)) == p


# -------------------------------------------------------- es_mes_futuro


@pytest.mark.unit
def test_un_mes_futuro_se_rechaza() -> None:
    # Criterio de aceptación de la tarea.
    actual = months.Periodo(2026, 10)
    assert months.es_mes_futuro(months.Periodo(2026, 11), actual) is True
    assert months.es_mes_futuro(months.Periodo(2027, 1), actual) is True


@pytest.mark.unit
def test_el_mes_actual_no_es_futuro() -> None:
    actual = months.Periodo(2026, 10)
    assert months.es_mes_futuro(actual, actual) is False


@pytest.mark.unit
def test_un_mes_pasado_no_es_futuro() -> None:
    actual = months.Periodo(2026, 10)
    assert months.es_mes_futuro(months.Periodo(2026, 9), actual) is False
    assert months.es_mes_futuro(months.Periodo(2025, 12), actual) is False


# -------------------------------------------------------- estado_valido


@pytest.mark.unit
@pytest.mark.parametrize("status", ["open", "historical"])
def test_los_dos_estados_son_validos(status: str) -> None:
    assert months.estado_valido(status) is True


@pytest.mark.unit
@pytest.mark.parametrize("status", ["", "abierto", "OPEN", "closed"])
def test_cualquier_otro_valor_no_es_valido(status: str) -> None:
    assert months.estado_valido(status) is False


# ------------------------------------------------------ origen_de_totales


@pytest.mark.unit
def test_un_mes_abierto_saca_los_totales_de_los_movimientos() -> None:
    assert months.origen_de_totales("open") == "transactions"


@pytest.mark.unit
def test_un_mes_historico_saca_los_totales_de_sus_propios_campos() -> None:
    assert months.origen_de_totales("historical") == "stored"


# --------------------------------------------------- transacciones_del_mes


@pytest.mark.unit
def test_un_mes_historico_siempre_devuelve_none() -> None:
    # Criterio de aceptación de la tarea: `transactions: null`, no `[]`.
    assert months.transacciones_del_mes("historical", None) is None


@pytest.mark.unit
def test_un_mes_historico_ignora_los_movimientos_que_le_pasen() -> None:
    """No se inventan movimientos históricos (Regla 4): aunque alguien
    le pase una lista con algo adentro, para un histórico la respuesta
    sigue siendo `None`, nunca esa lista."""
    assert months.transacciones_del_mes("historical", [object()]) is None


@pytest.mark.unit
def test_un_mes_abierto_sin_movimientos_devuelve_lista_vacia_no_none() -> None:
    """Es la otra mitad del contrato: `[]` significa "los tiene, y no
    hay ninguno este mes" — distinto de `None`. Confundirlos haría que
    el frontend muestre el mensaje de mes consolidado en un mes abierto
    que todavía no tiene nada cargado."""
    resultado = months.transacciones_del_mes("open", None)
    assert resultado == []
    assert resultado is not None


@pytest.mark.unit
def test_un_mes_abierto_con_movimientos_los_devuelve_tal_cual() -> None:
    movimientos = [object(), object()]
    assert months.transacciones_del_mes("open", movimientos) is movimientos
