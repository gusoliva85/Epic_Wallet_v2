"""`GET` y `PUT /api/settings` · F11-T01.

Se prueba contra la API real, con cuentas reales de Supabase — mismo
criterio que `test_investments_endpoints.py`.

Los criterios de aceptación, cada uno con su prueba: sin preferencia
guardada `theme` es `null`; guardarla la devuelve `GET`; guardar
`null` la borra; un valor fuera de "light"/"dark" da 422; el
aislamiento entre cuentas (RLS).
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
    correo = f"epicwallet.settings.{secrets.token_hex(6)}@example.com"
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
                text(f'delete from "{ESQUEMA}".app_settings where user_id = any(:ids)'),
                {"ids": [a.uid, b.uid]},
            )

    _limpiar()
    yield
    _limpiar()


# ===================================================================
#  GET /api/settings
# ===================================================================


@sin_entorno
def test_sin_token_devuelve_401(cliente) -> None:
    assert cliente.get("/api/settings").status_code == 401


@sin_entorno
def test_sin_preferencia_guardada_theme_es_null(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    r = cliente.get("/api/settings", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    assert r.json()["theme"] is None


# ===================================================================
#  PUT /api/settings
# ===================================================================


@sin_entorno
def test_guardar_el_tema_y_volver_a_leerlo(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    r = cliente.put("/api/settings", json={"theme": "dark"}, headers=a.cabeceras)
    assert r.status_code == 200, r.text
    assert r.json()["theme"] == "dark"

    r = cliente.get("/api/settings", headers=a.cabeceras)
    assert r.json()["theme"] == "dark"

    # Guardar de nuevo no duplica la fila (unique user_id, key): pisa.
    r = cliente.put("/api/settings", json={"theme": "light"}, headers=a.cabeceras)
    assert r.json()["theme"] == "light"


@sin_entorno
def test_guardar_null_borra_la_preferencia(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    cliente.put("/api/settings", json={"theme": "dark"}, headers=a.cabeceras)

    r = cliente.put("/api/settings", json={"theme": None}, headers=a.cabeceras)
    assert r.status_code == 200, r.text
    assert r.json()["theme"] is None

    assert cliente.get("/api/settings", headers=a.cabeceras).json()["theme"] is None


@sin_entorno
def test_un_valor_fuera_de_la_lista_da_422(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    r = cliente.put("/api/settings", json={"theme": "azul"}, headers=a.cabeceras)
    assert r.status_code == 422, r.text


@sin_entorno
def test_un_campo_desconocido_da_422(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, _ = cuentas
    r = cliente.put(
        "/api/settings", json={"theme": "dark", "numero_formato": "abreviado"}, headers=a.cabeceras
    )
    assert r.status_code == 422, r.text


# ===================================================================
#  Aislamiento entre cuentas (RLS)
# ===================================================================


@sin_entorno
def test_una_cuenta_no_ve_la_preferencia_de_otra(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar) -> None:
    a, b = cuentas
    cliente.put("/api/settings", json={"theme": "dark"}, headers=a.cabeceras)

    r = cliente.get("/api/settings", headers=b.cabeceras)
    assert r.status_code == 200
    assert r.json()["theme"] is None
