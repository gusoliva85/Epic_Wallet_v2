"""`GET /api/export` y `POST /api/import` · F11-T02.

Se prueba contra la API real, con cuentas reales de Supabase — mismo
criterio que `test_investments_endpoints.py`.

El criterio de aceptación que importa más, "se restaura el respaldo en
una cuenta limpia y los datos quedan iguales", se prueba de punta a
punta: se carga una cuenta con un poco de todo (un movimiento del mes
en curso, un mes histórico, una inversión, el saldo inicial y el
tema), se exporta, se importa en una cuenta nueva y se compara contra
`GET /api/dashboard`, `GET /api/months` y `GET /api/investments` de
las dos cuentas.
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

from tests.api.ayudas_auth import confirmar_correo
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
    correo = f"epicwallet.respaldo.{secrets.token_hex(6)}@example.com"
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
        # F11-T03: con la confirmación por correo activada, `signup` no
        # devuelve sesión y el `grant_type=password` daría
        # `email_not_confirmed`. Nadie va a abrir el mail de una cuenta
        # de QA, así que se confirma con la clave de servicio.
        confirmar_correo(uid)
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


@pytest.fixture
def cuentas(motor, cliente) -> Iterator[tuple[Cuenta, Cuenta]]:
    """Dos cuentas por prueba —no por módulo—: varias pruebas de acá
    cargan datos reales (movimientos, meses, inversiones) y una cuenta
    sucia de una prueba anterior haría fallar `cuenta_esta_limpia` en
    la siguiente, sin que el fallo tenga nada que ver con lo que esa
    prueba en verdad verifica."""
    a = _crear_cuenta()
    b = _crear_cuenta()
    yield a, b
    with escritura(motor) as con:
        con.execute(text("delete from auth.users where id = any(:ids)"), {"ids": [a.uid, b.uid]})


def _categoria_id(cliente, cuenta: Cuenta, nombre: str, tipo: str) -> int:
    categorias = cliente.get("/api/categories", headers=cuenta.cabeceras).json()
    return next(c["id"] for c in categorias if c["name"] == nombre and c["type"] == tipo)


# ===================================================================
#  GET /api/export
# ===================================================================


@sin_entorno
def test_sin_token_devuelve_401(cliente) -> None:
    assert cliente.get("/api/export").status_code == 401


@sin_entorno
def test_exportar_json_trae_perfil_y_categorias(cliente, cuentas: tuple[Cuenta, Cuenta]) -> None:
    a, _ = cuentas
    r = cliente.get("/api/export", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["schema_version"] == 1
    assert cuerpo["profile"]["username"]
    assert len(cuerpo["categories"]) == 21, "las 21 categorías iniciales del trigger"
    assert cuerpo["months"] == []
    assert cuerpo["transactions"] == []


@sin_entorno
def test_exportar_csv_da_un_zip_con_un_archivo_por_tabla(cliente, cuentas: tuple[Cuenta, Cuenta]) -> None:
    import io
    import zipfile

    a, _ = cuentas
    r = cliente.get("/api/export?format=csv", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/zip"

    with zipfile.ZipFile(io.BytesIO(r.content)) as zf:
        nombres = set(zf.namelist())
    assert "categories.csv" in nombres
    assert "profile.csv" in nombres


# ===================================================================
#  POST /api/import
# ===================================================================


@sin_entorno
def test_importar_sin_confirmar_solo_da_la_vista_previa(cliente, cuentas: tuple[Cuenta, Cuenta]) -> None:
    a, b = cuentas
    backup = cliente.get("/api/export", headers=a.cabeceras).json()

    r = cliente.post("/api/import", json={"backup": backup}, headers=b.cabeceras)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["applied"] is False
    assert cuerpo["categories"] == 21

    # No escribió nada importado. `GET /api/months` no sirve para
    # comprobarlo con un `== []`: abre el mes actual solo, por diseño
    # (routers/months.py, F03-T10), así que una cuenta nueva ya tiene
    # uno en cuanto se la lista — con eso alcanza, y por eso se verifica
    # que sea justo ese (en curso, en cero) y no algo importado.
    meses = cliente.get("/api/months", headers=b.cabeceras).json()
    assert len(meses) <= 1
    assert all(m["status"] == "open" and m["income_total"] == "0.00" for m in meses)


@sin_entorno
def test_version_de_esquema_distinta_da_400(cliente, cuentas: tuple[Cuenta, Cuenta]) -> None:
    a, b = cuentas
    backup = cliente.get("/api/export", headers=a.cabeceras).json()
    backup["schema_version"] = 999

    r = cliente.post("/api/import", json={"backup": backup, "confirm": True}, headers=b.cabeceras)
    assert r.status_code == 400, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


@sin_entorno
def test_importar_en_cuenta_que_ya_tiene_datos_da_409(cliente, cuentas: tuple[Cuenta, Cuenta]) -> None:
    a, b = cuentas
    # "b" deja de estar limpia: carga una posición.
    cliente.post(
        "/api/investments",
        json={"symbol": "X", "name": "X", "investment_type": "accion", "initial_value": "1000.00"},
        headers=b.cabeceras,
    )
    backup = cliente.get("/api/export", headers=a.cabeceras).json()

    r = cliente.post("/api/import", json={"backup": backup, "confirm": True}, headers=b.cabeceras)
    assert r.status_code == 409, r.text


@sin_entorno
def test_restaura_en_una_cuenta_limpia_y_los_datos_quedan_iguales(
    cliente, cuentas: tuple[Cuenta, Cuenta]
) -> None:
    """El criterio de aceptación de la tarea, de punta a punta."""
    a, b = cuentas

    # --- se carga "a" con un poco de todo ---
    cliente.patch("/api/me", json={"opening_balance": "500000.00"}, headers=a.cabeceras)
    cliente.put("/api/settings", json={"theme": "dark"}, headers=a.cabeceras)

    sueldo_id = _categoria_id(cliente, a, "Sueldo", "income")
    cliente.post(
        "/api/transactions",
        json={
            "category_id": sueldo_id,
            "transaction_type": "income",
            "amount": "1000000.00",
            "transaction_date": "2026-10-05",
            "description": "sueldo de octubre",
        },
        headers=a.cabeceras,
    )

    otros_id = _categoria_id(cliente, a, "Otros", "expense")
    cliente.post(
        "/api/months/historical",
        json={
            "year": 2026,
            "month": 9,
            "income_total": "900000.00",
            "expense_total": "600000.00",
            "saving_total": "300000.00",
            "categories": [{"category_id": otros_id, "total_amount": "600000.00"}],
        },
        headers=a.cabeceras,
    )

    cliente.post(
        "/api/investments",
        json={
            "symbol": "AL30",
            "name": "Bonar 2030",
            "investment_type": "bono",
            "nominal_quantity": "100",
            "initial_value": "150000.00",
        },
        headers=a.cabeceras,
    )

    # --- se exporta "a" y se importa en "b", limpia ---
    backup = cliente.get("/api/export", headers=a.cabeceras).json()
    r = cliente.post("/api/import", json={"backup": backup, "confirm": True}, headers=b.cabeceras)
    assert r.status_code == 200, r.text
    assert r.json() == {
        "categories": 21,
        "months": 2,
        "transactions": 1,
        "investments": 1,
        "liabilities": 0,
        "applied": True,
    }

    # --- se compara ---
    dash_a = cliente.get("/api/dashboard", headers=a.cabeceras).json()
    dash_b = cliente.get("/api/dashboard", headers=b.cabeceras).json()
    assert dash_b["month"]["income_total"] == dash_a["month"]["income_total"] == "1000000.00"
    assert dash_b["indicators"]["net_worth"] == dash_a["indicators"]["net_worth"]

    meses_a = {(m["year"], m["month"]): m for m in cliente.get("/api/months", headers=a.cabeceras).json()}
    meses_b = {(m["year"], m["month"]): m for m in cliente.get("/api/months", headers=b.cabeceras).json()}
    assert meses_a.keys() == meses_b.keys()
    for clave, mes_a in meses_a.items():
        assert mes_a["closing_balance"] == meses_b[clave]["closing_balance"], clave

    inv_a = cliente.get("/api/investments", headers=a.cabeceras).json()
    inv_b = cliente.get("/api/investments", headers=b.cabeceras).json()
    assert inv_a["indicators"]["current_value"] == inv_b["indicators"]["current_value"]
    assert [p["symbol"] for p in inv_a["positions"]] == [p["symbol"] for p in inv_b["positions"]]

    prefs_b = cliente.get("/api/settings", headers=b.cabeceras).json()
    assert prefs_b["theme"] == "dark"
