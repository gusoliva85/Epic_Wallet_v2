"""Ayudas de autenticación para las cuentas de prueba · F11-T03.

Existe por un efecto concreto de activar la confirmación por correo:
desde F11-T03, `POST /auth/v1/signup` **ya no devuelve sesión** —antes
sí, y de ahí salía el token de todas estas pruebas— y
`/auth/v1/token?grant_type=password` responde `email_not_confirmed`
hasta que alguien abra el enlace del mail.

Nadie va a abrir el mail de `epicwallet.me.a1b2c3@example.com`, así que
la cuenta de prueba se confirma con la clave de servicio, que es la
única forma de hacerlo sin un buzón de verdad. Es exactamente lo que
hace cualquier panel de administración: marcar el correo como
confirmado a mano.

Esto toca **sólo cuentas de prueba** y nunca la cuenta real de Gustavo:
lo único que hace es poner `email_confirmed_at` en el uid que se le
pasa, que es el que acaba de crear la prueba. No borra nada.

La función es tolerante a propósito: si no hay clave de servicio, o si
la confirmación por correo está apagada (y entonces no hace falta), no
pasa nada y el flujo de siempre sigue funcionando igual. Eso la hace
segura de llamar antes de que Gustavo toque el panel y después.
"""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]


def _del_env(clave: str) -> str | None:
    """Mismo lector que usan los módulos de prueba: entorno, y si no, `.env`."""
    valor = os.getenv(clave, "").strip()
    if valor:
        return valor
    archivo = RAIZ / ".env"
    if not archivo.exists():
        return None
    m = re.search(rf"^{clave}=(.+)$", archivo.read_text(encoding="utf-8"), re.M)
    return m.group(1).strip() if m else None


SUPABASE = (_del_env("SUPABASE_URL") or "").rstrip("/")
SERVICIO = _del_env("SUPABASE_SERVICE_ROLE_KEY")


def confirmar_correo(uid: str) -> bool:
    """Marca como confirmado el correo de una cuenta de prueba.

    Devuelve si hizo falta y salió bien. No lanza nunca: un fallo acá
    tiene que dejar que la prueba siga al `grant_type=password` y
    falle —o pase— por su propio motivo, no por esta ayuda.
    """
    if not (SUPABASE and SERVICIO and uid):
        return False

    req = urllib.request.Request(
        f"{SUPABASE}/auth/v1/admin/users/{uid}",
        data=json.dumps({"email_confirm": True}).encode(),
        headers={
            "apikey": str(SERVICIO),
            "Authorization": f"Bearer {SERVICIO}",
            "Content-Type": "application/json",
        },
        method="PUT",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return 200 <= r.status < 300
    except (urllib.error.HTTPError, urllib.error.URLError, OSError):
        return False
