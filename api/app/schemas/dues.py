"""Esquemas de vencimientos · F13-T03.

Referencia: 02_Documento_Tecnico.md §9.1 · General §29
"""

from __future__ import annotations

import decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from ..services.vencimientos import (
    AVISO_MAXIMO,
    AVISO_MINIMO,
    DIA_MAXIMO,
    DIA_MINIMO,
)


class ItemConVencimiento(BaseModel):
    """Una fila de la pantalla de Vencimientos.

    Viene una por **categoría de egreso activa**, tenga o no
    vencimiento configurado: la pantalla es la lista de ítems que ya
    existen, con un interruptor cada uno (no hay un «agregar»).

    Con `enabled` en `false`, `state` y `severity` vienen en `null`: un
    vencimiento apagado no es «todo en orden», es que no se está
    siguiendo. `due_day` y `notice_days` igual conservan lo último que
    se configuró, así prenderlo de nuevo no pide volver a elegir.
    """

    category_id: int
    name: str
    enabled: bool
    due_day: int
    notice_days: int

    # Del lado del servidor, calculado con el día de hoy en la zona de
    # presentación (`America/Argentina/Buenos_Aires`): el cliente no
    # decide qué día es, para que dos dispositivos con relojes
    # distintos no muestren alertas distintas.
    state: str | None
    severity: str | None
    days_left: int | None
    alert: bool
    paid: bool

    # Lo que se espera pagar: el total de ese ítem en el último mes que
    # tuvo movimiento. `null` si nunca tuvo —un ítem recién creado no
    # tiene con qué estimar, y un cero ahí se leería como gratis.
    estimated: decimal.Decimal | None

    @field_serializer("estimated")
    def _estimado_como_texto(self, valor: decimal.Decimal | None) -> str | None:
        return None if valor is None else f"{valor:.2f}"


class CambioDeVencimiento(BaseModel):
    """`PUT /api/dues/{category_id}`.

    Reemplaza la configuración entera, no por partes: son tres campos
    que se tocan juntos en la misma pantalla, y un `PATCH` por campo
    haría tres pedidos para lo que es un solo cambio.

    Los límites son los del servicio y los repite la base en dos
    `check` (la API se puede saltear; la restricción no). El día 31 es
    válido aunque no exista en todos los meses: significa «el último
    día», y el servicio lo recorta mes a mes.
    """

    model_config = ConfigDict(extra="forbid")

    enabled: bool
    due_day: int = Field(ge=DIA_MINIMO, le=DIA_MAXIMO)
    notice_days: int = Field(ge=AVISO_MINIMO, le=AVISO_MAXIMO)


class AlertaDeVencimiento(BaseModel):
    """Lo que viaja en `GET /api/dashboard` para el tablero y la
    campanita · F13-T03.

    Es un recorte de `ItemConVencimiento`: sólo los que **tienen
    alerta** hoy, ya ordenados por urgencia, y sólo los campos que la
    tarjeta del tablero muestra. Va dentro del dashboard y no en una
    llamada aparte porque el tablero es una sola llamada (CLAUDE.md).
    """

    model_config = ConfigDict(from_attributes=True)

    category_id: int
    name: str
    state: str
    severity: str
    days_left: int
    due_day: int
    estimated: decimal.Decimal | None

    @field_serializer("estimated")
    def _estimado_como_texto(self, valor: decimal.Decimal | None) -> str | None:
        return None if valor is None else f"{valor:.2f}"
