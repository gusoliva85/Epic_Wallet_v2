"""F10-T04 inversión: valor total, sin modo de valuación

ID de revisión: 7a3f9c2e1d84
Revisión anterior: 6216f0b3e56e
Creada: 2026-10-20

Referencia: 02_Documento_Tecnico.md §6.2 · General §20.1, §22 · F10-T04/F10-T06

Revisión de diseño (Gustavo, 2026-10-20): una posición no tiene dos
formas de valuación. `initial_value` y `current_value` pasan a ser
siempre el importe total cargado a mano —"precio de compra" y
"precio actual" en la interfaz—, nunca nominales por un precio
unitario. Se van `valuation_mode`, `current_unit_price`,
`price_source` y `price_updated_at`: ninguno tiene sentido en el
modelo nuevo (`price_source`/`price_updated_at` tampoco los llegó a
usar nadie — estaban preparados para la cotización automática de
después del MVP). `nominal_quantity` queda igual, ahora puramente
informativo.

Sin datos reales que migrar: todavía no se cargó ninguna posición de
verdad en Cartera (F10-T12 sigue pendiente).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "7a3f9c2e1d84"
down_revision: str | None = "6216f0b3e56e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _esquema() -> str:
    esquema = context.get_context().version_table_schema
    assert esquema, "la migración necesita un esquema explícito"
    return esquema


def upgrade() -> None:
    e = _esquema()

    op.drop_constraint("ck_investments_valuation_mode", "investments", schema=e, type_="check")
    op.drop_column("investments", "valuation_mode", schema=e)
    op.drop_column("investments", "current_unit_price", schema=e)
    op.drop_column("investments", "price_source", schema=e)
    op.drop_column("investments", "price_updated_at", schema=e)


def downgrade() -> None:
    e = _esquema()

    op.add_column(
        "investments",
        sa.Column("price_updated_at", sa.DateTime(timezone=True), nullable=True),
        schema=e,
    )
    op.add_column(
        "investments", sa.Column("price_source", sa.Text(), nullable=True), schema=e
    )
    op.add_column(
        "investments",
        sa.Column("current_unit_price", sa.Numeric(18, 6), nullable=True),
        schema=e,
    )
    op.add_column(
        "investments",
        sa.Column(
            "valuation_mode", sa.Text(), nullable=False, server_default=sa.text("'unit_price'")
        ),
        schema=e,
    )
    op.create_check_constraint(
        "ck_investments_valuation_mode",
        "investments",
        "valuation_mode in ('unit_price','manual')",
        schema=e,
    )
