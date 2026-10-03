"""Verifica la configuración de Supabase y la conexión a la base.

Uso:  python scripts/check_db.py

Lee .env del directorio del proyecto y comprueba:
  1. que estén todas las variables requeridas
  2. que DATABASE_URL apunte al pooler (6543) y use el driver psycopg
  3. que la conexión funcione, con versión de Postgres y latencia
  4. que las claves de Supabase tengan la forma esperada

NUNCA imprime el valor de un secreto: sólo si está presente, su
longitud y una huella corta. Es seguro pegar su salida en un chat.

Corresponde a la tarea F00-T04 del roadmap.
"""

from __future__ import annotations

import hashlib
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env"

OK = "  [ok]  "
BAD = "  [--]  "
WARN = "  [!]   "

problemas: list[str] = []
avisos: list[str] = []


def cargar_env() -> dict[str, str]:
    """Lee .env sin dependencias externas. Ignora comentarios y vacíos."""
    if not ENV_FILE.exists():
        print(f"{BAD}No existe {ENV_FILE.name}.")
        print("        Crealo con:  cp .env.example .env   y completá los valores.")
        sys.exit(1)
    datos: dict[str, str] = {}
    for linea in ENV_FILE.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, _, valor = linea.partition("=")
        datos[clave.strip()] = valor.strip().strip("\"'")
    return datos


def huella(valor: str) -> str:
    """Huella corta para comparar valores sin revelarlos."""
    return hashlib.sha256(valor.encode()).hexdigest()[:8]


def describir_secreto(nombre: str, valor: str, minimo: int) -> None:
    if not valor:
        problemas.append(f"{nombre} está vacía")
        print(f"{BAD}{nombre:30} vacía")
        return
    if valor.startswith(("xxxx", "PROYECTO", "CONTRASENA")) or "xxxx" in valor:
        problemas.append(f"{nombre} todavía tiene el valor de ejemplo")
        print(f"{BAD}{nombre:30} sigue con el valor de ejemplo")
        return
    estado = OK if len(valor) >= minimo else WARN
    if len(valor) < minimo:
        avisos.append(f"{nombre} parece corta ({len(valor)} caracteres)")
    print(f"{estado}{nombre:30} presente · {len(valor)} caracteres · huella {huella(valor)}")


def revisar_database_url(url: str) -> None:
    print("\n--- DATABASE_URL ---")
    if not url or "PROYECTO" in url or "CONTRASENA" in url:
        problemas.append("DATABASE_URL sin completar")
        print(f"{BAD}sin completar")
        return

    partes = urlsplit(url)

    if url.startswith("sqlite"):
        print(f"{WARN}apunta a SQLite: sólo sirve para tests, no para desarrollo normal")
        avisos.append("DATABASE_URL apunta a SQLite")
        return

    if "+psycopg" in partes.scheme:
        print(f"{OK}driver {partes.scheme}")
    else:
        problemas.append(f"el driver debe ser postgresql+psycopg, no {partes.scheme}")
        print(f"{BAD}driver {partes.scheme} · tiene que ser postgresql+psycopg")

    puerto = partes.port
    if puerto == 6543:
        print(f"{OK}puerto 6543 (pooler en modo transaction)")
    elif puerto == 5432:
        problemas.append("usa la conexión directa (5432) en lugar del pooler (6543)")
        print(f"{BAD}puerto 5432 · es la conexión directa; Vercel necesita el pooler (6543)")
    else:
        avisos.append(f"puerto inesperado: {puerto}")
        print(f"{WARN}puerto {puerto} · se esperaba 6543")

    if partes.hostname and "pooler.supabase.com" in partes.hostname:
        print(f"{OK}host {partes.hostname}")
    else:
        avisos.append("el host no parece el pooler de Supabase")
        print(f"{WARN}host {partes.hostname}")

    if not partes.password:
        problemas.append("DATABASE_URL no trae contraseña")
        print(f"{BAD}sin contraseña en la cadena")


def probar_conexion(url: str) -> None:
    print("\n--- conexión ---")
    if not url or "PROYECTO" in url:
        print(f"{BAD}no se intenta: DATABASE_URL sin completar")
        return
    try:
        from sqlalchemy import create_engine, text
    except ImportError:
        print(f'{BAD}falta SQLAlchemy. Instalá con:  pip install -e ".[dev]"')
        problemas.append("SQLAlchemy no instalado")
        return

    try:
        motor = create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 10})
        t0 = time.perf_counter()
        with motor.connect() as conexion:
            version = conexion.execute(text("select version()")).scalar_one()
            base = conexion.execute(text("select current_database()")).scalar_one()
            usuario = conexion.execute(text("select current_user")).scalar_one()
            esquemas = conexion.execute(
                text(
                    "select count(*) from information_schema.schemata "
                    "where schema_name in ('public','auth')"
                )
            ).scalar_one()
        ms = (time.perf_counter() - t0) * 1000
        corto = version.split(" on ")[0] if " on " in version else version[:40]
        print(f"{OK}conectado en {ms:.0f} ms")
        print(f"{OK}{corto}")
        print(f"{OK}base '{base}' · usuario '{usuario}'")
        if esquemas == 2:
            print(f"{OK}esquemas public y auth presentes (Supabase listo)")
        else:
            avisos.append("no se encontraron los esquemas public y auth")
            print(f"{WARN}faltan esquemas: se esperaban public y auth")
        if ms > 1500:
            avisos.append(f"latencia alta: {ms:.0f} ms")
            print(f"{WARN}latencia alta · ¿está el proyecto en São Paulo (sa-east-1)?")
        motor.dispose()
    except Exception as exc:  # cualquier fallo de conexión se reporta, no se propaga
        mensaje = str(exc).split("\n")[0][:220]
        problemas.append(f"no se pudo conectar: {mensaje}")
        print(f"{BAD}no se pudo conectar")
        print(f"        {mensaje}")


def main() -> int:
    print("\n" + "=" * 62)
    print("  EPIC WALLET · verificación de Supabase")
    print("=" * 62)

    env = cargar_env()
    os.environ.update(env)

    print("\n--- credenciales de Supabase ---")
    url_supabase = env.get("SUPABASE_URL", "")
    if url_supabase.startswith("https://") and ".supabase.co" in url_supabase:
        print(f"{OK}{'SUPABASE_URL':30} {url_supabase}")
    else:
        problemas.append("SUPABASE_URL no tiene la forma https://xxxx.supabase.co")
        print(f"{BAD}{'SUPABASE_URL':30} {url_supabase or 'vacía'}")

    describir_secreto("SUPABASE_ANON_KEY", env.get("SUPABASE_ANON_KEY", ""), 40)
    describir_secreto("SUPABASE_SERVICE_ROLE_KEY", env.get("SUPABASE_SERVICE_ROLE_KEY", ""), 40)
    describir_secreto("SUPABASE_JWT_SECRET", env.get("SUPABASE_JWT_SECRET", ""), 32)

    anon = env.get("SUPABASE_ANON_KEY", "")
    servicio = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if anon and servicio and anon == servicio:
        problemas.append("la clave anónima y la de servicio son iguales: están mal copiadas")
        print(f"{BAD}la clave anónima y la de servicio son idénticas")

    print("\n--- aplicación ---")
    for clave, esperado in (
        ("APP_ENV", {"development", "preview", "production"}),
        ("APP_TIMEZONE", None),
        ("ALLOWED_ORIGINS", None),
        ("PRICE_PROVIDER_ORDER", None),
        ("LOG_LEVEL", {"DEBUG", "INFO", "WARNING", "ERROR"}),
    ):
        valor = env.get(clave, "")
        if not valor:
            avisos.append(f"{clave} sin definir")
            print(f"{WARN}{clave:30} sin definir")
        elif esperado and valor not in esperado:
            avisos.append(f"{clave}={valor} no es un valor esperado")
            print(f"{WARN}{clave:30} {valor} · se esperaba uno de {sorted(esperado)}")
        else:
            print(f"{OK}{clave:30} {valor}")

    orden = env.get("PRICE_PROVIDER_ORDER", "")
    if orden and orden.split(",")[-1].strip() != "manual":
        avisos.append("PRICE_PROVIDER_ORDER debería terminar en 'manual'")
        print(f"{WARN}PRICE_PROVIDER_ORDER debería terminar en 'manual' (el camino garantizado)")

    url_db = env.get("DATABASE_URL", "")
    revisar_database_url(url_db)
    probar_conexion(url_db)

    print("\n" + "=" * 62)
    if problemas:
        print(f"  {len(problemas)} problema(s) a resolver:")
        for p in problemas:
            print(f"    - {p}")
    if avisos:
        print(f"  {len(avisos)} aviso(s):")
        for a in avisos:
            print(f"    - {a}")
    if not problemas:
        print("  TODO EN ORDEN" + (" (con avisos)" if avisos else ""))
    print("=" * 62 + "\n")
    return 1 if problemas else 0


if __name__ == "__main__":
    sys.exit(main())
