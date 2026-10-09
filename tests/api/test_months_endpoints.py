"""`GET /api/months` y `GET /api/months/{id}` · F03-T05.

Se prueba contra la API real, con cuentas reales de Supabase y sus
tokens reales —mismo criterio que `test_me.py`—. Los meses se siembran
llamando al repositorio directo con una sesión de usuario, no por HTTP:
todavía no hay `POST /api/months`, así que es la única forma de tener
datos para leer.

Los tres criterios de aceptación de la tarea, cada uno con su prueba:
sin token da 401, un mes de otro usuario da 404 y no 403, y un mes
histórico devuelve `transactions: null`.
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
    correo = f"epicwallet.months.ep.{secrets.token_hex(6)}@example.com"
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
def limpiar_meses(motor, cuentas):
    a, b = cuentas

    def _limpiar() -> None:
        with escritura(motor) as con:
            con.execute(
                text(f'delete from "{ESQUEMA}".months where user_id = any(:ids)'),
                {"ids": [a.uid, b.uid]},
            )

    _limpiar()
    yield
    _limpiar()


def _crear_mes(uid: str, **campos: Any) -> int:
    """Siembra un mes con el repositorio, dentro de una sesión a
    nombre de ese usuario (si no, RLS rechazaría el insert)."""
    from api.app.core import db as modulo
    from api.app.repos import months as repos

    with modulo.sesion_de_usuario(uid) as sesion:
        mes = repos.crear(sesion, user_id=uid, **campos)
        return mes.id


# ===================================================================
#  GET /api/months
# ===================================================================


@sin_entorno
def test_sin_token_devuelve_401(cliente) -> None:
    """Criterio de aceptación."""
    r = cliente.get("/api/months")
    assert r.status_code == 401


@sin_entorno
def test_devuelve_solo_los_meses_de_esa_cuenta(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, b = cuentas
    _crear_mes(a.uid, year=2026, month=10, status="open")
    _crear_mes(a.uid, year=2026, month=9, status="historical")
    _crear_mes(b.uid, year=2026, month=10, status="open")

    r = cliente.get("/api/months", headers=a.cabeceras)
    assert r.status_code == 200
    periodos = {(m["year"], m["month"]) for m in r.json()}
    assert periodos == {(2026, 10), (2026, 9)}
    assert len(r.json()) == 2, "vio un mes de la otra cuenta"


@sin_entorno
def test_los_importes_vienen_como_texto(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    _crear_mes(a.uid, year=2026, month=10, status="open")

    r = cliente.get("/api/months", headers=a.cabeceras)
    mes = r.json()[0]
    assert isinstance(mes["income_total"], str)
    assert mes["income_total"] == "0.00"


# ===================================================================
#  GET /api/months/{id}
# ===================================================================


@sin_entorno
def test_sin_token_el_detalle_tambien_devuelve_401(cliente) -> None:
    r = cliente.get("/api/months/1")
    assert r.status_code == 401


@sin_entorno
def test_el_detalle_de_un_mes_propio_trae_todo(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    month_id = _crear_mes(a.uid, year=2026, month=10, status="open")

    r = cliente.get(f"/api/months/{month_id}", headers=a.cabeceras)
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["id"] == month_id
    assert cuerpo["year"] == 2026
    assert cuerpo["month"] == 10
    assert cuerpo["status"] == "open"
    assert "opening_balance" in cuerpo
    assert "created_at" in cuerpo


@sin_entorno
def test_un_mes_que_no_existe_da_404(cliente, cuentas: tuple[Cuenta, Cuenta]) -> None:
    a, _ = cuentas
    r = cliente.get("/api/months/999999999", headers=a.cabeceras)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


@sin_entorno
def test_el_mes_de_otra_cuenta_da_404_y_no_403(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """Criterio de aceptación central de la tarea. RLS ya sacó la fila
    de la consulta; lo que se prueba es que el router no la convierta
    en un 403 —que sí revelaría que el mes existe y es de otro—, sino
    en el mismo 404 que un id inventado."""
    a, b = cuentas
    month_id = _crear_mes(a.uid, year=2026, month=10, status="open")

    r = cliente.get(f"/api/months/{month_id}", headers=b.cabeceras)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


@sin_entorno
def test_un_mes_abierto_devuelve_transactions_lista(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    month_id = _crear_mes(a.uid, year=2026, month=10, status="open")

    r = cliente.get(f"/api/months/{month_id}", headers=a.cabeceras)
    cuerpo = r.json()
    assert "transactions" in cuerpo
    assert cuerpo["transactions"] == []
    assert cuerpo["transactions"] is not None


@sin_entorno
def test_un_mes_historico_devuelve_transactions_null(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """Criterio de aceptación de la tarea, literal: `transactions:
    null`, no una lista vacía ni el campo ausente."""
    a, _ = cuentas
    month_id = _crear_mes(a.uid, year=2026, month=9, status="historical")

    r = cliente.get(f"/api/months/{month_id}", headers=a.cabeceras)
    cuerpo = r.json()
    assert "transactions" in cuerpo, "el campo no puede faltar"
    assert cuerpo["transactions"] is None
