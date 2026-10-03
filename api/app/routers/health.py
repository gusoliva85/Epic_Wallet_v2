"""Endpoint de salud. El único público de toda la API.

Sirve para dos cosas: comprobar que el despliegue vive, y saber de un
vistazo **contra qué esquema está corriendo** cada entorno, que es lo
que pide F00-T09 para distinguir una preview de producción.

Referencia: 02_Documento_Tecnico.md §9.1
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Response, status
from pydantic import BaseModel, Field

from ..core.config import settings
from ..core.db import revisar_conexion

router = APIRouter(tags=["salud"])


class EstadoDeBase(BaseModel):
    status: str = Field(description="connected | error")
    latency_ms: float = Field(description="Cuánto tardó la comprobación")
    schema_exists: bool | None = Field(
        default=None, description="Si el esquema configurado existe. None en SQLite."
    )
    reason: str | None = Field(default=None, description="Tipo de error, si falló")


class Salud(BaseModel):
    status: str = Field(description="ok | degraded")
    version: str
    environment: str
    db_schema: str | None = Field(description="Esquema activo: dev o public")
    timezone: str
    database: EstadoDeBase
    warnings: list[str] = Field(default_factory=list)


@router.get(
    "/health",
    response_model=Salud,
    summary="Estado del servicio",
    description=(
        "Público, sin autenticación. Informa versión, entorno, esquema activo y "
        "si la base responde. Devuelve 503 si la base no contesta, para que un "
        "monitor externo lo detecte."
    ),
)
async def salud(response: Response) -> dict[str, Any]:
    base = revisar_conexion()
    avisos = settings.validar_coherencia()

    if base["status"] != "connected":
        # Degradado, no caído: el servicio responde pero no puede trabajar.
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        estado = "degraded"
    elif base.get("schema_exists") is False:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        estado = "degraded"
        avisos.append(f"el esquema '{settings.esquema}' no existe: faltan correr las migraciones")
    else:
        estado = "ok"

    return {
        "status": estado,
        "version": settings.APP_VERSION,
        "environment": settings.APP_ENV,
        "db_schema": settings.esquema,
        "timezone": settings.APP_TIMEZONE,
        "database": base,
        "warnings": avisos,
    }
