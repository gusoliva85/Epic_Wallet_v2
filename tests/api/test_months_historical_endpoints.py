"""`POST /api/months/historical` y `PATCH /api/months/{id}` · F08-T03.

Se prueba contra la API real, con cuentas reales de Supabase y sus
tokens reales — mismo criterio que `test_months_endpoints.py`.

Los tres criterios de aceptación de la tarea, cada uno con su prueba:
un mes consolidado queda con sus totales y sin movimientos
(`test_carga_un_mes_historico_nuevo_con_sus_totales`), corregir un
total propaga el acumulado hacia adelante
(`test_corregir_un_mes_del_medio_propaga_el_acumulado_hacia_adelante`),
y los totales por categoría de un mes histórico quedan marcados como
manuales (`test_los_totales_por_categoria_quedan_marcados_como_manuales`).
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
    correo = f"epicwallet.historical.ep.{secrets.token_hex(6)}@example.com"
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


def _categoria_id(uid: str, nombre: str, tipo: str) -> int:
    from api.app.core import db as modulo
    from api.app.repos import categories as repos_categorias

    with modulo.sesion_de_usuario(uid) as sesion:
        for c in repos_categorias.listar(sesion, type_=tipo):
            if c.name == nombre:
                return c.id
    pytest.fail(f"no se encontró la categoría {nombre!r} de tipo {tipo!r}")


def _crear_mes_abierto_con_movimiento(uid: str, *, year: int, month: int) -> int:
    """Un mes `open` con un movimiento cargado, para probar que
    convertirlo a histórico exige confirmación."""
    from api.app.core import db as modulo
    from api.app.services import months as servicio_meses
    from api.app.services import transactions as servicio_movimientos

    sueldo = _categoria_id(uid, "Sueldo", "income")
    with modulo.sesion_de_usuario(uid) as sesion:
        mes = servicio_meses.abrir_mes(sesion, uid, servicio_meses.Periodo(year, month))
        servicio_movimientos.crear_movimiento(
            sesion,
            mes,
            user_id=uid,
            category_id=sueldo,
            transaction_date=dt.date(year, month, 10),
            transaction_type="income",
            amount=decimal.Decimal("100000.00"),
        )
        return mes.id


def _fijar_saldo_inicial(cliente, cuenta: Cuenta, valor: str) -> None:
    r = cliente.patch("/api/me", json={"opening_balance": valor}, headers=cuenta.cabeceras)
    assert r.status_code == 200, r.text


# ===================================================================
#  POST /api/months/historical
# ===================================================================


@sin_entorno
def test_sin_token_devuelve_401(cliente) -> None:
    r = cliente.post(
        "/api/months/historical",
        json={"year": 2026, "month": 1, "income_total": "0", "expense_total": "0", "saving_total": "0"},
    )
    assert r.status_code == 401


@sin_entorno
def test_carga_un_mes_historico_nuevo_con_sus_totales(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """Criterio de aceptación: un mes consolidado queda con sus
    totales y sin movimientos."""
    a, _ = cuentas
    r = cliente.post(
        "/api/months/historical",
        json={
            "year": 2025,
            "month": 6,
            "income_total": "500000.00",
            "expense_total": "350000.00",
            "saving_total": "150000.00",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["status"] == "historical"
    assert cuerpo["income_total"] == "500000.00"
    assert cuerpo["expense_total"] == "350000.00"
    assert cuerpo["saving_total"] == "150000.00"
    assert cuerpo["transactions"] is None


@sin_entorno
def test_el_detalle_del_mes_trae_lo_ya_cargado_por_categoria(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """Bug real (Gustavo): la hoja de carga histórica tiene que poder
    precargar lo que ya existe de un mes, o un segundo guardado sin
    repetir las líneas de antes las pisa en silencio. Hace falta que
    `GET /api/months/{id}` devuelva el desglose por categoría."""
    a, _ = cuentas
    sueldo = _categoria_id(a.uid, "Sueldo", "income")
    r = cliente.post(
        "/api/months/historical",
        json={
            "year": 2025,
            "month": 9,
            "income_total": "500000.00",
            "expense_total": "0",
            "saving_total": "500000.00",
            "categories": [{"category_id": sueldo, "total_amount": "500000.00"}],
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text
    month_id = r.json()["id"]
    assert r.json()["categories"] == [{"category_id": sueldo, "total_amount": "500000.00"}]

    r = cliente.get(f"/api/months/{month_id}", headers=a.cabeceras)
    assert r.status_code == 200, r.text
    assert r.json()["categories"] == [{"category_id": sueldo, "total_amount": "500000.00"}]


@sin_entorno
def test_rechaza_totales_negativos(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses) -> None:
    a, _ = cuentas
    r = cliente.post(
        "/api/months/historical",
        json={"year": 2025, "month": 6, "income_total": "-1", "expense_total": "0", "saving_total": "0"},
        headers=a.cabeceras,
    )
    assert r.status_code == 422, r.text


@sin_entorno
def test_acepta_un_ahorro_negativo(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses) -> None:
    """Bug real (Gustavo, cargando un mes donde gastó más de lo que
    ganó): un ahorro negativo es un resultado válido, no un error —
    sólo ingresos y egresos tienen que ser no negativos."""
    a, _ = cuentas
    r = cliente.post(
        "/api/months/historical",
        json={
            "year": 2025,
            "month": 6,
            "income_total": "100000.00",
            "expense_total": "150000.00",
            "saving_total": "-50000.00",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text
    assert r.json()["saving_total"] == "-50000.00"


@sin_entorno
def test_rechaza_un_mes_futuro(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses) -> None:
    a, _ = cuentas
    futuro = dt.datetime.now(tz=dt.UTC).year + 5
    r = cliente.post(
        "/api/months/historical",
        json={
            "year": futuro,
            "month": 1,
            "income_total": "0",
            "expense_total": "0",
            "saving_total": "0",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 400, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


@sin_entorno
def test_los_totales_por_categoria_quedan_marcados_como_manuales(
    cliente, motor, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """Criterio de aceptación de la tarea."""
    a, _ = cuentas
    alquiler = _categoria_id(a.uid, "Alquiler", "expense")

    r = cliente.post(
        "/api/months/historical",
        json={
            "year": 2025,
            "month": 6,
            "income_total": "500000.00",
            "expense_total": "350000.00",
            "saving_total": "150000.00",
            "categories": [{"category_id": alquiler, "total_amount": "350000.00"}],
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text
    month_id = r.json()["id"]

    with escritura(motor) as con:
        fila = con.execute(
            text(
                f'select is_manual_summary from "{ESQUEMA}".monthly_category_totals '
                "where month_id = :mid and category_id = :cid"
            ),
            {"mid": month_id, "cid": alquiler},
        ).one()
    assert fila[0] is True


@sin_entorno
def test_una_categoria_que_no_existe_se_rechaza(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    r = cliente.post(
        "/api/months/historical",
        json={
            "year": 2025,
            "month": 6,
            "income_total": "100.00",
            "expense_total": "100.00",
            "saving_total": "0.00",
            "categories": [{"category_id": 999999999, "total_amount": "100.00"}],
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 400, r.text
    assert r.json()["error"]["code"] == "VALIDATION_ERROR"


@sin_entorno
def test_una_categoria_de_otra_cuenta_se_rechaza(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """Aislamiento entre cuentas: RLS saca la categoría ajena de la
    consulta, así que para el router no existe."""
    a, b = cuentas
    categoria_de_b = _categoria_id(b.uid, "Alquiler", "expense")

    r = cliente.post(
        "/api/months/historical",
        json={
            "year": 2025,
            "month": 6,
            "income_total": "100.00",
            "expense_total": "100.00",
            "saving_total": "0.00",
            "categories": [{"category_id": categoria_de_b, "total_amount": "100.00"}],
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 400, r.text


@sin_entorno
def test_un_mes_abierto_con_movimientos_exige_confirmacion(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """Criterio de aceptación de F08-T01, probado de punta a punta:
    un mes `open` con movimientos no se puede convertir en consolidado
    sin aviso explícito."""
    a, _ = cuentas
    _crear_mes_abierto_con_movimiento(a.uid, year=2026, month=3)

    r = cliente.post(
        "/api/months/historical",
        json={
            "year": 2026,
            "month": 3,
            "income_total": "100000.00",
            "expense_total": "0",
            "saving_total": "100000.00",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 409, r.text
    assert r.json()["error"]["code"] == "CONFLICT"


@sin_entorno
def test_confirmar_convierte_el_mes_y_no_borra_los_movimientos(
    cliente, motor, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """`CLAUDE.md`: los datos reales no se borran. Convertir un mes a
    histórico no elimina sus `transactions` —sólo deja de leerlas—."""
    a, _ = cuentas
    month_id = _crear_mes_abierto_con_movimiento(a.uid, year=2026, month=3)

    r = cliente.post(
        "/api/months/historical",
        json={
            "year": 2026,
            "month": 3,
            "income_total": "200000.00",
            "expense_total": "50000.00",
            "saving_total": "150000.00",
            "confirm": True,
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert cuerpo["status"] == "historical"
    assert cuerpo["income_total"] == "200000.00"
    assert cuerpo["transactions"] is None

    with escritura(motor) as con:
        cantidad = con.execute(
            text(f'select count(*) from "{ESQUEMA}".transactions where month_id = :mid'),
            {"mid": month_id},
        ).scalar_one()
    assert cantidad == 1, "el movimiento no se tiene que borrar"


# ===================================================================
#  PATCH /api/months/{id}
# ===================================================================


@sin_entorno
def test_patch_sin_token_devuelve_401(cliente) -> None:
    r = cliente.patch(
        "/api/months/1",
        json={"income_total": "0", "expense_total": "0", "saving_total": "0"},
    )
    assert r.status_code == 401


@sin_entorno
def test_patch_de_un_mes_que_no_existe_da_404(cliente, cuentas: tuple[Cuenta, Cuenta]) -> None:
    a, _ = cuentas
    r = cliente.patch(
        "/api/months/999999999",
        json={"income_total": "0", "expense_total": "0", "saving_total": "0"},
        headers=a.cabeceras,
    )
    assert r.status_code == 404


@sin_entorno
def test_patch_de_un_mes_de_otra_cuenta_da_404(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, b = cuentas
    r = cliente.post(
        "/api/months/historical",
        json={"year": 2025, "month": 6, "income_total": "0", "expense_total": "0", "saving_total": "0"},
        headers=a.cabeceras,
    )
    month_id = r.json()["id"]

    r = cliente.patch(
        f"/api/months/{month_id}",
        json={"income_total": "1.00", "expense_total": "0", "saving_total": "1.00"},
        headers=b.cabeceras,
    )
    assert r.status_code == 404


@sin_entorno
def test_patch_de_un_mes_abierto_se_rechaza(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    a, _ = cuentas
    month_id = _crear_mes_abierto_con_movimiento(a.uid, year=2026, month=4)

    r = cliente.patch(
        f"/api/months/{month_id}",
        json={"income_total": "1.00", "expense_total": "0", "saving_total": "1.00"},
        headers=a.cabeceras,
    )
    assert r.status_code == 400, r.text


@sin_entorno
def test_corregir_un_mes_del_medio_propaga_el_acumulado_hacia_adelante(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_meses
) -> None:
    """Los tres criterios de aceptación de la tarea, juntos de punta a
    punta: se cargan tres meses históricos encadenados desde el saldo
    inicial del perfil, se corrige el del medio, y el acumulado de ese
    mes Y el del posterior cambian — el anterior no."""
    a, _ = cuentas
    _fijar_saldo_inicial(cliente, a, "1000000.00")

    ids = {}
    for mes, ahorro in [(1, "100000.00"), (2, "50000.00"), (3, "80000.00")]:
        r = cliente.post(
            "/api/months/historical",
            json={
                "year": 2024,
                "month": mes,
                "income_total": ahorro,
                "expense_total": "0",
                "saving_total": ahorro,
            },
            headers=a.cabeceras,
        )
        assert r.status_code == 201, r.text
        ids[mes] = r.json()["id"]

    r = cliente.get("/api/months", headers=a.cabeceras)
    por_mes = {m["month"]: m for m in r.json() if m["year"] == 2024}
    assert por_mes[1]["closing_balance"] == "1100000.00"
    assert por_mes[2]["closing_balance"] == "1150000.00"
    assert por_mes[3]["closing_balance"] == "1230000.00"

    # Se corrige febrero: el ahorro real era menor.
    r = cliente.patch(
        f"/api/months/{ids[2]}",
        json={"income_total": "20000.00", "expense_total": "0", "saving_total": "20000.00"},
        headers=a.cabeceras,
    )
    assert r.status_code == 200, r.text

    r = cliente.get("/api/months", headers=a.cabeceras)
    por_mes = {m["month"]: m for m in r.json() if m["year"] == 2024}
    assert por_mes[1]["closing_balance"] == "1100000.00"  # anterior: no cambia
    assert por_mes[2]["closing_balance"] == "1120000.00"  # el propio mes corregido
    assert por_mes[3]["closing_balance"] == "1200000.00"  # el posterior: también cambia

    _fijar_saldo_inicial(cliente, a, "0.00")
