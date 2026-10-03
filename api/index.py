"""Punto de entrada de la función Python en Vercel.

Vercel detecta la variable `app` como aplicación ASGI y la sirve.
Todo el código vive en `api/app/`; este archivo sólo la expone.

Referencia: 02_Documento_Tecnico.md §16.1
"""

from app.main import app

__all__ = ["app"]
