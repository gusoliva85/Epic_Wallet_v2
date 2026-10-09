"""Modelos de SQLAlchemy.

Todos se importan acá para que `Base.metadata` los conozca. Alembic
compara contra esos metadatos: un modelo que no se importe no aparece
en `autogenerate`, y la migración saldría vacía sin avisar.
"""

# supabase va PRIMERO: declara auth.users, a la que apunta profiles.
from . import supabase as _supabase  # noqa: F401
from .base import Base, esquema_actual, metadata
from .category import Category
from .month import Month
from .profile import Profile

__all__ = ["Base", "Category", "Month", "Profile", "esquema_actual", "metadata"]
