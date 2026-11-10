"""`GET /api/dues`, `PUT /api/dues/{category_id}` y
`GET /api/categories/{id}/history` · F13-T02 y F13-T03.

Contra la API real y con cuentas reales de Supabase, mismo criterio que
el resto de `tests/api/`: lo que sostiene el aislamiento es RLS, y RLS
no existe en un doble.

Qué se prueba acá, y por qué no alcanzaba con las pruebas de unidad
(`test_vencimientos.py` y `test_comparacion.py`, que cubren el cálculo):
el **recorrido completo** — que un vencimiento guardado vuelva con su
estado calculado por el servidor, que un movimiento del mes lo dé por
pagado solo, que el rango recorte por el final, y que un mes sin la
categoría venga en `null` y no en cero.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import secrets
import urllib.error
import urllib.request
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

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
    correo = f"epicwallet.dues.{secrets.token_hex(6)}@example.com"
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


@pytest.fixture(scope="module")
def cuentas(motor) -> Iterator[tuple[Cuenta, Cuenta]]:
    a = _crear_cuenta()
    b = _crear_cuenta()
    yield a, b
    with escritura(motor) as con:
        con.execute(text("delete from auth.users where id = any(:ids)"), {"ids": [a.uid, b.uid]})




@pytest.fixture
def limpiar(motor, cuentas):
    """Deja las dos cuentas sin vencimientos, movimientos ni meses.

    Borra SÓLO filas de estas dos cuentas de prueba, creadas por este
    mismo módulo y borradas al terminar (CLAUDE.md: los datos reales no
    se tocan).
    """
    a, b = cuentas

    def _limpiar() -> None:
        with escritura(motor) as con:
            for tabla in ("category_dues", "monthly_category_totals", "transactions", "months"):
                con.execute(
                    text(f'delete from "{ESQUEMA}".{tabla} where user_id = any(:ids)'),
                    {"ids": [a.uid, b.uid]},
                )

    _limpiar()
    yield
    _limpiar()


def _hoy() -> dt.date:
    return dt.datetime.now(ZoneInfo("America/Argentina/Buenos_Aires")).date()


def _categoria_id(cliente, cuenta: Cuenta, nombre: str, tipo: str) -> int:
    cats = cliente.get("/api/categories", headers=cuenta.cabeceras).json()
    for c in cats:
        if c["name"] == nombre and c["type"] == tipo:
            return int(c["id"])
    raise AssertionError(f"la cuenta no tiene la categoría {nombre} ({tipo})")


def _del_item(cliente, cuenta: Cuenta, category_id: int) -> dict:
    items = cliente.get("/api/dues", headers=cuenta.cabeceras).json()
    return next(i for i in items if i["category_id"] == category_id)


# ===================================================================
#  GET /api/dues
# ===================================================================


@sin_entorno
def test_lista_las_categorias_de_egreso_activas_sin_vencimiento(
    cliente, cuentas, limpiar
) -> None:
    """No hay un «agregar ítem»: la lista son los ítems que ya existen,
    todos apagados hasta que se prenda alguno."""
    a, _ = cuentas

    r = cliente.get("/api/dues", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    items = r.json()
    assert items, "una cuenta nueva ya tiene sus categorías de egreso"
    assert all(i["enabled"] is False for i in items)
    assert all(i["state"] is None and i["severity"] is None for i in items)
    # Ninguna categoría de ingreso: un sueldo no vence.
    assert "Sueldo" not in {i["name"] for i in items}


@sin_entorno
def test_guardar_un_vencimiento_lo_devuelve_con_su_estado(cliente, cuentas, limpiar) -> None:
    """El estado lo calcula el servidor con el día de hoy: el cliente no
    decide qué día es."""
    a, _ = cuentas
    hoy = _hoy()
    categoria = _categoria_id(cliente, a, "Alquiler", "expense")

    # Un vencimiento a dos días de hoy, avisando tres días antes: tiene
    # que estar avisando ya.
    dia = min(28, hoy.day + 2)
    r = cliente.put(
        f"/api/dues/{categoria}",
        json={"enabled": True, "due_day": dia, "notice_days": 3},
        headers=a.cabeceras,
    )
    assert r.status_code == 200, r.text
    item = r.json()
    assert item["enabled"] is True
    assert item["due_day"] == dia
    assert item["days_left"] == dia - hoy.day
    assert item["alert"] is True
    assert item["severity"] in {"warn", "crit"}

    guardado = _del_item(cliente, a, categoria)
    assert guardado["due_day"] == dia
    assert guardado["notice_days"] == 3


@sin_entorno
def test_apagarlo_conserva_el_dia_y_deja_de_avisar(cliente, cuentas, limpiar) -> None:
    """Se apaga en marzo y se prende en abril: el día y el aviso siguen
    ahí, no hay que volver a configurarlos."""
    a, _ = cuentas
    categoria = _categoria_id(cliente, a, "Luz", "expense")

    cliente.put(
        f"/api/dues/{categoria}",
        json={"enabled": True, "due_day": 12, "notice_days": 5},
        headers=a.cabeceras,
    )
    r = cliente.put(
        f"/api/dues/{categoria}",
        json={"enabled": False, "due_day": 12, "notice_days": 5},
        headers=a.cabeceras,
    )
    assert r.status_code == 200, r.text
    item = r.json()
    assert item["enabled"] is False
    assert item["state"] is None and item["alert"] is False
    assert item["due_day"] == 12 and item["notice_days"] == 5


@sin_entorno
def test_un_movimiento_del_mes_lo_da_por_pagado_y_apaga_la_alerta(
    cliente, cuentas, limpiar
) -> None:
    """La regla que pidió Gustavo: «cuando ve que ese ítem ya está
    cargado dentro del sistema, no lo cuenta». Nadie marca nada a
    mano."""
    a, _ = cuentas
    hoy = _hoy()
    categoria = _categoria_id(cliente, a, "Alquiler", "expense")

    cliente.put(
        f"/api/dues/{categoria}",
        json={"enabled": True, "due_day": min(28, hoy.day + 1), "notice_days": 3},
        headers=a.cabeceras,
    )
    antes = _del_item(cliente, a, categoria)
    assert antes["alert"] is True and antes["paid"] is False

    cliente.post(
        "/api/transactions",
        json={
            "category_id": categoria,
            "transaction_type": "expense",
            "amount": "530000.00",
            "transaction_date": hoy.isoformat(),
        },
        headers=a.cabeceras,
    )

    despues = _del_item(cliente, a, categoria)
    assert despues["paid"] is True
    assert despues["state"] == "paid"
    assert despues["alert"] is False


@sin_entorno
def test_las_alertas_viajan_dentro_del_dashboard(cliente, cuentas, limpiar) -> None:
    """El tablero es UNA llamada (CLAUDE.md): las alertas no se piden
    aparte."""
    a, _ = cuentas
    hoy = _hoy()
    categoria = _categoria_id(cliente, a, "Internet", "expense")

    cliente.put(
        f"/api/dues/{categoria}",
        json={"enabled": True, "due_day": min(28, hoy.day + 1), "notice_days": 3},
        headers=a.cabeceras,
    )

    d = cliente.get("/api/dashboard", headers=a.cabeceras).json()
    assert "dues_alerts" in d
    assert [x["category_id"] for x in d["dues_alerts"]] == [categoria]
    assert d["dues_alerts"][0]["severity"] == "crit"  # falta un día


@sin_entorno
def test_un_dia_o_un_aviso_fuera_de_rango_se_rechaza(cliente, cuentas, limpiar) -> None:
    a, _ = cuentas
    categoria = _categoria_id(cliente, a, "Luz", "expense")

    for cuerpo_pedido in (
        {"enabled": True, "due_day": 0, "notice_days": 3},
        {"enabled": True, "due_day": 32, "notice_days": 3},
        {"enabled": True, "due_day": 10, "notice_days": 99},
    ):
        r = cliente.put(f"/api/dues/{categoria}", json=cuerpo_pedido, headers=a.cabeceras)
        assert r.status_code == 422, (cuerpo_pedido, r.text)


@sin_entorno
def test_una_categoria_de_ingreso_no_puede_tener_vencimiento(cliente, cuentas, limpiar) -> None:
    a, _ = cuentas
    sueldo = _categoria_id(cliente, a, "Sueldo", "income")

    r = cliente.put(
        f"/api/dues/{sueldo}",
        json={"enabled": True, "due_day": 10, "notice_days": 3},
        headers=a.cabeceras,
    )
    assert r.status_code == 404, r.text


# ===================================================================
#  GET /api/categories/{id}/history
# ===================================================================


@sin_entorno
def test_el_historial_trae_un_mes_sin_la_categoria_en_null(cliente, cuentas, limpiar) -> None:
    """`null` y no cero: el mes existe, la categoría no tuvo nada. Un
    cero ahí se leería como «ese mes no gasté»."""
    a, _ = cuentas
    hoy = _hoy()
    categoria = _categoria_id(cliente, a, "Alquiler", "expense")
    otra = _categoria_id(cliente, a, "Luz", "expense")

    cliente.post(
        "/api/transactions",
        json={
            "category_id": otra,
            "transaction_type": "expense",
            "amount": "40000.00",
            "transaction_date": hoy.isoformat(),
        },
        headers=a.cabeceras,
    )

    r = cliente.get(f"/api/categories/{categoria}/history", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["category_id"] == categoria
    assert d["months"], "el mes en curso tiene que estar"
    assert d["months"][-1]["total"] is None
    # Sin dos meses con dato no hay promedio ni variación que calcular.
    assert d["average"] is None
    assert d["variation"] is None

    otra_serie = cliente.get(f"/api/categories/{otra}/history", headers=a.cabeceras).json()
    assert otra_serie["months"][-1]["total"] == "40000.00"


@sin_entorno
def test_el_rango_recorta_por_el_final(cliente, cuentas, limpiar) -> None:
    """`?months=1` tiene que devolver el mes MÁS NUEVO, no el más viejo:
    la pantalla pide «de acá tres meses atrás»."""
    a, _ = cuentas
    hoy = _hoy()
    categoria = _categoria_id(cliente, a, "Otros", "expense")

    # El historial es de sólo lectura y NO abre el mes en curso (a
    # diferencia de `GET /api/months` y del dashboard, que sí lo abren
    # si falta). En el uso real la aplicación carga el tablero antes de
    # llegar acá; en la prueba hay que pedirlo explícitamente, o el mes
    # de hoy no existiría y la serie tendría un mes menos.
    cliente.get("/api/months", headers=a.cabeceras)

    for resta in (2, 1):
        mes = hoy.replace(day=1)
        for _ in range(resta):
            mes = (mes - dt.timedelta(days=1)).replace(day=1)
        cliente.post(
            "/api/months/historical",
            json={
                "year": mes.year,
                "month": mes.month,
                "income_total": "0.00",
                "expense_total": "100000.00",
                "saving_total": "-100000.00",
                "categories": [{"category_id": categoria, "total_amount": "100000.00"}],
            },
            headers=a.cabeceras,
        )

    todo = cliente.get(f"/api/categories/{categoria}/history", headers=a.cabeceras).json()
    assert len(todo["months"]) == 3

    uno = cliente.get(f"/api/categories/{categoria}/history?months=1", headers=a.cabeceras).json()
    assert len(uno["months"]) == 1
    assert (uno["months"][0]["year"], uno["months"][0]["month"]) == (hoy.year, hoy.month)


@sin_entorno
def test_los_meses_consolidados_entran_en_la_comparacion(cliente, cuentas, limpiar) -> None:
    """Un mes histórico no tiene movimientos individuales (Regla 4), pero
    sí su total por categoría: es lo que se compara."""
    a, _ = cuentas
    hoy = _hoy()
    categoria = _categoria_id(cliente, a, "Otros", "expense")
    anterior = hoy.replace(day=1) - dt.timedelta(days=1)

    cliente.post(
        "/api/months/historical",
        json={
            "year": anterior.year,
            "month": anterior.month,
            "income_total": "0.00",
            "expense_total": "200000.00",
            "saving_total": "-200000.00",
            "categories": [{"category_id": categoria, "total_amount": "200000.00"}],
        },
        headers=a.cabeceras,
    )
    cliente.post(
        "/api/transactions",
        json={
            "category_id": categoria,
            "transaction_type": "expense",
            "amount": "250000.00",
            "transaction_date": hoy.isoformat(),
        },
        headers=a.cabeceras,
    )

    d = cliente.get(f"/api/categories/{categoria}/history", headers=a.cabeceras).json()
    serie = {(m["year"], m["month"]): m["total"] for m in d["months"]}
    assert serie[(anterior.year, anterior.month)] == "200000.00"
    assert serie[(hoy.year, hoy.month)] == "250000.00"
    # El último mes está en curso y no entra en el promedio: el promedio
    # es el del único mes cerrado.
    assert d["average"] == "200000.00"
    assert d["last_closed"] == "200000.00"
    assert d["difference"] == "50000.00"
    assert d["variation"] == "25.00"
