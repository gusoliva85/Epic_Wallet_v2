"""`dev` y `public` tienen que ser el mismo esquema · F02-T16.

Los dos viven en el mismo proyecto de Supabase y lo único que los
separa es el nombre. Eso los hace fáciles de mantener iguales y también
fáciles de desincronizar sin que nadie se entere: una migración que
corrió en `dev` y se olvidó en `public` no da ningún error hasta que un
usuario real toca la función que la necesita.

Esta prueba es el criterio de aceptación de F02-T16 puesto a correr en
cada suite, y vale para todas las migraciones que vengan: desde acá, si
alguien migra desarrollo y se olvida de producción, la suite se pone
roja antes del despliegue y no después.
"""

from __future__ import annotations

import importlib.util
import os
import re
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import Engine, text

from .ayudas_db import motor_de_pruebas

RAIZ = Path(__file__).resolve().parents[2]


def _del_env(clave: str) -> str | None:
    valor = os.getenv(clave, "").strip()
    if valor:
        return valor
    archivo = RAIZ / ".env"
    if not archivo.exists():
        return None
    m = re.search(rf"^{clave}=(.+)$", archivo.read_text(encoding="utf-8"), re.M)
    return m.group(1).strip() if m else None


URL_BASE = _del_env("DATABASE_URL")

pytestmark = [
    pytest.mark.api,
    pytest.mark.skipif(
        not URL_BASE or str(URL_BASE).startswith("sqlite"),
        reason="hace falta Postgres: con SQLite no hay dos esquemas que comparar",
    ),
]


@pytest.fixture(scope="module")
def motor() -> Engine:
    assert URL_BASE
    return motor_de_pruebas(str(URL_BASE))


def _comparador() -> Any:
    """Carga `scripts/comparar_esquemas.py`.

    Es un script y no un módulo del paquete, así que se importa por
    ruta. Se hace a propósito en vez de duplicar las consultas acá: si
    estuvieran en dos lados, la prueba podría pasar mientras el script
    que se usa en el despliegue mira otra cosa.
    """
    ruta = RAIZ / "scripts" / "comparar_esquemas.py"
    spec = importlib.util.spec_from_file_location("comparar_esquemas", ruta)
    assert spec and spec.loader
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


@pytest.fixture(scope="module")
def comparador() -> Any:
    return _comparador()


# ------------------------------------------------- lo que compara


def test_el_comparador_mira_lo_que_tiene_que_mirar(comparador: Any) -> None:
    """Un comparador al que le falta un grupo da «son iguales» igual.

    Los dos que más callan cuando faltan son los permisos y el `force`
    de RLS: una tabla sin `grant` existe y rechaza todo, y RLS con
    `enable` pero sin `force` deja pasar al dueño, así que la política
    parece estar y no filtra nada.
    """
    grupos = comparador.CONSULTAS
    for imprescindible in (
        "tablas",
        "columnas",
        "rls",
        "politicas",
        "permisos",
        "indices",
        "restricciones",
        "funciones",
        "triggers_en_auth_users",
    ):
        assert imprescindible in grupos, f"el comparador dejó de mirar {imprescindible}"

    assert "relforcerowsecurity" in grupos["rls"], (
        "la consulta de RLS no mira `force`, que es la mitad que importa"
    )
    assert "authenticated" in grupos["permisos"], (
        "la consulta de permisos no mira el rol `authenticated`"
    )


def test_normaliza_el_nombre_del_esquema(comparador: Any) -> None:
    """Sin esto los dos esquemas nunca darían iguales aunque lo fueran.

    La parte que costó entender: Postgres sólo escribe el esquema
    cuando **no** está en el `search_path`. `public` sí está, así que la
    misma clave foránea se imprime calificada en `dev` y sin calificar
    en `public`. Por eso no alcanza con reemplazar el nombre por una
    marca —en `public` no hay nada que reemplazar—: hay que sacar la
    calificación de los dos lados.
    """
    # La misma clave foránea, como la imprime cada esquema.
    assert comparador.normalizar(
        ["FOREIGN KEY (user_id) REFERENCES dev.profiles(id)"], "dev"
    ) == comparador.normalizar(["FOREIGN KEY (user_id) REFERENCES profiles(id)"], "public")

    # El mismo trigger, que lleva el esquema en el nombre.
    assert comparador.normalizar(["al_crear_usuario_dev"], "dev") == comparador.normalizar(
        ["al_crear_usuario_public"], "public"
    )

    assert comparador.normalizar(['create policy p on "dev".profiles'], "dev") == [
        "create policy p on profiles"
    ]

    # Un esquema ajeno sigue apareciendo con su nombre: si algún día una
    # referencia apunta afuera, queremos verla.
    assert comparador.normalizar(["REFERENCES auth.users(id)"], "dev") == [
        "REFERENCES auth.users(id)"
    ]


# ------------------------------------------------- la paridad


def test_los_dos_esquemas_estan_en_la_misma_revision(comparador: Any, motor: Engine) -> None:
    """Criterio de aceptación: `public` y `dev` en la misma revisión."""
    with motor.connect() as con:
        rev_dev = comparador.revision(con, "dev")
        rev_public = comparador.revision(con, "public")

    assert rev_public != "(sin alembic_version)", (
        "producción nunca se migró. Correr:  "
        "DB_SCHEMA=public APP_ENV=production alembic upgrade head"
    )
    assert rev_dev == rev_public, (
        f"dev está en {rev_dev} y public en {rev_public}. Migrar el que falte "
        "ANTES de publicar: el código nuevo espera tablas que el viejo no usa."
    )


def test_los_dos_esquemas_son_identicos(comparador: Any, motor: Engine) -> None:
    """Criterio de aceptación: RLS y los permisos de `authenticated` son
    iguales en los dos.

    Se comparan todos los grupos y no sólo esos dos: un comparador que
    ya está escrito no cuesta más, y la diferencia que va a aparecer
    algún día es justo la que no se nos ocurrió mirar.
    """
    problemas = []
    with motor.connect() as con:
        for nombre, sql in comparador.CONSULTAS.items():
            en_dev = comparador.consultar(con, "dev", sql)
            en_public = comparador.consultar(con, "public", sql)
            for fila in en_dev:
                if fila not in en_public:
                    problemas.append(f"{nombre}: sólo en dev · {fila}")
            for fila in en_public:
                if fila not in en_dev:
                    problemas.append(f"{nombre}: sólo en public · {fila}")

    assert not problemas, "los esquemas difieren:\n  " + "\n  ".join(problemas)


def test_rechaza_un_nombre_de_esquema_que_no_lo_es(comparador: Any) -> None:
    """El nombre del esquema se pega en la consulta porque un
    identificador no se puede parametrizar. Entonces se valida."""
    for nombre in ('public"; drop table profiles; --', "dev public", "", "Dev-1"):
        with pytest.raises(ValueError):
            comparador.esquema_valido(nombre)

    for nombre in ("dev", "public", "staging_2"):
        assert comparador.esquema_valido(nombre) == nombre


# ------------------------------------------------- `anon` no entra


@pytest.mark.parametrize("esquema", ["dev", "public"])
def test_anon_no_tiene_ningun_permiso(motor: Engine, esquema: str) -> None:
    """`anon` es el rol de la clave anónima, la que viaja en el paquete
    del navegador: la conoce cualquiera que abra la aplicación.

    Esto nació de un problema real. Supabase trae
    `alter default privileges in schema public grant all on tables to
    anon`, así que cada tabla que creábamos en producción nacía con
    todos los permisos para `anon`. En `profiles` y `categories` RLS lo
    tapaba, pero `alembic_version` no tiene RLS y `anon` podía borrarle
    la revisión de migraciones.

    No se vio hasta tener los dos esquemas para comparar, porque en
    `dev` no pasaba: ese esquema lo creamos nosotros y los privilegios
    por defecto son por esquema.
    """
    with motor.connect() as con:
        tablas = con.execute(
            text("""
                select table_name, privilege_type
                from information_schema.role_table_grants
                where table_schema = :e and grantee = 'anon'
                order by table_name, privilege_type
            """),
            {"e": esquema},
        ).all()
        secuencias = con.execute(
            text("""
                select c.relname, p.privilegio
                from pg_class c
                join pg_namespace n on n.oid = c.relnamespace
                cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) as p(privilegio)
                where n.nspname = :e and c.relkind = 'S'
                  and has_sequence_privilege('anon', c.oid, p.privilegio)
            """),
            {"e": esquema},
        ).all()
        # Sólo los que definió `postgres`. Los privilegios por defecto
        # son del rol que CREA el objeto, y nuestras tablas las crea
        # `postgres`: las migraciones se conectan con ese usuario.
        # `supabase_admin` tiene su propio juego en `public`, no es
        # nuestro rol y no lo podemos cambiar; sólo aplicaría a objetos
        # que él creara, y no crea ninguno nuestro.
        por_defecto = con.execute(
            text("""
                select d.defaclobjtype::text, e.privilege_type
                from pg_default_acl d
                join pg_namespace n on n.oid = d.defaclnamespace
                cross join aclexplode(d.defaclacl) e
                where n.nspname = :e
                  and pg_get_userbyid(d.defaclrole) = 'postgres'
                  and pg_get_userbyid(e.grantee) = 'anon'
            """),
            {"e": esquema},
        ).all()

    assert not tablas, f"`anon` tiene permisos en {esquema}: {tablas}"
    assert not secuencias, f"`anon` tiene permisos de secuencia en {esquema}: {secuencias}"
    assert not por_defecto, (
        f"en {esquema} las tablas nuevas van a nacer con permisos para `anon`: "
        f"{por_defecto}. Es la causa raíz, no el síntoma."
    )


def test_authenticated_tiene_lo_justo(motor: Engine) -> None:
    """Cuatro permisos sobre las dos tablas de datos, y nada sobre
    `alembic_version`.

    `TRUNCATE` es el que más importa de los que sobran: **RLS no lo
    filtra.** Una política que limita por `auth.uid()` no impide un
    `truncate`, que borra la tabla entera sin mirar ninguna fila.
    """
    esperado = {
        ("profiles", "SELECT"),
        ("profiles", "INSERT"),
        ("profiles", "UPDATE"),
        ("profiles", "DELETE"),
        ("categories", "SELECT"),
        ("categories", "INSERT"),
        ("categories", "UPDATE"),
        ("categories", "DELETE"),
    }
    for esquema in ("dev", "public"):
        with motor.connect() as con:
            tiene = set(
                con.execute(
                    text("""
                        select table_name, privilege_type
                        from information_schema.role_table_grants
                        where table_schema = :e and grantee = 'authenticated'
                    """),
                    {"e": esquema},
                ).all()
            )
        assert tiene == esperado, (
            f"en {esquema}, `authenticated` tiene {sorted(tiene - esperado)} de más "
            f"y {sorted(esperado - tiene)} de menos"
        )
