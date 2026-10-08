"""La tabla `profiles` y su aislamiento entre cuentas · F02-T03.

Esta es la prueba que importa de toda la tarea: **que una cuenta no
pueda ver ni tocar la fila de otra.** Sin RLS, cualquier consulta con
un token válido devolvería todas las filas, y alcanzaría con crear una
cuenta para ver las finanzas de los demás.

No se simula nada. Se corre contra Postgres de verdad, fijando los
claims del token igual que hace Supabase: `auth.uid()` lee
`request.jwt.claims->>'sub'`, así que poniendo ese valor se reproduce
exactamente lo que va a pasar en producción.

Se salta sola si no hay base configurada, para que la suite siga
corriendo en una máquina sin `.env`.
"""

from __future__ import annotations

import os
import re
import uuid
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Engine, text

from tests.api.ayudas_db import escritura, lectura, motor_de_pruebas

RAIZ = Path(__file__).resolve().parents[2]


def _url() -> str | None:
    url = os.getenv("DATABASE_URL", "").strip()
    if url:
        return url
    archivo = RAIZ / ".env"
    if not archivo.exists():
        return None
    m = re.search(r"^DATABASE_URL=(.+)$", archivo.read_text(encoding="utf-8"), re.M)
    return m.group(1).strip() if m else None


def _esquema() -> str:
    valor = os.getenv("DB_SCHEMA", "").strip()
    if valor:
        return valor
    archivo = RAIZ / ".env"
    if archivo.exists():
        m = re.search(r"^DB_SCHEMA=(.+)$", archivo.read_text(encoding="utf-8"), re.M)
        if m:
            return m.group(1).strip()
    return "public"


pytestmark = pytest.mark.api

URL = _url()
ESQUEMA = _esquema()

sin_base = pytest.mark.skipif(
    not URL or URL.startswith("sqlite"),
    reason="hace falta Postgres: RLS no existe en SQLite",
)


@pytest.fixture(scope="module")
def motor() -> Engine:
    assert URL
    return motor_de_pruebas(str(URL))


@pytest.fixture
def dos_usuarios(motor: Engine) -> Iterator[tuple[str, str]]:
    """Dos perfiles de cuentas distintas, y los borra al terminar.

    Se apoyan en usuarios que ya existen en `auth.users`: la clave
    foránea lo exige, y crear usuarios de Supabase desde SQL no es algo
    que haya que hacer desde una prueba.
    """
    with lectura(motor) as con:
        ids = [
            str(f[0])
            for f in con.execute(text("select id from auth.users order by created_at desc limit 2"))
        ]
    if len(ids) < 2:
        pytest.skip("hacen falta dos cuentas en auth.users para probar el aislamiento")

    a, b = ids
    marca = uuid.uuid4().hex[:8]
    with escritura(motor) as con:
        for uid, nombre in ((a, f"rls_a_{marca}"), (b, f"rls_b_{marca}")):
            con.execute(
                text(
                    f'insert into "{ESQUEMA}".profiles (id, username) '
                    "values (:id, :u) on conflict (id) do update set username = :u"
                ),
                {"id": uid, "u": nombre},
            )

    yield a, b

    with escritura(motor) as con:
        con.execute(
            text(f'delete from "{ESQUEMA}".profiles where id = any(:ids)'),
            {"ids": [a, b]},
        )


def _como(con: Any, uid: str) -> None:
    """Deja la conexión hablando como ese usuario.

    Es lo mismo que hace Supabase al propagar el token: el rol pasa a
    `authenticated` y `auth.uid()` lee el `sub` de los claims.
    """
    con.execute(text("set local role authenticated"))
    con.execute(
        text("select set_config('request.jwt.claims', :c, true)"),
        {"c": f'{{"sub":"{uid}","role":"authenticated"}}'},
    )


# ------------------------------------------------- la tabla quedó bien


@sin_base
def test_la_tabla_existe_con_sus_columnas(motor: Engine) -> None:
    with lectura(motor) as con:
        columnas = {
            f[0]: f[1]
            for f in con.execute(
                text(
                    "select column_name, data_type from information_schema.columns "
                    "where table_schema = :e and table_name = 'profiles'"
                ),
                {"e": ESQUEMA},
            )
        }
    esperadas = {
        "id",
        "username",
        "display_name",
        "opening_balance",
        "timezone",
        "active",
        "created_at",
        "updated_at",
        "last_login_at",
    }
    assert esperadas <= set(columnas), f"faltan columnas: {esperadas - set(columnas)}"
    assert columnas["opening_balance"] == "numeric", (
        "el saldo tiene que ser numeric: con float, los centavos se redondean mal"
    )


@sin_base
def test_borrar_la_cuenta_se_lleva_el_perfil(motor: Engine) -> None:
    """La cascada es lo que evita filas huérfanas apuntando a un usuario
    que ya no existe."""
    with lectura(motor) as con:
        regla = con.execute(
            text(
                "select rc.delete_rule from information_schema.referential_constraints rc "
                "join information_schema.table_constraints tc "
                "  on tc.constraint_name = rc.constraint_name "
                "where tc.table_schema = :e and tc.table_name = 'profiles'"
            ),
            {"e": ESQUEMA},
        ).scalar()
    assert regla == "CASCADE"


# --------------------------------------------- el aislamiento entre cuentas


@sin_base
def test_cada_cuenta_ve_solo_su_perfil(motor: Engine, dos_usuarios: tuple[str, str]) -> None:
    """Criterio de aceptación de la tarea."""
    a, b = dos_usuarios

    with escritura(motor) as con:
        _como(con, a)
        filas = [str(f[0]) for f in con.execute(text(f'select id from "{ESQUEMA}".profiles'))]

    assert filas == [a], (
        f"con el token de {a} se ven {len(filas)} filas: {filas}. RLS no está filtrando."
    )
    assert b not in filas


@sin_base
def test_una_cuenta_no_puede_tocar_el_perfil_de_otra(
    motor: Engine, dos_usuarios: tuple[str, str]
) -> None:
    """Ver no alcanza: también hay que impedir escribir.

    Una política que sólo filtrara lecturas dejaría que alguien
    cambiara el saldo inicial de otra persona.
    """
    a, b = dos_usuarios

    with escritura(motor) as con:
        _como(con, a)
        resultado = con.execute(
            text(f'update "{ESQUEMA}".profiles set display_name = :n where id = :id'),
            {"n": "intruso", "id": b},
        )
        assert resultado.rowcount == 0, "pudo modificar el perfil de otra cuenta"

    # Y la fila de B quedó intacta.
    with lectura(motor) as con:
        nombre = con.execute(
            text(f'select display_name from "{ESQUEMA}".profiles where id = :id'),
            {"id": b},
        ).scalar()
    assert nombre != "intruso"


@sin_base
def test_una_cuenta_no_puede_crear_un_perfil_ajeno(
    motor: Engine, dos_usuarios: tuple[str, str]
) -> None:
    """El `with check` de la política. Sin él, se podría insertar una
    fila con el id de otro y después leerla como propia."""
    a, _b = dos_usuarios
    ajeno = str(uuid.uuid4())

    with escritura(motor) as con:
        _como(con, a)
        with pytest.raises(Exception) as caso:
            con.execute(
                text(f'insert into "{ESQUEMA}".profiles (id, username) values (:id, :u)'),
                {"id": ajeno, "u": "ajeno"},
            )
        assert "policy" in str(caso.value).lower() or "violates" in str(caso.value).lower()


@sin_base
def test_sin_token_no_se_ve_nada(motor: Engine, dos_usuarios: tuple[str, str]) -> None:
    """Una conexión autenticada sin `sub` no es nadie: no tiene que ver
    ninguna fila, en lugar de verlas todas."""
    with escritura(motor) as con:
        con.execute(text("set local role authenticated"))
        con.execute(text("select set_config('request.jwt.claims', :c, true)"), {"c": "{}"})
        filas = con.execute(text(f'select count(*) from "{ESQUEMA}".profiles')).scalar()

    assert filas == 0


# ------------------------------------- la protección está realmente activa


@sin_base
def test_rls_esta_activo_y_es_obligatorio(motor: Engine) -> None:
    """`enable` no alcanza: sin `force`, el dueño de la tabla se saltea
    la política y el aislamiento pasa a depender de con qué rol se
    conecte la aplicación."""
    with lectura(motor) as con:
        fila = con.execute(
            text(
                "select relrowsecurity, relforcerowsecurity from pg_class c "
                "join pg_namespace n on n.oid = c.relnamespace "
                "where n.nspname = :e and c.relname = 'profiles'"
            ),
            {"e": ESQUEMA},
        ).one()
    assert fila[0] is True, "RLS no está habilitado"
    assert fila[1] is True, "RLS no es obligatorio para el dueño de la tabla"


@sin_base
def test_la_politica_se_llama_own_profile_y_cubre_todo(motor: Engine) -> None:
    with lectura(motor) as con:
        filas = list(
            con.execute(
                text(
                    "select policyname, cmd from pg_policies where schemaname = :e and tablename = 'profiles'"
                ),
                {"e": ESQUEMA},
            )
        )
    nombres = {f[0] for f in filas}
    assert "own_profile" in nombres, f"políticas encontradas: {nombres}"
    assert any(f[1] == "ALL" for f in filas), (
        "la política tiene que cubrir las cuatro operaciones, no sólo select"
    )


# ------------------------------------------------- el trigger de updated_at


@sin_base
def test_updated_at_se_actualiza_solo(motor: Engine, dos_usuarios: tuple[str, str]) -> None:
    """Va en la base y no en la aplicación: así también cambia cuando
    una fila se toca desde SQL o desde el panel de Supabase."""
    a, _ = dos_usuarios

    with lectura(motor) as con:
        antes = con.execute(
            text(f'select updated_at from "{ESQUEMA}".profiles where id = :id'),
            {"id": a},
        ).scalar()

    with escritura(motor) as con:
        con.execute(
            text(f'update "{ESQUEMA}".profiles set display_name = :n where id = :id'),
            {"n": "cambiado", "id": a},
        )

    with lectura(motor) as con:
        despues = con.execute(
            text(f'select updated_at from "{ESQUEMA}".profiles where id = :id'),
            {"id": a},
        ).scalar()

    assert despues > antes, "updated_at no se movió al modificar la fila"


@sin_base
def test_la_funcion_del_trigger_no_hereda_el_search_path(motor: Engine) -> None:
    """Es `security definer`: corre con los permisos de quien la creó.

    Sin `search_path = ''`, quien pueda crear una tabla en un esquema
    que esté antes en el camino de búsqueda podría hacer que la función
    llame a SU código con esos permisos.
    """
    with lectura(motor) as con:
        config = con.execute(
            text(
                "select proconfig from pg_proc p join pg_namespace n "
                "on n.oid = p.pronamespace "
                "where n.nspname = :e and p.proname = 'tocar_updated_at'"
            ),
            {"e": ESQUEMA},
        ).scalar()
    assert config and any("search_path=" in c for c in config), (
        f"la función no fija search_path: {config}"
    )
