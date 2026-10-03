"""Creación de la aplicación FastAPI.

Punto de entrada real: `api/index.py`, que es lo que ejecuta Vercel.
En local: `uvicorn app.main:app --reload --port 8000` desde `api/`.

Referencia: 02_Documento_Tecnico.md §5, §9, §16.1
"""

from __future__ import annotations

import logging
import sys
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.errors import registrar_manejadores
from .routers import health

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(levelname)-5.5s [%(name)s] %(message)s",
)
log = logging.getLogger("epic_wallet")


def _verificar_arranque() -> None:
    """Lo que no puede pasar, frena la aplicación acá y no en producción.

    Es la misma protección que `migrations/env.py` aplica a las
    migraciones (§4.1.1): desarrollo nunca debe tocar el esquema real.
    """
    if settings.APP_ENV == "development" and settings.esquema == "public":
        log.critical(
            "APP_ENV=development apuntando al esquema 'public'. "
            "Eso trabajaría sobre los datos reales. Usá DB_SCHEMA=dev."
        )
        sys.exit(1)


@asynccontextmanager
async def ciclo_de_vida(_: FastAPI) -> AsyncIterator[None]:
    _verificar_arranque()
    destino = "SQLite" if settings.es_sqlite else f"esquema '{settings.esquema}'"
    log.info("Epic Wallet %s · %s · %s", settings.APP_VERSION, settings.APP_ENV, destino)
    for aviso in settings.validar_coherencia():
        log.warning("configuración: %s", aviso)
    yield
    log.info("apagando")


def crear_app() -> FastAPI:
    app = FastAPI(
        title="Epic Wallet API",
        version=settings.APP_VERSION,
        description="API de la aplicación personal de gestión financiera.",
        lifespan=ciclo_de_vida,
        # La documentación interactiva sólo fuera de producción.
        docs_url=None if settings.es_produccion else "/api/docs",
        redoc_url=None,
        openapi_url=None if settings.es_produccion else "/api/openapi.json",
        root_path="",
    )

    # En producción el frontend y la API comparten dominio, así que no
    # hay CORS. Esto es sólo para el desarrollo local, donde el frontend
    # se sirve en otro puerto.
    if settings.origenes_permitidos and not settings.es_produccion:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.origenes_permitidos,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
            allow_headers=["Authorization", "Content-Type"],
        )

    registrar_manejadores(app)

    # Todas las rutas bajo /api. Vercel reescribe /api/* a esta función.
    app.include_router(health.router, prefix="/api")

    return app


app = crear_app()
