"""Esquemas de categorías · F03-T08.

Referencia: 02_Documento_Tecnico.md §9.1, §9.4
"""

from __future__ import annotations

import datetime as dt

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..services.categories import LARGO_MAXIMO_NOMBRE, nombre_valido, tipo_valido


class Categoria(BaseModel):
    """Lo que devuelven `GET` y las escrituras."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    active: bool
    sort_order: int
    created_at: dt.datetime
    updated_at: dt.datetime


def _validar_nombre(valor: str) -> str:
    limpio = valor.strip()
    if not nombre_valido(limpio):
        raise ValueError(f"el nombre tiene que tener entre 1 y {LARGO_MAXIMO_NOMBRE} caracteres")
    return limpio


def _validar_tipo(valor: str) -> str:
    if not tipo_valido(valor):
        raise ValueError("el tipo tiene que ser 'income' o 'expense'")
    return valor


class AltaDeCategoria(BaseModel):
    """Lo que acepta `POST /api/categories`.

    Sin `sort_order`: una categoría nueva se agrega al final de su
    tipo, lo decide el servicio (`repos.siguiente_orden`), no quien
    llama — así dos altas seguidas no pueden pedir el mismo lugar.
    """

    model_config = ConfigDict(extra="forbid")

    name: str = Field(max_length=LARGO_MAXIMO_NOMBRE)
    type: str

    @field_validator("name")
    @classmethod
    def _nombre(cls, v: str) -> str:
        return _validar_nombre(v)

    @field_validator("type")
    @classmethod
    def _tipo(cls, v: str) -> str:
        return _validar_tipo(v)


class CambioDeCategoria(BaseModel):
    """Lo que acepta `PATCH /api/categories/{id}`.

    Sin `type`: cambiarle el tipo a una categoría con histórico
    volvería incoherentes los movimientos que ya la usan (Regla 34).
    Para eso se crea una categoría nueva y se desactiva la vieja, no se
    reescribe ésta.

    Los campos ausentes no se tocan —mismo centinela que
    `CambioDePerfil` en `schemas/me.py`—: cambiar sólo el nombre no
    puede reactivar o desactivar la categoría de paso.
    """

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=LARGO_MAXIMO_NOMBRE)
    active: bool | None = None
    sort_order: int | None = None

    @field_validator("name")
    @classmethod
    def _nombre(cls, v: str | None) -> str | None:
        return _validar_nombre(v) if v is not None else None
