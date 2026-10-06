"""permisos: sacarle a `anon` lo que Supabase le regala en `public`

ID de revisión: c3e6a94d2f15
Revisión anterior: b2d5f8a31c94
Creada: 2026-10-05

Referencia: 02_Documento_Tecnico.md §6.1 · F02-T16

Esto apareció al migrar producción y comparar los dos esquemas, y no
estaba previsto.

Supabase trae configurado, de fábrica:

    alter default privileges in schema public
      grant all on tables to anon, authenticated, service_role;

Así que **toda tabla que creemos en `public` nace con todos los
privilegios para `anon`**, el rol con el que actúa la clave anónima —la
que viaja dentro del paquete del navegador y por lo tanto conoce
cualquiera. En `dev` no pasa, porque ese esquema lo creamos nosotros y
los privilegios por defecto son por esquema. De ahí que el problema
estuviera invisible hasta tener los dos lados para comparar.

Para `profiles` y `categories` RLS lo tapa: están con `force` y las
políticas comparan contra `auth.uid()`, que sin sesión es nulo, así que
ninguna fila pasa. Pero que el único muro sea RLS no es aceptable
cuando no cuesta nada tener dos.

Y había un agujero de verdad: **`alembic_version` no tiene RLS**, y
`anon` tenía `DELETE`, `UPDATE` y `TRUNCATE` sobre ella. Esa tabla
queda expuesta por la API REST de Supabase como cualquier otra de
`public`, así que con la clave anónima se podía borrar la revisión de
migraciones de producción. No hay datos ahí, pero el siguiente
despliegue intentaría correr todo de nuevo sobre tablas que ya existen
y fallaría.

Qué hace esta migración:

1. Le saca a `anon` todo lo que tenga en nuestras tablas.
2. Deja `authenticated` con exactamente los cuatro permisos que la
   aplicación usa, y nada sobre `alembic_version`.
3. Cambia los privilegios por defecto del esquema para que las tablas
   que vengan no vuelvan a nacer abiertas. Esto es lo que hace que el
   arreglo no haya que repetirlo en cada migración.

`service_role` se deja como está: es el rol administrativo de Supabase,
su clave nunca sale del servidor y varias funciones del panel lo
necesitan. Es la única diferencia aceptada entre los dos esquemas y está
anotada en el comparador.

En `dev` casi todo esto es un no-op —ahí `anon` nunca tuvo nada—, y eso
es bueno: la migración corre igual en los dos lados y los deja iguales.
"""

from collections.abc import Sequence

from alembic import context, op

revision: str = "c3e6a94d2f15"
down_revision: str | None = "b2d5f8a31c94"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NUESTRAS_TABLAS = ("profiles", "categories")


def _esquema() -> str:
    esquema = context.get_context().version_table_schema
    assert esquema, "la migración necesita un esquema explícito"
    return esquema


def upgrade() -> None:
    esquema = _esquema()

    # 1 · `anon` no tiene nada que hacer en nuestras tablas. La
    #     aplicación nunca actúa como `anon`: el backend se conecta y
    #     hace `set local role authenticated` con los claims del token.
    for tabla in (*NUESTRAS_TABLAS, "alembic_version"):
        op.execute(f'revoke all on "{esquema}".{tabla} from anon;')
    op.execute(f'revoke all on all sequences in schema "{esquema}" from anon;')

    # 2 · `authenticated` queda con los cuatro permisos de siempre y
    #     nada más. Los de regalo —REFERENCES, TRIGGER, TRUNCATE— no los
    #     usa nadie, y TRUNCATE no lo filtra RLS: borra la tabla entera
    #     sin mirar las políticas.
    for tabla in NUESTRAS_TABLAS:
        op.execute(f'revoke all on "{esquema}".{tabla} from authenticated;')
        op.execute(
            f'grant select, insert, update, delete on "{esquema}".{tabla} '
            "to authenticated;"
        )

    # 3 · `alembic_version` es nuestra y de nadie más. No tiene RLS
    #     porque no es una tabla de datos, así que acá el permiso es la
    #     única defensa.
    op.execute(f'revoke all on "{esquema}".alembic_version from authenticated;')

    # 3b · Y lo mismo con la secuencia de `categories`. Esto lo encontró
    #      el comparador y no se me había ocurrido: en `public`,
    #      `authenticated` tenía también `UPDATE`, que permite mover el
    #      contador a mano. Hacen falta `usage` y `select`; `update`, no.
    op.execute(f'revoke all on all sequences in schema "{esquema}" from authenticated;')
    op.execute(
        f'grant usage, select on all sequences in schema "{esquema}" to authenticated;'
    )

    # 4 · Y que las tablas que vengan no nazcan abiertas. Sin esto, el
    #     arreglo habría que repetirlo en cada migración nueva, y
    #     alguna vez nos olvidaríamos.
    #
    #     Los privilegios por defecto son del rol que crea el objeto, y
    #     las migraciones corren como `postgres`, así que alcanza con
    #     cambiar los de `postgres`. No se tocan los de `supabase_admin`
    #     —no es nuestro rol— y no hace falta: no crea nuestras tablas.
    op.execute(
        f'alter default privileges for role postgres in schema "{esquema}" '
        "revoke all on tables from anon;"
    )
    op.execute(
        f'alter default privileges for role postgres in schema "{esquema}" '
        "revoke all on tables from authenticated;"
    )
    op.execute(
        f'alter default privileges for role postgres in schema "{esquema}" '
        "revoke all on sequences from anon;"
    )


def downgrade() -> None:
    """Deshace los privilegios por defecto, no los permisos sueltos.

    Tentación evitada: el primer intento le devolvía a `anon` todos los
    permisos sobre las tablas, para «dejar el esquema como estaba». En
    `public` eso era cierto. En `dev` habría **inventado** permisos que
    ahí nunca existieron, y un `downgrade` que deja el esquema distinto
    de como lo encontró es peor que uno incompleto.

    Lo que esta migración creó son los privilegios por defecto; eso se
    deshace. Los permisos que `anon` tenía en `public` no los creó
    ninguna migración: eran el efecto de los privilegios por defecto de
    Supabase sobre las tablas que ya existían. Volver atrás restituye la
    regla, y si alguien quiere además los permisos viejos sobre las
    tablas viejas, los da a mano sabiendo lo que hace.
    """
    esquema = _esquema()

    op.execute(
        f'alter default privileges for role postgres in schema "{esquema}" '
        "grant all on tables to anon;"
    )
    op.execute(
        f'alter default privileges for role postgres in schema "{esquema}" '
        "grant all on tables to authenticated;"
    )
    op.execute(
        f'alter default privileges for role postgres in schema "{esquema}" '
        "grant all on sequences to anon;"
    )

    # Lo que sí restituye: los permisos que las migraciones anteriores
    # habían dado de verdad.
    for tabla in NUESTRAS_TABLAS:
        op.execute(
            f'grant select, insert, update, delete on "{esquema}".{tabla} '
            "to authenticated;"
        )
    op.execute(
        f'grant usage, select on all sequences in schema "{esquema}" to authenticated;'
    )
