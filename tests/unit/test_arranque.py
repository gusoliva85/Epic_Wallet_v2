"""Verifica las protecciones de arranque de la aplicación.

Nacieron de un problema real detectado en F00-T09: una preview quedó
desplegada **sin `DB_SCHEMA`**, y sin esquema las consultas caen en el
que Postgres tenga por defecto —normalmente `public`, los datos
reales— sin que nada lo avise.

Estas pruebas son la red para que no vuelva a pasar.
"""

from __future__ import annotations

import importlib
import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]


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


@pytest.mark.unit
def test_el_motor_no_usa_sentencias_preparadas() -> None:
    """psycopg3 prepara sola una consulta repetida, y la sentencia queda
    guardada en la conexión DEL SERVIDOR.

    Con el pooler en modo transacción, esa conexión se le entrega
    después a otro cliente que no sabe que existe: la próxima vez que se
    prepare el mismo nombre, Postgres responde «prepared statement
    "_pg3_0" already exists» y la petición falla.

    Apareció de verdad en F02-T05, en cuanto las pruebas repitieron las
    mismas consultas. En producción habría aparecido sola con el uso, de
    forma intermitente y muy difícil de atribuir.
    """
    fuente = (RAIZ / "api" / "app" / "core" / "db.py").read_text(encoding="utf-8")
    sin_comentarios = re.sub(r"^\s*#.*$", "", fuente, flags=re.M)
    assert '"prepare_threshold": None' in sin_comentarios, (
        "el motor tiene que desactivar las sentencias preparadas"
    )


@pytest.mark.unit
def test_cada_conexion_arranca_con_el_rol_limpio() -> None:
    """El pooler reparte las conexiones del servidor entre clientes. Si
    alguien deja un `set role` de sesión puesto, esa conexión vuelve al
    pool con el rol cambiado y se la entrega a quien siga.

    Pasó en F02-T05: una prueba de mutación cambió `set local role` por
    `set role` y dejó todas las conexiones del proyecto como
    `authenticated`.
    """
    fuente = (RAIZ / "api" / "app" / "core" / "db.py").read_text(encoding="utf-8")
    assert '"reset role"' in fuente or "'reset role'" in fuente, (
        "la conexión tiene que limpiar el rol al abrirse"
    )
    assert "def _limpiar_rol" in fuente, (
        "y también por transacción: el pooler asigna la conexión del "
        "servidor por transacción, no por cliente"
    )
