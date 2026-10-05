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
from typing import Annotated

from fastapi import Depends
from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker

from .config import settings
from .security import UsuarioActual

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
            # SIN sentencias preparadas. psycopg3 prepara sola una
            # consulta después de unas cuantas repeticiones, y la
            # sentencia queda guardada en la conexión DEL SERVIDOR. Con
            # el pooler en modo transacción, esa conexión se le entrega
            # después a otro cliente que no sabe que existe: la próxima
            # vez que se prepare el mismo nombre, Postgres responde
            # «prepared statement "_pg3_0" already exists» y la
            # petición falla.
            #
            # No es teórico: apareció en esta tarea, en cuanto las
            # pruebas repitieron las mismas consultas. En producción
            # habría aparecido sola con el uso, de forma intermitente y
            # muy difícil de atribuir.
            "prepare_threshold": None,
        }
    return create_engine(settings.DATABASE_URL, **opciones)


motor = crear_motor()

if settings.esquema and not settings.es_sqlite:

    @event.listens_for(motor, "connect", insert=True)
    def _preparar_conexion(dbapi_conn, _registro) -> None:
        """Cada conexión nueva arranca limpia y apuntando a nuestro esquema.

        El `reset role` no es paranoia: el pooler está en modo
        transacción y reparte las conexiones del servidor entre
        clientes. Si alguien —nosotros con un error, otro cliente, un
        script de mantenimiento— deja un `set role` de sesión puesto,
        esa conexión vuelve al pool con el rol cambiado y se la entrega
        a quien siga.

        Pasó de verdad: una prueba de mutación de F02-T05 cambió
        `set local role` por `set role` para comprobar que la diferencia
        importa, y dejó TODAS las conexiones del proyecto como
        `authenticated` hasta que se limpiaron a mano. Con esta línea,
        eso se corrige solo.
        """
        with dbapi_conn.cursor() as cur:
            cur.execute("reset role")
            cur.execute(f'set search_path to "{settings.esquema}", public')


FabricaDeSesiones = sessionmaker(bind=motor, autoflush=False, expire_on_commit=False)


def _limpiar_rol(sesion: Session) -> None:
    """Deja la transacción con el rol de la aplicación.

    Hace falta además del `reset role` de la conexión: el pooler asigna
    la conexión del servidor **por transacción**, así que la que
    atiende esta transacción puede no ser la misma que se limpió al
    conectarse.
    """
    sesion.execute(text("reset role"))


def get_session() -> Iterator[Session]:
    """Dependencia de FastAPI. Cierra siempre, revierte si hubo error."""
    sesion = FabricaDeSesiones()
    try:
        _limpiar_rol(sesion)
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
        _limpiar_rol(sesion)
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


# ============================================================
# Sesión a nombre del usuario · F02-T05
# Referencia: 02_Documento_Tecnico.md §6.5 y §8.7
# ============================================================

ROL_DE_USUARIO = "authenticated"


def _usuario_valido(user_id: str) -> str:
    """Comprueba que el identificador sea un uuid antes de usarlo.

    Viene de un token ya verificado, así que en la práctica siempre lo
    es. Se comprueba igual porque el valor entra en la configuración de
    la sesión de Postgres: si alguna vez llegara otra cosa, conviene
    que falle acá y no adentro de la base.
    """
    import uuid as _uuid

    try:
        return str(_uuid.UUID(user_id))
    except (ValueError, AttributeError, TypeError) as exc:
        raise ValueError(f"identificador de usuario inválido: {user_id!r}") from exc


def activar_usuario(sesion: Session, user_id: str) -> None:
    """Deja la transacción hablando a nombre de ese usuario.

    Dos cosas, y las dos son necesarias:

    1. **Cambiar de rol.** La aplicación se conecta como `postgres`,
       que tiene `bypassrls`: con ese rol, RLS **no se aplica** y una
       consulta sin filtro devuelve las filas de todos. Las políticas
       no sirven de nada hasta que se cambia a `authenticated`.

    2. **Fijar los claims.** `auth.uid()` lee `request.jwt.claims`.
       Sin eso, el rol `authenticated` no es nadie y, con las políticas
       puestas, no ve ninguna fila.

    Las dos van como **LOCAL**, o sea atadas a la transacción. No es un
    detalle: el pooler está en modo transacción, así que la misma
    conexión física atiende peticiones de usuarios distintos una detrás
    de otra. Con un `set` de sesión, el usuario de una petición quedaría
    activo para la siguiente — una filtración de datos entre cuentas.
    Al terminar la transacción, Postgres los descarta solo.
    """
    uid = _usuario_valido(user_id)

    # `set role` no admite parámetros, pero el valor es una constante
    # nuestra, no entra nada de afuera.
    sesion.execute(text(f"set local role {ROL_DE_USUARIO}"))

    # El uid sí va como parámetro. Se arma con json.dumps y no
    # concatenando, para que no haya forma de cerrar la cadena.
    import json

    sesion.execute(
        text("select set_config('request.jwt.claims', :claims, true)"),
        {"claims": json.dumps({"sub": uid, "role": ROL_DE_USUARIO})},
    )


@contextmanager
def sesion_de_usuario(user_id: str) -> Iterator[Session]:
    """Sesión donde RLS filtra sola por el usuario del token.

    Dentro de esto, una consulta sin `where user_id = ...` devuelve
    solamente las filas de ese usuario. El filtro del endpoint pasa a
    ser una comodidad; la barrera es la base.
    """
    sesion = FabricaDeSesiones()
    try:
        _limpiar_rol(sesion)
        activar_usuario(sesion, user_id)
        yield sesion
        sesion.commit()
    except Exception:
        sesion.rollback()
        raise
    finally:
        sesion.close()


def get_user_session(user_id: UsuarioActual) -> Iterator[Session]:
    """Dependencia de FastAPI:

        def endpoint(sesion: SesionDeUsuario) -> ...

    El `user_id` lo resuelve `current_user_id`, que verifica el token.
    Nada llega acá sin una sesión válida: pedir esta dependencia es
    pedir autenticación.
    """
    with sesion_de_usuario(user_id) as sesion:
        yield sesion


SesionDeUsuario = Annotated[Session, Depends(get_user_session)]
