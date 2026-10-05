"""profiles: tabla, RLS y trigger de updated_at

ID de revisión: a1c4e7f20b83
Revisión anterior: db3dbab54bbc
Creada: 2026-10-05

Referencia: 02_Documento_Tecnico.md §6.2 · F02-T03

Tres cosas, y las tres importan:

1. La tabla `profiles`, con la clave primaria apuntando a `auth.users`.
2. **RLS (row level security) con la política `own_profile`.** Es lo
   que impide que una cuenta vea los datos de otra. Sin esto, cualquier
   consulta con un token válido devolvería TODAS las filas: alcanzaría
   con crear una cuenta para ver las finanzas de los demás.
3. El trigger de `updated_at`. Va en la base y no en la aplicación para
   que también cambie cuando una fila se toca desde SQL o desde el
   panel de Supabase.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "a1c4e7f20b83"
down_revision: str | None = "db3dbab54bbc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _esquema() -> str:
    """El esquema donde se está migrando: `dev` o `public`.

    Sale de la configuración de Alembic, que a su vez lo toma de
    `DB_SCHEMA`. No hay valor por defecto a propósito: una migración en
    el esquema equivocado tocaría los datos reales.
    """
    esquema = context.get_context().version_table_schema
    assert esquema, "la migración necesita un esquema explícito"
    return esquema


def upgrade() -> None:
    esquema = _esquema()

    op.create_table(
        "profiles",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("username", sa.Text(), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=True),
        sa.Column(
            "opening_balance",
            sa.Numeric(14, 2),
            nullable=False,
            server_default=sa.text("0"),
        ),
        sa.Column(
            "timezone",
            sa.String(64),
            nullable=False,
            server_default=sa.text("'America/Argentina/Buenos_Aires'"),
        ),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_profiles"),
        sa.ForeignKeyConstraint(
            ["id"],
            ["auth.users.id"],
            name="fk_profiles_id_users",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("username", name="uq_profiles_username"),
        schema=esquema,
    )

    # ---- trigger de updated_at ----
    # `search_path = ''` en una función `security definer` no es
    # opcional: sin eso, quien pueda crear una tabla en un esquema que
    # esté antes en el search_path podría hacer que la función llame a
    # SU código con los permisos del dueño.
    op.execute(
        f"""
        create or replace function "{esquema}".tocar_updated_at()
        returns trigger
        language plpgsql
        security definer
        set search_path = ''
        as $$
        begin
          new.updated_at = now();
          return new;
        end;
        $$;
        """
    )
    op.execute(
        f"""
        create trigger profiles_updated_at
          before update on "{esquema}".profiles
          for each row execute function "{esquema}".tocar_updated_at();
        """
    )

    # ---- seguridad a nivel de fila ----
    op.execute(f'alter table "{esquema}".profiles enable row level security;')
    # `force` para que la política valga TAMBIÉN para el dueño de la
    # tabla. Sin esto, el rol que creó la tabla se saltea la política y
    # el aislamiento depende de con qué rol se conecte la aplicación.
    op.execute(f'alter table "{esquema}".profiles force row level security;')

    # ---- permisos de tabla ----
    # RLS decide QUÉ FILAS ve cada uno, pero no da acceso a la tabla:
    # son dos cosas distintas y hacen falta las dos. Sin estos permisos,
    # `authenticated` no puede ni entrar al esquema y la aplicación
    # falla con «permission denied for schema» antes de que RLS llegue
    # a filtrar nada.
    #
    # En `public` Supabase ya los da solo a las tablas creadas desde su
    # editor; una tabla creada por Alembic, y cualquier tabla en `dev`,
    # los necesita explícitos.
    op.execute(f'grant usage on schema "{esquema}" to authenticated;')
    op.execute(f'grant select, insert, update, delete on "{esquema}".profiles to authenticated;')
    # `anon` NO: un visitante sin sesión no tiene nada que hacer acá.

    # Una sola política para las cuatro operaciones: cada uno ve y toca
    # su fila y nada más. `auth.uid()` lo resuelve Supabase a partir del
    # token que la aplicación propaga en cada sesión (F02-T05).
    op.execute(
        f"""
        create policy own_profile on "{esquema}".profiles
          for all
          using (id = (select auth.uid()))
          with check (id = (select auth.uid()));
        """
    )


def downgrade() -> None:
    esquema = _esquema()

    # En orden inverso. La política y el trigger caen solos con la
    # tabla, pero se borran explícitamente para que el downgrade sea
    # legible y no dependa de ese detalle.
    op.execute(f'drop policy if exists own_profile on "{esquema}".profiles;')
    op.execute(f'drop trigger if exists profiles_updated_at on "{esquema}".profiles;')
    op.execute(f'revoke all on "{esquema}".profiles from authenticated;')
    op.drop_table("profiles", schema=esquema)
    op.execute(f'drop function if exists "{esquema}".tocar_updated_at();')
