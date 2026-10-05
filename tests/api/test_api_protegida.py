"""Toda la API protegida por defecto · F02-T07.

El olvido más caro de una API es el endpoint al que no le pusieron el
guardia: no se nota al escribirlo, no lo detecta ninguna prueba del
endpoint en sí, y el día que alguien lo encuentra ya expuso datos.

Por eso la dependencia de sesión va en el **enrutador** y no en cada
función, y por eso este barrido recorre **todas** las rutas registradas
en lugar de una lista escrita a mano: una lista se queda vieja en cuanto
alguien agrega algo, que es exactamente el caso que hay que cubrir.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from pathlib import Path

import pytest
from api.app.main import app
from fastapi import APIRouter
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

pytestmark = pytest.mark.api

# La única ruta pública, y el motivo: sirve para saber si el despliegue
# vive, así que pedirle una sesión no tendría sentido.
PUBLICAS = {"/api/health"}

METODOS_IGNORADOS = {"head", "options"}


def rutas_registradas() -> list[tuple[str, list[str]]]:
    """Cada ruta de la aplicación con sus métodos, ya resuelta.

    Se lee del esquema OpenAPI a propósito. Reconstruir las direcciones
    a mano desde `app.routes` parecía más directo y fue el primer
    intento, pero esta versión de FastAPI resuelve los prefijos tarde:
    guarda el del propio enrutador dentro de `route.path` y el del
    `include_router` en otro lado, así que sumarlos daba `/api/me/me` y
    al mismo tiempo perdía el `/api` de `health`. El esquema lo resuelve
    FastAPI con las mismas reglas que usa para enrutar de verdad.

    Lo que el esquema no muestra son las rutas con
    `include_in_schema=False`; de eso se ocupa
    `test_el_barrido_no_se_saltea_ninguna_ruta`.
    """
    rutas = []
    for ruta, operaciones in app.openapi()["paths"].items():
        metodos = sorted(m.upper() for m in operaciones if m.lower() not in METODOS_IGNORADOS)
        if metodos:
            rutas.append((ruta, metodos))
    return sorted(rutas)


def _hojas_de_la_aplicacion() -> Iterator[APIRoute]:
    """Las rutas de verdad, bajando por los enrutadores incluidos.

    No reconstruye la dirección —para eso está el esquema—, sólo mira
    las rutas en sí. Las de la documentación son `Route` de Starlette y
    no `APIRoute`, así que quedan afuera solas.
    """

    def caminar(router: object) -> Iterator[APIRoute]:
        for r in getattr(router, "routes", []):
            interno = getattr(r, "original_router", None)
            if interno is not None:
                yield from caminar(interno)
            elif isinstance(r, APIRoute):
                yield r

    yield from caminar(app.router)


def _enrutador_privado() -> APIRouter:
    """El enrutador que lleva la dependencia de sesión, buscado por esa
    dependencia y no por su nombre."""
    for r in app.router.routes:
        interno = getattr(r, "original_router", None)
        if interno is not None and getattr(interno, "dependencies", None):
            return interno
    raise AssertionError(
        "no hay ningún enrutador con dependencias: la protección a nivel de "
        "enrutador desapareció de main.py"
    )


@pytest.fixture(scope="module")
def cliente() -> Iterator[TestClient]:
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def _con_valores(ruta: str) -> str:
    """Reemplaza los parámetros de la ruta por algo plausible.

    El valor no importa: lo que se comprueba es que sin sesión no se
    llegue ni a mirarlo.
    """
    return re.sub(r"\{[^}]+\}", "1", ruta)


# ------------------------------------------- que el barrido barra


def test_el_barrido_encuentra_las_rutas() -> None:
    """Si la enumeración se rompiera, el barrido quedaría en verde sin
    revisar nada: es el modo de fallo peligroso de una prueba así."""
    rutas = {r for r, _ in rutas_registradas()}
    assert "/api/health" in rutas
    assert "/api/me" in rutas, f"no encontró las rutas privadas: {sorted(rutas)}"
    assert "/api/me/bootstrap" in rutas


def test_el_barrido_no_se_saltea_ninguna_ruta() -> None:
    """El esquema OpenAPI omite lo que lleva `include_in_schema=False`.

    Una ruta así quedaría fuera del barrido *y* nadie se enteraría. Acá
    se miran las rutas reales y se comparan con las del esquema: si
    alguien esconde una, esta prueba falla y hay que decidir qué hacer
    con ella.
    """
    ocultas = [r.path for r in _hojas_de_la_aplicacion() if not r.include_in_schema]
    assert not ocultas, (
        f"estas rutas no están en el esquema y el barrido no las ve: {ocultas}. "
        "Sumalas al barrido a mano o sacales include_in_schema=False."
    )

    operaciones_reales = sum(
        len({m.lower() for m in r.methods} - METODOS_IGNORADOS) for r in _hojas_de_la_aplicacion()
    )
    operaciones_barridas = sum(len(m) for _, m in rutas_registradas())
    assert operaciones_reales == operaciones_barridas, (
        f"la aplicación tiene {operaciones_reales} operaciones y el barrido "
        f"revisa {operaciones_barridas}"
    )


# ----------------------------------------------------- el barrido


@pytest.mark.parametrize(
    ("ruta", "metodos"),
    [
        pytest.param(r, m, id=f"{','.join(m)} {r}")
        for r, m in rutas_registradas()
        if r not in PUBLICAS
    ],
)
def test_toda_ruta_privada_responde_401_sin_token(
    cliente: TestClient, ruta: str, metodos: list[str]
) -> None:
    """Criterio de aceptación: el barrido pasa.

    Lo que el barrido *no* prueba, y se vio sacándole la dependencia al
    enrutador para ver qué fallaba: estas rutas siguieron dando 401
    porque los endpoints de `/me` piden la sesión también por su cuenta.
    El barrido mide el resultado, no de dónde viene. De que la
    protección esté en el enrutador se ocupa
    `test_una_ruta_nueva_queda_protegida_sin_hacer_nada`.
    """
    for metodo in metodos:
        r = cliente.request(metodo, _con_valores(ruta), json={})
        assert r.status_code == 401, (
            f"{metodo} {ruta} respondió {r.status_code} sin token: {r.text[:200]}"
        )
        assert r.json()["error"]["code"] == "UNAUTHENTICATED"


def test_un_token_invalido_tampoco_entra(cliente: TestClient) -> None:
    """El 401 sin cabecera podría venir de que falta la cabecera y nada
    más. Con una cabecera presente pero mentirosa, el 401 sólo puede
    venir de que alguien se tomó el trabajo de verificar la firma."""
    for ruta, metodos in rutas_registradas():
        if ruta in PUBLICAS:
            continue
        for metodo in metodos:
            r = cliente.request(
                metodo,
                _con_valores(ruta),
                json={},
                headers={"Authorization": "Bearer no.es.un.token"},
            )
            assert r.status_code == 401, f"{metodo} {ruta} → {r.status_code}"


# -------------------------------------------------- la excepción


def test_health_es_publica(cliente: TestClient) -> None:
    """Y tiene que seguir siéndolo: es lo que dice si el despliegue vive,
    y pedirle una sesión para eso no tendría sentido."""
    r = cliente.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] in {"ok", "degraded"}


def test_solo_health_es_publica() -> None:
    """Si alguien agrega otra ruta pública, que sea una decisión y no un
    descuido: esta prueba obliga a declararla acá."""
    privadas = {r for r, _ in rutas_registradas() if r not in PUBLICAS}
    assert privadas, "no hay ninguna ruta privada: algo se rompió en el registro"
    assert {"/api/health"} == PUBLICAS, (
        "cambió la lista de rutas públicas; cada una tiene que justificarse"
    )


# --------------------------------- una ruta nueva nace protegida


def test_una_ruta_nueva_queda_protegida_sin_hacer_nada() -> None:
    """Criterio de aceptación, y la razón de ser de la tarea.

    Se agrega una ruta al enrutador privado **sin ponerle ninguna
    dependencia**, como la agregaría alguien distraído, y se comprueba
    que igual pide sesión. Se usa la `app` de producción y no una copia:
    una copia probaría que el patrón funciona, no que esta aplicación lo
    usa.
    """
    nueva = APIRouter()

    @nueva.get("/recien-agregada")
    def recien_agregada() -> dict[str, str]:
        # Sin `UsuarioActual`, sin `SesionDeUsuario`, sin nada.
        return {"secreto": "datos de alguien"}

    privado = _enrutador_privado()
    cuantas_habia = len(privado.routes)
    privado.include_router(nueva)
    app.openapi_schema = None  # el esquema que había quedó viejo
    try:
        with TestClient(app, raise_server_exceptions=False) as c:
            r = c.get("/api/recien-agregada")
        assert r.status_code == 401, (
            "una ruta agregada sin dependencias quedó accesible: la protección "
            "del enrutador no está funcionando"
        )
        assert "secreto" not in r.text
    finally:
        # Se deja la aplicación como estaba: es la de producción y la
        # comparten las demás pruebas.
        del privado.routes[cuantas_habia:]
        app.openapi_schema = None


def test_la_proteccion_esta_en_el_enrutador_y_no_en_cada_funcion() -> None:
    """Puesta endpoint por endpoint, protege lo que hay hoy y nada de lo
    que venga. Puesta en el enrutador, protege lo que venga también."""
    fuente = (Path(__file__).resolve().parents[2] / "api" / "app" / "main.py").read_text(
        encoding="utf-8"
    )

    assert "dependencies=[Depends(current_user_id)]" in fuente, (
        "la dependencia de sesión tiene que estar en el enrutador privado"
    )
