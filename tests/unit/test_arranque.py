"""Verifica las protecciones de arranque de la aplicación.

Nacieron de un problema real detectado en F00-T09: una preview quedó
desplegada **sin `DB_SCHEMA`**, y sin esquema las consultas caen en el
que Postgres tenga por defecto —normalmente `public`, los datos
reales— sin que nada lo avise.

Estas pruebas son la red para que no vuelva a pasar.
"""

from __future__ import annotations

import importlib

import pytest


def _recargar_con(monkeypatch: pytest.MonkeyPatch, **entorno: str) -> object:
    """Recarga la configuración y main con un entorno dado."""
    base = {
        "DATABASE_URL": "postgresql+psycopg://u:p@h.pooler.supabase.com:6543/postgres",
        "SUPABASE_URL": "https://x.supabase.co",
    }
    for clave, valor in {**base, **entorno}.items():
        monkeypatch.setenv(clave, valor)
    for clave in ("DB_SCHEMA", "APP_ENV"):
        if clave not in entorno:
            monkeypatch.delenv(clave, raising=False)

    from app.core import config

    # Sin env_file, para que lea sólo lo que le pasamos.
    monkeypatch.setitem(config.Settings.model_config, "env_file", None)
    config.get_settings.cache_clear()
    config.settings = config.get_settings()

    from app import main

    importlib.reload(main)
    monkeypatch.setattr(main, "settings", config.settings)
    return main


@pytest.mark.unit
def test_aborta_si_falta_db_schema(monkeypatch: pytest.MonkeyPatch) -> None:
    """El caso de la preview mal configurada: sin esquema, no arranca."""
    main = _recargar_con(monkeypatch, APP_ENV="preview")
    with pytest.raises(SystemExit) as salida:
        main._verificar_arranque()  # type: ignore[attr-defined]
    assert salida.value.code == 1


@pytest.mark.unit
@pytest.mark.parametrize("entorno", ["development", "preview"])
def test_aborta_si_no_produccion_apunta_a_public(
    monkeypatch: pytest.MonkeyPatch, entorno: str
) -> None:
    main = _recargar_con(monkeypatch, APP_ENV=entorno, DB_SCHEMA="public")
    with pytest.raises(SystemExit) as salida:
        main._verificar_arranque()  # type: ignore[attr-defined]
    assert salida.value.code == 1


@pytest.mark.unit
def test_aborta_si_produccion_no_apunta_a_public(monkeypatch: pytest.MonkeyPatch) -> None:
    """Producción sobre 'dev' no destruye nada, pero nadie vería sus datos."""
    main = _recargar_con(monkeypatch, APP_ENV="production", DB_SCHEMA="dev")
    with pytest.raises(SystemExit) as salida:
        main._verificar_arranque()  # type: ignore[attr-defined]
    assert salida.value.code == 1


@pytest.mark.unit
@pytest.mark.parametrize(
    ("entorno", "esquema"),
    [("development", "dev"), ("preview", "dev"), ("production", "public")],
)
def test_arranca_con_las_combinaciones_validas(
    monkeypatch: pytest.MonkeyPatch, entorno: str, esquema: str
) -> None:
    main = _recargar_con(monkeypatch, APP_ENV=entorno, DB_SCHEMA=esquema)
    main._verificar_arranque()  # type: ignore[attr-defined]  # no debe lanzar


@pytest.mark.unit
def test_sqlite_no_necesita_esquema(monkeypatch: pytest.MonkeyPatch) -> None:
    """SQLite no soporta esquemas: la protección no debe aplicarle."""
    main = _recargar_con(
        monkeypatch,
        DATABASE_URL="sqlite+pysqlite:///./test.db",
        APP_ENV="development",
    )
    main._verificar_arranque()  # type: ignore[attr-defined]  # no debe lanzar
