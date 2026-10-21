"""Modelos de SQLAlchemy.

Todos se importan acá para que `Base.metadata` los conozca. Alembic
compara contra esos metadatos: un modelo que no se importe no aparece
en `autogenerate`, y la migración saldría vacía sin avisar.
"""

# supabase va PRIMERO: declara auth.users, a la que apunta profiles.
from . import supabase as _supabase  # noqa: F401
from .app_setting import AppSetting
from .base import Base, esquema_actual, metadata
from .category import Category
from .investment import Investment
from .liability import Liability
from .month import Month
from .monthly_category_total import MonthlyCategoryTotal
from .profile import Profile
from .transaction import Transaction

__all__ = [
    "AppSetting",
    "Base",
    "Category",
    "Investment",
    "Liability",
    "Month",
    "MonthlyCategoryTotal",
    "Profile",
    "Transaction",
    "esquema_actual",
    "metadata",
]
