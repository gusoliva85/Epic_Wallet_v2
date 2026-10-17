"""Repositorio de pasivos · F09-T03.

Referencia: 02_Documento_Tecnico.md §6.2

Sólo una consulta: los pasivos activos, para que el servicio sume su
total con `calc.total_de_pasivos`. Nada escribe en esta tabla todavía
—no se usa desde la interfaz en el MVP—, así que no hace falta
`crear`/`eliminar` por ahora.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Liability


def listar_activos(sesion: Session) -> list[Liability]:
    return list(sesion.scalars(select(Liability).where(Liability.active.is_(True))))
