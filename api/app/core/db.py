"""Motor y sesiones de SQLAlchemy.

Dos decisiones que importan en serverless:

1. **`NullPool`**: cada invocación de la función de Vercel es un
   proceso que puede morir en cualquier momento. Mantener un pool
   propio sólo acumularía conexiones muertas contra el pooler de
   Supabase, que ya hace de pool del lado del servidor.

2. **`search_path` por sesión**: fija el esquema de `DB_SCHEMA`, así
   las consultas sin esquema explícito caen donde deben
   (02_Documento_Tecnico §4.1.1).
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from .config import settings

log = logging.getLogger("epic_wallet")


def crear_motor() -> Engine:
    opciones: dict[str, object] = {
        "pool_pre_ping": True,
        "echo": settings.LOG_LEVEL == "DEBUG",
    }
    if not settings.es_sqlite:
        from sqlalchemy.pool import NullPool

        opciones["poolclass"] = NullPool
        opciones["connect_args"] = {
            "connect_timeout": 10,
            # Identifica las conexiones en el panel de Supabase.
            "application_name": f"epic-wallet-{settings.APP_ENV}",
        }
    return create_engine(settings.DATABASE_URL, **opciones)


motor = crear_motor()

if settings.esquema and not settings.es_sqlite:

    @event.listens_for(motor, "connect", insert=True)
    def _fijar_search_path(dbapi_conn, _registro) -> None:
        """Cada conexión nueva arranca apuntando a nuestro esquema."""
        with dbapi_conn.cursor() as cur:
            cur.execute(f'set search_path to "{settings.esquema}", public')


FabricaDeSesiones = sessionmaker(bind=motor, autoflush=False, expire_on_commit=False)


def get_session() -> Iterator[Session]:
    """Dependencia de FastAPI. Cierra siempre, revierte si hubo error."""
    sesion = FabricaDeSesiones()
    try:
        yield sesion
        sesion.commit()
    except Exception:
        sesion.rollback()
        raise
    finally:
        sesion.close()


@contextmanager
def sesion_manual() -> Iterator[Session]:
    """Para scripts y tareas fuera del ciclo de una petición."""
    sesion = FabricaDeSesiones()
    try:
        yield sesion
        sesion.commit()
    except Exception:
        sesion.rollback()
        raise
    finally:
        sesion.close()


def revisar_conexion() -> dict[str, object]:
    """Comprueba la base para `/api/health`. No lanza excepciones.

    Devuelve siempre un diccionario: que la base esté caída no debe
    tumbar el endpoint de salud, que es justamente el que sirve para
    enterarse.
    """
    import time

    inicio = time.perf_counter()
    try:
        with motor.connect() as conexion:
            conexion.execute(text("select 1"))
            esquema_ok: bool | None = None
            if settings.esquema and not settings.es_sqlite:
                esquema_ok = bool(
                    conexion.execute(
                        text("select 1 from information_schema.schemata where schema_name = :e"),
                        {"e": settings.esquema},
                    ).scalar()
                )
        return {
            "status": "connected",
            "latency_ms": round((time.perf_counter() - inicio) * 1000, 1),
            "schema_exists": esquema_ok,
        }
    except Exception as exc:
        log.warning("la base no responde: %s", exc)
        return {
            "status": "error",
            "latency_ms": round((time.perf_counter() - inicio) * 1000, 1),
            # Tipo de error, no el mensaje: puede traer host y usuario.
            "reason": type(exc).__name__,
        }
