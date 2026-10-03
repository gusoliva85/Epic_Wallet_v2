"""Verifica la configuración de Alembic y sus protecciones.

Corresponde a la tarea F00-T05. No aplica migraciones contra la base:
comprueba que la configuración existe, que los metadatos toman el
esquema del entorno, y que `migrations/env.py` aborta en los tres
casos peligrosos en lugar de asumir un esquema.

Es lo que impide que una migración caiga sobre los datos reales.
"""

from __future__ import annotations

import configparser
import os
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]


# ==================================================================
#  Archivos y configuración
# ==================================================================
@pytest.mark.unit
def test_los_archivos_de_alembic_existen() -> None:
    for ruta in ("alembic.ini", "migrations/env.py", "migrations/script.py.mako"):
        assert (RAIZ / ruta).exists(), f"falta {ruta}"


@pytest.mark.unit
def test_alembic_ini_no_trae_la_url_de_la_base() -> None:
    """La URL se lee del entorno. Si estuviera acá, terminaría en el repositorio."""
    ini = configparser.ConfigParser()
    ini.read(RAIZ / "alembic.ini", encoding="utf-8")
    url = ini.get("alembic", "sqlalchemy.url", fallback="")
    assert not url, "alembic.ini no debe traer sqlalchemy.url: va en DATABASE_URL"


@pytest.mark.unit
def test_env_py_no_tiene_esquema_por_defecto() -> None:
    """Un valor por defecto es justo lo que no debe existir."""
    codigo = (RAIZ / "migrations" / "env.py").read_text(encoding="utf-8")
    for peligroso in ('getenv("DB_SCHEMA", "public")', "getenv('DB_SCHEMA', 'public')"):
        assert peligroso not in codigo, "DB_SCHEMA no puede tener 'public' por defecto"
    assert "version_table_schema" in codigo, "falta fijar version_table_schema"
    assert "include_schemas" in codigo, "falta include_schemas"


# ==================================================================
#  Metadatos
# ==================================================================
@pytest.mark.unit
def test_los_metadatos_toman_el_esquema_del_entorno(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql+psycopg://u:p@h:6543/postgres")
    monkeypatch.setenv("DB_SCHEMA", "dev")
    import importlib

    from app.models import base

    importlib.reload(base)
    assert base.metadata.schema == "dev"


@pytest.mark.unit
def test_en_sqlite_no_hay_esquema(monkeypatch: pytest.MonkeyPatch) -> None:
    """SQLite no soporta esquemas: tiene que quedar en None."""
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///./test.db")
    monkeypatch.setenv("DB_SCHEMA", "dev")
    import importlib

    from app.models import base

    importlib.reload(base)
    assert base.metadata.schema is None


@pytest.mark.unit
def test_la_convencion_de_nombres_esta_definida() -> None:
    """Sin convención, cada máquina genera migraciones distintas."""
    from app.models.base import metadata

    convencion = metadata.naming_convention
    for clave in ("ix", "uq", "ck", "fk", "pk"):
        assert clave in convencion, f"falta la convención para '{clave}'"


# ==================================================================
#  Protecciones de env.py
# ==================================================================
def _correr_alembic(entorno: dict[str, str]) -> subprocess.CompletedProcess[str]:
    """Corre `alembic current` con un entorno controlado, ignorando el .env.

    EPIC_WALLET_IGNORAR_DOTENV evita que env.py lea el .env del
    proyecto: sin eso, DB_SCHEMA siempre estaría definido y la
    protección no se podría probar.
    """
    env = {k: v for k, v in os.environ.items() if k not in {"DB_SCHEMA", "DATABASE_URL", "APP_ENV"}}
    env.update(entorno)
    env["EPIC_WALLET_IGNORAR_DOTENV"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"
    return subprocess.run(
        [sys.executable, "-m", "alembic", "current"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        cwd=RAIZ,
        timeout=90,
        check=False,
    )


@pytest.mark.unit
def test_aborta_sin_database_url() -> None:
    r = _correr_alembic({})
    assert r.returncode == 1, "tendría que abortar"
    assert "DATABASE_URL" in (r.stderr + r.stdout)


@pytest.mark.unit
def test_aborta_sin_db_schema() -> None:
    r = _correr_alembic({"DATABASE_URL": "postgresql+psycopg://u:p@localhost:6543/postgres"})
    assert r.returncode == 1, "tendría que abortar en lugar de asumir un esquema"
    assert "DB_SCHEMA" in (r.stderr + r.stdout)


@pytest.mark.unit
def test_aborta_si_desarrollo_apunta_a_produccion() -> None:
    """La protección más importante: no migrar los datos reales por descuido."""
    r = _correr_alembic(
        {
            "DATABASE_URL": "postgresql+psycopg://u:p@localhost:6543/postgres",
            "DB_SCHEMA": "public",
            "APP_ENV": "development",
        }
    )
    assert r.returncode == 1, "tendría que abortar"
    salida = r.stderr + r.stdout
    assert "public" in salida and "development" in salida
