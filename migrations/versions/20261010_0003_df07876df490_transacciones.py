"""transacciones

ID de revisión: df07876df490
Revisión anterior: e5d57b6f5c3b
Creada: 2026-10-10

Referencia: 02_Documento_Tecnico.md §6.2 · General §8 · F04-T03

Dos tablas, mismo patrón que `months` en `e5d57b6f5c3b`: RLS activo y
forzado, una sola política por tabla, trigger de `updated_at` con la
función que ya existe desde `a1c4e7f20b83`. Sin grant de secuencia a
mano: desde `d4f7ba05e3c6` los privilegios por defecto ya le dan a
`authenticated` exactamente `usage` y `select`.

`transactions.amount` lleva `check (amount > 0)` en la base, no sólo
en `services.transactions.importe_valido` (F04-T01): el signo contable
lo decide `transaction_type`, nunca el número (General §8.4).

`monthly_category_totals` no tiene aún quien escriba en ella —eso es
F04-T05—, pero sin la tabla el modelo no compila contra nada real.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "df07876df490"
down_revision: str | None = "e5d57b6f5c3b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _esquema() -> str:
    esquema = context.get_context().version_table_schema
    assert esquema, "la migración necesita un esquema explícito"
    return esquema


def upgrade() -> None:
    e = _esquema()

    # ------------------------------------------------------ transactions
    op.create_table(
        "transactions",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("month_id", sa.BigInteger(), nullable=False),
        sa.Column("category_id", sa.BigInteger(), nullable=False),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("transaction_type", sa.Text(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source", sa.Text(), nullable=False, server_default=sa.text("'manual'")),
        sa.Column("external_id", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id", name="pk_transactions"),
        sa.ForeignKeyConstraint(
            ["user_id"], [f"{e}.profiles.id"], name="fk_transactions_user_id_profiles", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["month_id"], [f"{e}.months.id"], name="fk_transactions_month_id_months", ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            [f"{e}.categories.id"],
            name="fk_transactions_category_id_categories",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint("transaction_type in ('income','expense')", name="ck_transactions_transaction_type"),
        sa.CheckConstraint("amount > 0", name="ck_transactions_amount_positive"),
        sa.CheckConstraint(
            "source in ('manual','mercado_pago','system','import')", name="ck_transactions_source"
        ),
        # Anti-duplicación de importaciones futuras (Mercado Pago, Excel):
        # un mismo origen no puede traer dos veces el mismo external_id.
        # NULL no choca con NULL, así que los movimientos manuales (sin
        # external_id) no se ven afectados por esta restricción.
        sa.UniqueConstraint("user_id", "source", "external_id", name="transactions_external_unique"),
        schema=e,
    )

    op.execute(
        f'create index transactions_month_idx on "{e}".transactions '
        "(user_id, month_id, transaction_date desc, id desc);"
    )
    op.execute(
        f'create index transactions_category_idx on "{e}".transactions '
        "(user_id, category_id, transaction_date desc);"
    )
    op.create_index(
        "transactions_search_idx", "transactions", ["user_id", "description"], schema=e
    )

    op.execute(
        f"""
        create trigger transactions_updated_at
          before update on "{e}".transactions
          for each row execute function "{e}".tocar_updated_at();
        """
    )

    op.execute(f'alter table "{e}".transactions enable row level security;')
    op.execute(f'alter table "{e}".transactions force row level security;')
    op.execute(
        f"""
        create policy own_transactions on "{e}".transactions
          for all
          using (user_id = (select auth.uid()))
          with check (user_id = (select auth.uid()));
        """
    )
    op.execute(f'grant select, insert, update, delete on "{e}".transactions to authenticated;')

    # ------------------------------------------- monthly_category_totals
    op.create_table(
        "monthly_category_totals",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("month_id", sa.BigInteger(), nullable=False),
        sa.Column("category_id", sa.BigInteger(), nullable=False),
        sa.Column("total_amount", sa.Numeric(14, 2), nullable=False, server_default=sa.text("0")),
        sa.Column(
            "is_manual_summary", sa.Boolean(), nullable=False, server_default=sa.text("false")
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id", name="pk_monthly_category_totals"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            [f"{e}.profiles.id"],
            name="fk_monthly_category_totals_user_id_profiles",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["month_id"],
            [f"{e}.months.id"],
            name="fk_monthly_category_totals_month_id_months",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            [f"{e}.categories.id"],
            name="fk_monthly_category_totals_category_id_categories",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("month_id", "category_id", name="mct_unique"),
        schema=e,
    )
    op.create_index(
        "mct_month_idx", "monthly_category_totals", ["user_id", "month_id"], schema=e
    )

    op.execute(
        f"""
        create trigger monthly_category_totals_updated_at
          before update on "{e}".monthly_category_totals
          for each row execute function "{e}".tocar_updated_at();
        """
    )

    op.execute(f'alter table "{e}".monthly_category_totals enable row level security;')
    op.execute(f'alter table "{e}".monthly_category_totals force row level security;')
    op.execute(
        f"""
        create policy own_monthly_category_totals on "{e}".monthly_category_totals
          for all
          using (user_id = (select auth.uid()))
          with check (user_id = (select auth.uid()));
        """
    )
    op.execute(
        f'grant select, insert, update, delete on "{e}".monthly_category_totals to authenticated;'
    )


def downgrade() -> None:
    e = _esquema()

    op.execute(f"drop policy if exists own_monthly_category_totals on \"{e}\".monthly_category_totals;")
    op.execute(f'drop trigger if exists monthly_category_totals_updated_at on "{e}".monthly_category_totals;')
    op.drop_index("mct_month_idx", table_name="monthly_category_totals", schema=e)
    op.drop_table("monthly_category_totals", schema=e)

    op.execute(f'drop policy if exists own_transactions on "{e}".transactions;')
    op.execute(f'drop trigger if exists transactions_updated_at on "{e}".transactions;')
    op.drop_index("transactions_search_idx", table_name="transactions", schema=e)
    op.execute(f'drop index if exists "{e}".transactions_category_idx;')
    op.execute(f'drop index if exists "{e}".transactions_month_idx;')
    op.drop_table("transactions", schema=e)
