"""Exportación y respaldo · F11-T02.

Referencia: 02_Documento_Tecnico.md §18 · General §58

Tres cosas, en el mismo archivo porque son dos caras de la misma
moneda (armar un respaldo y leerlo de vuelta tienen que usar
exactamente la misma forma, o uno se desalinea del otro sin que nada
avise):

- `armar_respaldo`: todo lo del usuario, en la forma de `Respaldo`.
- `cuenta_esta_limpia`: si hay algo que un `POST /api/import` pudiera
  pisar sin querer.
- `importar_respaldo`: valida, arma la vista previa y —sólo con
  `confirm=True`— escribe.

La restauración es **sólo para una cuenta limpia** (sin meses,
inversiones, pasivos ni preferencias todavía): resolver un `import`
general, que tuviera que decidir qué hacer con un mes que ya existe o
una categoría que ya existe con otro orden, es un problema bastante
más grande que "no depender de una sola copia" (General §58), que es
lo que esta tarea tiene que resolver. Las categorías son la única
excepción —se reconcilian por `(type, name)`— porque una cuenta recién
creada ya trae sus 21 categorías del trigger (F02-T04), y sin esa
reconciliación la importación fallaría siempre, incluso en la cuenta
más limpia posible.
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import zipfile

from sqlalchemy.orm import Session

from ..core.errors import conflicto, error_de_validacion
from ..models import Month
from ..repos import app_settings as repos_settings
from ..repos import categories as repos_categorias
from ..repos import investments as repos_inversiones
from ..repos import liabilities as repos_pasivos
from ..repos import monthly_category_totals as repos_totales
from ..repos import months as repos_meses
from ..repos import profiles as repos_perfiles
from ..repos import transactions as repos_movimientos
from ..schemas.respaldo import (
    SCHEMA_VERSION,
    CategoriaRespaldo,
    InversionRespaldo,
    MesRespaldo,
    MovimientoRespaldo,
    PasivoRespaldo,
    PerfilRespaldo,
    PreferenciasRespaldo,
    Respaldo,
    TotalPorCategoriaRespaldo,
    VistaPreviaDeImportacion,
)
from .months import HISTORICO, recalcular_saldos_acumulados
from .settings import guardar_tema, tema_guardado
from .transactions import recalcular_y_guardar_mes


def armar_respaldo(sesion: Session) -> Respaldo:
    perfil = repos_perfiles.buscar(sesion)
    assert perfil is not None, "armar_respaldo se llama después de asegurar_perfil_y_categorias"

    categorias = repos_categorias.listar(sesion)

    meses: list[MesRespaldo] = []
    movimientos: list[MovimientoRespaldo] = []
    for mes in repos_meses.listar(sesion):
        totales_categoria: list[TotalPorCategoriaRespaldo] = []
        if mes.status == HISTORICO:
            totales_categoria = [
                TotalPorCategoriaRespaldo.model_validate(t, from_attributes=True)
                for t in repos_totales.listar_por_mes(sesion, mes.id)
            ]
        else:
            movimientos.extend(
                MovimientoRespaldo.model_validate(m, from_attributes=True)
                for m in repos_movimientos.listar_por_mes(sesion, mes.id)
            )
        meses.append(
            MesRespaldo.model_validate(mes, from_attributes=True).model_copy(
                update={"category_totals": totales_categoria}
            )
        )

    return Respaldo(
        exported_at=dt.datetime.now(dt.UTC),
        profile=PerfilRespaldo.model_validate(perfil, from_attributes=True),
        categories=[
            CategoriaRespaldo.model_validate(c, from_attributes=True) for c in categorias
        ],
        months=meses,
        transactions=movimientos,
        investments=[
            InversionRespaldo.model_validate(i, from_attributes=True)
            for i in repos_inversiones.listar(sesion, active=None)
        ],
        liabilities=[
            PasivoRespaldo.model_validate(p, from_attributes=True)
            for p in repos_pasivos.listar_todos(sesion)
        ],
        settings=PreferenciasRespaldo(theme=tema_guardado(sesion)),
    )


def cuenta_esta_limpia(sesion: Session) -> bool:
    """Nada que un `import` pudiera pisar sin querer. Las categorías no
    cuentan: se reconcilian, no se pisan (ver el docstring del
    módulo)."""
    return not (
        repos_meses.listar(sesion)
        or repos_inversiones.listar(sesion, active=None)
        or repos_pasivos.listar_todos(sesion)
        or repos_settings.listar(sesion)
    )


def _reconciliar_categorias(
    sesion: Session, user_id: str, categorias: list[CategoriaRespaldo]
) -> dict[int, int]:
    """Cada categoría del respaldo, mapeada a un `id` real: si ya existe
    una con el mismo `(type, name)` —los 21 del trigger, normalmente—
    se reusa esa; si no, se crea."""
    existentes = {(c.type, c.name): c.id for c in repos_categorias.listar(sesion, active=None)}
    mapa: dict[int, int] = {}
    for c in categorias:
        clave = (c.type, c.name)
        if clave in existentes:
            mapa[c.id] = existentes[clave]
            continue
        nueva = repos_categorias.crear(
            sesion, user_id=user_id, name=c.name, type_=c.type, sort_order=c.sort_order
        )
        if not c.active:
            nueva.active = False
        mapa[c.id] = nueva.id
        existentes[clave] = nueva.id
    sesion.flush()
    return mapa


def _escribir_meses(
    sesion: Session, user_id: str, backup: Respaldo, mapa_categorias: dict[int, int]
) -> dict[int, int]:
    mapa_meses: dict[int, int] = {}
    for m in backup.months:
        mes = repos_meses.crear(sesion, user_id=user_id, year=m.year, month=m.month, status=m.status)
        mapa_meses[m.id] = mes.id
        if m.status == HISTORICO:
            mes.income_total = m.income_total
            mes.expense_total = m.expense_total
            mes.saving_total = m.saving_total
            totales = {
                mapa_categorias[t.category_id]: t.total_amount for t in m.category_totals
            }
            repos_totales.reemplazar_manuales(
                sesion, user_id=user_id, month_id=mes.id, totales=totales
            )

    # Los movimientos sólo existen para meses abiertos (las dos
    # naturalezas, Técnico §6.6): se insertan y recién al final se
    # recalcula cada mes tocado, en vez de uno por movimiento — es la
    # misma cuenta, `recalcular_mes` no cambia si se la llama una vez
    # con todos los movimientos puestos o una por cada uno.
    meses_a_recalcular: set[int] = set()
    for mv in backup.transactions:
        month_id = mapa_meses[mv.month_id]
        repos_movimientos.crear(
            sesion,
            user_id=user_id,
            month_id=month_id,
            category_id=mapa_categorias[mv.category_id],
            transaction_date=mv.transaction_date,
            transaction_type=mv.transaction_type,
            amount=mv.amount,
            description=mv.description,
            source=mv.source,
        )
        meses_a_recalcular.add(month_id)

    for month_id in meses_a_recalcular:
        mes_abierto = sesion.get(Month, month_id)
        assert mes_abierto is not None
        recalcular_y_guardar_mes(sesion, mes_abierto)

    return mapa_meses


def importar_respaldo(
    sesion: Session, user_id: str, backup: Respaldo, *, confirm: bool
) -> VistaPreviaDeImportacion:
    if backup.schema_version != SCHEMA_VERSION:
        raise error_de_validacion(
            f"Este respaldo es de la versión {backup.schema_version} y la aplicación "
            f"espera la {SCHEMA_VERSION}. No se puede importar tal cual."
        )
    if not cuenta_esta_limpia(sesion):
        raise conflicto(
            "Esta cuenta ya tiene datos cargados. La importación es para restaurar "
            "un respaldo en una cuenta limpia, no para combinar dos conjuntos de datos."
        )

    vista_previa = VistaPreviaDeImportacion(
        categories=len(backup.categories),
        months=len(backup.months),
        transactions=len(backup.transactions),
        investments=len(backup.investments),
        liabilities=len(backup.liabilities),
        applied=False,
    )
    if not confirm:
        return vista_previa

    perfil = repos_perfiles.buscar(sesion)
    assert perfil is not None
    perfil.display_name = backup.profile.display_name
    perfil.opening_balance = backup.profile.opening_balance
    perfil.timezone = backup.profile.timezone

    mapa_categorias = _reconciliar_categorias(sesion, user_id, backup.categories)
    _escribir_meses(sesion, user_id, backup, mapa_categorias)

    for inv in backup.investments:
        nueva = repos_inversiones.crear(
            sesion,
            user_id=user_id,
            symbol=inv.symbol,
            name=inv.name,
            investment_type=inv.investment_type,
            nominal_quantity=inv.nominal_quantity,
            initial_value=inv.initial_value,
            current_value=inv.current_value,
        )
        if not inv.active:
            nueva.active = False

    for pasivo in backup.liabilities:
        repos_pasivos.crear(
            sesion, user_id=user_id, name=pasivo.name, amount=pasivo.amount, active=pasivo.active
        )

    if backup.settings.theme is not None:
        guardar_tema(sesion, user_id, backup.settings.theme)

    recalcular_saldos_acumulados(sesion, user_id)

    return vista_previa.model_copy(update={"applied": True})


# ===================================================================
#  `format=csv`: un ZIP con un archivo por tabla, para abrir en Excel.
#  No es lo que lee `POST /api/import` —eso es siempre el JSON, que no
#  pierde nada al ida y vuelta—, es sólo otra forma de mirar lo mismo.
# ===================================================================


def _csv_de(filas: list[dict[str, object]]) -> str:
    salida = io.StringIO()
    if filas:
        escritor = csv.DictWriter(salida, fieldnames=list(filas[0].keys()))
        escritor.writeheader()
        escritor.writerows(filas)
    return salida.getvalue()


def armar_zip_csv(backup: Respaldo) -> bytes:
    tablas: dict[str, list[dict[str, object]]] = {
        "profile": [backup.profile.model_dump(mode="json")],
        "categories": [c.model_dump(mode="json") for c in backup.categories],
        "months": [
            m.model_dump(mode="json", exclude={"category_totals"}) for m in backup.months
        ],
        "month_category_totals": [
            {"month_id": m.id, **t.model_dump(mode="json")}
            for m in backup.months
            for t in m.category_totals
        ],
        "transactions": [t.model_dump(mode="json") for t in backup.transactions],
        "investments": [i.model_dump(mode="json") for i in backup.investments],
        "liabilities": [p.model_dump(mode="json") for p in backup.liabilities],
    }

    paquete = io.BytesIO()
    with zipfile.ZipFile(paquete, "w", zipfile.ZIP_DEFLATED) as zf:
        for nombre, filas in tablas.items():
            zf.writestr(f"{nombre}.csv", _csv_de(filas))
    return paquete.getvalue()
