"""Aislamiento entre cuentas, barrido completo · F11-T04.

`test_aislamiento_entre_cuentas.py` es de F02-T14 y barre lo que existía
entonces: los tres endpoints de `/api/me`. Desde ahí se construyeron
meses, categorías, movimientos, inversiones, preferencias y respaldo, y
cada tarea probó lo suyo. Esto es el barrido del cierre del MVP: **los
27 endpoints privados, todos juntos, en un solo lugar**, que es lo que
pide la tarea.

QUÉ SE VERIFICA, Y POR QUÉ ASÍ

Dos cuentas reales, A con datos y B vacía, y con el token de B se
intenta tocar todo lo de A. Tres formas, porque son tres agujeros
distintos:

1. **Pasando el id ajeno en la dirección** (`PATCH /api/categories/{id}`
   y los otros ocho que llevan id). La respuesta tiene que ser **404**,
   no 403: un 403 confirmaría que el recurso existe, y que exista ya es
   un dato de la otra cuenta. Los routers lo dicen explícitamente
   («404 también para la categoría de otro usuario: no se revela…»);
   acá se comprueba que de verdad pase.
2. **Pidiendo la colección** (`GET /api/transactions`, el dashboard, el
   patrimonio, el respaldo). Nada de A puede aparecer.
3. **Colando el id ajeno en el cuerpo**, que es el caso que no se ve
   mirando la dirección: crear un movimiento de B apuntando a una
   categoría de A.

Y después de todos esos intentos —incluidos los `DELETE`— se vuelve a
mirar la cuenta A entera: tiene que estar igual. Un aislamiento que
devuelve 404 pero borra la fila sería peor que ninguno.

**No se repite el barrido de «sin token da 401»**: eso ya lo hace
`test_api_protegida.py`, y lo hace mejor que una lista escrita a mano
—lee las rutas registradas, así que una ruta nueva entra sola.

POR QUÉ CONTRA LA BASE REAL

Porque lo que sostiene el aislamiento no es sólo el `where user_id`:
es RLS, y RLS no existe en un doble. Mismo criterio que los otros
módulos de `tests/api/`. Las dos cuentas son de prueba, se crean acá y
se borran al terminar.
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

# Misma zona de presentación que el resto de las pruebas de API: la
# fecha de un movimiento es la del día de Gustavo, no la de UTC.
ZONA_APP = ZoneInfo("America/Argentina/Buenos_Aires")


def _hoy() -> dt.date:
    return dt.datetime.now(ZONA_APP).date()


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
    correo = f"epicwallet.f11t04.{secrets.token_hex(6)}@example.com"
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
    """Dos cuentas para todo el módulo: el límite de registro de
    Supabase corta si se crean muchas seguidas."""
    a = _crear_cuenta()
    b = _crear_cuenta()
    yield a, b
    with escritura(motor) as con:
        con.execute(text("delete from auth.users where id = any(:ids)"), {"ids": [a.uid, b.uid]})


# ===================================================================
#  Los datos de A, una vez para todo el módulo
# ===================================================================

# Valores con los que se reconoce un dato de A si se filtra a B. No son
# decorativos: cada prueba de colección busca exactamente estos.
NOMBRE_CATEGORIA = "Zona exclusiva de A"
DESCRIPCION_MOVIMIENTO = "Movimiento que sólo A puede ver"
SIMBOLO_INVERSION = "SOLOA"
ANIO_HISTORICO = 2024
MES_HISTORICO = 3


class DatosDeA:
    def __init__(self, **ids: int) -> None:
        self.categoria = ids["categoria"]
        self.categoria_semilla = ids["categoria_semilla"]
        self.movimiento = ids["movimiento"]
        self.mes = ids["mes"]
        self.inversion = ids["inversion"]


@pytest.fixture(scope="module")
def datos(cliente, cuentas: tuple[Cuenta, Cuenta]) -> DatosDeA:
    """Una de cada cosa en A, y B arrancada pero vacía.

    B también se siembra (`bootstrap`): si estuviera sin categorías, un
    `GET /api/categories` suyo devolvería `[]` y la prueba pasaría sin
    haber comprobado nada — hace falta que B tenga las suyas para que
    «no aparece la de A» signifique algo.
    """
    a, b = cuentas
    for quien in (a, b):
        cliente.post("/api/me/bootstrap", headers=quien.cabeceras)

    r = cliente.post(
        "/api/categories",
        json={"name": NOMBRE_CATEGORIA, "type": "expense"},
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text
    categoria = int(r.json()["id"])

    semillas = cliente.get("/api/categories", headers=a.cabeceras).json()
    ingreso = next(c for c in semillas if c["type"] == "income")

    r = cliente.post(
        "/api/transactions",
        json={
            "category_id": categoria,
            "transaction_date": _hoy().isoformat(),
            "transaction_type": "expense",
            "amount": "12345.67",
            "description": DESCRIPCION_MOVIMIENTO,
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text
    movimiento = int(r.json()["transaction"]["id"])

    r = cliente.post(
        "/api/months/historical",
        json={
            "year": ANIO_HISTORICO,
            "month": MES_HISTORICO,
            "income_total": "900000.00",
            "expense_total": "400000.00",
            "saving_total": "500000.00",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text
    mes = int(r.json()["id"])

    r = cliente.post(
        "/api/investments",
        json={
            "symbol": SIMBOLO_INVERSION,
            "name": "Posición de A",
            "investment_type": "accion",
            "initial_value": "250000.00",
        },
        headers=a.cabeceras,
    )
    assert r.status_code == 201, r.text
    # `POST /api/investments` devuelve la posición en la raíz, no
    # envuelta como la hace `POST /api/transactions`.
    inversion = int(r.json()["id"])

    assert cliente.put("/api/settings", json={"theme": "dark"}, headers=a.cabeceras).status_code == 200

    return DatosDeA(
        categoria=categoria,
        categoria_semilla=int(ingreso["id"]),
        movimiento=movimiento,
        mes=mes,
        inversion=inversion,
    )


# ===================================================================
#  1 · El id ajeno en la dirección: 404, y ni un 403
# ===================================================================


def _endpoints_con_id(d: DatosDeA) -> list[tuple[str, str, str, dict[str, Any] | None]]:
    """Los nueve endpoints privados que llevan un id en la dirección.

    La lista está escrita a mano, al revés del barrido de
    `test_api_protegida.py`, y es a propósito: acá hace falta un id que
    exista y sea de A, y eso no se puede deducir del esquema. Por eso
    `test_la_lista_cubre_todos_los_endpoints_con_id` compara esta lista
    contra el OpenAPI y falla si alguien agrega uno.
    """
    return [
        ("get", f"/api/categories/{d.categoria}/detail", "/api/categories/{category_id}/detail", None),
        ("patch", f"/api/categories/{d.categoria}", "/api/categories/{category_id}", {"name": "De B"}),
        ("delete", f"/api/categories/{d.categoria}", "/api/categories/{category_id}", None),
        ("get", f"/api/months/{d.mes}", "/api/months/{month_id}", None),
        # Los tres totales van completos a propósito: el esquema los
        # exige y Pydantic valida ANTES de que el handler mire de quién
        # es el mes. Con un cuerpo incompleto la respuesta sería 422 —y
        # eso no delata nada, porque un id inexistente da el mismo 422—,
        # pero tampoco probaría el aislamiento, que es lo que se busca.
        (
            "patch",
            f"/api/months/{d.mes}",
            "/api/months/{month_id}",
            {"income_total": "1.00", "expense_total": "1.00", "saving_total": "0.00"},
        ),
        (
            "put",
            f"/api/transactions/{d.movimiento}",
            "/api/transactions/{transaction_id}",
            {
                "category_id": d.categoria_semilla,
                "transaction_date": _hoy().isoformat(),
                "transaction_type": "expense",
                "amount": "1.00",
            },
        ),
        ("delete", f"/api/transactions/{d.movimiento}", "/api/transactions/{transaction_id}", None),
        (
            "put",
            f"/api/investments/{d.inversion}",
            "/api/investments/{investment_id}",
            {"current_value": "1.00"},
        ),
        ("delete", f"/api/investments/{d.inversion}", "/api/investments/{investment_id}", None),
    ]


@sin_entorno
def test_la_lista_cubre_todos_los_endpoints_con_id(cliente, cuentas, datos: DatosDeA) -> None:
    """La lista de arriba no puede quedarse vieja en silencio.

    Si mañana aparece un `DELETE /api/months/{month_id}` y nadie lo
    agrega a `_endpoints_con_id`, el barrido pasaría en verde sin haber
    probado el endpoint nuevo — que es exactamente el agujero que esta
    tarea viene a cerrar.
    """
    spec = cliente.get("/api/openapi.json").json()
    del_esquema = {
        (metodo, ruta)
        for ruta, metodos in spec["paths"].items()
        if "{" in ruta
        for metodo in metodos
        if metodo in {"get", "post", "put", "patch", "delete"}
    }
    de_la_lista = {(m, plantilla) for m, _, plantilla, _ in _endpoints_con_id(datos)}

    assert del_esquema == de_la_lista, (
        "la lista de endpoints con id quedó desalineada con la API.\n"
        f"faltan en la lista: {sorted(del_esquema - de_la_lista)}\n"
        f"sobran en la lista: {sorted(de_la_lista - del_esquema)}"
    )


@sin_entorno
def test_con_el_token_de_b_ningun_recurso_de_a_es_alcanzable(
    cliente, cuentas: tuple[Cuenta, Cuenta], datos: DatosDeA
) -> None:
    """Criterio de aceptación: ningún recurso ajeno es accesible en
    ningún endpoint."""
    _, b = cuentas

    # `/detail` pide año y mes obligatorios; los demás no llevan query.
    extra = {"/api/categories/{category_id}/detail": {"year": 2026, "month": 1}}

    fallos = []
    for metodo, direccion, plantilla, cuerpo in _endpoints_con_id(datos):
        pedir = getattr(cliente, metodo)
        kwargs: dict[str, Any] = {"headers": b.cabeceras}
        if cuerpo is not None:
            kwargs["json"] = cuerpo
        if plantilla in extra:
            kwargs["params"] = extra[plantilla]

        r = pedir(direccion, **kwargs)
        if r.status_code != 404:
            fallos.append(f"{metodo.upper()} {plantilla} → {r.status_code} ({r.text[:120]})")

    assert not fallos, "endpoints que no devolvieron 404 con un id ajeno:\n" + "\n".join(fallos)


@sin_entorno
def test_el_404_no_distingue_un_id_ajeno_de_uno_inexistente(
    cliente, cuentas: tuple[Cuenta, Cuenta], datos: DatosDeA
) -> None:
    """Que los dos casos den 404 no alcanza: tienen que dar **el mismo**
    404. Si el mensaje cambiara —«no es tuya» contra «no existe»—, la
    respuesta volvería a contar que el recurso existe, que es justo lo
    que el 404 vino a tapar."""
    _, b = cuentas

    ajeno = cliente.get(f"/api/months/{datos.mes}", headers=b.cabeceras)
    inexistente = cliente.get("/api/months/999999999", headers=b.cabeceras)

    assert ajeno.status_code == inexistente.status_code == 404
    assert ajeno.json() == inexistente.json(), "el cuerpo delata que el mes ajeno existe"


# ===================================================================
#  2 · Las colecciones: nada de A asoma en B
# ===================================================================


@sin_entorno
def test_ninguna_coleccion_de_b_trae_datos_de_a(
    cliente, cuentas: tuple[Cuenta, Cuenta], datos: DatosDeA
) -> None:
    """Las ocho lecturas sin id, incluido el respaldo completo.

    Se busca el texto crudo de la respuesta y no una clave puntual: si
    un dato de A se filtra por un camino que nadie pensó —anidado en el
    dashboard, dentro del export—, aparece igual.
    """
    _, b = cuentas
    agujas = [NOMBRE_CATEGORIA, DESCRIPCION_MOVIMIENTO, SIMBOLO_INVERSION]

    rutas = [
        ("/api/me", None),
        ("/api/categories", None),
        ("/api/transactions", None),
        ("/api/months", None),
        ("/api/months/savings-evolution", None),
        ("/api/investments", None),
        ("/api/patrimony", None),
        ("/api/settings", None),
        ("/api/dashboard", None),
        ("/api/export", None),
    ]

    fallos = []
    for ruta, params in rutas:
        r = cliente.get(ruta, headers=b.cabeceras, params=params)
        assert r.status_code == 200, f"{ruta} → {r.status_code}: {r.text[:200]}"
        crudo = r.text
        for aguja in agujas:
            if aguja in crudo:
                fallos.append(f"{ruta} filtró «{aguja}»")

    assert not fallos, "\n".join(fallos)


@sin_entorno
def test_el_mes_historico_de_a_no_esta_en_la_lista_de_b(
    cliente, cuentas: tuple[Cuenta, Cuenta], datos: DatosDeA
) -> None:
    """El mes no se reconoce por un texto sino por su año y mes, así que
    va aparte del barrido de arriba."""
    _, b = cuentas
    meses = cliente.get("/api/months", headers=b.cabeceras).json()
    assert not [
        m for m in meses if m["year"] == ANIO_HISTORICO and m["month"] == MES_HISTORICO
    ], "B ve el mes histórico que cargó A"


@sin_entorno
def test_la_preferencia_de_tema_no_se_cruza(cliente, cuentas: tuple[Cuenta, Cuenta], datos: DatosDeA) -> None:
    """A guardó `dark`. B no guardó nada: tiene que seguir sin nada, no
    heredar el tema de A."""
    _, b = cuentas
    assert cliente.get("/api/settings", headers=b.cabeceras).json()["theme"] is None


# ===================================================================
#  3 · El id ajeno colado en el cuerpo
# ===================================================================


@sin_entorno
def test_b_no_puede_cargar_un_movimiento_en_una_categoria_de_a(
    cliente, cuentas: tuple[Cuenta, Cuenta], datos: DatosDeA
) -> None:
    """El caso que no se ve mirando la dirección: la dirección es
    `/api/transactions`, que es de B; el id ajeno viaja en el cuerpo."""
    _, b = cuentas
    r = cliente.post(
        "/api/transactions",
        json={
            "category_id": datos.categoria,
            "transaction_date": _hoy().isoformat(),
            "transaction_type": "expense",
            "amount": "1.00",
            "description": "Intento de B",
        },
        headers=b.cabeceras,
    )
    assert r.status_code == 400, r.text

    # Y no quedó cargado en ningún lado.
    de_b = cliente.get("/api/transactions", headers=b.cabeceras).json()
    assert not [t for t in de_b if t.get("description") == "Intento de B"]


# ===================================================================
#  4 · Después de todos los intentos, A sigue entera
# ===================================================================


@sin_entorno
def test_la_cuenta_de_a_quedo_intacta_despues_de_todos_los_intentos(
    cliente, cuentas: tuple[Cuenta, Cuenta], datos: DatosDeA
) -> None:
    """La otra mitad del aislamiento, y la que un 404 no garantiza.

    Un endpoint que devuelve 404 y borra la fila igual sería peor que no
    tener aislamiento, porque además no se notaría. Los `DELETE` de B ya
    corrieron en las pruebas de arriba (van en orden dentro del módulo),
    así que acá se mira si sobrevivieron.
    """
    a, _ = cuentas

    categorias = cliente.get("/api/categories", headers=a.cabeceras).json()
    assert [c for c in categorias if c["name"] == NOMBRE_CATEGORIA], "B borró la categoría de A"

    movimientos = cliente.get("/api/transactions", headers=a.cabeceras).json()
    mio = [t for t in movimientos if t.get("description") == DESCRIPCION_MOVIMIENTO]
    assert mio, "B borró el movimiento de A"
    assert mio[0]["amount"] == "12345.67", "B cambió el importe del movimiento de A"

    mes = cliente.get(f"/api/months/{datos.mes}", headers=a.cabeceras)
    assert mes.status_code == 200
    assert mes.json()["income_total"] == "900000.00", "B corrigió el mes histórico de A"

    inversiones = cliente.get("/api/investments", headers=a.cabeceras).json()
    assert [
        i for i in inversiones["positions"] if i["symbol"] == SIMBOLO_INVERSION
    ], "B vendió la posición de A"

    assert cliente.get("/api/settings", headers=a.cabeceras).json()["theme"] == "dark"
