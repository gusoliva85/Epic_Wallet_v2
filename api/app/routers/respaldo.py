"""Exportación y respaldo · F11-T02.

Referencia: 02_Documento_Tecnico.md §9.1, §18 · General §58

    GET  /api/export?format=json|csv   todo lo del usuario
    POST /api/import                   restaurarlo en una cuenta limpia

`POST /api/import` es de dos pasos, con el mismo cuerpo los dos veces:
sin `confirm` (o en `false`) sólo valida y devuelve cuántas filas trae
cada tabla, sin escribir nada; con `confirm: true` escribe de verdad.
Así el frontend puede mostrar la vista previa antes de pedir que se
confirme, sin que el servidor tenga que guardar nada a medio camino
entre un pedido y el otro.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Query, Response

from ..core.db import SesionDeUsuario
from ..core.security import UsuarioDelToken
from ..schemas.respaldo import PedidoDeImportacion, VistaPreviaDeImportacion
from ..services import respaldo as servicio
from .me import asegurar_perfil_y_categorias

router = APIRouter(tags=["respaldo"])


@router.get("/export", summary="Todo lo del usuario (JSON o un ZIP de CSV)")
def exportar(
    sesion: SesionDeUsuario,
    usuario: UsuarioDelToken,
    format: Literal["json", "csv"] = Query("json"),
) -> Response:
    asegurar_perfil_y_categorias(sesion, usuario)
    backup = servicio.armar_respaldo(sesion)
    nombre = f"epic-wallet-{backup.exported_at:%Y-%m-%d}"

    if format == "csv":
        return Response(
            content=servicio.armar_zip_csv(backup),
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{nombre}.zip"'},
        )

    return Response(
        content=backup.model_dump_json(indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{nombre}.json"'},
    )


@router.post("/import", response_model=VistaPreviaDeImportacion, summary="Restaurar un respaldo")
def importar(
    pedido: PedidoDeImportacion, sesion: SesionDeUsuario, usuario: UsuarioDelToken
) -> VistaPreviaDeImportacion:
    asegurar_perfil_y_categorias(sesion, usuario)
    return servicio.importar_respaldo(sesion, usuario.id, pedido.backup, confirm=pedido.confirm)
