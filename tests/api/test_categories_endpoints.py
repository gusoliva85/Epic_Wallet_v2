"""`GET`, `POST`, `PATCH` y `DELETE /api/categories` · F03-T08.

Se prueba contra la API real, con cuentas reales de Supabase —mismo
criterio que `test_me.py` y `test_months_endpoints.py`—.

Los tres criterios de aceptación de la tarea, cada uno con su prueba:
dos categorías con el mismo nombre y tipo se rechazan, una categoría
con movimientos no se puede borrar y el mensaje lo explica, y (la
coincidencia de tipo, que es de cálculo puro) se prueba aparte en
`tests/unit/test_categories_calc.py`.
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
from api.app.core.categorias_iniciales import INICIALES
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
    correo = f"epicwallet.categories.{secrets.token_hex(6)}@example.com"
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
def limpiar_categorias_extra(motor, cuentas):
    """Antes y después de cada prueba, sin categorías más allá de las
    21 iniciales: las que agregó la prueba anterior no contaminan la
    siguiente."""
    a, b = cuentas
    nombres_iniciales = {n for n, _ in INICIALES}

    def _limpiar() -> None:
        with escritura(motor) as con:
            con.execute(
                text(
                    f'delete from "{ESQUEMA}".categories where user_id = any(:ids) '
                    "and name != all(:nombres)"
                ),
                {"ids": [a.uid, b.uid], "nombres": list(nombres_iniciales)},
            )

    _limpiar()
    yield
    _limpiar()


# ===================================================================
#  GET /api/categories — la siembra del trigger
# ===================================================================


@sin_entorno
def test_sin_token_devuelve_401(cliente) -> None:
    assert cliente.get("/api/categories").status_code == 401


@sin_entorno
def test_la_cuenta_nueva_trae_las_21_categorias_en_orden(
    cliente, cuentas: tuple[Cuenta, Cuenta]
) -> None:
    """Verifica que la siembra del trigger de F02-T04 dejó las 21
    categorías en orden — el criterio de la tarea que no es una
    validación nueva sino una comprobación de lo que ya existe.

    Se compara contra `INICIALES`, la lista del código —la misma que
    usa `bootstrap`—, no contra el texto del documento general: eso
    sería un test de documentación, y los tests de documentación se
    sacaron en la revisión v2.0 (CLAUDE.md)."""
    a, _ = cuentas
    r = cliente.get("/api/categories", headers=a.cabeceras)
    assert r.status_code == 200

    categorias = r.json()
    assert len(categorias) == 21

    obtenido = [(c["name"], c["type"]) for c in categorias]
    assert obtenido == list(INICIALES)

    ordenes = [c["sort_order"] for c in categorias]
    assert ordenes == sorted(ordenes), "no vinieron en el orden de sort_order"
    assert all(c["active"] for c in categorias)


@sin_entorno
def test_filtra_por_type(cliente, cuentas: tuple[Cuenta, Cuenta]) -> None:
    a, _ = cuentas
    r = cliente.get("/api/categories", params={"type": "income"}, headers=a.cabeceras)
    categorias = r.json()
    assert len(categorias) == 3
    assert all(c["type"] == "income" for c in categorias)


@sin_entorno
def test_un_tipo_invalido_en_el_filtro_no_rompe_devuelve_vacio(
    cliente, cuentas: tuple[Cuenta, Cuenta]
) -> None:
    # El filtro compara contra el valor tal cual: un tipo que no existe
    # no es un 422, es una lista vacía. Validar la entrada acá sería
    # más estricto de lo que la tarea pide para un query param de
    # lectura.
    a, _ = cuentas
    r = cliente.get("/api/categories", params={"type": "no-existe"}, headers=a.cabeceras)
    assert r.status_code == 200
    assert r.json() == []


# ===================================================================
#  POST /api/categories
# ===================================================================


@sin_entorno
def test_crear_categoria_la_agrega_al_final_de_su_tipo(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_categorias_extra
) -> None:
    a, _ = cuentas
    r = cliente.post(
        "/api/categories", json={"name": "Gimnasio", "type": "expense"}, headers=a.cabeceras
    )
    assert r.status_code == 201
    creada = r.json()
    assert creada["name"] == "Gimnasio"
    assert creada["active"] is True

    # Las 18 de egreso que trae la siembra van de sort_order 4 a 21;
    # la nueva tiene que quedar después de todas.
    egresos = cliente.get(
        "/api/categories", params={"type": "expense"}, headers=a.cabeceras
    ).json()
    assert egresos[-1]["name"] == "Gimnasio"


@sin_entorno
def test_dos_categorias_con_el_mismo_nombre_y_tipo_se_rechazan(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_categorias_extra
) -> None:
    """Criterio de aceptación de la tarea."""
    a, _ = cuentas
    cliente.post("/api/categories", json={"name": "Suscripciones", "type": "expense"}, headers=a.cabeceras)
    r = cliente.post(
        "/api/categories", json={"name": "Suscripciones", "type": "expense"}, headers=a.cabeceras
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "CONFLICT"


@sin_entorno
def test_el_mismo_nombre_en_el_otro_tipo_no_choca(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_categorias_extra
) -> None:
    # "Otros" ya existe como ingreso Y como egreso desde la siembra:
    # si esto fallara, la cuenta nueva no podría ni crearse.
    a, _ = cuentas
    r = cliente.post("/api/categories", json={"name": "Varios", "type": "income"}, headers=a.cabeceras)
    assert r.status_code == 201
    r = cliente.post("/api/categories", json={"name": "Varios", "type": "expense"}, headers=a.cabeceras)
    assert r.status_code == 201


@sin_entorno
@pytest.mark.parametrize(
    "cuerpo",
    [
        {"name": "", "type": "expense"},
        {"name": "x" * 61, "type": "expense"},
        {"name": "Algo", "type": "ingreso"},
        {"name": "Algo", "type": "expense", "sort_order": 5},
        {"name": "Algo", "type": "expense", "active": True},
    ],
)
def test_entradas_invalidas_dan_422(cliente, cuentas: tuple[Cuenta, Cuenta], cuerpo: dict) -> None:
    a, _ = cuentas
    r = cliente.post("/api/categories", json=cuerpo, headers=a.cabeceras)
    assert r.status_code == 422


# ===================================================================
#  PATCH /api/categories/{id}
# ===================================================================


@sin_entorno
def test_patch_renombra(cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_categorias_extra) -> None:
    a, _ = cuentas
    creada = cliente.post(
        "/api/categories", json={"name": "Antes", "type": "expense"}, headers=a.cabeceras
    ).json()

    r = cliente.patch(f"/api/categories/{creada['id']}", json={"name": "Después"}, headers=a.cabeceras)
    assert r.status_code == 200
    assert r.json()["name"] == "Después"


@sin_entorno
def test_patch_desactiva_sin_tocar_el_nombre(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_categorias_extra
) -> None:
    a, _ = cuentas
    creada = cliente.post(
        "/api/categories", json={"name": "Para desactivar", "type": "expense"}, headers=a.cabeceras
    ).json()

    r = cliente.patch(f"/api/categories/{creada['id']}", json={"active": False}, headers=a.cabeceras)
    assert r.status_code == 200
    assert r.json()["active"] is False
    assert r.json()["name"] == "Para desactivar"


@sin_entorno
def test_patch_no_acepta_cambiar_el_tipo(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_categorias_extra
) -> None:
    a, _ = cuentas
    creada = cliente.post(
        "/api/categories", json={"name": "Fija", "type": "expense"}, headers=a.cabeceras
    ).json()

    r = cliente.patch(f"/api/categories/{creada['id']}", json={"type": "income"}, headers=a.cabeceras)
    assert r.status_code == 422, "type no es un campo de CambioDeCategoria"


@sin_entorno
def test_patch_a_una_categoria_de_otra_cuenta_da_404(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_categorias_extra
) -> None:
    a, b = cuentas
    creada = cliente.post(
        "/api/categories", json={"name": "De A", "type": "expense"}, headers=a.cabeceras
    ).json()

    r = cliente.patch(f"/api/categories/{creada['id']}", json={"name": "Robada"}, headers=b.cabeceras)
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


# ===================================================================
#  DELETE /api/categories/{id}
# ===================================================================


@sin_entorno
def test_borrar_una_categoria_sin_movimientos_la_elimina(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_categorias_extra
) -> None:
    a, _ = cuentas
    creada = cliente.post(
        "/api/categories", json={"name": "Efímera", "type": "expense"}, headers=a.cabeceras
    ).json()

    r = cliente.delete(f"/api/categories/{creada['id']}", headers=a.cabeceras)
    assert r.status_code == 204

    r = cliente.patch(f"/api/categories/{creada['id']}", json={"name": "x"}, headers=a.cabeceras)
    assert r.status_code == 404, "siguió existiendo después del borrado"


@sin_entorno
def test_borrar_la_categoria_de_otra_cuenta_da_404(
    cliente, cuentas: tuple[Cuenta, Cuenta], limpiar_categorias_extra
) -> None:
    a, b = cuentas
    creada = cliente.post(
        "/api/categories", json={"name": "De A otra vez", "type": "expense"}, headers=a.cabeceras
    ).json()

    r = cliente.delete(f"/api/categories/{creada['id']}", headers=b.cabeceras)
    assert r.status_code == 404


@sin_entorno
def test_borrar_una_categoria_con_movimientos_queda_bloqueada(
    cliente, motor, cuentas: tuple[Cuenta, Cuenta], limpiar_categorias_extra
) -> None:
    """Criterio de aceptación central de la tarea: una categoría con
    movimientos no se puede borrar y el mensaje lo explica.

    `transactions` todavía no existe (F04): se simula el `on delete
    restrict` que esa tabla va a tener (Técnico §6.2) con una tabla
    descartable, creada y borrada acá mismo, que referencia
    `categories(id)` de la misma manera. Es la única forma de probar
    de verdad el camino de `ForeignKeyViolation` → 409 sin esperar a
    F04 para saber si funciona.
    """
    a, _ = cuentas
    creada = cliente.post(
        "/api/categories", json={"name": "Con movimientos", "type": "expense"}, headers=a.cabeceras
    ).json()

    tabla = f"zzz_prueba_fk_categoria_{secrets.token_hex(4)}"
    with escritura(motor) as con:
        con.execute(
            text(
                f'create table "{ESQUEMA}"."{tabla}" ('
                "id bigint generated always as identity primary key, "
                f'category_id bigint references "{ESQUEMA}".categories(id) on delete restrict'
                ")"
            )
        )
        con.execute(
            text(f'insert into "{ESQUEMA}"."{tabla}" (category_id) values (:id)'),
            {"id": creada["id"]},
        )

    try:
        r = cliente.delete(f"/api/categories/{creada['id']}", headers=a.cabeceras)
        assert r.status_code == 409
        assert r.json()["error"]["code"] == "CONFLICT"
        assert "movimientos" in r.json()["error"]["message"].lower()

        # Y sigue ahí, intacta.
        intacta = cliente.get(
            "/api/categories", params={"type": "expense"}, headers=a.cabeceras
        ).json()
        assert any(c["id"] == creada["id"] for c in intacta)
    finally:
        with escritura(motor) as con:
            con.execute(text(f'drop table if exists "{ESQUEMA}"."{tabla}"'))
