"""months

ID de revisión: e5d57b6f5c3b
Revisión anterior: d4f7ba05e3c6
Creada: 2026-10-08

Referencia: 02_Documento_Tecnico.md §6.2, §6.5 · General §33, §50 (R1) · F03-T03

La tabla de meses. Mismo patrón que `categories` en `b2d5f8a31c94`:
RLS activo y forzado, una sola política (`own_months`) que cubre las
cuatro operaciones, y el trigger de `updated_at` reusando la función
`tocar_updated_at()` que ya existe desde `a1c4e7f20b83` — no hace
falta otra por tabla.

**Sin el grant de la secuencia.** `categorias_y_trigger` sí lo hacía a
mano porque en ese momento la tabla nacía con todos los privilegios
para `anon` (el problema que describe `c3e6a94d2f15`). Desde
`d4f7ba05e3c6`, los privilegios por defecto de `postgres` sobre
secuencias nuevas ya le dan a `authenticated` exactamente `usage` y
`select`, y nada a `anon`: la secuencia que crea esta migración nace
bien sin que haya que pedírselo. Se comprobó después de migrar, no se
supuso.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "e5d57b6f5c3b"
down_revision: str | None = "d4f7ba05e3c6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _esquema() -> str:
    esquema = context.get_context().version_table_schema
    assert esquema, "la migración necesita un esquema explícito"
    return esquema


def upgrade() -> None:
    e = _esquema()

    op.create_table(
        "months",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default=sa.text("'open'")),
        sa.Column("income_total", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("expense_total", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("saving_total", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("opening_balance", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column("closing_balance", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id", name="pk_months"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            [f"{e}.profiles.id"],
            name="fk_months_user_id_profiles",
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("year between 2000 and 2100", name="ck_months_year_range"),
        sa.CheckConstraint("month between 1 and 12", name="ck_months_month_range"),
        sa.CheckConstraint("status in ('open','historical')", name="ck_months_status"),
        # Regla 1 del documento general: un mes por año/mes, por usuario.
        sa.UniqueConstraint("user_id", "year", "month", name="months_unique_per_user"),
        schema=e,
    )

    # "Los meses de este usuario, del más nuevo al más viejo": el orden
    # que usan la barra de mes y el historial.
    op.execute(
        f'create index months_user_period_idx on "{e}".months '
        "(user_id, year desc, month desc);"
    )

    op.execute(
        f"""
        create trigger months_updated_at
          before update on "{e}".months
          for each row execute function "{e}".tocar_updated_at();
        """
    )

    op.execute(f'alter table "{e}".months enable row level security;')
    op.execute(f'alter table "{e}".months force row level security;')
    op.execute(
        f"""
        create policy own_months on "{e}".months
          for all
          using (user_id = (select auth.uid()))
          with check (user_id = (select auth.uid()));
        """
    )
    op.execute(f'grant select, insert, update, delete on "{e}".months to authenticated;')


def downgrade() -> None:
    e = _esquema()

    op.execute(f'drop policy if exists own_months on "{e}".months;')
    op.execute(f'drop trigger if exists months_updated_at on "{e}".months;')
    op.drop_index("months_user_period_idx", table_name="months", schema=e)
    op.drop_table("months", schema=e)
