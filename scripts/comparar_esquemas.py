"""Compara dos esquemas y dice en qué se diferencian.

    python scripts/comparar_esquemas.py            # dev contra public
    python scripts/comparar_esquemas.py dev public

Para qué: `dev` y `public` viven en el mismo proyecto de Supabase y lo
único que los separa es el nombre del esquema. Eso los hace fáciles de
mantener iguales y también fáciles de desincronizar sin que nadie se
entere: una migración que corrió en `dev` y se olvidó en `public` no da
ningún error hasta que un usuario real toca la función que la necesita.

Y lo que más calla cuando falta no son las tablas —eso se nota
enseguida— sino los permisos. Una tabla sin `grant` a `authenticated`
existe, se ve en el panel de Supabase y rechaza todo. Las políticas de
RLS son peor todavía: `enable` sin `force` deja pasar al dueño de la
tabla, así que la política parece estar y no filtra nada.

Compara: revisión de Alembic · tablas y columnas · RLS (`enable` **y**
`force`) · políticas con su expresión · permisos de `authenticated` ·
índices · restricciones · funciones y triggers.

Devuelve 0 si son iguales y 1 si no, así sirve en un script de
despliegue.
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path
from typing import Any

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ / "api"))

# La consola de Windows abre en cp1252 y revienta con los caracteres de
# dibujo. Que el script falle por eso sería absurdo: lo que informa es
# más importante que cómo se ve.
for flujo in (sys.stdout, sys.stderr):
    if hasattr(flujo, "reconfigure"):
        flujo.reconfigure(encoding="utf-8", errors="replace")

from sqlalchemy import create_engine, text  # noqa: E402

VERDE, ROJO, AMARILLO, GRIS, FIN = (
    "\033[32m",
    "\033[31m",
    "\033[33m",
    "\033[90m",
    "\033[0m",
)


def cargar_dotenv() -> None:
    archivo = RAIZ / ".env"
    if not archivo.exists():
        return
    for linea in archivo.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, valor = linea.split("=", 1)
        os.environ.setdefault(clave.strip(), valor.strip())


# ==================================================================
#  Lo que se le pregunta a cada esquema
# ==================================================================
#
# Cada consulta devuelve filas comparables de texto. Se normaliza el
# nombre del esquema a «{esq}» para que `dev` y `public` den lo mismo
# cuando de verdad son iguales: si no, el nombre propio aparecería como
# diferencia en cada política y en cada trigger.

CONSULTAS: dict[str, str] = {
    "tablas": """
        select table_name
        from information_schema.tables
        where table_schema = :esq and table_type = 'BASE TABLE'
        order by table_name
    """,
    "columnas": """
        select table_name || '.' || column_name || ' ' || data_type
               || coalesce('(' || character_maximum_length || ')', '')
               || coalesce('(' || numeric_precision || ',' || numeric_scale || ')', '')
               || case when is_nullable = 'YES' then ' null' else ' not null' end
               || coalesce(' default ' || column_default, '')
        from information_schema.columns
        where table_schema = :esq
        order by table_name, column_name
    """,
    "rls": """
        select c.relname
               || ' enable=' || c.relrowsecurity
               || ' force=' || c.relforcerowsecurity
        from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = :esq and c.relkind = 'r'
        order by c.relname
    """,
    "politicas": """
        select tablename || ' · ' || policyname || ' · ' || cmd
               || ' · roles=' || array_to_string(roles, ',')
               || ' · using=' || coalesce(qual, '-')
               || ' · check=' || coalesce(with_check, '-')
        from pg_policies
        where schemaname = :esq
        order by tablename, policyname
    """,
    # `service_role` queda afuera a propósito, y es la única excepción:
    # es el rol administrativo de Supabase, su clave no sale del
    # servidor y el panel lo necesita. En `public` lo trae de fábrica y
    # en `dev` no, y esa diferencia es correcta.
    "permisos": """
        select grantee || ' · ' || table_name || ' · ' || privilege_type
        from information_schema.role_table_grants
        where table_schema = :esq and grantee in ('authenticated', 'anon')
        order by grantee, table_name, privilege_type
    """,
    # `role_table_grants` no incluye las secuencias, así que una
    # diferencia ahí quedaba invisible. Y sí importa: con `usage` sobre
    # la secuencia de `categories` se puede quemar su rango de ids.
    "permisos_de_secuencias": """
        select r.rolname || ' · ' || c.relname || ' · ' || p.privilegio
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        cross join (values ('USAGE'), ('SELECT'), ('UPDATE')) as p(privilegio)
        cross join pg_roles r
        where n.nspname = :esq and c.relkind = 'S'
          and r.rolname in ('authenticated', 'anon')
          and has_sequence_privilege(r.rolname, c.oid, p.privilegio)
        order by r.rolname, c.relname, p.privilegio
    """,
    # Los privilegios por defecto son la causa de todo el problema de
    # F02-T16: definen con qué permisos NACE cada tabla nueva. Si los dos
    # esquemas no los tienen iguales, van a volver a separarse solos en
    # la próxima migración.
    #
    # Se pregunta sólo por `anon` y `authenticated`, y sólo por los
    # privilegios que definió `postgres`. Las dos restricciones hacen
    # falta:
    #
    # · El ACL crudo difiere por cómo Postgres lo guarda —en `dev` no
    #   hay ninguna fila porque nunca hubo nada que sacar, y en `public`
    #   queda la fila con `postgres` y `service_role` adentro—, y eso
    #   sería una diferencia permanente que no significa nada.
    #
    # · `supabase_admin` tiene su propio juego de privilegios por
    #   defecto en `public` y no es nuestro rol: no lo podemos cambiar y
    #   tampoco hace falta, porque los privilegios por defecto son del
    #   rol que CREA el objeto y nuestras tablas las crea `postgres`.
    #   Sin este filtro el comparador señalaba algo que no se puede
    #   arreglar, que es la peor clase de alarma.
    #
    # Con los dos esquemas en orden, esta consulta no devuelve nada en
    # ninguno.
    "privilegios_por_defecto": """
        select pg_get_userbyid(e.grantee) || ' · ' || d.defaclobjtype::text
               || ' · ' || e.privilege_type
        from pg_default_acl d
        join pg_namespace n on n.oid = d.defaclnamespace
        cross join aclexplode(d.defaclacl) e
        where n.nspname = :esq
          and pg_get_userbyid(d.defaclrole) = 'postgres'
          and pg_get_userbyid(e.grantee) in ('anon', 'authenticated')
        order by 1
    """,
    "indices": """
        select indexname || ' · ' || indexdef
        from pg_indexes
        where schemaname = :esq
        order by indexname
    """,
    "restricciones": """
        select rel.relname || ' · ' || con.conname || ' · ' || con.contype::text
               || ' · ' || pg_get_constraintdef(con.oid)
        from pg_constraint con
        join pg_class rel on rel.oid = con.conrelid
        join pg_namespace n on n.oid = con.connamespace
        where n.nspname = :esq
        order by rel.relname, con.conname
    """,
    "funciones": """
        select p.proname
               || ' · ' || pg_get_function_identity_arguments(p.oid)
               || ' · security_definer=' || p.prosecdef
               || ' · ' || coalesce(array_to_string(p.proconfig, ','), 'sin-config')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = :esq
        order by p.proname
    """,
    # Los triggers de aprovisionamiento no viven en nuestro esquema
    # sino sobre `auth.users`, que es compartida. Se distinguen por el
    # sufijo del nombre, así que se filtra por eso.
    "triggers_en_auth_users": """
        select t.tgname || ' · ' || pg_get_triggerdef(t.oid)
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'auth' and c.relname = 'users'
          and not t.tgisinternal
          and t.tgname like '%\\_' || :esq escape '\\'
        order by t.tgname
    """,
}


NOMBRE_DE_ESQUEMA = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")


def esquema_valido(esq: str) -> str:
    """Valida el nombre antes de pegarlo en una consulta.

    Un identificador no se puede parametrizar en Postgres: `:esq` sirve
    para `information_schema.tables`, donde el esquema es un dato, pero
    no para `from "esq".alembic_version`, donde es parte de la
    sentencia. Como el nombre viene de la línea de comandos, se valida
    acá y las comillas dobles hacen el resto.
    """
    if not NOMBRE_DE_ESQUEMA.match(esq):
        raise ValueError(
            f"«{esq}» no parece un nombre de esquema. Se esperan minúsculas, "
            "dígitos y guiones bajos."
        )
    return esq


def revision(conexion: Any, esq: str) -> str:
    esq = esquema_valido(esq)
    existe = conexion.execute(
        text("""
            select 1 from information_schema.tables
            where table_schema = :esq and table_name = 'alembic_version'
        """),
        {"esq": esq},
    ).scalar()
    if not existe:
        return "(sin alembic_version)"
    filas = conexion.execute(
        text(f'select version_num from "{esq}".alembic_version order by 1')  # noqa: S608
    ).scalars()
    return ", ".join(filas) or "(vacía)"


def normalizar(filas: list[str], esq: str) -> list[str]:
    """Saca el nombre del esquema para que no cuente como diferencia.

    Hay dos formas en que aparece y las dos hay que sacar:

    1. **Como sufijo de un identificador.** El trigger de alta se llama
       `al_crear_usuario_dev` en uno y `al_crear_usuario_public` en el
       otro. Es el mismo trigger.
    2. **Calificando un objeto.** Y acá está la trampa que costó un
       rato: Postgres sólo escribe el esquema cuando *no* está en el
       `search_path`. `public` sí está, así que la misma clave foránea
       se imprime `REFERENCES {esq}.profiles(id)` en `dev` y
       `REFERENCES profiles(id)` en `public`. Reemplazar el nombre por
       una marca no alcanza —en `public` no hay nada que reemplazar—,
       así que se saca la calificación de los dos lados y quedan
       iguales.

    Sólo se saca **nuestro** esquema. Una referencia a otro sigue
    apareciendo con su nombre, que es justo lo que querríamos ver si
    algún día aparece.
    """
    salida = []
    for fila in filas:
        fila = fila.replace(f"_{esq}", "_{esq}")
        fila = fila.replace(f'"{esq}".', "").replace(f"{esq}.", "")
        salida.append(fila)
    return salida


def consultar(conexion: Any, esq: str, sql: str) -> list[str]:
    filas = conexion.execute(text(sql), {"esq": esq}).scalars().all()
    return normalizar([str(f) for f in filas], esq)


# ==================================================================


def main() -> int:
    cargar_dotenv()
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        print(f"{ROJO}DATABASE_URL no está definida.{FIN}")
        return 2

    a = sys.argv[1] if len(sys.argv) > 1 else "dev"
    b = sys.argv[2] if len(sys.argv) > 2 else "public"

    # `prepare_threshold=None`: detrás del pooler en modo transacción
    # las sentencias preparadas de psycopg3 chocan entre conexiones.
    motor = create_engine(
        url,
        pool_pre_ping=True,
        connect_args={"prepare_threshold": None},
    )

    print(f"\n{GRIS}{'─' * 64}{FIN}")
    print(f"  Comparando  {AMARILLO}{a}{FIN}  contra  {AMARILLO}{b}{FIN}")
    print(f"{GRIS}{'─' * 64}{FIN}\n")

    diferencias = 0
    with motor.connect() as conexion:
        rev_a, rev_b = revision(conexion, a), revision(conexion, b)
        igual_rev = rev_a == rev_b
        marca = f"{VERDE}=={FIN}" if igual_rev else f"{ROJO}!={FIN}"
        print(f"  revisión de Alembic  {marca}  {a}: {rev_a}   {b}: {rev_b}")
        if not igual_rev:
            diferencias += 1

        for nombre, sql in CONSULTAS.items():
            filas_a = consultar(conexion, a, sql)
            filas_b = consultar(conexion, b, sql)
            solo_a = [f for f in filas_a if f not in filas_b]
            solo_b = [f for f in filas_b if f not in filas_a]

            if not solo_a and not solo_b:
                print(f"  {nombre:<24} {VERDE}=={FIN}  {len(filas_a)} filas")
                continue

            diferencias += 1
            print(f"  {nombre:<24} {ROJO}!={FIN}  {a}: {len(filas_a)}  {b}: {len(filas_b)}")
            for f in solo_a:
                print(f"      {ROJO}sólo en {a}:{FIN} {f}")
            for f in solo_b:
                print(f"      {ROJO}sólo en {b}:{FIN} {f}")

    print()
    if diferencias:
        print(f"{ROJO}  {diferencias} grupo(s) con diferencias.{FIN}\n")
        return 1
    print(f"{VERDE}  Los dos esquemas son iguales.{FIN}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
