"""permisos: cerrar los privilegios por defecto que quedaban abiertos

ID de revisión: d4f7ba05e3c6
Revisión anterior: c3e6a94d2f15
Creada: 2026-10-05

Referencia: 02_Documento_Tecnico.md §6.1 · F02-T16

Continuación de `c3e6a94d2f15`. Esa migración cerró los permisos sobre
las tablas que ya existían y los privilegios por defecto **de tablas**.
Al volver a comparar los dos esquemas quedaron dos cosas abiertas que
esa no cubría, las dos en los privilegios por defecto —o sea: no son
permisos de hoy, son con qué permisos va a **nacer** lo que creemos
mañana.

**1 · Secuencias.** `authenticated` tenía por defecto `usage`, `select`
**y `update`**. La aplicación necesita las dos primeras —`usage` para
que `nextval()` funcione al insertar— y `update` no: permite mover el
contador a mano. Queda el valor por defecto en exactamente lo que hace
falta, así una secuencia nueva nace bien sin que nadie se acuerde.

**2 · Funciones.** Toda función creada en `public` nacía con `EXECUTE`
para `anon` y `authenticated`. Importa más de lo que parece: nuestras
funciones son `security definer`, es decir corren con los permisos del
dueño y **se saltean RLS**. Una función `security definer` ejecutable
por `anon` es una puerta directa a los datos de todos.

Hoy no era explotable y se comprobó, no se supuso: las dos funciones
que existen son de trigger, y Postgres contesta «trigger functions can
only be called as triggers» cuando se las llama de frente. Pero la
primera función normal que alguien agregue nacería abierta.

**Lo que esta migración NO hace, a propósito:** no les toca los
permisos a las dos funciones que ya existen. Para cerrarlas de verdad
habría que revocarle `EXECUTE` a `PUBLIC`, y de `PUBLIC` también
depende `supabase_auth_admin`, que es quien dispara
`crear_perfil_y_categorias` al registrarse alguien. Arriesgar el alta de
cuentas para cerrar una puerta que ya está probada como cerrada no se
paga. Si alguna vez se agrega una función invocable, hay que darle sus
permisos a mano —y ahora el valor por defecto obliga a pensarlo.

Cambiar los privilegios por defecto no toca nada de lo que ya existe,
así que esta migración no puede romper lo que está andando.
"""

from collections.abc import Sequence

from alembic import context, op

revision: str = "d4f7ba05e3c6"
down_revision: str | None = "c3e6a94d2f15"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Los privilegios por defecto son del rol que CREA el objeto, y las
# migraciones corren como `postgres`. Los de `supabase_admin` no se
# tocan: no es nuestro rol y no crea nuestros objetos.
ROL = "postgres"


def _esquema() -> str:
    esquema = context.get_context().version_table_schema
    assert esquema, "la migración necesita un esquema explícito"
    return esquema


def _por_defecto(esquema: str, sentencia: str) -> None:
    op.execute(
        f'alter default privileges for role {ROL} in schema "{esquema}" {sentencia};'
    )


def upgrade() -> None:
    esquema = _esquema()

    # 1 · Secuencias: exactamente lo que la aplicación usa.
    _por_defecto(esquema, "revoke all on sequences from authenticated")
    _por_defecto(esquema, "grant usage, select on sequences to authenticated")

    # 2 · Funciones: nada para nadie. `PUBLIC` también, que es de donde
    #     viene el `EXECUTE` que Postgres da de fábrica a todo el mundo.
    for quien in ("public", "anon", "authenticated"):
        _por_defecto(esquema, f"revoke all on functions from {quien}")


def downgrade() -> None:
    esquema = _esquema()

    _por_defecto(esquema, "grant all on sequences to authenticated")
    for quien in ("public", "anon", "authenticated"):
        _por_defecto(esquema, f"grant execute on functions to {quien}")
