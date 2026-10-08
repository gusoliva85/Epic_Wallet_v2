"""Los endpoints del perfil · F02-T06.

Se prueban contra la API real, con cuentas reales de Supabase y sus
tokens reales. No hay dobles: lo que se verifica es que el camino
entero funcione —token, verificación, propagación a Postgres, RLS,
consulta— porque cada una de esas piezas se probó sola y lo que falta
es saber que encajan.
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
    correo = f"epicwallet.me.{secrets.token_hex(6)}@example.com"
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
def cuenta(motor) -> Iterator[Cuenta]:
    """UNA cuenta para todo el módulo.

    Antes era una por prueba, y Supabase cortaba por límite de
    registros: catorce pruebas se salteaban en silencio, justo las que
    más importaban. El estado se devuelve a cero entre pruebas con
    `cuenta_intacta`.
    """
    c = _crear_cuenta()
    yield c
    with escritura(motor) as con:
        con.execute(text("delete from auth.users where id = :id"), {"id": c.uid})


@pytest.fixture(autouse=True)
def cuenta_intacta(request: pytest.FixtureRequest, motor) -> None:
    """Deja la cuenta como recién creada antes de cada prueba.

    Se hace por SQL y no llamando a `bootstrap`, que es justamente una
    de las cosas que se prueban: prepararle el terreno con él haría que
    una prueba de bootstrap dependa de bootstrap.
    """
    if "cuenta" not in request.fixturenames:
        return
    c = request.getfixturevalue("cuenta")

    from api.app.core.categorias_iniciales import INICIALES

    with escritura(motor) as con:
        con.execute(text(f'delete from "{ESQUEMA}".profiles where id = :id'), {"id": c.uid})
        con.execute(
            text(f'insert into "{ESQUEMA}".profiles (id, username) values (:id, :u)'),
            {"id": c.uid, "u": c.correo.split("@")[0]},
        )
        for orden, (nombre, tipo) in enumerate(INICIALES, start=1):
            con.execute(
                text(
                    f'insert into "{ESQUEMA}".categories '
                    "(user_id, name, type, sort_order) values (:id, :n, :t, :o)"
                ),
                {"id": c.uid, "n": nombre, "t": tipo, "o": orden},
            )


# --------------------------------------------------------- GET /api/me


@sin_entorno
def test_sin_token_devuelve_401(cliente) -> None:
    """Criterio de aceptación."""
    r = cliente.get("/api/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "UNAUTHENTICATED"


@sin_entorno
def test_con_un_token_inventado_devuelve_401(cliente) -> None:
    r = cliente.get("/api/me", headers={"Authorization": "Bearer no.es.un.token"})
    assert r.status_code == 401


@sin_entorno
def test_con_token_devuelve_tu_perfil(cliente, cuenta: Cuenta) -> None:
    """Criterio de aceptación. El perfil existe porque lo creó el
    trigger al nacer la cuenta: nadie llamó a `bootstrap`."""
    r = cliente.get("/api/me", headers=cuenta.cabeceras)
    assert r.status_code == 200, r.text

    perfil = r.json()
    assert perfil["id"] == cuenta.uid
    assert perfil["username"]
    assert perfil["opening_balance"] == "0.00"
    assert perfil["timezone"] == "America/Argentina/Buenos_Aires"
    assert perfil["active"] is True


@sin_entorno
def test_el_perfil_que_llega_es_el_del_token(cliente, motor, cuenta: Cuenta) -> None:
    """Dos cuentas, dos tokens: cada una ve el suyo.

    Es la prueba de que RLS está haciendo el trabajo: el endpoint
    consulta sin filtrar por usuario.
    """
    otra = _crear_cuenta()
    try:
        a = cliente.get("/api/me", headers=cuenta.cabeceras).json()
        b = cliente.get("/api/me", headers=otra.cabeceras).json()
        assert a["id"] == cuenta.uid
        assert b["id"] == otra.uid
        assert a["id"] != b["id"]
    finally:
        with escritura(motor) as con:
            con.execute(text("delete from auth.users where id = :id"), {"id": otra.uid})


# ------------------------------------------------------- PATCH /api/me


@sin_entorno
def test_el_saldo_inicial_se_guarda_y_se_lee(cliente, cuenta: Cuenta) -> None:
    """Criterio de aceptación.

    Viaja como string: JSON no distingue enteros de flotantes y
    JavaScript convierte todo a `double`, así que un saldo con centavos
    puede volver con uno de diferencia.
    """
    r = cliente.patch("/api/me", json={"opening_balance": "4200000.55"}, headers=cuenta.cabeceras)
    assert r.status_code == 200, r.text
    assert r.json()["opening_balance"] == "4200000.55"

    de_nuevo = cliente.get("/api/me", headers=cuenta.cabeceras)
    assert de_nuevo.json()["opening_balance"] == "4200000.55"


@sin_entorno
def test_el_nombre_visible_se_cambia(cliente, cuenta: Cuenta) -> None:
    r = cliente.patch("/api/me", json={"display_name": "Gustavo"}, headers=cuenta.cabeceras)
    assert r.status_code == 200
    assert r.json()["display_name"] == "Gustavo"


@sin_entorno
def test_cambiar_el_saldo_no_borra_el_nombre(cliente, cuenta: Cuenta) -> None:
    """Lo que un `PATCH` mal hecho rompe sin que se note.

    Si el endpoint tomara todos los campos del modelo en lugar de los
    que llegaron, mandar sólo el saldo pondría el nombre en null.
    """
    cliente.patch("/api/me", json={"display_name": "Gustavo"}, headers=cuenta.cabeceras)
    r = cliente.patch("/api/me", json={"opening_balance": "100.00"}, headers=cuenta.cabeceras)
    assert r.status_code == 200
    assert r.json()["display_name"] == "Gustavo", "el nombre se borró solo"


@sin_entorno
def test_el_nombre_se_puede_borrar_a_proposito(cliente, cuenta: Cuenta) -> None:
    """Mandarlo en null sí lo borra: es la diferencia con no mandarlo."""
    cliente.patch("/api/me", json={"display_name": "Gustavo"}, headers=cuenta.cabeceras)
    r = cliente.patch("/api/me", json={"display_name": None}, headers=cuenta.cabeceras)
    assert r.json()["display_name"] is None


@sin_entorno
@pytest.mark.parametrize(
    "malo",
    [
        pytest.param("no es un número", id="texto"),
        pytest.param("", id="vacío"),
        pytest.param("1e400", id="demasiado grande"),
        pytest.param("99999999999999999", id="no entra en la columna"),
    ],
)
def test_un_saldo_que_no_es_un_importe_devuelve_422(cliente, cuenta: Cuenta, malo: str) -> None:
    """Criterio de aceptación: un texto en el saldo inicial da 422."""
    r = cliente.patch("/api/me", json={"opening_balance": malo}, headers=cuenta.cabeceras)
    assert r.status_code == 422, f"aceptó {malo!r}: {r.text}"


@sin_entorno
def test_no_se_puede_cambiar_lo_que_no_corresponde(cliente, cuenta: Cuenta) -> None:
    """El id, el username y el correo no se tocan desde acá. Con
    `extra='forbid'`, intentarlo es un error y no un campo ignorado en
    silencio."""
    r = cliente.patch(
        "/api/me",
        json={"id": "00000000-0000-4000-8000-000000000000", "username": "otro"},
        headers=cuenta.cabeceras,
    )
    assert r.status_code == 422


@sin_entorno
def test_un_patch_sin_token_devuelve_401(cliente) -> None:
    r = cliente.patch("/api/me", json={"display_name": "x"})
    assert r.status_code == 401


# ----------------------------------------------- POST /api/me/bootstrap


@sin_entorno
def test_bootstrap_dos_veces_no_duplica_nada(cliente, motor, cuenta: Cuenta) -> None:
    """Criterio de aceptación.

    La cuenta ya nació completa por el trigger, así que la primera
    llamada no debería crear nada tampoco.
    """
    primera = cliente.post("/api/me/bootstrap", headers=cuenta.cabeceras)
    assert primera.status_code == 200, primera.text
    assert primera.json()["perfil_creado"] is False
    assert primera.json()["categorias_creadas"] == 0
    assert primera.json()["total_categorias"] == 21

    segunda = cliente.post("/api/me/bootstrap", headers=cuenta.cabeceras)
    assert segunda.json() == primera.json()

    with escritura(motor) as con:
        cuantas = con.execute(
            text(f'select count(*) from "{ESQUEMA}".categories where user_id = :id'),
            {"id": cuenta.uid},
        ).scalar()
    assert cuantas == 21, f"quedaron {cuantas} categorías"


@sin_entorno
def test_bootstrap_rehace_lo_que_falta(cliente, motor, cuenta: Cuenta) -> None:
    """El caso para el que existe: una cuenta a la que le falta algo.

    Se simula borrando el perfil —la cascada se lleva las categorías—,
    que es exactamente el estado de una cuenta creada antes de que el
    trigger existiera.
    """
    with escritura(motor) as con:
        con.execute(text(f'delete from "{ESQUEMA}".profiles where id = :id'), {"id": cuenta.uid})

    # Y sin perfil, leerlo dice qué hacer en lugar de romper.
    sin_perfil = cliente.get("/api/me", headers=cuenta.cabeceras)
    assert sin_perfil.status_code == 404
    assert "bootstrap" in sin_perfil.json()["error"]["message"]

    r = cliente.post("/api/me/bootstrap", headers=cuenta.cabeceras)
    assert r.status_code == 200, r.text
    assert r.json()["perfil_creado"] is True
    assert r.json()["categorias_creadas"] == 21
    assert r.json()["total_categorias"] == 21

    # Y ahora el perfil se lee normalmente.
    assert cliente.get("/api/me", headers=cuenta.cabeceras).status_code == 200


@sin_entorno
def test_bootstrap_completa_las_categorias_que_falten(cliente, motor, cuenta: Cuenta) -> None:
    """Si faltan algunas, agrega sólo esas y no duplica las que están."""
    with escritura(motor) as con:
        con.execute(
            text(f"delete from \"{ESQUEMA}\".categories where user_id = :id and type = 'income'"),
            {"id": cuenta.uid},
        )

    r = cliente.post("/api/me/bootstrap", headers=cuenta.cabeceras)
    assert r.json()["perfil_creado"] is False
    assert r.json()["categorias_creadas"] == 3
    assert r.json()["total_categorias"] == 21


@sin_entorno
def test_bootstrap_sin_token_devuelve_401(cliente) -> None:
    assert cliente.post("/api/me/bootstrap").status_code == 401


@sin_entorno
def test_bootstrap_no_toca_otras_cuentas(cliente, motor, cuenta: Cuenta) -> None:
    """Corre con RLS puesto, así que no puede ni ver lo ajeno."""
    otra = _crear_cuenta()
    try:
        cliente.post("/api/me/bootstrap", headers=cuenta.cabeceras)
        with escritura(motor) as con:
            cuantas = con.execute(
                text(f'select count(*) from "{ESQUEMA}".categories where user_id = :id'),
                {"id": otra.uid},
            ).scalar()
        assert cuantas == 21, "le tocó las categorías a la otra cuenta"
    finally:
        with escritura(motor) as con:
            con.execute(text("delete from auth.users where id = :id"), {"id": otra.uid})
