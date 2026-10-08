"""Aislamiento entre cuentas · F02-T14.

Dos cuentas reales, cada una con sus propios datos, y con el token de
una se intenta leer y escribir lo de la otra en **todos los endpoints
que existen hoy**: `GET /api/me`, `PATCH /api/me` y
`POST /api/me/bootstrap`. Los que vengan después (meses, movimientos,
inversiones) no existen todavía — cuando se construyan, cada uno repite
este mismo tratamiento, y F11-T04 vuelve a barrerlos a todos juntos
antes del cierre del MVP.

Por qué no hay un endpoint al que pasarle "el id de la otra cuenta":
ninguno de los tres acepta un identificador en la entrada. `GET` y
`PATCH /api/me` resuelven siempre "la cuenta del token"; no hay un
`GET /api/me/{id}`. Eso no es una laguna, es la razón de que la prueba
más directa de "identificador a mano" sea justamente **intentar
colarlo**: mandarlo en el cuerpo de un `PATCH` y comprobar que ni
siquiera se procesa.

Se prueba contra la API real, con cuentas reales de Supabase — mismo
criterio que `test_me.py`: no hay dobles, lo que se verifica es que el
camino entero (token, RLS, consulta) sostenga el aislamiento aunque un
endpoint no filtrara explícitamente por `user_id` (como de hecho no lo
hace ninguno de los tres: la fila correcta sale sólo porque RLS la
filtra).
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


@pytest.fixture(scope="module")
def motor():
    return motor_de_pruebas(str(URL_BASE))


@pytest.fixture(scope="module")
def cliente():
    from api.app.main import app
    from fastapi.testclient import TestClient

    return TestClient(app, raise_server_exceptions=False)


class Cuenta:
    """Una cuenta de prueba con su token."""

    def __init__(self, uid: str, correo: str, token: str) -> None:
        self.uid = uid
        self.correo = correo
        self.token = token

    @property
    def cabeceras(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.token}"}


def _crear_cuenta() -> Cuenta:
    correo = f"epicwallet.aislamiento.{secrets.token_hex(6)}@example.com"
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
def cuentas(motor) -> Iterator[tuple[Cuenta, Cuenta]]:
    """Dos cuentas reales para todo el módulo — no una por prueba: el
    límite de registro de Supabase corta si se crean demasiadas
    seguidas (ya pasó una vez, ver `test_me.py`)."""
    a = _crear_cuenta()
    b = _crear_cuenta()
    yield a, b
    with escritura(motor) as con:
        con.execute(text("delete from auth.users where id = any(:ids)"), {"ids": [a.uid, b.uid]})


# ===================================================================
#  Cada cuenta ve y guarda sólo lo suyo
# ===================================================================


@sin_entorno
def test_get_me_devuelve_la_cuenta_del_token_y_no_la_otra(cliente, cuentas: tuple[Cuenta, Cuenta]) -> None:
    a, b = cuentas
    ra = cliente.get("/api/me", headers=a.cabeceras).json()
    rb = cliente.get("/api/me", headers=b.cabeceras).json()

    assert ra["id"] == a.uid
    assert rb["id"] == b.uid
    assert ra["id"] != rb["id"]


@sin_entorno
def test_patch_de_una_cuenta_no_cambia_el_perfil_de_la_otra(
    cliente, cuentas: tuple[Cuenta, Cuenta]
) -> None:
    """El criterio central de la tarea: con el token de B se escribe,
    y lo de A tiene que quedar exactamente como estaba.

    `cambiar_perfil` no filtra por `user_id` en su consulta — depende
    enteramente de RLS para resolver "la fila de quién". Es justo el
    caso que esta prueba tiene que cubrir: si RLS fallara o se
    desactivara por error, ésta es la prueba que lo notaría antes que
    nada en el dashboard de alguien.
    """
    a, b = cuentas

    cliente.patch("/api/me", json={"display_name": "Soy A, no me toquen"}, headers=a.cabeceras)
    antes = cliente.get("/api/me", headers=a.cabeceras).json()

    r = cliente.patch("/api/me", json={"display_name": "Escrito por B"}, headers=b.cabeceras)
    assert r.status_code == 200
    assert r.json()["id"] == b.uid

    despues = cliente.get("/api/me", headers=a.cabeceras).json()
    assert despues["display_name"] == antes["display_name"] == "Soy A, no me toquen"
    assert despues["display_name"] != "Escrito por B"


@sin_entorno
def test_no_se_puede_colar_el_id_de_otra_cuenta_en_el_patch(
    cliente, cuentas: tuple[Cuenta, Cuenta]
) -> None:
    """"Intentar... por identificador directo": acá es literal. Se
    manda `id` en el cuerpo apuntando a la cuenta A, con el token de B.

    `CambioDePerfil` tiene `extra="forbid"` (Técnico §9.1): el campo
    `id` ni siquiera es un campo del esquema, así que esto se rechaza
    en la validación de Pydantic, antes de que la consulta llegue a la
    base. Dos barreras, no una: aunque `cambiar_perfil` leyera un `id`
    del cuerpo algún día, seguiría sin tener cómo pedirle a RLS que
    filtre por una fila que no es la del token.
    """
    a, b = cuentas

    r = cliente.patch(
        "/api/me",
        json={"id": a.uid, "display_name": "hackeado"},
        headers=b.cabeceras,
    )
    assert r.status_code == 422, "un campo que no existe en el esquema tiene que rechazarse"

    # Y lo de A, intacto.
    intacto = cliente.get("/api/me", headers=a.cabeceras).json()
    assert intacto["display_name"] != "hackeado"


@sin_entorno
def test_bootstrap_de_una_cuenta_no_le_toca_las_categorias_a_la_otra(
    cliente, motor, cuentas: tuple[Cuenta, Cuenta]
) -> None:
    a, b = cuentas

    cliente.post("/api/me/bootstrap", headers=a.cabeceras)
    cliente.post("/api/me/bootstrap", headers=b.cabeceras)

    with escritura(motor) as con:
        de_a = con.execute(
            text(f'select count(*) from "{ESQUEMA}".categories where user_id = :id'), {"id": a.uid}
        ).scalar()
        de_b = con.execute(
            text(f'select count(*) from "{ESQUEMA}".categories where user_id = :id'), {"id": b.uid}
        ).scalar()

    # 21 cada una, ni una de más ni una prestada de la otra.
    assert de_a == 21, f"la cuenta A quedó con {de_a} categorías"
    assert de_b == 21, f"la cuenta B quedó con {de_b} categorías"


@sin_entorno
@pytest.mark.parametrize(
    ("metodo", "ruta", "cuerpo"),
    [
        ("get", "/api/me", None),
        ("patch", "/api/me", {"display_name": "x"}),
        ("post", "/api/me/bootstrap", None),
    ],
)
def test_todos_los_endpoints_de_hoy_resuelven_por_token_no_por_dato_de_entrada(
    cliente, cuentas: tuple[Cuenta, Cuenta], metodo: str, ruta: str, cuerpo: dict[str, Any] | None
) -> None:
    """Barrido explícito de los tres endpoints que existen hoy: cada
    uno, con el token de B, nunca devuelve ni toca nada con el `id` de
    A adentro. Es el inventario que esta tarea pide "en todos los
    endpoints" — ninguno queda afuera porque ninguno existe afuera de
    esta lista todavía."""
    a, b = cuentas
    metodo_cliente = getattr(cliente, metodo)
    r = metodo_cliente(ruta, json=cuerpo, headers=b.cabeceras) if cuerpo is not None else metodo_cliente(
        ruta, headers=b.cabeceras
    )
    assert r.status_code < 500
    texto = r.text
    assert a.uid not in texto, f"{metodo.upper()} {ruta} devolvió el id de otra cuenta"
