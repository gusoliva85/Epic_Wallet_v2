"""Armado de la pantalla de Vencimientos · F13-T03.

Referencia: 02_Documento_Tecnico.md §9.1 · General §29

La división con `services/vencimientos.py` es la de siempre en este
proyecto: ahí viven las funciones **puras** (qué estado tiene un
vencimiento el día 7, cómo se recorta el día 31 en febrero) y acá el
armado, que sí lee la base. Mismo reparto que `calc.py` contra
`dashboard.py`.

TRES COSAS QUE SE DECIDEN ACÁ

1. **Qué ítems entran:** las categorías de **egreso activas**. Un
   vencimiento es algo que se paga; una categoría de ingreso no vence,
   y una desactivada no se sigue. No hay un «agregar ítem»: la lista es
   la que ya existe.

2. **Qué quiere decir «pagado»:** que ese ítem tenga total en el mes en
   curso. Sale de `monthly_category_totals`, que es la misma tabla que
   alimenta el resto del tablero y ya está recalculada después de cada
   alta (F04-T05). No hay que marcar nada a mano: se carga el
   movimiento del alquiler y la alerta se apaga sola, que es lo que
   pidió Gustavo.

3. **Cuánto se estima:** el total de ese ítem en el **mes anterior**.
   Es la cifra más honesta que se puede dar sin inventar un promedio: el
   mes en curso puede estar a mitad de camino, y un promedio de doce
   meses de inflación argentina queda siempre por debajo de lo que vas
   a pagar. `None` si el mes anterior no existe o el ítem no tuvo nada.
"""

from __future__ import annotations

import datetime as dt
import decimal
from typing import NamedTuple

from sqlalchemy.orm import Session

from ..models import Category, Month
from ..repos import categories as repos_categorias
from ..repos import category_dues as repos_vencimientos
from ..repos import monthly_category_totals as repos_totales
from ..repos import months as repos_meses
from . import vencimientos as puro
from .months import dias_transcurridos, mes_actual, mes_anterior

# Lo que se le configura a un ítem la primera vez que se lo prende, si
# el cliente no manda otra cosa. Son los valores del mockup aprobado.
DIA_POR_DEFECTO = 10
AVISO_POR_DEFECTO = 3

TIPO_EGRESO = "expense"


class ItemDeVencimiento(NamedTuple):
    """Una fila de la pantalla, lista para el esquema de salida."""

    category_id: int
    name: str
    enabled: bool
    due_day: int
    notice_days: int
    state: str | None
    severity: str | None
    days_left: int | None
    alert: bool
    paid: bool
    estimated: decimal.Decimal | None


def armar(
    sesion: Session,
    *,
    ahora: dt.datetime | None = None,
    meses: list[Month] | None = None,
    categorias: list[Category] | None = None,
) -> list[ItemDeVencimiento]:
    """Todas las categorías de egreso activas con su estado de hoy.

    Seis consultas como máximo, no una por ítem: las categorías, los
    vencimientos configurados, los dos meses (el actual y el anterior) y
    sus totales. Con veintiún categorías, la versión ingenua son
    cuarenta y dos viajes a São Paulo para pintar una lista.

    `meses` y `categorias` son para quien ya los tiene leídos —el
    dashboard los pide igual (`services/dashboard.py::armar`)—, y bajan
    de seis consultas a tres. Es la única razón por la que están: el
    tablero es una sola llamada y tiene un presupuesto de 400 ms
    (CLAUDE.md). Omitirlos no cambia el resultado, sólo el costo.
    """
    periodo = mes_actual(ahora)
    # El día de hoy en la zona de presentación. Sale de
    # `dias_transcurridos`, que para el mes en curso es justamente el
    # día de hoy: así el "hoy" de los vencimientos y el del gráfico
    # diario no pueden discrepar por media hora de diferencia.
    hoy = dias_transcurridos(periodo, ahora)
    largo = puro.dias_del_mes(periodo.year, periodo.month)

    if categorias is None:
        items_de_categoria = repos_categorias.listar(sesion, type_=TIPO_EGRESO, active=True)
    else:
        # Filtrado en memoria: la lista que trae el dashboard es la
        # completa, de los dos tipos y con las inactivas.
        items_de_categoria = [c for c in categorias if c.type == TIPO_EGRESO and c.active]

    configurados = {d.category_id: d for d in repos_vencimientos.listar(sesion)}

    anterior_periodo = mes_anterior(periodo)
    if meses is None:
        mes = repos_meses.buscar_por_periodo(sesion, periodo.year, periodo.month)
        anterior = repos_meses.buscar_por_periodo(sesion, *anterior_periodo)
    else:
        mes = next((m for m in meses if (m.year, m.month) == periodo), None)
        anterior = next((m for m in meses if (m.year, m.month) == anterior_periodo), None)

    totales_del_mes = (
        {t.category_id: t.total_amount for t in repos_totales.listar_por_mes(sesion, mes.id)}
        if mes
        else {}
    )
    totales_anteriores = (
        {t.category_id: t.total_amount for t in repos_totales.listar_por_mes(sesion, anterior.id)}
        if anterior
        else {}
    )

    items: list[ItemDeVencimiento] = []
    for categoria in items_de_categoria:
        configurado = configurados.get(categoria.id)
        encendido = bool(configurado and configurado.enabled)
        dia = configurado.due_day if configurado else DIA_POR_DEFECTO
        aviso = configurado.notice_days if configurado else AVISO_POR_DEFECTO

        # Un total en cero cuenta como pagado igual que uno positivo: la
        # fila existe porque hubo un movimiento, y eso es lo que se
        # pregunta. Que haya sido de cero pesos es raro, pero es un
        # movimiento cargado.
        pagado = categoria.id in totales_del_mes

        if encendido:
            estado = puro.estado_de_vencimiento(
                due_day=dia,
                notice_days=aviso,
                hoy=hoy,
                largo_del_mes=largo,
                pagado=pagado,
            )
            items.append(
                ItemDeVencimiento(
                    category_id=categoria.id,
                    name=categoria.name,
                    enabled=True,
                    due_day=dia,
                    notice_days=aviso,
                    state=estado.state,
                    severity=estado.severity,
                    days_left=estado.days_left,
                    alert=estado.alert,
                    paid=pagado,
                    estimated=totales_anteriores.get(categoria.id),
                )
            )
        else:
            # Apagado: sin estado y sin alerta, pero con el día y el
            # aviso que quedaron guardados.
            items.append(
                ItemDeVencimiento(
                    category_id=categoria.id,
                    name=categoria.name,
                    enabled=False,
                    due_day=dia,
                    notice_days=aviso,
                    state=None,
                    severity=None,
                    days_left=None,
                    alert=False,
                    paid=pagado,
                    estimated=totales_anteriores.get(categoria.id),
                )
            )

    return items


def alertas(items: list[ItemDeVencimiento]) -> list[ItemDeVencimiento]:
    """Los que hay que avisar hoy, de lo más urgente a lo menos.

    El orden lo decide `services.vencimientos.ORDEN_DE_ESTADOS`, no esta
    función: es la misma prioridad que usa la pantalla para pintarlos.
    """
    return sorted(
        (i for i in items if i.alert),
        key=lambda i: (puro.ORDEN_DE_ESTADOS.get(i.state or "", 9), i.due_day),
    )
