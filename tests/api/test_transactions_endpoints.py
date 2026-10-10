"""`GET`, `POST`, `PUT` y `DELETE /api/transactions` · F04-T06.

Se prueba contra la API real, con `TestClient` y cuentas reales de
Supabase — mismo criterio que `test_categories_endpoints.py`.

Los cuatro criterios de aceptación de la tarea, cada uno con su
prueba: cada escritura devuelve los totales nuevos del mes
(`test_crear_devuelve_el_movimiento_y_los_totales`,
`test_editar_devuelve_los_totales_actualizados`,
`test_borrar_devuelve_los_totales_sin_el_movimiento`), un movimiento
de otro usuario devuelve 404 (`test_editar_un_movimiento_de_otra_cuenta_da_404`,
`test_borrar_un_movimiento_de_otra_cuenta_da_404`), los filtros
combinan (`test_get_combina_varios_filtros`), y el borrado queda
registrado con su metadata técnica
(`test_borrar_deja_metadata_tecnica_en_el_log`).
"""

from __future__ import annotations

import datetime as dt
import json
import logging
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

from tests.api.ayudas_db import escritura, motor_de_pruebas

RAIZ = Path(__file__).resolve().parents[2]
pytestmark = pytest.mark.api

ZONA_APP = ZoneInfo("America/Argentina/Buenos_Aires")


def _hoy() -> dt.date:
    return dt.datetime.now(ZONA_APP).date()


def _otro_anio(fecha: dt.date) -> dt.date:
    """Un mes futuro, lejos de cualquier `hoy` real: un año más tarde,
    mismo mes y día (1, para no pisar el 29 de febrero)."""
    return dt.date(fecha.year + 1, fecha.month, 1)


def _primer_dia_del_mes_siguiente(fecha: dt.date) -> dt.date:
    if fecha.month == 12:
        return dt.date(fecha.year + 1, 1, 1)
    return dt.date(fecha.year, fecha.month + 1, 1)


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
    correo = f"epicwallet.transactions.{secrets.token_hex(6)}@example.com"
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
    cuentas, para que ninguna prueba dependa de lo que dejó la
    anterior."""
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


# ===================================================================
#  POST /api/transactions
# ===================================================================


@sin_entorno
def test_sin_token_devuelve_401(cliente) -> None:
    assert cliente.get("/api/transactions").status_code == 401


@sin_entorno
def test_crear_devuelve_el_movimiento_y_los_totales_del_mes(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    sueldo = _categoria_id(cliente, a, "Sueldo", "income")

    r = cliente.post(
        "/api/transactions",
        json={
            "category_id": sueldo,
            "transaction_date": _hoy().isoformat(),
            "transaction_type": "income",
            "amount": "500000.00",
            "description": "Sueldo de octubre",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text
    cuerpo = r.json()

    assert cuerpo["transaction"]["category_id"] == sueldo
    assert cuerpo["transaction"]["amount"] == "500000.00"
    assert cuerpo["transaction"]["description"] == "Sueldo de octubre"
    assert cuerpo["transaction"]["source"] == "manual"
    assert cuerpo["month_totals"]["income_total"] == "500000.00"
    assert cuerpo["month_totals"]["expense_total"] == "0.00"
    assert cuerpo["month_totals"]["saving_total"] == "500000.00"


@sin_entorno
def test_crear_con_categoria_de_otro_tipo_se_rechaza(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """Regla 34 del documento general: una categoría de ingreso no le
    sirve a un egreso."""
    a, _ = cuentas
    sueldo = _categoria_id(cliente, a, "Sueldo", "income")

    r = cliente.post(
        "/api/transactions",
        json={
            "category_id": sueldo,
            "transaction_date": _hoy().isoformat(),
            "transaction_type": "expense",
            "amount": "1000.00",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 400, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


@sin_entorno
def test_crear_con_categoria_inexistente_se_rechaza(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    r = cliente.post(
        "/api/transactions",
        json={
            "category_id": 999999999,
            "transaction_date": _hoy().isoformat(),
            "transaction_type": "expense",
            "amount": "1000.00",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 400, r.text


@sin_entorno
def test_crear_con_categoria_de_otra_cuenta_se_rechaza(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """No se revela que la categoría existe: mismo 400 que una que no
    existe en absoluto, nunca un 403 ni un 404 que confirme que es de
    otro usuario."""
    a, b = cuentas
    gas_de_b = _categoria_id(cliente, b, "Gas", "expense")

    r = cliente.post(
        "/api/transactions",
        json={
            "category_id": gas_de_b,
            "transaction_date": _hoy().isoformat(),
            "transaction_type": "expense",
            "amount": "1000.00",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 400, r.text


@sin_entorno
def test_crear_en_un_mes_futuro_se_rechaza(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")

    r = cliente.post(
        "/api/transactions",
        json={
            "category_id": gas,
            "transaction_date": _otro_anio(_hoy()).isoformat(),
            "transaction_type": "expense",
            "amount": "1000.00",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 400, r.text


@sin_entorno
def test_crear_en_un_mes_ya_historico_se_rechaza(
    cliente, motor, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """Regla que no se negocia (CLAUDE.md): un mes consolidado no
    recibe movimientos individuales. Se simula un mes histórico ya
    cargado —F08 todavía no tiene el endpoint que lo crea— con un
    `insert` directo, mismo criterio que otras pruebas de este
    proyecto que anticipan una tabla o una fila que otra fase va a
    poblar de verdad."""
    a, _ = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")
    hoy = _hoy()

    with escritura(motor) as con:
        con.execute(
            text(
                f'insert into "{ESQUEMA}".months (user_id, year, month, status) '
                "values (:uid, :year, :month, 'historical')"
            ),
            {"uid": a.uid, "year": hoy.year, "month": hoy.month},
        )

    r = cliente.post(
        "/api/transactions",
        json={
            "category_id": gas,
            "transaction_date": hoy.isoformat(),
            "transaction_type": "expense",
            "amount": "1000.00",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 400, r.text
    assert "histór" in r.json()["error"]["message"].lower()


@sin_entorno
@pytest.mark.parametrize(
    "cambios",
    [
        {"amount": "0.00"},
        {"amount": "-100.00"},
        {"transaction_type": "ahorro"},
        {"description": "x" * 501},
        {"category_id": "no-es-un-numero"},
        {"extra": "no debería existir"},
    ],
)
def test_entradas_invalidas_dan_422(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses, cambios: dict
) -> None:
    a, _ = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")
    cuerpo = {
        "category_id": gas,
        "transaction_date": _hoy().isoformat(),
        "transaction_type": "expense",
        "amount": "1000.00",
        **cambios,
    }
    r = cliente.post("/api/transactions", json=cuerpo, headers=a.cabeceras)
    assert r.status_code == 422, r.text


# ===================================================================
#  PUT /api/transactions/{id}
# ===================================================================


@sin_entorno
def test_editar_devuelve_los_totales_actualizados(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    alquiler = _categoria_id(cliente, a, "Alquiler", "expense")
    hoy = _hoy()

    creado = cliente.post(
        "/api/transactions",
        json={
            "category_id": alquiler,
            "transaction_date": hoy.isoformat(),
            "transaction_type": "expense",
            "amount": "100000.00",
        },
        headers=a.cabeceras,
    ).json()["transaction"]

    r = cliente.put(
        f"/api/transactions/{creado['id']}",
        json={
            "category_id": alquiler,
            "transaction_date": hoy.isoformat(),
            "transaction_type": "expense",
            "amount": "120000.00",
            "description": "Alquiler con aumento",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert cuerpo["transaction"]["amount"] == "120000.00"
    assert cuerpo["transaction"]["description"] == "Alquiler con aumento"
    assert cuerpo["month_totals"]["expense_total"] == "120000.00"


@sin_entorno
def test_editar_con_fecha_fuera_del_mes_se_rechaza(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")
    hoy = _hoy()

    creado = cliente.post(
        "/api/transactions",
        json={
            "category_id": gas,
            "transaction_date": hoy.isoformat(),
            "transaction_type": "expense",
            "amount": "1000.00",
        },
        headers=a.cabeceras,
    ).json()["transaction"]

    otro_mes = _primer_dia_del_mes_siguiente(hoy)
    r = cliente.put(
        f"/api/transactions/{creado['id']}",
        json={
            "category_id": gas,
            "transaction_date": otro_mes.isoformat(),
            "transaction_type": "expense",
            "amount": "1000.00",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 400, r.text


@sin_entorno
def test_editar_un_movimiento_de_otra_cuenta_da_404(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, b = cuentas
    gas_a = _categoria_id(cliente, a, "Gas", "expense")
    gas_b = _categoria_id(cliente, b, "Gas", "expense")
    hoy = _hoy()

    creado = cliente.post(
        "/api/transactions",
        json={
            "category_id": gas_a,
            "transaction_date": hoy.isoformat(),
            "transaction_type": "expense",
            "amount": "1000.00",
        },
        headers=a.cabeceras,
    ).json()["transaction"]

    r = cliente.put(
        f"/api/transactions/{creado['id']}",
        json={
            "category_id": gas_b,
            "transaction_date": hoy.isoformat(),
            "transaction_type": "expense",
            "amount": "1.00",
        },
        headers=b.cabeceras,
    )
    assert r.status_code == 404, r.text


# ===================================================================
#  DELETE /api/transactions/{id}
# ===================================================================


@sin_entorno
def test_borrar_devuelve_los_totales_sin_el_movimiento(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")
    hoy = _hoy()

    creado = cliente.post(
        "/api/transactions",
        json={
            "category_id": gas,
            "transaction_date": hoy.isoformat(),
            "transaction_type": "expense",
            "amount": "1000.00",
        },
        headers=a.cabeceras,
    ).json()["transaction"]

    r = cliente.delete(f"/api/transactions/{creado['id']}", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    cuerpo = r.json()
    assert "transaction" not in cuerpo
    assert cuerpo["month_totals"]["expense_total"] == "0.00"

    # Ya no está: volver a borrarlo da 404.
    r2 = cliente.delete(f"/api/transactions/{creado['id']}", headers=a.cabeceras)
    assert r2.status_code == 404


@sin_entorno
def test_borrar_un_movimiento_de_otra_cuenta_da_404(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, b = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")
    hoy = _hoy()

    creado = cliente.post(
        "/api/transactions",
        json={
            "category_id": gas,
            "transaction_date": hoy.isoformat(),
            "transaction_type": "expense",
            "amount": "1000.00",
        },
        headers=a.cabeceras,
    ).json()["transaction"]

    r = cliente.delete(f"/api/transactions/{creado['id']}", headers=b.cabeceras)
    assert r.status_code == 404


@sin_entorno
def test_borrar_deja_metadata_tecnica_en_el_log(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses, caplog: pytest.LogCaptureFixture
) -> None:
    """Criterio de aceptación: el borrado queda registrado con su
    metadata técnica (General §59). `transactions` no tiene borrado
    lógico —la fila se va de verdad—, así que lo que se comprueba es
    que el log del servidor conserva quién, qué fila y con qué datos
    se borró."""
    a, _ = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")
    hoy = _hoy()

    creado = cliente.post(
        "/api/transactions",
        json={
            "category_id": gas,
            "transaction_date": hoy.isoformat(),
            "transaction_type": "expense",
            "amount": "4321.00",
        },
        headers=a.cabeceras,
    ).json()["transaction"]

    with caplog.at_level(logging.INFO, logger="epic_wallet"):
        r = cliente.delete(f"/api/transactions/{creado['id']}", headers=a.cabeceras)
    assert r.status_code == 200

    mensajes = " ".join(rec.message for rec in caplog.records)
    assert f"id={creado['id']}" in mensajes
    assert a.uid in mensajes
    assert "4321.00" in mensajes


# ===================================================================
#  GET /api/transactions — filtros
# ===================================================================


@sin_entorno
def test_get_de_un_mes_sin_crear_da_lista_vacia(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    hoy = _hoy()
    r = cliente.get(
        "/api/transactions", params={"year": hoy.year, "month": hoy.month}, headers=a.cabeceras
    )
    assert r.status_code == 200
    assert r.json() == []


@sin_entorno
def test_get_combina_varios_filtros(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    sueldo = _categoria_id(cliente, a, "Sueldo", "income")
    gas = _categoria_id(cliente, a, "Gas", "expense")
    luz = _categoria_id(cliente, a, "Luz", "expense")
    hoy = _hoy()

    def _crear(category_id: int, tipo: str, importe: str, descripcion: str, dia: int) -> None:
        fecha = hoy.replace(day=min(dia, 28))
        r = cliente.post(
            "/api/transactions",
            json={
                "category_id": category_id,
                "transaction_date": fecha.isoformat(),
                "transaction_type": tipo,
                "amount": importe,
                "description": descripcion,
            },
            headers=a.cabeceras,
        )
        assert r.status_code == 201, r.text

    _crear(sueldo, "income", "500000.00", "Sueldo de octubre", 1)
    _crear(gas, "expense", "15000.00", "Factura de gas", 5)
    _crear(gas, "expense", "2000.00", "Gas garrafa", 10)
    _crear(luz, "expense", "9000.00", "Factura de luz", 12)

    base = {"year": hoy.year, "month": hoy.month}

    # Sólo tipo.
    egresos = cliente.get(
        "/api/transactions", params={**base, "type": "expense"}, headers=a.cabeceras
    ).json()
    assert len(egresos) == 3
    assert all(m["transaction_type"] == "expense" for m in egresos)

    # Tipo + categoría a la vez: los filtros combinan.
    de_gas = cliente.get(
        "/api/transactions",
        params={**base, "type": "expense", "category_id": gas},
        headers=a.cabeceras,
    ).json()
    assert len(de_gas) == 2
    assert all(m["category_id"] == gas for m in de_gas)

    # Texto en la descripción.
    con_factura = cliente.get(
        "/api/transactions", params={**base, "q": "factura"}, headers=a.cabeceras
    ).json()
    assert len(con_factura) == 2

    # Texto + tipo a la vez.
    con_factura_de_gas = cliente.get(
        "/api/transactions",
        params={**base, "q": "factura", "category_id": gas},
        headers=a.cabeceras,
    ).json()
    assert len(con_factura_de_gas) == 1
    assert con_factura_de_gas[0]["description"] == "Factura de gas"

    # Rango de fechas: sólo la primera quincena.
    primera_quincena = cliente.get(
        "/api/transactions",
        params={
            **base,
            "date_from": hoy.replace(day=1).isoformat(),
            "date_to": hoy.replace(day=9).isoformat(),
        },
        headers=a.cabeceras,
    ).json()
    assert len(primera_quincena) == 2  # sueldo (día 1) y factura de gas (día 5)


@sin_entorno
def test_get_no_devuelve_movimientos_de_otra_cuenta(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, b = cuentas
    gas = _categoria_id(cliente, a, "Gas", "expense")
    hoy = _hoy()

    cliente.post(
        "/api/transactions",
        json={
            "category_id": gas,
            "transaction_date": hoy.isoformat(),
            "transaction_type": "expense",
            "amount": "1000.00",
        },
        headers=a.cabeceras,
    )

    de_b = cliente.get(
        "/api/transactions", params={"year": hoy.year, "month": hoy.month}, headers=b.cabeceras
    ).json()
    assert de_b == [], "una cuenta vio movimientos de la otra"
