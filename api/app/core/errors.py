"""Errores de la API con formato uniforme.

Todo error sale con la misma forma, para que el frontend tenga un
único camino de manejo:

    {"error": {"code": "...", "message": "...", "details": [...]}}

Referencia: 02_Documento_Tecnico.md §9.3
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as HTTPExceptionDeStarlette

log = logging.getLogger("epic_wallet")

# Códigos definidos en §9.3. El frontend traduce cada uno a un mensaje.
VALIDATION_ERROR = "VALIDATION_ERROR"
UNAUTHENTICATED = "UNAUTHENTICATED"
FORBIDDEN = "FORBIDDEN"
NOT_FOUND = "NOT_FOUND"
CONFLICT = "CONFLICT"
UNPROCESSABLE = "UNPROCESSABLE"

# Starlette renombró la constante del 422. Se resuelve una vez acá para no
# atarse a la versión instalada ni arrastrar un aviso de deprecación.
HTTP_422 = (
    getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", None) or status.HTTP_422_UNPROCESSABLE_ENTITY
)
UPSTREAM_ERROR = "UPSTREAM_ERROR"
INTERNAL_ERROR = "INTERNAL_ERROR"

_POR_ESTADO = {
    status.HTTP_405_METHOD_NOT_ALLOWED: VALIDATION_ERROR,
    status.HTTP_400_BAD_REQUEST: VALIDATION_ERROR,
    status.HTTP_401_UNAUTHORIZED: UNAUTHENTICATED,
    status.HTTP_403_FORBIDDEN: FORBIDDEN,
    status.HTTP_404_NOT_FOUND: NOT_FOUND,
    status.HTTP_409_CONFLICT: CONFLICT,
    HTTP_422: UNPROCESSABLE,
    status.HTTP_502_BAD_GATEWAY: UPSTREAM_ERROR,
}


class ErrorDeApi(HTTPException):
    """Error con código propio, para los casos de negocio."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(status_code=status_code, detail=message)
        self.code = code
        self.message = message
        self.details = details or []


def error_de_validacion(message: str, details: list[dict[str, Any]] | None = None) -> ErrorDeApi:
    return ErrorDeApi(status.HTTP_400_BAD_REQUEST, VALIDATION_ERROR, message, details)


def no_encontrado(message: str = "No se encontró el recurso.") -> ErrorDeApi:
    """404 también para recursos de otro usuario: no se revela que existen."""
    return ErrorDeApi(status.HTTP_404_NOT_FOUND, NOT_FOUND, message)


def conflicto(message: str, details: list[dict[str, Any]] | None = None) -> ErrorDeApi:
    return ErrorDeApi(status.HTTP_409_CONFLICT, CONFLICT, message, details)


def _respuesta(
    status_code: int, code: str, message: str, details: list[dict[str, Any]] | None = None
) -> JSONResponse:
    cuerpo: dict[str, Any] = {"error": {"code": code, "message": message}}
    if details:
        cuerpo["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=cuerpo)


def registrar_manejadores(app: FastAPI) -> None:
    """Engancha los manejadores. Se llama una vez al crear la aplicación."""

    @app.exception_handler(ErrorDeApi)
    async def _api(_: Request, exc: ErrorDeApi) -> JSONResponse:
        return _respuesta(exc.status_code, exc.code, exc.message, exc.details)

    # Se registra sobre la clase de Starlette, que es la PADRE de la de
    # FastAPI: así entran también los 404 y 405 que genera el enrutador
    # antes de llegar a FastAPI. Registrarlo sólo sobre la de FastAPI deja
    # esos dos casos saliendo como {"detail": ...}, con lo que el frontend
    # tendría que manejar dos formatos distintos.
    @app.exception_handler(HTTPExceptionDeStarlette)
    async def _http(_: Request, exc: HTTPExceptionDeStarlette) -> JSONResponse:
        code = _POR_ESTADO.get(exc.status_code, INTERNAL_ERROR)
        mensaje = str(exc.detail)
        # Los mensajes que pone Starlette vienen en inglés y secos.
        if exc.status_code == status.HTTP_404_NOT_FOUND and mensaje == "Not Found":
            mensaje = "No se encontró el recurso."
        elif exc.status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
            code = VALIDATION_ERROR
            mensaje = "El método no está permitido para esta ruta."
        return _respuesta(exc.status_code, code, mensaje)

    @app.exception_handler(RequestValidationError)
    async def _validacion(_: Request, exc: RequestValidationError) -> JSONResponse:
        detalles = [
            {
                "field": ".".join(str(p) for p in e["loc"][1:]) or str(e["loc"][0]),
                "message": e["msg"],
            }
            for e in exc.errors()
        ]
        return _respuesta(
            HTTP_422,
            UNPROCESSABLE,
            "Los datos enviados no son válidos.",
            detalles,
        )

    @app.exception_handler(Exception)
    async def _inesperado(request: Request, exc: Exception) -> JSONResponse:
        # Se loguea completo del lado del servidor y se devuelve genérico:
        # nunca una traza al cliente (§17).
        log.exception("error inesperado en %s %s", request.method, request.url.path)
        return _respuesta(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            INTERNAL_ERROR,
            "Ocurrió un error inesperado. Volvé a intentar en unos minutos.",
        )
