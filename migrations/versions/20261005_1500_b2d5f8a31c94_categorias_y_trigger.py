"""categories y el trigger que da de alta una cuenta

ID de revisión: b2d5f8a31c94
Revisión anterior: a1c4e7f20b83
Creada: 2026-10-05

Referencia: 02_Documento_Tecnico.md §8.4 · General §7.1, §7.2 · F02-T04

Dos cosas:

1. La tabla `categories`. El roadmap la ponía en F03-T07, pero el
   trigger inserta las 21 categorías iniciales: sin la tabla, el
   trigger no puede existir. Se adelanta y queda anotado.

2. La función `crear_perfil_y_categorias()` y su trigger sobre
   `auth.users`.

**Por qué el trigger y no el backend:** el registro ocurre contra
Supabase directamente, sin pasar por nuestra API. Si el perfil se
creara en el primer acceso a `/api/...`, una cuenta podría existir sin
perfil en el medio y habría que manejar ese estado en cada endpoint. El
trigger lo vuelve imposible.

**El trigger lleva el esquema en el nombre.** `auth.users` es única por
proyecto y los dos esquemas la comparten (§4.1.1), así que cuando
`public` también se migre van a existir dos triggers sobre la misma
tabla y los dos van a disparar: una cuenta nueva va a tener su perfil
en `dev` y en `public`. Es lo correcto —el mismo login sirve para los
dos entornos— pero los nombres no pueden chocar.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "b2d5f8a31c94"
down_revision: str | None = "a1c4e7f20b83"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _esquema() -> str:
    esquema = context.get_context().version_table_schema
    assert esquema, "la migración necesita un esquema explícito"
    return esquema


def upgrade() -> None:
    e = _esquema()

    # ------------------------------------------------------ categories
    op.create_table(
        "categories",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column(
            "user_id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=False
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column(
            "active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        sa.Column(
            "sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")
        ),
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
        sa.PrimaryKeyConstraint("id", name="pk_categories"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            [f"{e}.profiles.id"],
            name="fk_categories_user_id_profiles",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("type in ('income','expense')", name="ck_categories_type"),
        # «Otros» existe como ingreso Y como egreso: el tipo entra en la
        # restricción.
        sa.UniqueConstraint(
            "user_id", "type", "name", name="categories_unique_name_per_type"
        ),
        schema=e,
    )
    op.create_index(
        "categories_user_type_idx",
        "categories",
        ["user_id", "type", "active", "sort_order"],
        schema=e,
    )

    op.execute(
        f"""
        create trigger categories_updated_at
          before update on "{e}".categories
          for each row execute function "{e}".tocar_updated_at();
        """
    )

    op.execute(f'alter table "{e}".categories enable row level security;')
    op.execute(f'alter table "{e}".categories force row level security;')
    op.execute(
        f"""
        create policy own_categories on "{e}".categories
          for all
          using (user_id = (select auth.uid()))
          with check (user_id = (select auth.uid()));
        """
    )
    op.execute(
        f'grant select, insert, update, delete on "{e}".categories to authenticated;'
    )
    op.execute(f'grant usage, select on all sequences in schema "{e}" to authenticated;')

    # ------------------------------------- el alta automática de la cuenta
    #
    # `security definer` para poder escribir saltando RLS —el usuario
    # todavía no tiene sesión cuando esto corre— y `search_path = ''`
    # para que una tabla intrusa en otro esquema no pueda hacerse pasar
    # por las nuestras. Por eso todos los nombres van calificados.
    op.execute(
        f"""
        create or replace function "{e}".crear_perfil_y_categorias()
        returns trigger
        language plpgsql
        security definer
        set search_path = ''
        as $$
        declare
          iniciales text[][] := array[
            array['Sueldo','income'], array['Aguinaldo','income'],
            array['Otros','income'],
            array['Alquiler','expense'], array['Expensas','expense'],
            array['Cochera','expense'], array['ABL','expense'],
            array['Gas','expense'], array['Luz','expense'],
            array['Internet','expense'], array['Da Vinci','expense'],
            array['Tarjeta','expense'], array['Tuenti','expense'],
            array['Nafta','expense'], array['Subte','expense'],
            array['Mercadería','expense'], array['Verdulería','expense'],
            array['Carnicería / Pollería','expense'],
            array['Delivery / Salida','expense'],
            array['Comida Trabajo','expense'], array['Otros','expense']
          ];
          fila text[];
          orden int := 0;
          base text;
          candidato text;
          intento int := 0;
        begin
          -- `username` sale del correo, pero tiene que ser único: dos
          -- cuentas distintas pueden compartir la parte de adelante
          -- (alguien@live.com y alguien@gmail.com). Sin esto, la
          -- segunda cuenta fallaría al crearse y el registro entero se
          -- caería con un error que no dice nada.
          base := split_part(new.email, '@', 1);
          candidato := base;
          while exists (
            select 1 from "{e}".profiles p where p.username = candidato
          ) loop
            intento := intento + 1;
            candidato := base || intento::text;
          end loop;

          insert into "{e}".profiles (id, username, display_name)
          values (
            new.id,
            candidato,
            coalesce(new.raw_user_meta_data->>'display_name', base)
          );

          foreach fila slice 1 in array iniciales loop
            orden := orden + 1;
            insert into "{e}".categories (user_id, name, type, sort_order)
            values (new.id, fila[1], fila[2], orden);
          end loop;

          return new;
        end;
        $$;
        """
    )

    # El nombre lleva el esquema: `auth.users` la comparten los dos, así
    # que cuando `public` se migre va a haber dos triggers sobre la
    # misma tabla.
    op.execute(
        f"""
        create trigger al_crear_usuario_{e}
          after insert on auth.users
          for each row execute function "{e}".crear_perfil_y_categorias();
        """
    )


def downgrade() -> None:
    e = _esquema()

    op.execute(f"drop trigger if exists al_crear_usuario_{e} on auth.users;")
    op.execute(f'drop function if exists "{e}".crear_perfil_y_categorias();')

    op.execute(f'drop policy if exists own_categories on "{e}".categories;')
    op.execute(f'drop trigger if exists categories_updated_at on "{e}".categories;')
    op.drop_index("categories_user_type_idx", table_name="categories", schema=e)
    op.drop_table("categories", schema=e)
