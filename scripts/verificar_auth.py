"""Comprueba la configuración de Supabase Auth · F02-T02.

    python scripts/verificar_auth.py

Verifica, contra el proyecto real, los tres criterios de aceptación de
la tarea:

  1. una contraseña de 7 caracteres se rechaza del lado del servidor;
  2. una cuenta nueva queda confirmada al instante y puede iniciar
     sesión (sin depender de que llegue un correo);
  3. el registro está habilitado.

Las Redirect URLs no se pueden leer desde afuera —Supabase no las
publica, y está bien que no lo haga— así que ésas se miran en el panel.

Para la prueba 2 crea una cuenta de usar y tirar en `example.com`, que
la RFC 2606 reserva justo para esto y no entrega correo a nadie.

OJO con el dominio: la primera versión usaba `.test`, que Supabase
rechaza por inválido. La prueba de la contraseña corta daba «rechazada»
y parecía correcta, pero la rechazaba por el CORREO. Por eso ahora no
alcanza con que falle: se comprueba que el motivo hable de la
contraseña.
"""

from __future__ import annotations

import json
import re
import secrets
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

RAIZ = Path(__file__).resolve().parent.parent
ENV = RAIZ / ".env"

OK = "  [ok]  "
MAL = "  [MAL] "


def _config() -> tuple[str, str]:
    if not ENV.exists():
        sys.exit("falta el archivo .env")
    texto = ENV.read_text(encoding="utf-8")

    def leer(clave: str) -> str:
        m = re.search(rf"^{clave}=(.+)$", texto, re.M)
        if not m:
            sys.exit(f"falta {clave} en .env")
        return m.group(1).strip()

    return leer("SUPABASE_URL").rstrip("/"), leer("SUPABASE_ANON_KEY")


def _pedir(
    url: str, clave: str, ruta: str, cuerpo: dict[str, Any] | None = None
) -> tuple[int, dict[str, Any]]:
    datos = json.dumps(cuerpo).encode() if cuerpo is not None else None
    # La URL sale de .env, que es del proyecto: no hay entrada ajena
    # que pueda cambiarle el esquema.
    req = urllib.request.Request(  # noqa: S310
        f"{url}{ruta}",
        data=datos,
        headers={
            "apikey": clave,
            "Authorization": f"Bearer {clave}",
            "Content-Type": "application/json",
        },
        method="POST" if datos else "GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as r:  # noqa: S310
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        crudo = e.read() or b"{}"
        try:
            return e.code, json.loads(crudo)
        except json.JSONDecodeError:
            return e.code, {"raw": crudo.decode(errors="replace")}


def main() -> int:
    url, clave = _config()
    print(f"\n  Proyecto: {url}\n")
    fallos = 0

    # --- 1. el registro está abierto y la confirmación, desactivada ---
    _, ajustes = _pedir(url, clave, "/auth/v1/settings")

    if ajustes.get("disable_signup") is False:
        print(f"{OK}El registro está habilitado.")
    else:
        print(f"{MAL}El registro está cerrado: nadie puede crear una cuenta.")
        fallos += 1

    if ajustes.get("mailer_autoconfirm") is True:
        print(f"{OK}La confirmación por correo está desactivada.")
    else:
        print(
            f"{MAL}La confirmación por correo sigue ACTIVADA. El registro va a "
            "quedar esperando un mail que todavía no se manda.\n"
            "        Authentication -> Providers -> Email -> Confirm email, en off."
        )
        fallos += 1

    # --- 2. una contraseña corta se rechaza del lado del servidor ---
    # Dos correos distintos: si el mínimo del servidor permitiera 7
    # caracteres, el primer registro CREA la cuenta, y entonces el
    # segundo fallaba con «User already registered» y parecía que el
    # registro estaba roto. Falla mía de la primera versión.
    correo_corto = f"epicwallet.corta.{secrets.token_hex(6)}@example.com"
    correo = f"epicwallet.prueba.{secrets.token_hex(6)}@example.com"
    estado, cuerpo = _pedir(
        url, clave, "/auth/v1/signup", {"email": correo_corto, "password": "1234567"}
    )
    motivo = str(cuerpo.get("msg") or cuerpo.get("error_description") or cuerpo.get("message", ""))
    # Que falle no alcanza: tiene que fallar POR LA CONTRASEÑA. Si
    # fallara por el correo, esto daría verde sin haber comprobado nada.
    por_la_clave = "password" in motivo.lower() or "contraseñ" in motivo.lower()

    if estado >= 400 and por_la_clave:
        print(f"{OK}Una contraseña de 7 caracteres se rechaza: {motivo}")
    elif "rate limit" in motivo.lower():
        # Con la confirmación activada, cada registro intenta mandar un
        # correo, y el plan gratuito permite pocos por hora. Al apagar
        # la confirmación no se manda ninguno y esto desaparece.
        print(
            f"{MAL}No se pudo comprobar: Supabase cortó por límite de correos.\n"
            "        Es consecuencia de tener la confirmación activada: cada\n"
            "        registro intenta mandar un mail. Apagala y repetí esto."
        )
        fallos += 1
    elif estado >= 400:
        print(
            f"{MAL}El registro falló, pero NO por la contraseña: {motivo}\n"
            "        Esta comprobación no sirve hasta que el correo sea válido."
        )
        fallos += 1
    else:
        print(
            f"{MAL}Una contraseña de 7 caracteres fue ACEPTADA. El mínimo no está "
            "puesto en 8.\n"
            "        Authentication -> Policies (o Sign In / Providers -> "
            "Password) -> Minimum password length."
        )
        fallos += 1

    # --- 3. una cuenta nueva queda confirmada y puede entrar ---
    buena = secrets.token_urlsafe(16)
    estado, cuerpo = _pedir(url, clave, "/auth/v1/signup", {"email": correo, "password": buena})
    if estado >= 400:
        motivo = cuerpo.get("msg") or cuerpo.get("message", cuerpo)
        print(f"{MAL}No se pudo crear la cuenta de prueba: {motivo}")
        return 1

    estado, sesion = _pedir(
        url,
        clave,
        "/auth/v1/token?grant_type=password",
        {"email": correo, "password": buena},
    )
    if estado == 200 and sesion.get("access_token"):
        print(f"{OK}Una cuenta nueva entra enseguida, sin esperar un correo.")

        # De paso: que el token sea el que el backend sabe verificar.
        cabecera = json.loads(
            __import__("base64").urlsafe_b64decode(sesion["access_token"].split(".")[0] + "==")
        )
        if cabecera.get("alg") == "ES256":
            print(f"{OK}El token viene firmado con ES256, como espera el backend.")
        else:
            print(f"{MAL}El token viene con alg={cabecera.get('alg')} y no ES256.")
            fallos += 1
    else:
        motivo = sesion.get("msg") or sesion.get("error_description") or sesion
        print(f"{MAL}La cuenta nueva no puede entrar: {motivo}")
        fallos += 1

    print(f"\n  Cuenta de prueba creada: {correo}")
    print("  Se puede borrar desde Authentication -> Users.\n")

    if fallos:
        print(f"  {fallos} cosa(s) por ajustar en el panel.\n")
    else:
        print("  Todo en orden.\n")
    return 1 if fallos else 0


if __name__ == "__main__":
    raise SystemExit(main())
