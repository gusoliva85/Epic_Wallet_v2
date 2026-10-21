"""F11-T01 app_settings

ID de revisión: c4d8a1e6f352
Revisión anterior: 7a3f9c2e1d84
Creada: 2026-10-21

Referencia: 02_Documento_Tecnico.md §6.2 · General §42 · F11-T01

Mismo patrón que `liabilities` en `52214f48b025`: RLS activo y
forzado, una sola política por tabla, trigger de `updated_at` con la
función que ya existe desde `a1c4e7f20b83`. Sin grant de secuencia a
mano (`d4f7ba05e3c6` ya se lo da a `authenticated` por defecto).

`(user_id, key)` único: una cuenta tiene a lo sumo un valor por
preferencia. `value` es `jsonb`, no un tipo fijo: la tabla guarda
preferencias arbitrarias (hoy sólo `theme`), sin que una preferencia
nueva el día de mañana pida otra migración.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "c4d8a1e6f352"
down_revision: str | None = "7a3f9c2e1d84"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _esquema() -> str:
    esquema = context.get_context().version_table_schema
    assert esquema, "la migración necesita un esquema explícito"
    return esquema


def upgrade() -> None:
    e = _esquema()

    op.create_table(
        "app_settings",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("value", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id", name="pk_app_settings"),
        sa.ForeignKeyConstraint(
            ["user_id"], [f"{e}.profiles.id"], name="fk_app_settings_user_id_profiles", ondelete="CASCADE"
        ),
        sa.UniqueConstraint("user_id", "key", name="app_settings_unique"),
        schema=e,
    )

    op.execute(
        f"""
        create trigger app_settings_updated_at
          before update on "{e}".app_settings
          for each row execute function "{e}".tocar_updated_at();
        """
    )

    op.execute(f'alter table "{e}".app_settings enable row level security;')
    op.execute(f'alter table "{e}".app_settings force row level security;')
    op.execute(
        f"""
        create policy own_app_settings on "{e}".app_settings
          for all
          using (user_id = (select auth.uid()))
          with check (user_id = (select auth.uid()));
        """
    )
    op.execute(f'grant select, insert, update, delete on "{e}".app_settings to authenticated;')


def downgrade() -> None:
    e = _esquema()

    op.execute(f'drop policy if exists own_app_settings on "{e}".app_settings;')
    op.execute(f'drop trigger if exists app_settings_updated_at on "{e}".app_settings;')
    op.drop_table("app_settings", schema=e)
