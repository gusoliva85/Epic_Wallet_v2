"""Vencimientos de los ítems · F13-T03.

Referencia: 01_Documento_General.md §29 (alertas) · pedido de Gustavo,
2026-11-10, con el mockup `documentacion/mockups/04_Mockup_Comparacion_y_Vencimientos.html`
aprobado el mismo día.

Funciones puras, sin base de datos — mismo criterio que `calc.py` y
`months.py`. Reciben un día del mes y devuelven el estado de un
vencimiento; nada de acá sabe qué es una sesión ni una categoría.

LAS CUATRO DECISIONES QUE VIVEN ACÁ

1. **El día se recorta al largo del mes.** Un vencimiento el 31 existe
   en enero y no en febrero. En vez de rechazar el 31 al configurarlo
   —que obligaría a elegir un día que valga en todos los meses—, el día
   efectivo es el último del mes cuando no llega: así «el 31» significa
   «el último día», que es lo que quiere decir quien lo configura.

2. **Falta 1 día o menos es crítico; hasta el aviso, atención.** Gustavo
   lo pidió en esos términos: a 3 y a 2 días, amarillo; a 1 día, rojo.
   «Vence hoy» y «ya venció» son rojos por el mismo motivo.

3. **Lo que ya está pagado no avisa.** Y «pagado» no se marca a mano:
   lo decide la existencia de un movimiento de ese ítem en el mes
   (quien llama lo pasa en `pagado`). Un aviso que hay que apagar a
   mano es un aviso que queda prendido.

4. **Un vencimiento apagado no tiene estado.** No es «todo en orden»:
   es que no se está siguiendo. Quien llama distingue los dos casos
   porque para el apagado no llama a esta función.
"""

from __future__ import annotations

import calendar
from typing import NamedTuple

# Los seis estados posibles de un vencimiento prendido. El nombre es
# lo que decide el texto y el icono en la interfaz: el color no puede
# ser lo único que diga la gravedad (skill §8).
PAGADO = "paid"
VENCIDO = "overdue"
HOY = "today"
MANANA = "tomorrow"
PRONTO = "soon"
PROGRAMADO = "scheduled"

ESTADOS = (PAGADO, VENCIDO, HOY, MANANA, PRONTO, PROGRAMADO)

# Severidades del sistema de diseño (skill §8, `components/avisos.js`).
# `None` es "esto no es una alerta", no una severidad más.
OK = "ok"
ATENCION = "warn"
CRITICO = "crit"

# Los límites de lo que se puede configurar. El día 31 vale (ver la
# decisión 1); 0 días de aviso también, y significa "avisame el día que
# vence, no antes".
DIA_MINIMO = 1
DIA_MAXIMO = 31
AVISO_MINIMO = 0
AVISO_MAXIMO = 30


class EstadoDeVencimiento(NamedTuple):
    """Lo que la interfaz necesita saber de un vencimiento hoy.

    `alerta` es lo único que decide si aparece en el tablero y si cuenta
    para la campanita: un vencimiento pagado o todavía lejano tiene
    estado y no tiene alerta.
    """

    state: str
    severity: str | None
    days_left: int
    due_day: int
    alert: bool


def dias_del_mes(year: int, month: int) -> int:
    """Cuántos días tiene ese mes. Está acá y no en `months.py` porque
    el único que lo necesita es el recorte del día de vencimiento."""
    return calendar.monthrange(year, month)[1]


def dia_efectivo(due_day: int, largo_del_mes: int) -> int:
    """El día en que vence de verdad este mes: el configurado, o el
    último del mes si el configurado no llega (decisión 1)."""
    return min(due_day, largo_del_mes)


def dia_valido(due_day: int) -> bool:
    return DIA_MINIMO <= due_day <= DIA_MAXIMO


def aviso_valido(notice_days: int) -> bool:
    return AVISO_MINIMO <= notice_days <= AVISO_MAXIMO


def estado_de_vencimiento(
    *,
    due_day: int,
    notice_days: int,
    hoy: int,
    largo_del_mes: int,
    pagado: bool,
) -> EstadoDeVencimiento:
    """El estado de un vencimiento prendido, mirado desde el día `hoy`.

    `hoy` y `due_day` son días del mes (1 a 31), no fechas: el
    vencimiento es mensual y siempre se mira dentro del mes en curso.
    """
    dia = dia_efectivo(due_day, largo_del_mes)
    faltan = dia - hoy

    if pagado:
        # Pagado es pagado aunque ya haya pasado la fecha: el mes que
        # viene vuelve a empezar de cero.
        return EstadoDeVencimiento(PAGADO, OK, faltan, dia, False)

    if faltan < 0:
        return EstadoDeVencimiento(VENCIDO, CRITICO, faltan, dia, True)
    if faltan == 0:
        return EstadoDeVencimiento(HOY, CRITICO, faltan, dia, True)
    if faltan == 1:
        return EstadoDeVencimiento(MANANA, CRITICO, faltan, dia, True)
    if faltan <= notice_days:
        return EstadoDeVencimiento(PRONTO, ATENCION, faltan, dia, True)

    # Todavía falta más de lo que se pidió avisar: hay estado, no alerta.
    return EstadoDeVencimiento(PROGRAMADO, None, faltan, dia, False)


# El orden en que se muestran las alertas: primero lo que ya venció,
# después lo que vence hoy, y así. Dos alertas con el mismo estado se
# ordenan por día de vencimiento, que es lo que las desempata sin
# depender del orden en que vinieron de la base.
ORDEN_DE_ESTADOS = {VENCIDO: 0, HOY: 1, MANANA: 2, PRONTO: 3, PROGRAMADO: 4, PAGADO: 5}


def clave_de_orden(estado: EstadoDeVencimiento) -> tuple[int, int]:
    return (ORDEN_DE_ESTADOS.get(estado.state, 9), estado.due_day)
