"""Servicio de cartera · F10-T04 (alta, baja, indicadores) y F10-T06
(la transferencia con el ahorro).

Referencia: 02_Documento_Tecnico.md §6.2, §7.3

Se prueba contra Postgres real, igual que `test_transactions_servicio.py`:
llamando directo a `services.investments` con una `Session` de
`db.sesion_de_usuario(uid)`, sin pasar por HTTP — todavía no existe el
endpoint (F10-T08 es la pantalla; el endpoint llega en una tarea
aparte si hiciera falta uno dedicado, pero el servicio ya es el
camino completo).

Los criterios de aceptación, cada uno con su prueba:
`downgrade` probado a mano contra la base real (ver NOTAS_CLAUDE.md,
mismo procedimiento que `liabilities`); una venta a medias no deja la
cartera descuadrada; el aislamiento entre cuentas (RLS); comprar SÍ
cuenta en el total del mes y en el desglose por categoría, bajo
"Inversiones" (decisión de Gustavo, 2026-10-17, pisa la redacción
original del técnico §7.3); vender devuelve el importe como ingreso,
misma categoría de tipo `income`; `affect_savings=False` no toca el
ahorro, para cargar una cartera preexistente sin inventar un
movimiento que nunca pasó.
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

D = decimal.Decimal
HOY = dt.datetime(2026, 10, 17, 12, 0, tzinfo=dt.UTC)


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
    correo = f"epicwallet.investments.{secrets.token_hex(6)}@example.com"
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
def cuentas(motor) -> Iterator[tuple[str, str]]:
    a = _crear_cuenta()
    b = _crear_cuenta()
    yield a, b
    with escritura(motor) as con:
        con.execute(text("delete from auth.users where id = any(:ids)"), {"ids": [a, b]})


@pytest.fixture
def limpiar(motor, cuentas):
    """Antes y después de cada prueba: sin posiciones ni meses (y por
    cascada, sin movimientos) de ninguna de las dos cuentas. Las
    categorías "Inversiones" que se hayan creado quedan —son
    idempotentes de encontrar, dejarlas no ensucia nada—."""
    a, b = cuentas

    def _limpiar() -> None:
        with escritura(motor) as con:
            con.execute(
                text(f'delete from "{ESQUEMA}".investments where user_id = any(:ids)'),
                {"ids": [a, b]},
            )
            con.execute(
                text(f'delete from "{ESQUEMA}".months where user_id = any(:ids)'),
                {"ids": [a, b]},
            )

    _limpiar()
    yield
    _limpiar()


def _mes_actual(db, cuenta: str):
    from api.app.repos import months as repos_meses

    with db.sesion_de_usuario(cuenta) as sesion:
        mes = repos_meses.buscar_por_periodo(sesion, 2026, 10)
        assert mes is not None, "comprar/vender tenían que haber abierto el mes actual"
        return mes


# ===================================================================
#  comprar_posicion — sólo la cartera (F10-T04), sin tocar el ahorro
# ===================================================================


@sin_entorno
def test_comprar_por_precio_unitario_valua_nominales_por_precio(db, cuentas: tuple[str, str], limpiar) -> None:
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        posicion = servicio.comprar_posicion(
            sesion,
            a,
            symbol="CP410",
            name="Letra CP410",
            investment_type="bono",
            valuation_mode="unit_price",
            nominal_quantity=D("732"),
            current_unit_price=D("1527.53"),
            affect_savings=False,
        )
        assert posicion.initial_value == D("1118151.96")
        assert posicion.current_value == D("1118151.96")

    # Sesión nueva: lo de arriba no era sólo el objeto en memoria.
    with db.sesion_de_usuario(a) as sesion:
        from api.app.repos import investments as repos

        de_nuevo = repos.buscar_por_id(sesion, posicion.id)
        assert de_nuevo is not None
        assert de_nuevo.initial_value == D("1118151.96")


@sin_entorno
def test_comprar_manual_usa_el_valor_cargado_a_mano(db, cuentas: tuple[str, str], limpiar) -> None:
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        posicion = servicio.comprar_posicion(
            sesion,
            a,
            symbol="FCI-X",
            name="Fondo X",
            investment_type="fci",
            valuation_mode="manual",
            valor_manual=D("500000.00"),
            affect_savings=False,
        )
        assert posicion.initial_value == D("500000.00")
        assert posicion.current_value == D("500000.00")
        assert posicion.nominal_quantity == D("0.0000")


# ===================================================================
#  vender_posicion — sólo la cartera
# ===================================================================


@sin_entorno
def test_vender_borra_la_posicion_de_verdad_no_solo_en_memoria(db, cuentas: tuple[str, str], limpiar) -> None:
    from api.app.repos import investments as repos
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        posicion = servicio.comprar_posicion(
            sesion,
            a,
            symbol="CEDEAR-Y",
            name="Cedear Y",
            investment_type="cedear",
            valuation_mode="manual",
            valor_manual=D("1200000.00"),
            affect_savings=False,
        )
        posicion_id = posicion.id
        valor_devuelto = servicio.vender_posicion(sesion, posicion, affect_savings=False)
        assert valor_devuelto == D("1200000.00")

    # Criterio de aceptación: una venta a medias no deja la cartera
    # descuadrada. Acá se comprueba lo contrario de "a medias": en una
    # sesión nueva, la posición no está ni a medias ni completa, no
    # está.
    with db.sesion_de_usuario(a) as sesion:
        assert repos.buscar_por_id(sesion, posicion_id) is None
        assert repos.listar(sesion) == []


# ===================================================================
#  indicadores_de_cartera
# ===================================================================


@sin_entorno
def test_indicadores_de_cartera_con_varias_posiciones(db, cuentas: tuple[str, str], limpiar) -> None:
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        servicio.comprar_posicion(
            sesion, a, symbol="A", name="A", investment_type="accion",
            valuation_mode="manual", valor_manual=D("1000000.00"), affect_savings=False,
        )
        servicio.comprar_posicion(
            sesion, a, symbol="B", name="B", investment_type="accion",
            valuation_mode="manual", valor_manual=D("500000.00"), affect_savings=False,
        )
        cartera = servicio.listar_cartera(sesion)
        # Ganancia simulada: se actualiza el valor actual a mano, sin
        # pasar por la actualización manual (F10-T08) que todavía no
        # existe —sólo para armar el escenario de esta prueba.
        cartera[0].current_value = D("1200000.00")
        sesion.flush()

        indicadores = servicio.indicadores_de_cartera(servicio.listar_cartera(sesion))
        assert indicadores.total_invertido == D("1500000.00")
        assert indicadores.valor_actual == D("1700000.00")
        assert indicadores.rendimiento == D("200000.00")
        assert indicadores.cantidad_de_posiciones == 2


@sin_entorno
def test_indicadores_de_cartera_vacia_no_rompe(db, cuentas: tuple[str, str], limpiar) -> None:
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        indicadores = servicio.indicadores_de_cartera(servicio.listar_cartera(sesion))
        assert indicadores.valor_actual == D("0.00")
        assert indicadores.total_invertido == D("0.00")
        assert indicadores.rendimiento_porcentual is None
        assert indicadores.cantidad_de_posiciones == 0


# ===================================================================
#  Aislamiento entre cuentas (RLS)
# ===================================================================


@sin_entorno
def test_una_cuenta_no_ve_la_cartera_de_otra(db, cuentas: tuple[str, str], limpiar) -> None:
    from api.app.repos import investments as repos
    from api.app.services import investments as servicio

    a, b = cuentas
    with db.sesion_de_usuario(a) as sesion:
        posicion_de_a = servicio.comprar_posicion(
            sesion, a, symbol="SOLO-A", name="Sólo de A", investment_type="accion",
            valuation_mode="manual", valor_manual=D("100000.00"), affect_savings=False,
        )
        id_de_a = posicion_de_a.id

    with db.sesion_de_usuario(b) as sesion:
        assert repos.listar(sesion) == []
        # Ni siquiera pidiéndola por id directo.
        assert repos.buscar_por_id(sesion, id_de_a) is None


# ===================================================================
#  La transferencia con el ahorro (F10-T06, decisión de Gustavo
#  2026-10-17: SÍ cuenta en el total del mes y en el desglose)
# ===================================================================


@sin_entorno
def test_comprar_resta_del_ahorro_del_mes_bajo_la_categoria_inversiones(
    db, cuentas: tuple[str, str], limpiar
) -> None:
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        servicio.comprar_posicion(
            sesion, a, symbol="CEDEAR-Z", name="Cedear Z", investment_type="cedear",
            valuation_mode="manual", valor_manual=D("500000.00"), ahora=HOY,
        )

    mes = _mes_actual(db, a)
    # Decisión de Gustavo: SÍ cuenta como gasto del mes, no queda
    # afuera — "sino no se entiende por qué tenés plata de menos".
    assert mes.expense_total == D("500000.00")
    assert mes.saving_total == D("-500000.00")

    with db.sesion_de_usuario(a) as sesion:
        from api.app.repos import categories as repos_categorias
        from api.app.repos import transactions as repos_movimientos

        categoria = repos_categorias.buscar_por_nombre_y_tipo(sesion, "Inversiones", "expense")
        assert categoria is not None
        movimientos = repos_movimientos.listar_por_mes(sesion, mes.id)
        assert len(movimientos) == 1
        assert movimientos[0].category_id == categoria.id
        assert movimientos[0].amount == D("500000.00")
        assert movimientos[0].source == "system"


@sin_entorno
def test_comprar_dos_veces_reusa_la_misma_categoria_inversiones(db, cuentas: tuple[str, str], limpiar) -> None:
    from api.app.repos import categories as repos_categorias
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        servicio.comprar_posicion(
            sesion, a, symbol="UNO", name="Uno", investment_type="accion",
            valuation_mode="manual", valor_manual=D("100000.00"), ahora=HOY,
        )
        servicio.comprar_posicion(
            sesion, a, symbol="DOS", name="Dos", investment_type="accion",
            valuation_mode="manual", valor_manual=D("200000.00"), ahora=HOY,
        )

    with db.sesion_de_usuario(a) as sesion:
        categorias = [c for c in repos_categorias.listar(sesion, type_="expense") if c.name == "Inversiones"]
        assert len(categorias) == 1, "no tiene que duplicar la categoría"

    mes = _mes_actual(db, a)
    assert mes.expense_total == D("300000.00")


@sin_entorno
def test_vender_acredita_el_valor_total_como_ingreso_bajo_inversiones(
    db, cuentas: tuple[str, str], limpiar
) -> None:
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        posicion = servicio.comprar_posicion(
            sesion, a, symbol="CEDEAR-W", name="Cedear W", investment_type="cedear",
            valuation_mode="manual", valor_manual=D("1000000.00"), ahora=HOY,
        )
        # Ganancia simulada antes de vender.
        posicion.current_value = D("1200000.00")
        sesion.flush()
        valor_devuelto = servicio.vender_posicion(sesion, posicion, ahora=HOY)
        assert valor_devuelto == D("1200000.00")

    mes = _mes_actual(db, a)
    # El importe que vuelve al ahorro es el valor TOTAL de venta
    # ($1.200.000), no sólo la ganancia ($200.000) — el rendimiento es
    # un cálculo aparte (Regla 9) y nunca se informa como ingreso.
    assert mes.income_total == D("1200000.00")

    with db.sesion_de_usuario(a) as sesion:
        from api.app.repos import categories as repos_categorias
        from api.app.repos import transactions as repos_movimientos

        categoria = repos_categorias.buscar_por_nombre_y_tipo(sesion, "Inversiones", "income")
        assert categoria is not None
        movimientos = [m for m in repos_movimientos.listar_por_mes(sesion, mes.id) if m.transaction_type == "income"]
        assert len(movimientos) == 1
        assert movimientos[0].amount == D("1200000.00")
        assert movimientos[0].category_id == categoria.id


@sin_entorno
def test_affect_savings_false_no_toca_el_ahorro_al_comprar(db, cuentas: tuple[str, str], limpiar) -> None:
    """Cargar una cartera preexistente: no hay plata "nueva" saliendo
    del ahorro ahora, sólo se está poniendo al día la cartera."""
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        servicio.comprar_posicion(
            sesion, a, symbol="YA-TENIA", name="Ya la tenía", investment_type="accion",
            valuation_mode="manual", valor_manual=D("2000000.00"), affect_savings=False, ahora=HOY,
        )

    from api.app.repos import months as repos_meses

    with db.sesion_de_usuario(a) as sesion:
        mes = repos_meses.buscar_por_periodo(sesion, 2026, 10)
        assert mes is None, "no tenía que haber abierto ni tocado ningún mes"


@sin_entorno
def test_affect_savings_false_no_toca_el_ahorro_al_vender(db, cuentas: tuple[str, str], limpiar) -> None:
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        posicion = servicio.comprar_posicion(
            sesion, a, symbol="CORRIGE", name="Se cargó mal", investment_type="accion",
            valuation_mode="manual", valor_manual=D("300000.00"), affect_savings=False, ahora=HOY,
        )
        servicio.vender_posicion(sesion, posicion, affect_savings=False, ahora=HOY)

    from api.app.repos import months as repos_meses

    with db.sesion_de_usuario(a) as sesion:
        assert repos_meses.buscar_por_periodo(sesion, 2026, 10) is None
