"""Punto de entrada de la función Python en Vercel.

Vercel detecta la variable `app` como aplicación ASGI y la sirve.
Todo el código vive en `api/app/`; este archivo sólo la expone.

POR QUÉ EL sys.path.insert DE ABAJO
En local el paquete `app` se encuentra porque el proyecto se instala
con `pip install -e .` (pyproject.toml lo mapea a api/app). En Vercel
eso no pasa: sólo se instala requirements.txt, así que `app` no es un
paquete instalado y el import fallaría con ModuleNotFoundError. Agregar
el directorio de este archivo a sys.path lo resuelve en los dos casos.

Referencia: 02_Documento_Tecnico.md §16.1
"""

import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
if str(AQUI) not in sys.path:
    sys.path.insert(0, str(AQUI))

from app.main import app  # noqa: E402

__all__ = ["app"]
