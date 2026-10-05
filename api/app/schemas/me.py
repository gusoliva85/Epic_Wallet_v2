"""Esquemas del perfil · F02-T06.

Referencia: 02_Documento_Tecnico.md §9.1

Los importes viajan como **string decimal**, no como float. Es la regla
del proyecto y tiene un motivo concreto: JSON no distingue enteros de
flotantes y JavaScript convierte todo a `double`, así que un saldo como
8562500.15 puede volver con un centavo de diferencia. Como string, lo
que sale es exactamente lo que había.
"""

from __future__ import annotations

import datetime as dt
import decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

# Catorce dígitos con dos decimales, igual que la columna. Más que eso
# no entra en la base, y es mejor rechazarlo acá que recibir un error
# de Postgres que no dice nada.
MAXIMO = decimal.Decimal("999999999999.99")
MINIMO = decimal.Decimal("-999999999999.99")


class Perfil(BaseModel):
    """Lo que devuelve `GET /api/me`."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    display_name: str | None = None
    opening_balance: decimal.Decimal
    timezone: str
    active: bool
    created_at: dt.datetime
    updated_at: dt.datetime
    last_login_at: dt.datetime | None = None

    @field_serializer("opening_balance")
    def _importe_como_texto(self, valor: decimal.Decimal) -> str:
        # Siempre con dos decimales: "8562500.00" y no "8562500", para
        # que el frontend no tenga que adivinar el formato.
        return f"{valor:.2f}"


class CambioDePerfil(BaseModel):
    """Lo que acepta `PATCH /api/me`.

    Sólo dos campos. El correo no se toca desde acá —lo maneja Supabase
    Auth— y el resto son datos del sistema.

    Los campos ausentes no se tocan; para borrar el nombre visible hay
    que mandarlo explícitamente en `null`. Por eso se distingue «no
    vino» de «vino vacío» con el centinela de abajo.
    """

    model_config = ConfigDict(extra="forbid")

    display_name: str | None = Field(default=None, max_length=120)
    opening_balance: decimal.Decimal | None = Field(default=None)

    @field_validator("display_name")
    @classmethod
    def _limpiar_nombre(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        limpio = valor.strip()
        # Un nombre de puros espacios es lo mismo que no tener nombre.
        return limpio or None

    @field_validator("opening_balance")
    @classmethod
    def _saldo_razonable(cls, valor: decimal.Decimal | None) -> decimal.Decimal | None:
        if valor is None:
            return None
        if not MINIMO <= valor <= MAXIMO:
            raise ValueError(f"el saldo inicial tiene que estar entre {MINIMO} y {MAXIMO}")
        # Se redondea a dos decimales acá y no en la base: así lo que se
        # guarda es lo que se devuelve, sin sorpresas al releer.
        return valor.quantize(decimal.Decimal("0.01"))


class ResultadoDeBootstrap(BaseModel):
    """Lo que devuelve `POST /api/me/bootstrap`.

    Dice qué hizo, no sólo que terminó bien: llamarlo dos veces tiene
    que poder distinguirse de llamarlo una.
    """

    perfil_creado: bool = Field(description="True si no existía y se creó")
    categorias_creadas: int = Field(description="Cuántas se agregaron ahora")
    total_categorias: int = Field(description="Cuántas tiene la cuenta al terminar")
