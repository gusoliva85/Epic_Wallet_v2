"""Modelos de SQLAlchemy.

Todos se importan acá para que `Base.metadata` los conozca. Alembic
compara contra esos metadatos: un modelo que no se importe no aparece
en `autogenerate`, y la migración saldría vacía sin avisar.
"""

from .base import Base, esquema_actual, metadata
from .category import Category
from .profile import Profile

__all__ = ["Base", "Category", "Profile", "esquema_actual", "metadata"]
