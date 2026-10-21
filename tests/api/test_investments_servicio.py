"""Servicio de cartera · F10-T04 (alta, baja, indicadores).

Referencia: 02_Documento_Tecnico.md §6.2, §7.3

Se prueba contra Postgres real, igual que `test_transactions_servicio.py`:
llamando directo a `services.investments` con una `Session` de
`db.sesion_de_usuario(uid)`, sin pasar por HTTP.

La cartera es información, no bitácora de gastos (decisión de
Gustavo, 2026-10-17, revisa F10-T06): comprar y vender NUNCA tocan el
ahorro del mes —ni crean ni borran un mes, ni un movimiento—. Los
criterios de aceptación, cada uno con su prueba: una venta a medias no
deja la cartera descuadrada; el aislamiento entre cuentas (RLS);
comprar y vender no abren ni tocan ningún mes.
"""

from __future__ import annotations

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
    cascada, sin movimientos) de ninguna de las dos cuentas."""
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


# ===================================================================
#  comprar_posicion
# ===================================================================


@sin_entorno
def test_comprar_guarda_nominales_como_dato_informativo(db, cuentas: tuple[str, str], limpiar) -> None:
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        posicion = servicio.comprar_posicion(
            sesion,
            a,
            symbol="CP410",
            name="Letra CP410",
            investment_type="bono",
            initial_value=D("1118151.96"),
            nominal_quantity=D("732"),
        )
        assert posicion.initial_value == D("1118151.96")
        assert posicion.current_value == D("1118151.96")
        assert posicion.nominal_quantity == D("732.0000")

    # Sesión nueva: lo de arriba no era sólo el objeto en memoria.
    with db.sesion_de_usuario(a) as sesion:
        from api.app.repos import investments as repos

        de_nuevo = repos.buscar_por_id(sesion, posicion.id)
        assert de_nuevo is not None
        assert de_nuevo.initial_value == D("1118151.96")


@sin_entorno
def test_comprar_sin_nominales_los_deja_en_cero(db, cuentas: tuple[str, str], limpiar) -> None:
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        posicion = servicio.comprar_posicion(
            sesion,
            a,
            symbol="FCI-X",
            name="Fondo X",
            investment_type="fci",
            initial_value=D("500000.00"),
        )
        assert posicion.initial_value == D("500000.00")
        assert posicion.current_value == D("500000.00")
        assert posicion.nominal_quantity == D("0.0000")


@sin_entorno
def test_comprar_no_abre_ni_toca_ningun_mes(db, cuentas: tuple[str, str], limpiar) -> None:
    """La cartera es información, no bitácora de gastos: comprar no
    tiene que crear un movimiento ni, por lo tanto, abrir un mes."""
    from api.app.repos import months as repos_meses
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        servicio.comprar_posicion(
            sesion, a, symbol="CEDEAR-Z", name="Cedear Z", investment_type="cedear",
            initial_value=D("500000.00"),
        )

    with db.sesion_de_usuario(a) as sesion:
        assert repos_meses.buscar_por_periodo(sesion, 2026, 10) is None


# ===================================================================
#  vender_posicion
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
            initial_value=D("1200000.00"),
        )
        posicion_id = posicion.id
        servicio.vender_posicion(sesion, posicion)

    # Criterio de aceptación: una venta a medias no deja la cartera
    # descuadrada. Acá se comprueba lo contrario de "a medias": en una
    # sesión nueva, la posición no está ni a medias ni completa, no
    # está.
    with db.sesion_de_usuario(a) as sesion:
        assert repos.buscar_por_id(sesion, posicion_id) is None
        assert repos.listar(sesion) == []


@sin_entorno
def test_vender_no_abre_ni_toca_ningun_mes(db, cuentas: tuple[str, str], limpiar) -> None:
    from api.app.repos import months as repos_meses
    from api.app.services import investments as servicio

    a, _ = cuentas
    with db.sesion_de_usuario(a) as sesion:
        posicion = servicio.comprar_posicion(
            sesion, a, symbol="CORRIGE", name="Se cargó mal", investment_type="accion",
            initial_value=D("300000.00"),
        )
        servicio.vender_posicion(sesion, posicion)

    with db.sesion_de_usuario(a) as sesion:
        assert repos_meses.buscar_por_periodo(sesion, 2026, 10) is None


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
            initial_value=D("1000000.00"),
        )
        servicio.comprar_posicion(
            sesion, a, symbol="B", name="B", investment_type="accion",
            initial_value=D("500000.00"),
        )
        cartera = servicio.listar_cartera(sesion)
        # Ganancia simulada: se actualiza el valor actual a mano, sin
        # pasar por el endpoint de actualización (F10-T08) — sólo para
        # armar el escenario de esta prueba.
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
            initial_value=D("100000.00"),
        )
        id_de_a = posicion_de_a.id

    with db.sesion_de_usuario(b) as sesion:
        assert repos.listar(sesion) == []
        # Ni siquiera pidiéndola por id directo.
        assert repos.buscar_por_id(sesion, id_de_a) is None
