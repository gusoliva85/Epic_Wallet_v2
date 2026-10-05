"""Propagación del token a Postgres · F02-T05.

Sin esto, las políticas de RLS **no filtran nada**. La aplicación se
conecta como `postgres`, que tiene `bypassrls`: con ese rol, Postgres
ignora las políticas y una consulta sin filtro devuelve las filas de
todos los usuarios. Las barreras que se escribieron en F02-T03 y T04
recién empiezan a valer cuando la sesión cambia de rol y declara de
quién es.

Y el estado tiene que ser **por transacción**. El pooler está en modo
transacción (puerto 6543): la misma conexión física atiende peticiones
de usuarios distintos una detrás de otra. Con un `set` de sesión en
lugar de `set local`, el usuario de una petición quedaría activo para
la siguiente — una filtración de datos entre cuentas, y de las que no
se notan hasta que es tarde.
"""

from __future__ import annotations

import os
import re
import uuid
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import text

from tests.api.ayudas_db import escritura, lectura

RAIZ = Path(__file__).resolve().parents[2]
pytestmark = pytest.mark.api


def _del_env(clave: str) -> str | None:
    valor = os.getenv(clave, "").strip()
    if valor:
        return valor
    archivo = RAIZ / ".env"
    if not archivo.exists():
        return None
    m = re.search(rf"^{clave}=(.+)$", archivo.read_text(encoding="utf-8"), re.M)
    return m.group(1).strip() if m else None


URL = _del_env("DATABASE_URL")
ESQUEMA = os.getenv("DB_SCHEMA", "dev").strip() or "dev"

sin_base = pytest.mark.skipif(
    not URL or str(URL).startswith("sqlite"),
    reason="hace falta Postgres: RLS no existe en SQLite",
)


@pytest.fixture(scope="module")
def db():
    from api.app.core import db as modulo

    return modulo


@pytest.fixture
def dos_perfiles(db) -> Iterator[tuple[str, str]]:
    """Dos perfiles de cuentas distintas, con una categoría propia cada
    una para poder comprobar que no se cruzan."""
    with lectura(db.motor) as con:
        ids = [
            str(f[0])
            for f in con.execute(text("select id from auth.users order by created_at desc limit 2"))
        ]
    if len(ids) < 2:
        pytest.skip("hacen falta dos cuentas en auth.users")

    a, b = ids
    marca = uuid.uuid4().hex[:8]
    with escritura(db.motor) as con:
        for uid, nombre in ((a, f"ses_a_{marca}"), (b, f"ses_b_{marca}")):
            con.execute(
                text(
                    f'insert into "{ESQUEMA}".profiles (id, username) '
                    "values (:id, :u) on conflict (id) do update set username = :u"
                ),
                {"id": uid, "u": nombre},
            )
            con.execute(
                text(
                    f'insert into "{ESQUEMA}".categories (user_id, name, type, sort_order) '
                    "values (:id, :n, 'expense', 999) "
                    "on conflict (user_id, type, name) do nothing"
                ),
                {"id": uid, "n": f"marca_{marca}_{nombre}"},
            )

    yield a, b

    with escritura(db.motor) as con:
        con.execute(
            text(f'delete from "{ESQUEMA}".categories where user_id = any(:ids)'),
            {"ids": [a, b]},
        )
        con.execute(
            text(f'delete from "{ESQUEMA}".profiles where id = any(:ids)'),
            {"ids": [a, b]},
        )


# ------------------------------------ sin propagar, RLS no filtra nada


@sin_base
def test_sin_propagar_el_token_rls_no_filtra(db, dos_perfiles) -> None:
    """Esta prueba documenta el agujero que la tarea cierra.

    Es la sesión «normal», la que no sabe de quién es: devuelve las
    filas de TODOS. No es un fallo de las políticas —están bien— sino
    de que el rol de la conexión las saltea.
    """
    a, b = dos_perfiles
    with db.sesion_manual() as sesion:
        vistos = {str(f[0]) for f in sesion.execute(text(f'select id from "{ESQUEMA}".profiles'))}

    assert a in vistos and b in vistos, (
        "la conexión de la aplicación tendría que ver todo sin propagar el "
        "token; si acá ya filtra, esta prueba dejó de probar lo que dice"
    )


@sin_base
def test_la_conexion_de_la_aplicacion_saltea_rls(db) -> None:
    """El motivo de lo anterior, dicho por la base."""
    with lectura(db.motor) as con:
        bypass = con.execute(
            text("select rolbypassrls from pg_roles where rolname = current_user")
        ).scalar()
    assert bypass is True, (
        "si el rol dejara de tener bypassrls, la explicación de esta tarea "
        "cambia y conviene revisarla"
    )


# --------------------------------------- con el token, filtra sola


@sin_base
def test_una_consulta_sin_filtro_devuelve_solo_lo_del_usuario(db, dos_perfiles) -> None:
    """Criterio de aceptación.

    La consulta no lleva `where user_id = ...`: el filtro lo pone la
    base. Es lo que hace que un olvido en un endpoint no se convierta
    en una filtración.
    """
    a, b = dos_perfiles

    with db.sesion_de_usuario(a) as sesion:
        perfiles = {str(f[0]) for f in sesion.execute(text(f'select id from "{ESQUEMA}".profiles'))}
        categorias = {
            str(f[0]) for f in sesion.execute(text(f'select user_id from "{ESQUEMA}".categories'))
        }

    assert perfiles == {a}, f"vio perfiles de más: {perfiles}"
    assert categorias <= {a}, f"vio categorías de otra cuenta: {categorias}"
    assert b not in perfiles


@sin_base
def test_tampoco_puede_escribir_en_lo_ajeno(db, dos_perfiles) -> None:
    a, b = dos_perfiles

    with db.sesion_de_usuario(a) as sesion:
        resultado = sesion.execute(
            text(f'update "{ESQUEMA}".profiles set display_name = :n where id = :id'),
            {"n": "intruso", "id": b},
        )
        assert resultado.rowcount == 0

    with lectura(db.motor) as con:
        nombre = con.execute(
            text(f'select display_name from "{ESQUEMA}".profiles where id = :id'),
            {"id": b},
        ).scalar()
    assert nombre != "intruso"


# ----------------------------- dos peticiones seguidas no se contaminan


@sin_base
def test_dos_usuarios_seguidos_no_se_contaminan(db, dos_perfiles) -> None:
    """Criterio de aceptación, y el que importa por el pooler.

    Se hacen las dos consultas una detrás de otra, como harían dos
    peticiones seguidas. Con un `set` de sesión en vez de `set local`,
    la segunda vería lo de la primera.
    """
    a, b = dos_perfiles

    with db.sesion_de_usuario(a) as sesion:
        primero = {str(f[0]) for f in sesion.execute(text(f'select id from "{ESQUEMA}".profiles'))}
    with db.sesion_de_usuario(b) as sesion:
        segundo = {str(f[0]) for f in sesion.execute(text(f'select id from "{ESQUEMA}".profiles'))}

    assert primero == {a}
    assert segundo == {b}, f"la segunda petición vio lo de la primera: {segundo}"


@sin_base
def test_el_estado_no_sobrevive_a_la_transaccion(db, dos_perfiles) -> None:
    """Lo mismo, mirado desde adentro: después de cerrar, la conexión
    vuelve a ser la de la aplicación y no la del usuario."""
    a, _ = dos_perfiles

    with db.sesion_de_usuario(a) as sesion:
        rol_adentro = sesion.execute(text("select current_user")).scalar()
        claims_adentro = sesion.execute(
            text("select current_setting('request.jwt.claims', true)")
        ).scalar()

    with db.sesion_manual() as sesion:
        rol_despues = sesion.execute(text("select current_user")).scalar()
        claims_despues = sesion.execute(
            text("select current_setting('request.jwt.claims', true)")
        ).scalar()

    assert rol_adentro == "authenticated"
    assert claims_adentro and a in claims_adentro
    assert rol_despues != "authenticated", "el rol quedó pegado a la conexión"
    assert not claims_despues, f"los claims sobrevivieron: {claims_despues}"


@sin_base
def test_si_algo_falla_tampoco_queda_el_estado(db, dos_perfiles) -> None:
    """El `rollback` también descarta los `set local`. Si no, una
    petición que falla dejaría su usuario activo para la siguiente."""
    a, _ = dos_perfiles

    with pytest.raises(Exception), db.sesion_de_usuario(a) as sesion:  # noqa: B017
        sesion.execute(text("select 1/0"))

    with db.sesion_manual() as sesion:
        claims = sesion.execute(text("select current_setting('request.jwt.claims', true)")).scalar()
    assert not claims


# --------------------------------------------------- lo que no se acepta


@sin_base
@pytest.mark.parametrize(
    "malo",
    ["", "   ", "no-es-un-uuid", "'; drop table profiles; --", "1 or 1=1"],
)
def test_un_identificador_que_no_es_uuid_se_rechaza(db, malo: str) -> None:
    """El valor entra en la configuración de la sesión de Postgres.
    Conviene que falle acá y no adentro de la base."""
    with pytest.raises(ValueError, match="inválido"), db.sesion_de_usuario(malo):
        pass


@sin_base
def test_el_rol_y_los_claims_van_como_local(db) -> None:
    """Se comprueba leyendo el código, y es a propósito: la diferencia
    entre `set` y `set local` no se nota en una prueba contra una sola
    conexión, pero es la que decide si hay filtración entre peticiones.
    """
    fuente = (RAIZ / "api" / "app" / "core" / "db.py").read_text(encoding="utf-8")
    cuerpo = fuente[fuente.index("def activar_usuario") :]
    cuerpo = cuerpo[: cuerpo.index("@contextmanager")]

    assert "set local role" in cuerpo, "el rol tiene que ser LOCAL a la transacción"
    # El tercer argumento `true` de set_config es lo que lo hace local.
    assert "'request.jwt.claims', :claims, true" in cuerpo, (
        "los claims tienen que ser locales a la transacción"
    )
