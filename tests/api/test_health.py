"""Pruebas del endpoint de salud y del formato de errores.

Corresponde a la tarea F00-T07. Usa `httpx.ASGITransport` en lugar de
`TestClient` para hablar con la aplicación en memoria: es lo que pide
§19 del documento técnico y evita el aviso de deprecación de Starlette.

La conexión a la base se simula: estas pruebas no necesitan red.
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.main import app


def _cliente() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app),
        base_url="http://test",
    )


# ==================================================================
#  Salud
# ==================================================================
@pytest.mark.api
async def test_salud_responde_con_la_base_viva(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.routers import health as modulo

    monkeypatch.setattr(
        modulo,
        "revisar_conexion",
        lambda: {"status": "connected", "latency_ms": 31.4, "schema_exists": True},
    )
    async with _cliente() as c:
        r = await c.get("/api/health")

    assert r.status_code == 200
    cuerpo: dict[str, Any] = r.json()
    assert cuerpo["status"] == "ok"
    assert cuerpo["database"]["status"] == "connected"
    # Lo que pide F00-T09: saber contra qué esquema corre cada entorno.
    assert "db_schema" in cuerpo
    assert cuerpo["environment"] in {"development", "preview", "production"}
    assert cuerpo["version"]


@pytest.mark.api
async def test_salud_no_se_cae_si_la_base_no_responde(monkeypatch: pytest.MonkeyPatch) -> None:
    """El endpoint que sirve para enterarse de que la base falló no puede fallar."""
    from app.routers import health as modulo

    monkeypatch.setattr(
        modulo,
        "revisar_conexion",
        lambda: {"status": "error", "latency_ms": 10000.0, "reason": "OperationalError"},
    )
    async with _cliente() as c:
        r = await c.get("/api/health")

    assert r.status_code == 503, "una base caída es servicio degradado"
    cuerpo = r.json()
    assert cuerpo["status"] == "degraded"
    assert cuerpo["database"]["status"] == "error"
    assert cuerpo["database"]["reason"] == "OperationalError"


@pytest.mark.api
async def test_salud_avisa_si_falta_el_esquema(monkeypatch: pytest.MonkeyPatch) -> None:
    """Sin el esquema, las migraciones no corrieron: hay que saberlo."""
    from app.routers import health as modulo

    monkeypatch.setattr(
        modulo,
        "revisar_conexion",
        lambda: {"status": "connected", "latency_ms": 30.0, "schema_exists": False},
    )
    async with _cliente() as c:
        r = await c.get("/api/health")

    assert r.status_code == 503
    assert r.json()["status"] == "degraded"
    assert any("migraciones" in a for a in r.json()["warnings"])


@pytest.mark.api
async def test_la_salud_no_filtra_secretos(monkeypatch: pytest.MonkeyPatch) -> None:
    """Ni claves ni la cadena de conexión pueden salir en la respuesta."""
    from app.core.config import settings
    from app.routers import health as modulo

    monkeypatch.setattr(
        modulo,
        "revisar_conexion",
        lambda: {"status": "connected", "latency_ms": 30.0, "schema_exists": True},
    )
    async with _cliente() as c:
        r = await c.get("/api/health")

    texto = r.text
    for secreto in (
        settings.SUPABASE_SERVICE_ROLE_KEY,
        settings.SUPABASE_JWT_SECRET,
        settings.DATABASE_URL,
    ):
        if secreto:
            assert secreto not in texto, "la respuesta de salud no debe traer secretos"


# ==================================================================
#  Formato de errores (§9.3)
# ==================================================================
@pytest.mark.api
async def test_una_ruta_inexistente_usa_el_formato_uniforme() -> None:
    async with _cliente() as c:
        r = await c.get("/api/no-existe")

    assert r.status_code == 404
    cuerpo = r.json()
    assert "error" in cuerpo, "todo error sale como {'error': {...}}"
    assert cuerpo["error"]["code"] == "NOT_FOUND"
    assert cuerpo["error"]["message"]


@pytest.mark.api
async def test_un_metodo_no_permitido_usa_el_formato_uniforme() -> None:
    async with _cliente() as c:
        r = await c.post("/api/health")

    assert r.status_code == 405
    assert "error" in r.json()
    assert r.json()["error"]["code"]


@pytest.mark.api
async def test_la_documentacion_interactiva_existe_fuera_de_produccion() -> None:
    from app.core.config import settings

    async with _cliente() as c:
        r = await c.get("/api/docs")

    if settings.es_produccion:
        assert r.status_code == 404, "en producción la documentación no se expone"
    else:
        assert r.status_code == 200
