"""El estado de un vencimiento · F13-T03.

Entra en la política de pruebas del proyecto porque decide **si una
alerta aparece y de qué color**: un error acá no se ve mirando la
pantalla —se ve el día que el aviso del alquiler no salió—, que es
justo el criterio del CLAUDE.md.

Los casos son los que Gustavo pidió en esos términos (2026-11-10):
«a 3 y 2 días amarillo, a 1 día rojo, y lo que ya está cargado no
cuenta».
"""

from __future__ import annotations

import pytest

from app.services.vencimientos import (
    ATENCION,
    CRITICO,
    HOY,
    MANANA,
    OK,
    PAGADO,
    PROGRAMADO,
    PRONTO,
    VENCIDO,
    clave_de_orden,
    dia_efectivo,
    dias_del_mes,
    estado_de_vencimiento,
)


def estado(dia: int, aviso: int, hoy: int, *, largo: int = 30, pagado: bool = False):
    return estado_de_vencimiento(
        due_day=dia, notice_days=aviso, hoy=hoy, largo_del_mes=largo, pagado=pagado
    )


# --------------------------------------------------- el caso de Gustavo
# "El alquiler se vence el día 10, avisame 3 días antes."


@pytest.mark.parametrize(
    ("hoy", "esperado", "severidad"),
    [
        (6, PROGRAMADO, None),  # faltan 4: todavía no se avisa
        (7, PRONTO, ATENCION),  # faltan 3: amarillo, el día que pidió
        (8, PRONTO, ATENCION),  # faltan 2: amarillo
        (9, MANANA, CRITICO),  # falta 1: rojo
        (10, HOY, CRITICO),  # vence hoy: rojo
        (11, VENCIDO, CRITICO),  # ya venció: rojo
    ],
)
def test_el_alquiler_del_10_con_tres_dias_de_aviso(hoy, esperado, severidad) -> None:
    e = estado(10, 3, hoy)
    assert e.state == esperado
    assert e.severity == severidad
    # La alerta aparece exactamente cuando hay severidad.
    assert e.alert is (severidad is not None)


def test_los_dias_que_faltan_viajan_con_el_estado() -> None:
    """La pantalla escribe «faltan 3 días» con este número; no lo
    recalcula por su cuenta."""
    assert estado(10, 3, 7).days_left == 3
    assert estado(10, 3, 10).days_left == 0
    assert estado(10, 3, 13).days_left == -3


# ------------------------------------------------------------- pagado


def test_lo_que_ya_esta_cargado_no_avisa() -> None:
    """«Si yo pago el día 5, la alerta no lo cuenta» — el caso con el
    que Gustavo cerró el pedido."""
    e = estado(10, 3, 7, pagado=True)
    assert e.state == PAGADO
    assert e.severity == OK
    assert e.alert is False


def test_pagado_tarde_tampoco_avisa() -> None:
    """Se pagó el 12 un vencimiento del 10: ya está, el mes que viene
    vuelve a empezar. Un aviso que sigue prendido después de pagar es
    un aviso que se aprende a ignorar."""
    e = estado(10, 3, 15, pagado=True)
    assert e.state == PAGADO
    assert e.alert is False


# ------------------------------------------- el día que no existe


def test_el_31_en_un_mes_de_30_vence_el_30() -> None:
    """«El 31» quiere decir «el último día»: si se rechazara, habría que
    elegir un día que exista en todos los meses y el vencimiento de fin
    de mes no se podría configurar."""
    assert dia_efectivo(31, 30) == 30
    e = estado(31, 3, 30, largo=30)
    assert e.state == HOY
    assert e.due_day == 30


def test_febrero_de_un_ano_no_biciesto_tiene_28() -> None:
    assert dias_del_mes(2026, 2) == 28
    assert dias_del_mes(2028, 2) == 29
    assert dias_del_mes(2026, 11) == 30
    assert dias_del_mes(2026, 12) == 31


def test_un_dia_que_si_existe_no_se_toca() -> None:
    assert dia_efectivo(10, 31) == 10


# --------------------------------------------------- casos de borde


def test_sin_dias_de_aviso_solo_avisa_el_dia_que_vence() -> None:
    """`notice_days = 0` es «avisame el día que vence, no antes». Los
    dos últimos días siguen siendo críticos: eso no es el aviso, es que
    ya está encima."""
    assert estado(10, 0, 5).state == PROGRAMADO
    assert estado(10, 0, 9).state == MANANA
    assert estado(10, 0, 10).state == HOY


def test_con_un_aviso_larguisimo_avisa_desde_el_principio_del_mes() -> None:
    e = estado(28, 30, 1)
    assert e.state == PRONTO
    assert e.severity == ATENCION


def test_el_orden_pone_primero_lo_mas_urgente() -> None:
    """Es el orden en que se apilan las alertas en el tablero: lo
    vencido arriba, lo programado abajo."""
    vencido = estado(5, 3, 9)
    vence_hoy = estado(9, 3, 9)
    pronto = estado(11, 3, 9)
    ordenadas = sorted([pronto, vence_hoy, vencido], key=clave_de_orden)
    assert [e.state for e in ordenadas] == [VENCIDO, HOY, PRONTO]


def test_dos_vencimientos_del_mismo_estado_se_ordenan_por_dia() -> None:
    primero = estado(12, 5, 9)
    segundo = estado(13, 5, 9)
    assert sorted([segundo, primero], key=clave_de_orden) == [primero, segundo]
