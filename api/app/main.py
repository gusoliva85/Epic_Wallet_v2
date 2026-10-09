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

from fastapi import APIRouter, Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .core.config import settings
from .core.errors import registrar_manejadores
from .core.security import current_user_id
from .routers import categories, health, me, months

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(levelname)-5.5s [%(name)s] %(message)s",
)
log = logging.getLogger("epic_wallet")


def _verificar_arranque() -> None:
    """Un único control: que haya un esquema donde escribir.

    El proyecto usa **un solo esquema** (`public`). No hay entorno de
    desarrollo separado, así que no hay cruce posible entre esquemas que
    haya que vigilar. Lo único que no puede faltar es el esquema mismo.
    """
    if not settings.es_sqlite and not settings.esquema:
        log.critical("DB_SCHEMA vacía: no hay esquema donde leer ni escribir.")
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
    #
    # `/api/health` es la ÚNICA pública: sirve para saber si el
    # despliegue vive, y pedirle una sesión para eso no tendría sentido.
    app.include_router(health.router, prefix="/api")

    # Y todo lo demás cuelga de un enrutador que exige la sesión. La
    # dependencia está acá y no en cada endpoint a propósito: una ruta
    # nueva nace protegida sin que nadie tenga que acordarse. El olvido
    # más caro de una API es el endpoint al que no le pusieron el
    # guardia, y así ese olvido no es posible.
    privado = APIRouter(prefix="/api", dependencies=[Depends(current_user_id)])
    privado.include_router(me.router)
    privado.include_router(months.router)
    privado.include_router(categories.router)
    app.include_router(privado)

    return app


app = crear_app()
