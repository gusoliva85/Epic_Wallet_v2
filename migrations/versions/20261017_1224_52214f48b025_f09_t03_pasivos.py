"""F09-T03 pasivos

ID de revisión: 52214f48b025
Revisión anterior: df07876df490
Creada: 2026-10-17

Referencia: 02_Documento_Tecnico.md §6.2 · General §5.3 · F09-T03

Mismo patrón que `categories` en `b2d5f8a31c94`: RLS activo y forzado,
una sola política por tabla, trigger de `updated_at` con la función
que ya existe desde `a1c4e7f20b83`. Sin grant de secuencia a mano:
desde `d4f7ba05e3c6` los privilegios por defecto ya le dan a
`authenticated` exactamente `usage` y `select`.

`liabilities` se crea vacía y preparada, no se muestra en la interfaz
en el MVP (General §5.3: "la arquitectura debe dejar el concepto de
pasivos preparado para el futuro, aunque no se muestre inicialmente").
`services.calc.patrimonio_neto` ya resta el total real desde que esta
tabla existe.

El `autogenerate` de esta revisión también proponía recrear las
foreign keys de `categories`, `months`, `monthly_category_totals`,
`profiles` y `transactions` tal cual ya estaban —un falso positivo
conocido de Alembic al comparar nombres de esquema calificados contra
sin calificar—. Se descartó esa parte a mano: lo único que cambia de
verdad en esta revisión es la tabla nueva.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "52214f48b025"
down_revision: str | None = "df07876df490"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _esquema() -> str:
    esquema = context.get_context().version_table_schema
    assert esquema, "la migración necesita un esquema explícito"
    return esquema


def upgrade() -> None:
    e = _esquema()

    op.create_table(
        "liabilities",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id", name="pk_liabilities"),
        sa.ForeignKeyConstraint(
            ["user_id"], [f"{e}.profiles.id"], name="fk_liabilities_user_id_profiles", ondelete="CASCADE"
        ),
        schema=e,
    )

    op.execute(
        f"""
        create trigger liabilities_updated_at
          before update on "{e}".liabilities
          for each row execute function "{e}".tocar_updated_at();
        """
    )

    op.execute(f'alter table "{e}".liabilities enable row level security;')
    op.execute(f'alter table "{e}".liabilities force row level security;')
    op.execute(
        f"""
        create policy own_liabilities on "{e}".liabilities
          for all
          using (user_id = (select auth.uid()))
          with check (user_id = (select auth.uid()));
        """
    )
    op.execute(f'grant select, insert, update, delete on "{e}".liabilities to authenticated;')


def downgrade() -> None:
    e = _esquema()

    op.execute(f'drop policy if exists own_liabilities on "{e}".liabilities;')
    op.execute(f'drop trigger if exists liabilities_updated_at on "{e}".liabilities;')
    op.drop_table("liabilities", schema=e)
