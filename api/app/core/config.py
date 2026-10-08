"""Configuración de la aplicación, leída del entorno.

Las variables vienen de Vercel en producción y de .env en local.
Ninguna tiene valor por defecto si es un secreto: si falta, la
aplicación no arranca, en lugar de arrancar a medias.

Referencia: 02_Documento_Tecnico.md §11
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Entorno = Literal["development", "preview", "production"]

# Ruta absoluta al .env de la raíz: config.py está en api/app/core/.
# Relativa al directorio actual fallaría según desde dónde se arranque
# (uvicorn desde api/, pytest desde la raíz, Vercel desde otro lugar).
# En Vercel no existe .env y las variables vienen del entorno: que el
# archivo falte no es un problema.
RAIZ = Path(__file__).resolve().parents[3]
ARCHIVO_ENV = RAIZ / ".env"


class Settings(BaseSettings):
    """Configuración completa. Se valida una sola vez al arrancar."""

    model_config = SettingsConfigDict(
        env_file=ARCHIVO_ENV,
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    # --- base de datos ---
    DATABASE_URL: str
    # Un solo esquema para todo el proyecto. No hay entorno separado.
    DB_SCHEMA: str = "public"

    # --- Supabase ---
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    # No se usa para verificar: el proyecto firma con ES256 y la clave
    # pública se obtiene del JWKS (§8.8). Se conserva por compatibilidad.
    SUPABASE_JWT_SECRET: str = ""

    # --- aplicación ---
    APP_ENV: Entorno = "development"
    APP_TIMEZONE: str = "America/Argentina/Buenos_Aires"
    ALLOWED_ORIGINS: str = ""
    LOG_LEVEL: str = "INFO"
    PUBLIC_APP_URL: str = ""

    # --- cotizaciones ---
    PRICE_PROVIDER_ORDER: str = "manual"
    PRICE_REFRESH_COOLDOWN_MINUTES: int = 15

    # --- versión, para poder identificar qué está desplegado ---
    APP_VERSION: str = "0.1.0"

    @field_validator("SUPABASE_URL")
    @classmethod
    def sin_ruta_al_final(cls, v: str) -> str:
        """`https://xxx.supabase.co/rest/v1/` es el error más común al copiarla."""
        v = v.rstrip("/")
        if ".supabase.co" in v:
            resto = v.split(".supabase.co", 1)[1]
            if resto:
                raise ValueError(
                    f"SUPABASE_URL no debe traer la ruta '{resto}': "
                    "tiene que terminar en .supabase.co"
                )
        return v

    @computed_field  # type: ignore[prop-decorator]
    @property
    def es_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def esquema(self) -> str | None:
        """Esquema donde viven las tablas. None en SQLite, que no los soporta."""
        if self.es_sqlite:
            return None
        return self.DB_SCHEMA.strip() or None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def origenes_permitidos(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def proveedores_de_precio(self) -> list[str]:
        return [p.strip() for p in self.PRICE_PROVIDER_ORDER.split(",") if p.strip()]

    @computed_field  # type: ignore[prop-decorator]
    @property
    def jwks_url(self) -> str:
        """De dónde salen las claves públicas para verificar los JWT (§8.8)."""
        return f"{self.SUPABASE_URL}/auth/v1/.well-known/jwks.json"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def es_produccion(self) -> bool:
        return self.APP_ENV == "production"

    def validar_coherencia(self) -> list[str]:
        """Avisos de configuración sospechosa, sin impedir el arranque."""
        avisos: list[str] = []
        if not self.es_sqlite and ":6543" not in self.DATABASE_URL:
            avisos.append(
                "DATABASE_URL no usa el pooler (6543): en serverless se agotan "
                "las conexiones directas"
            )
        if self.es_produccion and not self.SUPABASE_ANON_KEY:
            avisos.append("SUPABASE_ANON_KEY vacía: el frontend no podría autenticar")
        return avisos


@lru_cache
def get_settings() -> Settings:
    """Una sola instancia por proceso. `lru_cache` la memoriza."""
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
