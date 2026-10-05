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
from .routers import health, me

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(levelname)-5.5s [%(name)s] %(message)s",
)
log = logging.getLogger("epic_wallet")


def _verificar_arranque() -> None:
    """Lo que no puede pasar, frena la aplicación acá y no en producción.

    Es la misma protección que `migrations/env.py` aplica a las
    migraciones (§4.1.1): nada que no sea producción debe poder tocar
    el esquema real.
    """
    # 1. DB_SCHEMA vacío sobre Postgres es el caso MÁS peligroso, y es el
    #    que se dio en F00-T09 con una preview mal configurada: sin
    #    esquema no se fija el search_path, y las consultas caen en el
    #    que Postgres tenga por defecto, que suele ser 'public'. O sea,
    #    los datos reales, sin que nada lo avise.
    if not settings.es_sqlite and not settings.esquema:
        log.critical(
            "DB_SCHEMA no está definida. Sin esquema, las consultas caerían "
            "en el que Postgres tenga por defecto, que suele ser 'public': "
            "los datos reales. Definí DB_SCHEMA=dev o DB_SCHEMA=public."
        )
        sys.exit(1)

    # 2. Desarrollo o preview apuntando al esquema real.
    if settings.APP_ENV != "production" and settings.esquema == "public":
        log.critical(
            "APP_ENV=%s apuntando al esquema 'public'. Eso trabajaría sobre "
            "los datos reales. Usá DB_SCHEMA=dev.",
            settings.APP_ENV,
        )
        sys.exit(1)

    # 3. Producción apuntando a un esquema de prueba: no es destructivo,
    #    pero significaría que nadie ve sus datos. Mejor no arrancar.
    if settings.APP_ENV == "production" and settings.esquema != "public":
        log.critical(
            "APP_ENV=production con el esquema '%s'. Producción tiene que "
            "usar 'public' o nadie vería sus datos.",
            settings.esquema,
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
    app.include_router(privado)

    return app


app = crear_app()
