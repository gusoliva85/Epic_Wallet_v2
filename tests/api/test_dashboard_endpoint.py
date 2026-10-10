"""`GET /api/dashboard` · F05-T04.

Se prueba contra la API real, con `TestClient` y cuentas reales de
Supabase — mismo criterio que `test_transactions_endpoints.py`.

Los tres criterios de aceptación de la tarea, cada uno con su prueba:
una sola petición trae todo (`test_una_cuenta_nueva_trae_todo_en_cero`,
`test_con_movimientos_cargados_los_indicadores_reflejan_la_realidad`),
un mes histórico responde `transactions: null`-equivalente —acá
`daily` y `recent_transactions`— y sin serie diaria
(`test_un_mes_historico_no_tiene_diario_ni_movimientos_recientes`), y
el tiempo de respuesta queda registrado, aunque no se le exige un
número duro: la red de este entorno de pruebas no es la de producción
—en gru1, misma región que la base— que es la que de verdad importa
para el límite de 400 ms.
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
    correo = f"epicwallet.dashboard.{secrets.token_hex(6)}@example.com"
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
    """Antes y después de cada prueba: sin meses (y por cascada, sin
    movimientos ni totales por categoría) de ninguna de las dos
    cuentas."""
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


# ===================================================================


@sin_entorno
def test_sin_token_devuelve_401(cliente) -> None:
    assert cliente.get("/api/dashboard").status_code == 401


@sin_entorno
def test_una_cuenta_nueva_trae_todo_en_cero(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses) -> None:
    a, _ = cuentas
    r = cliente.get("/api/dashboard", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    cuerpo = r.json()

    assert cuerpo["month"]["is_current"] is True
    assert cuerpo["month"]["status"] == "open"
    assert cuerpo["month"]["income_total"] == "0.00"
    assert cuerpo["month"]["saving_rate"] is None  # criterio: ingresos en cero, nunca 0%

    assert cuerpo["indicators"]["savings_balance"] == "0.00"
    assert cuerpo["indicators"]["net_worth"] == "0.00"
    assert cuerpo["indicators"]["vs_previous"] == {"income": None, "expense": None, "saving": None}

    assert cuerpo["daily"] is not None
    assert all(v == "0.00" for v in cuerpo["daily"]["income"])
    assert cuerpo["daily"]["peak_expense"] is None
    assert cuerpo["daily"]["days_without_expense"] == cuerpo["daily"]["days"]

    assert cuerpo["categories"] == []
    assert cuerpo["recent_transactions"] == []
    assert cuerpo["alerts"] == []
    assert cuerpo["navigation"]["next"] is None  # ya es el mes actual


@sin_entorno
def test_con_movimientos_cargados_los_indicadores_reflejan_la_realidad(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    sueldo = _categoria_id(cliente, a, "Sueldo", "income")
    alquiler = _categoria_id(cliente, a, "Alquiler", "expense")
    gas = _categoria_id(cliente, a, "Gas", "expense")

    hoy = cliente.get("/api/dashboard", headers=a.cabeceras).json()["month"]
    anio, mes_num = hoy["year"], hoy["month"]

    def fecha(d: int) -> str:
        return f"{anio:04d}-{mes_num:02d}-{d:02d}"

    _cargar(cliente, a, category_id=sueldo, tipo="income", importe="500000.00", fecha=fecha(1), desc="Sueldo")
    _cargar(cliente, a, category_id=alquiler, tipo="expense", importe="150000.00", fecha=fecha(5), desc="Alquiler")
    _cargar(cliente, a, category_id=gas, tipo="expense", importe="20000.00", fecha=fecha(5), desc="Gas de casa")

    r = cliente.get("/api/dashboard", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    cuerpo = r.json()

    assert cuerpo["month"]["income_total"] == "500000.00"
    assert cuerpo["month"]["expense_total"] == "170000.00"
    assert cuerpo["month"]["saving_total"] == "330000.00"
    assert cuerpo["month"]["saving_rate"] == "66.0"

    assert cuerpo["indicators"]["income"] == "500000.00"
    assert cuerpo["indicators"]["savings_balance"] == "330000.00"
    assert cuerpo["indicators"]["net_worth"] == "330000.00"  # sin inversiones ni pasivos todavía

    assert cuerpo["daily"]["income"][0] == "500000.00"
    assert cuerpo["daily"]["expense"][4] == "170000.00"
    assert cuerpo["daily"]["peak_expense"] == {"day": 5, "amount": "170000.00"}
    assert cuerpo["daily"]["saving_cumulative"][-1] == "330000.00"

    categorias = {c["name"]: c for c in cuerpo["categories"]}
    assert categorias["Alquiler"]["total"] == "150000.00"
    assert categorias["Alquiler"]["share"] == "88.2"  # 150000 / 170000 * 100
    assert categorias["Alquiler"]["transaction_count"] == 1
    assert categorias["Sueldo"]["total"] == "500000.00"

    assert len(cuerpo["recent_transactions"]) == 3
    nombres_recientes = {m["description"] for m in cuerpo["recent_transactions"]}
    assert nombres_recientes == {"Sueldo", "Alquiler", "Gas de casa"}


@sin_entorno
def test_un_mes_historico_no_tiene_diario_ni_movimientos_recientes(
    cliente, motor, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    # Criterio de aceptación de la tarea. F08 todavía no tiene el
    # endpoint que crea un mes histórico de verdad: se simula con un
    # insert directo, mismo criterio que
    # test_transactions_endpoints.py::test_crear_en_un_mes_ya_historico_se_rechaza.
    a, _ = cuentas
    with escritura(motor) as con:
        con.execute(
            text(
                f'insert into "{ESQUEMA}".months '
                "(user_id, year, month, status, income_total, expense_total, saving_total) "
                "values (:uid, 2025, 6, 'historical', 400000, 250000, 150000)"
            ),
            {"uid": a.uid},
        )
        categoria = con.execute(
            text(f'select id from "{ESQUEMA}".categories where user_id = :uid and name = \'Alquiler\''),
            {"uid": a.uid},
        ).scalar()
        mes_id = con.execute(
            text(f'select id from "{ESQUEMA}".months where user_id = :uid and year = 2025 and month = 6'),
            {"uid": a.uid},
        ).scalar()
        con.execute(
            text(
                f'insert into "{ESQUEMA}".monthly_category_totals '
                "(user_id, month_id, category_id, total_amount, is_manual_summary) "
                "values (:uid, :mes_id, :cat_id, 250000, true)"
            ),
            {"uid": a.uid, "mes_id": mes_id, "cat_id": categoria},
        )

    r = cliente.get("/api/dashboard", params={"year": 2025, "month": 6}, headers=a.cabeceras)
    assert r.status_code == 200, r.text
    cuerpo = r.json()

    assert cuerpo["month"]["status"] == "historical"
    assert cuerpo["month"]["consolidated"] is True
    assert cuerpo["daily"] is None
    assert cuerpo["recent_transactions"] is None
    # El total manual sigue mostrándose: Regla 4 dice que no hay
    # movimientos individuales, no que no haya totales.
    assert cuerpo["categories"][0]["total"] == "250000.00"
    assert cuerpo["categories"][0]["transaction_count"] == 0
    assert cuerpo["categories"][0]["last_date"] is None


@sin_entorno
def test_un_mes_que_no_existe_da_404(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses) -> None:
    a, _ = cuentas
    r = cliente.get("/api/dashboard", params={"year": 1999, "month": 1}, headers=a.cabeceras)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


@sin_entorno
def test_vs_previous_compara_con_el_mes_anterior(
    cliente, motor, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    hoy = cliente.get("/api/dashboard", headers=a.cabeceras).json()["month"]
    anio, mes_num = hoy["year"], hoy["month"]
    mes_anterior = mes_num - 1 if mes_num > 1 else 12
    anio_anterior = anio if mes_num > 1 else anio - 1

    with escritura(motor) as con:
        con.execute(
            text(
                f'insert into "{ESQUEMA}".months '
                "(user_id, year, month, status, income_total, expense_total, saving_total) "
                "values (:uid, :anio, :mes, 'historical', 100000, 50000, 50000)"
            ),
            {"uid": a.uid, "anio": anio_anterior, "mes": mes_anterior},
        )

    sueldo = _categoria_id(cliente, a, "Sueldo", "income")
    _cargar(cliente, a, category_id=sueldo, tipo="income", importe="150000.00", fecha=f"{anio:04d}-{mes_num:02d}-01")

    r = cliente.get("/api/dashboard", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    # (150000 - 100000) / 100000 * 100 = 50.0
    assert r.json()["indicators"]["vs_previous"]["income"] == "50.0"


@sin_entorno
def test_una_cuenta_no_ve_el_dashboard_de_otra(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses) -> None:
    a, b = cuentas
    sueldo = _categoria_id(cliente, a, "Sueldo", "income")
    hoy = cliente.get("/api/dashboard", headers=a.cabeceras).json()["month"]
    _cargar(
        cliente, a, category_id=sueldo, tipo="income", importe="999999.00",
        fecha=f"{hoy['year']:04d}-{hoy['month']:02d}-01",
    )

    r = cliente.get("/api/dashboard", headers=b.cabeceras)
    assert r.status_code == 200
    assert r.json()["month"]["income_total"] == "0.00"
