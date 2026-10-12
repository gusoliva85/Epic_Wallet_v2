"""`GET /api/categories/{id}/detail` · F07-T01.

Se prueba contra la API real, con cuentas reales de Supabase — mismo
criterio que `test_dashboard_endpoint.py` y `test_months_endpoints.py`.

Los tres criterios de aceptación de la tarea que le tocan a este
endpoint (el de los porcentajes es de `GET /api/dashboard`, probado en
`test_dashboard_endpoint.py`): una categoría sin movimientos da el
total en cero y no un error, y el detalle de un mes histórico devuelve
el total sin inventar movimientos (`transactions: null`, nunca una
lista vacía ni una lista inventada).
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
    correo = f"epicwallet.catdetail.{secrets.token_hex(6)}@example.com"
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


def _categoria_id(cliente, cuenta: Cuenta, nombre: str, tipo: str) -> int:
    r = cliente.get("/api/categories", params={"type": tipo}, headers=cuenta.cabeceras)
    for c in r.json():
        if c["name"] == nombre:
            return int(c["id"])
    pytest.fail(f"no se encontró la categoría {nombre!r} de tipo {tipo!r}")


def _cargar(cliente, cuenta: Cuenta, *, category_id: int, tipo: str, importe: str, fecha: str, desc: str = "") -> dict:
    r = cliente.post(
        "/api/transactions",
        json={
            "category_id": category_id,
            "transaction_date": fecha,
            "transaction_type": tipo,
            "amount": importe,
            "description": desc,
        },
        headers=cuenta.cabeceras,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _mes_actual(cliente, cuenta: Cuenta) -> tuple[int, int]:
    hoy = cliente.get("/api/dashboard", headers=cuenta.cabeceras).json()["month"]
    return hoy["year"], hoy["month"]


# ===================================================================


@sin_entorno
def test_sin_token_devuelve_401(cliente) -> None:
    r = cliente.get("/api/categories/1/detail", params={"year": 2026, "month": 1})
    assert r.status_code == 401


@sin_entorno
def test_sin_year_o_month_da_422(cliente, cuentas: tuple[Cuenta, Cuenta]) -> None:
    # A diferencia de GET /api/dashboard, acá no hay "mes actual" por
    # default: quien pide el detalle ya sabe qué mes está mirando.
    a, _ = cuentas
    r = cliente.get("/api/categories/1/detail", headers=a.cabeceras)
    assert r.status_code == 422


@sin_entorno
def test_categoria_inexistente_da_404(cliente, cuentas: tuple[Cuenta, Cuenta]) -> None:
    a, _ = cuentas
    r = cliente.get(
        "/api/categories/999999999/detail", params={"year": 2026, "month": 1}, headers=a.cabeceras
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


@sin_entorno
def test_categoria_de_otra_cuenta_da_404_y_no_403(cliente, cuentas: tuple[Cuenta, Cuenta]) -> None:
    a, b = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")
    r = cliente.get(
        f"/api/categories/{gas}/detail", params={"year": 2026, "month": 1}, headers=b.cabeceras
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


@sin_entorno
def test_un_mes_sin_abrir_da_404(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses) -> None:
    a, _ = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")
    r = cliente.get(
        f"/api/categories/{gas}/detail", params={"year": 1999, "month": 1}, headers=a.cabeceras
    )
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


@sin_entorno
def test_una_categoria_sin_movimientos_da_total_cero_y_lista_vacia(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """Criterio de aceptación: "una categoría sin movimientos no
    aparece o aparece en cero, decidido y consistente" — en el
    desglose del dashboard no aparece; pedida por su propio detalle,
    sí tiene que responder algo, así que es cero."""
    a, _ = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")
    anio, mes = _mes_actual(cliente, a)  # abre el mes, sin cargar nada en Gas

    r = cliente.get(f"/api/categories/{gas}/detail", params={"year": anio, "month": mes}, headers=a.cabeceras)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["total"] == "0.00"
    assert cuerpo["transactions"] == []
    assert cuerpo["last_date"] is None


@sin_entorno
def test_un_mes_abierto_trae_los_movimientos_de_esa_categoria_del_mas_nuevo_al_mas_viejo(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")
    luz = _categoria_id(cliente, a, "Luz", "expense")
    anio, mes = _mes_actual(cliente, a)

    def fecha(d: int) -> str:
        return f"{anio:04d}-{mes:02d}-{d:02d}"

    _cargar(cliente, a, category_id=gas, tipo="expense", importe="10000.00", fecha=fecha(3), desc="Gas 1")
    _cargar(cliente, a, category_id=gas, tipo="expense", importe="15000.00", fecha=fecha(20), desc="Gas 2")
    # Otra categoría: no tiene que aparecer en el detalle de Gas.
    _cargar(cliente, a, category_id=luz, tipo="expense", importe="8000.00", fecha=fecha(10), desc="Luz")

    r = cliente.get(f"/api/categories/{gas}/detail", params={"year": anio, "month": mes}, headers=a.cabeceras)
    assert r.status_code == 200, r.text
    cuerpo = r.json()

    assert cuerpo["category_id"] == gas
    assert cuerpo["name"] == "Gas"
    assert cuerpo["total"] == "25000.00"
    assert cuerpo["last_date"] == fecha(20)

    assert len(cuerpo["transactions"]) == 2
    assert [t["description"] for t in cuerpo["transactions"]] == ["Gas 2", "Gas 1"]  # más nuevo primero
    assert all(t["category_id"] == gas for t in cuerpo["transactions"])


@sin_entorno
def test_un_mes_historico_devuelve_el_total_sin_inventar_movimientos(
    cliente, motor, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """Criterio de aceptación central de la tarea, literal: el total
    manual se muestra, pero `transactions` es `null` — nunca `[]`, que
    diría "no hubo gastos" cuando lo que pasa es que no hay cómo
    saberlo (Regla 4)."""
    a, _ = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")

    with escritura(motor) as con:
        con.execute(
            text(
                f'insert into "{ESQUEMA}".months '
                "(user_id, year, month, status, income_total, expense_total, saving_total) "
                "values (:uid, 2025, 6, 'historical', 400000, 90000, 310000)"
            ),
            {"uid": a.uid},
        )
        mes_id = con.execute(
            text(f'select id from "{ESQUEMA}".months where user_id = :uid and year = 2025 and month = 6'),
            {"uid": a.uid},
        ).scalar()
        con.execute(
            text(
                f'insert into "{ESQUEMA}".monthly_category_totals '
                "(user_id, month_id, category_id, total_amount, is_manual_summary) "
                "values (:uid, :mes_id, :cat_id, 45000, true)"
            ),
            {"uid": a.uid, "mes_id": mes_id, "cat_id": gas},
        )

    r = cliente.get(f"/api/categories/{gas}/detail", params={"year": 2025, "month": 6}, headers=a.cabeceras)
    assert r.status_code == 200, r.text
    cuerpo = r.json()

    assert cuerpo["total"] == "45000.00"
    assert cuerpo["transactions"] is None
    assert cuerpo["last_date"] is None
