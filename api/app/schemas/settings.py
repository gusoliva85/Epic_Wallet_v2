"""Esquemas de preferencias · F11-T01.

Referencia: 02_Documento_Tecnico.md §9.1 · General §42

La tabla de abajo es clave/valor abierta, pero el contrato de la API
no lo es: `theme` es el único campo porque es la única preferencia
real que hay hoy. Una preferencia nueva se agrega como un campo más
acá, no abriendo el valor libre al frontend.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from ..services.settings import Tema


class RespuestaPreferencias(BaseModel):
    """`GET /api/settings`. `theme: null` = sin preferencia guardada,
    la cuenta sigue el tema del dispositivo."""

    theme: Tema | None


class CambioDePreferencias(BaseModel):
    """`PUT /api/settings`. Reemplaza el valor entero, no por partes:
    hoy hay un solo campo y no hace falta un "no mandado" aparte de
    `null`. `theme: null` borra la preferencia guardada."""

    model_config = ConfigDict(extra="forbid")

    theme: Tema | None
