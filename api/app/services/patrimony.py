"""Servicio de patrimonio · F09-T03.

Referencia: 02_Documento_Tecnico.md §9.1, §14.2 · General §5.3

`GET /api/patrimony` es una foto de ahora, sin navegación de mes —a
diferencia de `GET /api/dashboard`, que mira el mes que esté en la
barra—: el ahorro acumulado de TODOS los meses hasta hoy, el valor de
inversiones (F10-T04, la cartera real) y los pasivos activos (la
tabla de F09-T03 existe pero nadie carga nada ahí en el MVP). El
patrimonio neto es la misma `calc.patrimonio_neto` que ya usa el
dashboard.

La composición (ahorro líquido vs. inversiones, Técnico §14.2) usa el
mismo método del mayor resto que el desglose por categoría
(F07-T01, `calc.porcentajes_de_categorias`): los dos porcentajes
tienen que sumar exactamente 100 para que la barra apilada no deje un
hueco ni se pase del borde.
"""

from __future__ import annotations

import datetime as dt
import decimal
from typing import NamedTuple

from sqlalchemy.orm import Session

from ..repos import investments as repos_inversiones
from ..repos import liabilities as repos_pasivos
from ..repos import months as repos_meses
from ..repos import profiles as repos_perfiles
from . import calc
from .months import abrir_mes_actual


class Patrimonio(NamedTuple):
    ahorro: decimal.Decimal
    inversiones: decimal.Decimal
    pasivos: decimal.Decimal
    total: decimal.Decimal
    porcentaje_ahorro: decimal.Decimal | None
    porcentaje_inversiones: decimal.Decimal | None


def armar(sesion: Session, user_id: str, *, ahora: dt.datetime | None = None) -> Patrimonio:
    # Mismo motivo que `services.dashboard.armar`: asegura que el mes
    # actual exista antes de sumar, así una cuenta recién creada no da
    # un acumulado vacío por no haber pasado nunca por la barra de mes.
    abrir_mes_actual(sesion, user_id, ahora=ahora)

    perfil = repos_perfiles.buscar(sesion)
    saldo_inicial = perfil.opening_balance if perfil else decimal.Decimal("0")

    meses = repos_meses.listar(sesion)
    ahorro = calc.ahorro_acumulado(saldo_inicial, [m.saving_total for m in meses])

    inversiones = calc.total_de_inversiones(
        [p.current_value for p in repos_inversiones.listar(sesion)]
    )
    pasivos = calc.total_de_pasivos([p.amount for p in repos_pasivos.listar_activos(sesion)])

    total = calc.patrimonio_neto(ahorro, inversiones, pasivos=pasivos)

    # La barra de composición es sólo ahorro e inversiones (Técnico
    # §14.2): los pasivos no son una porción que se dibuje, son lo que
    # ya se restó del total. Con la suma de esas dos partes en cero o
    # negativa no hay una barra que tenga sentido dibujar — mismo
    # criterio que el resto de la aplicación: `None`, nunca una
    # división cruda ni un porcentaje inventado.
    composicion_total = ahorro + inversiones
    if composicion_total > 0:
        porcentaje_ahorro, porcentaje_inversiones = calc.porcentajes_de_categorias(
            [ahorro, inversiones], composicion_total
        )
    else:
        porcentaje_ahorro, porcentaje_inversiones = None, None

    return Patrimonio(
        ahorro=ahorro,
        inversiones=inversiones,
        pasivos=pasivos,
        total=total,
        porcentaje_ahorro=porcentaje_ahorro,
        porcentaje_inversiones=porcentaje_inversiones,
    )
