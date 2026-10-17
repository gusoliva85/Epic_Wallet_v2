"""F10-T04 investments

ID de revisión: 6216f0b3e56e
Revisión anterior: 52214f48b025
Creada: 2026-10-17

Referencia: 02_Documento_Tecnico.md §6.2 · General §20, §21, §22 · F10-T04

Mismo patrón que `liabilities` en `52214f48b025`: RLS activo y
forzado, una sola política por tabla, trigger de `updated_at` con la
función que ya existe desde `a1c4e7f20b83`. Sin grant de secuencia a
mano (`d4f7ba05e3c6` ya se lo da a `authenticated` por defecto).

El `autogenerate` de esta revisión volvió a traer el mismo falso
positivo que la de `liabilities`: foreign keys de tablas existentes
recreadas tal cual estaban, por comparar nombres de esquema calificados
contra sin calificar. Se descartó a mano; lo único que cambia de
verdad acá es la tabla nueva.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "6216f0b3e56e"
down_revision: str | None = "52214f48b025"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _esquema() -> str:
    esquema = context.get_context().version_table_schema
    assert esquema, "la migración necesita un esquema explícito"
    return esquema


def upgrade() -> None:
    e = _esquema()

    op.create_table(
        "investments",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("symbol", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("investment_type", sa.Text(), nullable=False),
        sa.Column("nominal_quantity", sa.Numeric(18, 4), nullable=False, server_default=sa.text("0")),
        sa.Column("initial_value", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("current_unit_price", sa.Numeric(18, 6), nullable=True),
        sa.Column("current_value", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "valuation_mode", sa.Text(), nullable=False, server_default=sa.text("'unit_price'")
        ),
        sa.Column("price_source", sa.Text(), nullable=True),
        sa.Column("price_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id", name="pk_investments"),
        sa.ForeignKeyConstraint(
            ["user_id"], [f"{e}.profiles.id"], name="fk_investments_user_id_profiles", ondelete="CASCADE"
        ),
        sa.CheckConstraint(
            "investment_type in ('obligacion_negociable','bono','cedear','accion','fci','otro')",
            name="ck_investments_investment_type",
        ),
        sa.CheckConstraint("nominal_quantity >= 0", name="ck_investments_nominal_quantity"),
        sa.CheckConstraint("initial_value >= 0", name="ck_investments_initial_value"),
        sa.CheckConstraint(
            "valuation_mode in ('unit_price','manual')", name="ck_investments_valuation_mode"
        ),
        schema=e,
    )
    op.create_index(
        "investments_user_idx", "investments", ["user_id", "active", "symbol"], schema=e
    )

    op.execute(
        f"""
        create trigger investments_updated_at
          before update on "{e}".investments
          for each row execute function "{e}".tocar_updated_at();
        """
    )

    op.execute(f'alter table "{e}".investments enable row level security;')
    op.execute(f'alter table "{e}".investments force row level security;')
    op.execute(
        f"""
        create policy own_investments on "{e}".investments
          for all
          using (user_id = (select auth.uid()))
          with check (user_id = (select auth.uid()));
        """
    )
    op.execute(f'grant select, insert, update, delete on "{e}".investments to authenticated;')


def downgrade() -> None:
    e = _esquema()

    op.execute(f'drop policy if exists own_investments on "{e}".investments;')
    op.execute(f'drop trigger if exists investments_updated_at on "{e}".investments;')
    op.drop_index("investments_user_idx", table_name="investments", schema=e)
    op.drop_table("investments", schema=e)
