"""Entorno de Alembic para Epic Wallet 2.0.

Dos cosas que este archivo garantiza:

1. **La URL y el esquema vienen del entorno**, nunca de alembic.ini.
   Las variables del shell tienen prioridad sobre .env, así que
   `DB_SCHEMA=public alembic upgrade head` manda sobre lo que diga
   el archivo.

2. **DB_SCHEMA es obligatorio y sin valor por defecto.** Con un solo
   proyecto de Supabase, el esquema es lo único que separa los datos
   reales de los de prueba (02_Documento_Tecnico §4.1.1). Si falta,
   Alembic aborta con un mensaje claro en lugar de asumir uno y
   escribir donde no debe.
"""

from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool, text

RAIZ = Path(__file__).resolve().parent.parent

# --- api/ al path para poder importar los modelos -----------------
sys.path.insert(0, str(RAIZ / "api"))

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# ==================================================================
#  Configuración leída del entorno
# ==================================================================
def cargar_dotenv() -> None:
    """Carga .env SIN pisar lo que ya venga del shell.

    El orden importa: `DB_SCHEMA=public alembic ...` tiene que poder
    sobreescribir el DB_SCHEMA=dev del archivo.

    EPIC_WALLET_IGNORAR_DOTENV=1 saltea la carga. Lo usan los tests
    para poder comprobar que las protecciones de abajo funcionan: sin
    esto, el .env del proyecto siempre define DB_SCHEMA y la
    protección nunca se podría probar.
    """
    if os.getenv("EPIC_WALLET_IGNORAR_DOTENV"):
        return
    archivo = RAIZ / ".env"
    if not archivo.exists():
        return
    for linea in archivo.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, _, valor = linea.partition("=")
        clave = clave.strip()
        if clave not in os.environ:
            os.environ[clave] = valor.strip().strip("\"'")


def abortar(mensaje: str, ayuda: str = "") -> None:
    print(f"\n  ERROR: {mensaje}", file=sys.stderr)
    if ayuda:
        print(f"  {ayuda}\n", file=sys.stderr)
    sys.exit(1)


cargar_dotenv()

URL = os.getenv("DATABASE_URL", "").strip()
if not URL:
    abortar(
        "DATABASE_URL no está definida.",
        "Creá .env a partir de .env.example y completá los valores.",
    )

ES_SQLITE = URL.startswith("sqlite")
ESQUEMA = os.getenv("DB_SCHEMA", "").strip() or None

if not ES_SQLITE and not ESQUEMA:
    abortar(
        "DB_SCHEMA no está definida.",
        "No tiene valor por defecto a propósito: una migración en el esquema "
        "equivocado tocaría los datos reales.\n"
        "  Usá:  DB_SCHEMA=dev alembic upgrade head        (desarrollo)\n"
        "        DB_SCHEMA=public alembic upgrade head     (producción)",
    )

# Coherencia con el entorno declarado: no dejar que desarrollo escriba en producción.
APP_ENV = os.getenv("APP_ENV", "").strip()
if APP_ENV == "development" and ESQUEMA == "public":
    abortar(
        "APP_ENV=development apuntando al esquema 'public'.",
        "Eso escribiría sobre los datos reales. Usá DB_SCHEMA=dev, o poné "
        "APP_ENV=production si de verdad querés migrar producción.",
    )

config.set_main_option("sqlalchemy.url", URL)

# --- metadatos de los modelos -------------------------------------
# Se importan después de fijar el entorno: base.py lee DB_SCHEMA al
# construir la MetaData.
from app.models.base import Base

target_metadata = Base.metadata


# ==================================================================
#  Filtro de objetos
# ==================================================================
def incluir_objeto(objeto, nombre, tipo, reflejado, comparado_con):
    """Decide qué entra en el autogenerate.

    Se ignora todo lo que no viva en nuestro esquema: los esquemas
    internos de Supabase (auth, storage, realtime, vault, extensions)
    no son nuestros y no deben aparecer en una migración.
    """
    if tipo == "table":
        esquema_objeto = getattr(objeto, "schema", None)
        if ESQUEMA and esquema_objeto != ESQUEMA:
            return False
        if objeto.name == "alembic_version":
            return False
    return True


def asegurar_esquema(conexion) -> None:
    """Crea el esquema si falta. Idempotente."""
    if ES_SQLITE or not ESQUEMA:
        return
    existe = conexion.execute(
        text("select 1 from information_schema.schemata where schema_name = :e"),
        {"e": ESQUEMA},
    ).scalar()
    if not existe:
        print(f"  creando el esquema '{ESQUEMA}'…")
        conexion.execute(text(f'create schema "{ESQUEMA}"'))


# ==================================================================
#  Modo offline: genera el SQL sin conectarse
# ==================================================================
def migrar_offline() -> None:
    context.configure(
        url=URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=not ES_SQLITE,
        version_table_schema=ESQUEMA,
        include_object=incluir_objeto,
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ==================================================================
#  Modo online: aplica contra la base
# ==================================================================
def migrar_online() -> None:
    conectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with conectable.connect() as conexion:
        asegurar_esquema(conexion)
        if ESQUEMA and not ES_SQLITE:
            # Que las sentencias sin esquema explícito caigan en el nuestro.
            conexion.execute(text(f'set search_path to "{ESQUEMA}", public'))
        conexion.commit()

        context.configure(
            connection=conexion,
            target_metadata=target_metadata,
            include_schemas=not ES_SQLITE,
            version_table_schema=ESQUEMA,
            include_object=incluir_objeto,
            compare_type=True,
            compare_server_default=True,
            transaction_per_migration=True,
        )
        destino = "SQLite" if ES_SQLITE else f"esquema '{ESQUEMA}'"
        print(f"  migrando sobre {destino}")
        with context.begin_transaction():
            context.run_migrations()
    conectable.dispose()


if context.is_offline_mode():
    migrar_offline()
else:
    migrar_online()
