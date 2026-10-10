"""Servicio de recálculo transaccional · F04-T05.

Referencia: 02_Documento_Tecnico.md §7.2

Se prueba contra Postgres real, igual que `test_months.py`: llamando
directo a `services.transactions` con una `Session` de
`db.sesion_de_usuario(uid)`, sin pasar por HTTP — todavía no existe el
endpoint (F04-T06).

Los dos criterios de aceptación de la tarea, cada uno con su prueba:
cargar un movimiento deja los totales coherentes con la suma de los
movimientos, y si el recálculo falla el movimiento no queda guardado
a medias.
"""

from __future__ import annotations

import datetime as dt
import decimal
import json
import os
import re
import secrets
import urllib.error
import urllib.request
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import text

from tests.api.ayudas_db import escritura, motor_de_pruebas

RAIZ = Path(__file__).resolve().parents[2]
pytestmark = pytest.mark.api


def _del_env(clave: str) -> str | None:
    valor = os.getenv(clave, "").strip()
    if valor:
        return valor
    archivo = RAIZ / ".env"
    if not archivo.exists():
        return None
    m = re.search(rf"^{clave}=(.+)$", archivo.read_text(encoding="utf-8"), re.M)
    return m.group(1).strip() if m else None


URL_BASE = _del_env("DATABASE_URL")
SUPABASE = (_del_env("SUPABASE_URL") or "").rstrip("/")
ANON = _del_env("SUPABASE_ANON_KEY")
ESQUEMA = _del_env("DB_SCHEMA") or "public"

sin_entorno = pytest.mark.skipif(
    not (URL_BASE and SUPABASE and ANON) or str(URL_BASE).startswith("sqlite"),
    reason="hacen falta Postgres y las credenciales de Supabase",
)


def _auth(ruta: str, cuerpo: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    req = urllib.request.Request(
        f"{SUPABASE}/auth/v1{ruta}",
        data=json.dumps(cuerpo).encode(),
        headers={
            "apikey": str(ANON),
            "Authorization": f"Bearer {ANON}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


def _crear_cuenta() -> str:
    """Crea una cuenta real y devuelve su uid. El trigger de F02-T04 le
    siembra perfil y las 21 categorías iniciales solo."""
    correo = f"epicwallet.transactions.{secrets.token_hex(6)}@example.com"
    clave = secrets.token_urlsafe(16)

    estado, cuerpo = _auth("/signup", {"email": correo, "password": clave})
    if estado >= 400:
        motivo = str(cuerpo.get("msg") or cuerpo)
        if "rate limit" in motivo.lower():
            pytest.skip(f"Supabase cortó por límite: {motivo}")
        pytest.fail(f"no se pudo crear la cuenta: {motivo}")

    uid = str(cuerpo.get("id") or cuerpo.get("user", {}).get("id"))
    assert uid and uid != "None", "la cuenta se creó pero no hay uid"
    return uid


@pytest.fixture(scope="module")
def motor():
    return motor_de_pruebas(str(URL_BASE))


@pytest.fixture(scope="module")
def db():
    from api.app.core import db as modulo

    return modulo


@pytest.fixture(scope="module")
def cuenta(motor) -> Iterator[str]:
    uid = _crear_cuenta()
    yield uid
    with escritura(motor) as con:
        con.execute(text("delete from auth.users where id = :id"), {"id": uid})


@pytest.fixture
def mes_abierto(motor, db, cuenta: str) -> Iterator[int]:
    """Octubre 2026, abierto y sin movimientos, para cada prueba: el
    `delete` de `months` se lleva en cascada sus `transactions` y sus
    `monthly_category_totals`, así que no hace falta limpiarlas aparte."""

    def _limpiar() -> None:
        with escritura(motor) as con:
            con.execute(text(f'delete from "{ESQUEMA}".months where user_id = :id'), {"id": cuenta})

    _limpiar()
    from api.app.services import months as servicio_meses

    with db.sesion_de_usuario(cuenta) as sesion:
        ahora = dt.datetime(2026, 10, 15, 12, 0, tzinfo=servicio_meses.ZONA_APP)
        mes = servicio_meses.abrir_mes_actual(sesion, cuenta, ahora=ahora)
        mes_id = mes.id
    yield mes_id
    _limpiar()


def _categoria_id(db, cuenta: str, nombre: str, tipo: str) -> int:
    from api.app.repos import categories as repos_categorias

    with db.sesion_de_usuario(cuenta) as sesion:
        for c in repos_categorias.listar(sesion, type_=tipo):
            if c.name == nombre:
                return c.id
    pytest.fail(f"no se encontró la categoría {nombre!r} de tipo {tipo!r}")


# ===================================================================
#  Cargar movimientos deja los totales coherentes con la suma
# ===================================================================


@sin_entorno
def test_cargar_movimientos_deja_totales_coherentes(db, cuenta: str, mes_abierto: int) -> None:
    from api.app.repos import monthly_category_totals as repos_totales
    from api.app.repos import months as repos_meses
    from api.app.services import transactions as servicio

    sueldo = _categoria_id(db, cuenta, "Sueldo", "income")
    alquiler = _categoria_id(db, cuenta, "Alquiler", "expense")
    gas = _categoria_id(db, cuenta, "Gas", "expense")

    with db.sesion_de_usuario(cuenta) as sesion:
        mes = repos_meses.buscar_por_periodo(sesion, 2026, 10)
        assert mes is not None

        servicio.crear_movimiento(
            sesion,
            mes,
            user_id=cuenta,
            category_id=sueldo,
            transaction_date=dt.date(2026, 10, 1),
            transaction_type="income",
            amount=decimal.Decimal("500000.00"),
        )
        servicio.crear_movimiento(
            sesion,
            mes,
            user_id=cuenta,
            category_id=alquiler,
            transaction_date=dt.date(2026, 10, 5),
            transaction_type="expense",
            amount=decimal.Decimal("150000.00"),
        )
        servicio.crear_movimiento(
            sesion,
            mes,
            user_id=cuenta,
            category_id=gas,
            transaction_date=dt.date(2026, 10, 10),
            transaction_type="expense",
            amount=decimal.Decimal("20000.00"),
        )

        # El objeto en memoria ya refleja el recálculo, antes de que
        # termine la transacción.
        assert mes.income_total == decimal.Decimal("500000.00")
        assert mes.expense_total == decimal.Decimal("170000.00")
        assert mes.saving_total == decimal.Decimal("330000.00")

    # Sesión nueva: lo de arriba no era sólo el objeto en memoria.
    with db.sesion_de_usuario(cuenta) as sesion:
        mes = repos_meses.buscar_por_periodo(sesion, 2026, 10)
        assert mes is not None
        assert mes.income_total == decimal.Decimal("500000.00")
        assert mes.expense_total == decimal.Decimal("170000.00")
        assert mes.saving_total == decimal.Decimal("330000.00")

        totales = {t.category_id: t.total_amount for t in repos_totales.listar_por_mes(sesion, mes.id)}
        assert totales == {
            sueldo: decimal.Decimal("500000.00"),
            alquiler: decimal.Decimal("150000.00"),
            gas: decimal.Decimal("20000.00"),
        }


@sin_entorno
def test_editar_un_movimiento_actualiza_los_totales(db, cuenta: str, mes_abierto: int) -> None:
    from api.app.repos import monthly_category_totals as repos_totales
    from api.app.repos import months as repos_meses
    from api.app.services import transactions as servicio

    alquiler = _categoria_id(db, cuenta, "Alquiler", "expense")
    expensas = _categoria_id(db, cuenta, "Expensas", "expense")

    with db.sesion_de_usuario(cuenta) as sesion:
        mes = repos_meses.buscar_por_periodo(sesion, 2026, 10)
        assert mes is not None

        movimiento = servicio.crear_movimiento(
            sesion,
            mes,
            user_id=cuenta,
            category_id=alquiler,
            transaction_date=dt.date(2026, 10, 5),
            transaction_type="expense",
            amount=decimal.Decimal("100000.00"),
        )

        # Cambia el importe y la categoría a la vez — el recálculo no
        # distingue qué cambió, siempre vuelve a sumar todo el mes.
        servicio.actualizar_movimiento(
            sesion,
            mes,
            movimiento,
            {"amount": decimal.Decimal("120000.00"), "category_id": expensas},
        )

        assert mes.expense_total == decimal.Decimal("120000.00")

    with db.sesion_de_usuario(cuenta) as sesion:
        mes = repos_meses.buscar_por_periodo(sesion, 2026, 10)
        assert mes is not None
        totales = {t.category_id: t.total_amount for t in repos_totales.listar_por_mes(sesion, mes.id)}
        assert totales == {expensas: decimal.Decimal("120000.00")}


@sin_entorno
def test_borrar_el_ultimo_movimiento_de_una_categoria_la_quita_de_los_totales(
    db, cuenta: str, mes_abierto: int
) -> None:
    from api.app.repos import monthly_category_totals as repos_totales
    from api.app.repos import months as repos_meses
    from api.app.services import transactions as servicio

    gas = _categoria_id(db, cuenta, "Gas", "expense")

    with db.sesion_de_usuario(cuenta) as sesion:
        mes = repos_meses.buscar_por_periodo(sesion, 2026, 10)
        assert mes is not None

        movimiento = servicio.crear_movimiento(
            sesion,
            mes,
            user_id=cuenta,
            category_id=gas,
            transaction_date=dt.date(2026, 10, 10),
            transaction_type="expense",
            amount=decimal.Decimal("20000.00"),
        )
        assert len(repos_totales.listar_por_mes(sesion, mes.id)) == 1

        servicio.borrar_movimiento(sesion, mes, movimiento)

        assert mes.expense_total == decimal.Decimal("0.00")
        assert repos_totales.listar_por_mes(sesion, mes.id) == []


# ===================================================================
#  Si el recálculo falla, el movimiento no queda guardado a medias
# ===================================================================


@sin_entorno
def test_si_el_recalculo_falla_el_movimiento_no_queda_guardado(
    db, cuenta: str, mes_abierto: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    from api.app.repos import months as repos_meses
    from api.app.repos import transactions as repos_movimientos
    from api.app.services import transactions as servicio

    sueldo = _categoria_id(db, cuenta, "Sueldo", "income")

    def _falla(*_args: object, **_kwargs: object) -> None:
        raise RuntimeError("fallo simulado del recálculo")

    monkeypatch.setattr(servicio, "recalcular_mes", _falla)

    with pytest.raises(RuntimeError), db.sesion_de_usuario(cuenta) as sesion:
        mes = repos_meses.buscar_por_periodo(sesion, 2026, 10)
        assert mes is not None
        servicio.crear_movimiento(
            sesion,
            mes,
            user_id=cuenta,
            category_id=sueldo,
            transaction_date=dt.date(2026, 10, 1),
            transaction_type="income",
            amount=decimal.Decimal("500000.00"),
        )

    # Sesión nueva, con el `recalcular_mes` real: ni el movimiento ni
    # el total a medias quedaron — Postgres revirtió la transacción
    # entera cuando `sesion_de_usuario` hizo `rollback()`.
    with db.sesion_de_usuario(cuenta) as sesion:
        mes = repos_meses.buscar_por_periodo(sesion, 2026, 10)
        assert mes is not None
        assert mes.income_total == decimal.Decimal("0.00")
        assert repos_movimientos.listar_por_mes(sesion, mes.id) == []


# ===================================================================
#  Las filas manuales (futuro mes histórico, F08) no se tocan
# ===================================================================


@sin_entorno
def test_reemplazar_automaticos_no_toca_los_totales_manuales(db, cuenta: str, mes_abierto: int) -> None:
    from api.app.models import MonthlyCategoryTotal
    from api.app.repos import monthly_category_totals as repos_totales
    from api.app.repos import months as repos_meses

    otros = _categoria_id(db, cuenta, "Otros", "expense")
    sueldo = _categoria_id(db, cuenta, "Sueldo", "income")

    with db.sesion_de_usuario(cuenta) as sesion:
        mes = repos_meses.buscar_por_periodo(sesion, 2026, 10)
        assert mes is not None

        sesion.add(
            MonthlyCategoryTotal(
                user_id=cuenta,
                month_id=mes.id,
                category_id=otros,
                total_amount=decimal.Decimal("999.00"),
                is_manual_summary=True,
            )
        )
        sesion.flush()

        repos_totales.reemplazar_automaticos(
            sesion, user_id=cuenta, month_id=mes.id, totales={sueldo: decimal.Decimal("100.00")}
        )

        filas = {
            f.category_id: (f.total_amount, f.is_manual_summary)
            for f in repos_totales.listar_por_mes(sesion, mes.id)
        }
        assert filas == {
            otros: (decimal.Decimal("999.00"), True),
            sueldo: (decimal.Decimal("100.00"), False),
        }
