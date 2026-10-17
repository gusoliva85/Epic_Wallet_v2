"""`GET`, `POST`, `PUT` y `DELETE /api/investments` · F10-T06.

Se prueba contra la API real, con cuentas reales de Supabase — mismo
criterio que `test_categories_endpoints.py`.

Los criterios de aceptación de la tarea, cada uno con su prueba:
comprar sí aparece como gasto bajo "Inversiones" en el total del mes y
en el desglose por categoría; vender devuelve el importe como ingreso,
misma categoría de tipo `income`; alta y baja son opcionales respecto
del ahorro (`affect_savings`); actualizar el valor a mano cambia el
patrimonio y no el ahorro del mes.
"""

from __future__ import annotations

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


class Cuenta:
    def __init__(self, uid: str, correo: str, token: str) -> None:
        self.uid = uid
        self.correo = correo
        self.token = token

    @property
    def cabeceras(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


def _crear_cuenta() -> Cuenta:
    correo = f"epicwallet.investendp.{secrets.token_hex(6)}@example.com"
    clave = secrets.token_urlsafe(16)

    estado, cuerpo = _auth("/signup", {"email": correo, "password": clave})
    if estado >= 400:
        motivo = str(cuerpo.get("msg") or cuerpo)
        if "rate limit" in motivo.lower():
            pytest.skip(f"Supabase cortó por límite: {motivo}")
        pytest.fail(f"no se pudo crear la cuenta: {motivo}")

    uid = str(cuerpo.get("id") or cuerpo.get("user", {}).get("id"))
    token = cuerpo.get("access_token")
    if not token:
        estado, sesion = _auth("/token?grant_type=password", {"email": correo, "password": clave})
        token = sesion.get("access_token")
    assert token, "la cuenta se creó pero no hay token"
    return Cuenta(uid, correo, str(token))


@pytest.fixture(scope="module")
def motor():
    return motor_de_pruebas(str(URL_BASE))


@pytest.fixture(scope="module")
def cliente():
    from api.app.main import app
    from fastapi.testclient import TestClient

    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture(scope="module")
def cuentas(motor) -> Iterator[tuple[Cuenta, Cuenta]]:
    a = _crear_cuenta()
    b = _crear_cuenta()
    yield a, b
    with escritura(motor) as con:
        con.execute(text("delete from auth.users where id = any(:ids)"), {"ids": [a.uid, b.uid]})


@pytest.fixture
def limpiar(motor, cuentas):
    a, b = cuentas

    def _limpiar() -> None:
        with escritura(motor) as con:
            con.execute(
                text(f'delete from "{ESQUEMA}".investments where user_id = any(:ids)'),
                {"ids": [a.uid, b.uid]},
            )
            con.execute(
                text(f'delete from "{ESQUEMA}".months where user_id = any(:ids)'),
                {"ids": [a.uid, b.uid]},
            )

    _limpiar()
    yield
    _limpiar()


def _mes_actual(cliente, cuenta: Cuenta) -> dict:
    return cliente.get("/api/dashboard", headers=cuenta.cabeceras).json()


# ===================================================================
#  POST /api/investments — comprar
# ===================================================================


@sin_entorno
def test_sin_token_devuelve_401(cliente) -> None:
    assert cliente.post("/api/investments", json={}).status_code == 401


@sin_entorno
def test_comprar_por_precio_unitario(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    r = cliente.post(
        "/api/investments",
        json={
            "symbol": "CP410",
            "name": "Letra CP410",
            "investment_type": "bono",
            "valuation_mode": "unit_price",
            "nominal_quantity": "732",
            "current_unit_price": "1527.53",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["initial_value"] == "1118151.96"
    assert cuerpo["current_value"] == "1118151.96"
    assert cuerpo["return_amount"] == "0.00"
    assert cuerpo["return_percentage"] == "0.0"


@sin_entorno
def test_comprar_sin_los_datos_que_pide_el_modo_da_422(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    # unit_price sin nominales ni precio.
    r = cliente.post(
        "/api/investments",
        json={"symbol": "X", "name": "X", "investment_type": "accion", "valuation_mode": "unit_price"},
        headers=a.cabeceras,
    )
    assert r.status_code == 422, r.text

    # manual sin valor.
    r = cliente.post(
        "/api/investments",
        json={"symbol": "Y", "name": "Y", "investment_type": "accion", "valuation_mode": "manual"},
        headers=a.cabeceras,
    )
    assert r.status_code == 422, r.text


@sin_entorno
def test_comprar_resta_del_ahorro_y_aparece_en_el_desglose(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    r = cliente.post(
        "/api/investments",
        json={
            "symbol": "CEDEAR-Z",
            "name": "Cedear Z",
            "investment_type": "cedear",
            "valuation_mode": "manual",
            "manual_value": "500000.00",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text

    cuerpo = _mes_actual(cliente, a)
    # Decisión de Gustavo (2026-10-17): SÍ cuenta como gasto del mes,
    # SÍ aparece en el desglose, bajo "Inversiones" — no queda afuera.
    assert cuerpo["month"]["expense_total"] == "500000.00"
    assert cuerpo["month"]["saving_total"] == "-500000.00"
    categorias = {c["name"]: c for c in cuerpo["categories"]}
    assert "Inversiones" in categorias
    assert categorias["Inversiones"]["total"] == "500000.00"


@sin_entorno
def test_comprar_con_affect_savings_false_no_toca_el_ahorro(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    r = cliente.post(
        "/api/investments",
        json={
            "symbol": "YA-TENIA",
            "name": "Ya la tenía",
            "investment_type": "accion",
            "valuation_mode": "manual",
            "manual_value": "2000000.00",
            "affect_savings": False,
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text

    cuerpo = _mes_actual(cliente, a)
    assert cuerpo["month"]["expense_total"] == "0.00"
    assert cuerpo["categories"] == []


# ===================================================================
#  GET /api/investments — la cartera
# ===================================================================


@sin_entorno
def test_listar_cartera_vacia(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    r = cliente.get("/api/investments", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["positions"] == []
    assert cuerpo["indicators"]["current_value"] == "0.00"
    assert cuerpo["indicators"]["return_percentage"] is None


@sin_entorno
def test_listar_cartera_con_posiciones(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    cliente.post(
        "/api/investments",
        json={
            "symbol": "A", "name": "A", "investment_type": "accion", "valuation_mode": "manual",
            "manual_value": "1000000.00", "affect_savings": False,
        },
        headers=a.cabeceras,
    )
    cliente.post(
        "/api/investments",
        json={
            "symbol": "B", "name": "B", "investment_type": "accion", "valuation_mode": "manual",
            "manual_value": "500000.00", "affect_savings": False,
        },
        headers=a.cabeceras,
    )

    r = cliente.get("/api/investments", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert len(cuerpo["positions"]) == 2
    assert cuerpo["indicators"]["current_value"] == "1500000.00"
    assert cuerpo["indicators"]["total_invested"] == "1500000.00"
    assert cuerpo["indicators"]["position_count"] == 2


# ===================================================================
#  PUT /api/investments/{id} — editar / actualizar el valor
# ===================================================================


@sin_entorno
def test_actualizar_valor_manual_no_toca_el_ahorro_del_mes(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    alta = cliente.post(
        "/api/investments",
        json={
            "symbol": "SUBE", "name": "Sube", "investment_type": "fci", "valuation_mode": "manual",
            "manual_value": "1000000.00", "affect_savings": False,
        },
        headers=a.cabeceras,
    ).json()

    r = cliente.put(
        f"/api/investments/{alta['id']}", json={"current_value": "1300000.00"}, headers=a.cabeceras
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["current_value"] == "1300000.00"
    assert cuerpo["return_amount"] == "300000.00"
    assert cuerpo["return_percentage"] == "30.0"

    # El patrimonio cambia (vía investments_value), el ahorro del mes no.
    dashboard = _mes_actual(cliente, a)
    assert dashboard["month"]["expense_total"] == "0.00"
    assert dashboard["month"]["income_total"] == "0.00"
    assert dashboard["indicators"]["investments_value"] == "1300000.00"


@sin_entorno
def test_actualizar_precio_unitario_recalcula_el_valor_con_los_nominales(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar
) -> None:
    a, _ = cuentas
    alta = cliente.post(
        "/api/investments",
        json={
            "symbol": "CP410", "name": "Letra CP410", "investment_type": "bono",
            "valuation_mode": "unit_price", "nominal_quantity": "100", "current_unit_price": "1000.00",
            "affect_savings": False,
        },
        headers=a.cabeceras,
    ).json()
    assert alta["current_value"] == "100000.00"

    r = cliente.put(
        f"/api/investments/{alta['id']}", json={"current_unit_price": "1200.00"}, headers=a.cabeceras
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["current_unit_price"] == "1200.000000"
    assert cuerpo["current_value"] == "120000.00"  # 100 nominales por 1200


@sin_entorno
def test_editar_una_posicion_de_otra_cuenta_da_404(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, b = cuentas
    alta = cliente.post(
        "/api/investments",
        json={
            "symbol": "SOLO-A", "name": "Sólo de A", "investment_type": "accion",
            "valuation_mode": "manual", "manual_value": "100000.00", "affect_savings": False,
        },
        headers=a.cabeceras,
    ).json()

    r = cliente.put(f"/api/investments/{alta['id']}", json={"current_value": "999.00"}, headers=b.cabeceras)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


# ===================================================================
#  DELETE /api/investments/{id} — vender
# ===================================================================


@sin_entorno
def test_vender_acredita_el_valor_total_como_ingreso(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    alta = cliente.post(
        "/api/investments",
        json={
            "symbol": "CEDEAR-W", "name": "Cedear W", "investment_type": "cedear",
            "valuation_mode": "manual", "manual_value": "1000000.00", "affect_savings": False,
        },
        headers=a.cabeceras,
    ).json()
    cliente.put(f"/api/investments/{alta['id']}", json={"current_value": "1200000.00"}, headers=a.cabeceras)

    r = cliente.delete(f"/api/investments/{alta['id']}", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    # El importe que vuelve al ahorro es el valor TOTAL de venta, no
    # sólo la ganancia — el rendimiento es un cálculo aparte (Regla 9).
    assert cuerpo["amount"] == "1200000.00"
    assert cuerpo["affected_savings"] is True

    dashboard = _mes_actual(cliente, a)
    assert dashboard["month"]["income_total"] == "1200000.00"
    categorias = {c["name"]: c for c in dashboard["categories"] if c["type"] == "income"}
    assert categorias["Inversiones"]["total"] == "1200000.00"

    # Y la posición ya no está en la cartera.
    cartera = cliente.get("/api/investments", headers=a.cabeceras).json()
    assert cartera["positions"] == []


@sin_entorno
def test_vender_con_affect_savings_false_no_acredita_nada(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    alta = cliente.post(
        "/api/investments",
        json={
            "symbol": "CORRIJO", "name": "Se cargó mal", "investment_type": "accion",
            "valuation_mode": "manual", "manual_value": "300000.00", "affect_savings": False,
        },
        headers=a.cabeceras,
    ).json()

    r = cliente.delete(f"/api/investments/{alta['id']}?affect_savings=false", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    assert r.json()["affected_savings"] is False

    dashboard = _mes_actual(cliente, a)
    assert dashboard["month"]["income_total"] == "0.00"


@sin_entorno
def test_vender_una_posicion_que_no_existe_da_404(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    r = cliente.delete("/api/investments/999999999", headers=a.cabeceras)
    assert r.status_code == 404


# ===================================================================
#  Aislamiento entre cuentas (RLS)
# ===================================================================


@sin_entorno
def test_una_cuenta_no_ve_la_cartera_de_otra(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, b = cuentas
    cliente.post(
        "/api/investments",
        json={
            "symbol": "SOLO-A", "name": "Sólo de A", "investment_type": "accion",
            "valuation_mode": "manual", "manual_value": "100000.00", "affect_savings": False,
        },
        headers=a.cabeceras,
    )

    r = cliente.get("/api/investments", headers=b.cabeceras)
    assert r.status_code == 200
    assert r.json()["positions"] == []
