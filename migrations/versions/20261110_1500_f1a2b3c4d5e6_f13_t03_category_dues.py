"""F13-T03 category_dues

ID de revisión: f1a2b3c4d5e6
Revisión anterior: c4d8a1e6f352
Creada: 2026-11-10

Referencia: 02_Documento_Tecnico.md §6.2 · General §29 · F13-T03

Mismo patrón que `app_settings` en `c4d8a1e6f352`: RLS activo y
forzado, una sola política por tabla, trigger de `updated_at` con la
función que ya existe desde `a1c4e7f20b83`, y sin grant de secuencia a
mano (`d4f7ba05e3c6` ya se lo da a `authenticated` por defecto).

**Esta migración sólo CREA.** No borra, no renombra y no toca ninguna
fila existente: una tabla nueva y vacía al lado de las que ya están.
Los datos cargados no se ven afectados de ninguna manera.

`(user_id, category_id)` único: una categoría tiene a lo sumo un
vencimiento, y es lo que hace que `PUT /api/dues/{category_id}` sea un
upsert sin carreras. Los dos `check` repiten los límites que ya valida
el esquema de la API, a propósito: la API se puede saltear (la clave
publicable de Supabase llega a Postgres), la restricción no.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

revision: str = "f1a2b3c4d5e6"
down_revision: str | None = "c4d8a1e6f352"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _esquema() -> str:
    esquema = context.get_context().version_table_schema
    assert esquema, "la migración necesita un esquema explícito"
    return esquema


def upgrade() -> None:
    e = _esquema()

    op.create_table(
        "category_dues",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.dialects.postgresql.UUID(as_uuid=False), nullable=False),
        sa.Column("category_id", sa.BigInteger(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("due_day", sa.Integer(), nullable=False),
        sa.Column("notice_days", sa.Integer(), nullable=False, server_default="3"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")
        ),
        sa.PrimaryKeyConstraint("id", name="pk_category_dues"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            [f"{e}.profiles.id"],
            name="fk_category_dues_user_id_profiles",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            [f"{e}.categories.id"],
            name="fk_category_dues_category_id_categories",
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint("user_id", "category_id", name="category_dues_unique"),
        sa.CheckConstraint("due_day between 1 and 31", name="category_dues_day"),
        sa.CheckConstraint("notice_days between 0 and 30", name="category_dues_notice"),
        schema=e,
    )

    op.execute(
        f"""
        create trigger category_dues_updated_at
          before update on "{e}".category_dues
          for each row execute function "{e}".tocar_updated_at();
        """
    )

    op.execute(f'alter table "{e}".category_dues enable row level security;')
    op.execute(f'alter table "{e}".category_dues force row level security;')
    op.execute(
        f"""
        create policy own_category_dues on "{e}".category_dues
          for all
          using (user_id = (select auth.uid()))
          with check (user_id = (select auth.uid()));
        """
    )
    op.execute(f'grant select, insert, update, delete on "{e}".category_dues to authenticated;')


def downgrade() -> None:
    """Vuelve atrás borrando la tabla que esta misma migración creó.

    Se lleva la configuración de vencimientos —qué día vence cada ítem y
    con cuántos días de aviso—, que es lo único que vive ahí. Ningún
    movimiento, mes, categoría ni inversión se toca: esta tabla no
    guarda nada de eso y no hay cascada que llegue a ellos (las dos
    claves foráneas apuntan hacia afuera, no al revés).
    """
    e = _esquema()

    op.execute(f'drop policy if exists own_category_dues on "{e}".category_dues;')
    op.execute(f'drop trigger if exists category_dues_updated_at on "{e}".category_dues;')
    op.drop_table("category_dues", schema=e)
