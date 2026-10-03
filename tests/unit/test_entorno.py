"""Verifica que el entorno de desarrollo está correctamente montado.

Corresponde a la tarea F00-T02 del roadmap. No prueba lógica de negocio:
prueba que las herramientas y dependencias que el documento técnico exige
están instaladas y en la versión esperada.
"""

import sys
from importlib.metadata import version

import pytest


@pytest.mark.unit
def test_version_de_python() -> None:
    """El documento técnico fija Python 3.12 (02_Documento_Tecnico §3)."""
    assert sys.version_info >= (3, 12), f"Se requiere Python 3.12+, hay {sys.version}"


@pytest.mark.unit
@pytest.mark.parametrize(
    "modulo",
    [
        "fastapi",
        "pydantic",
        "pydantic_settings",
        "sqlalchemy",
        "alembic",
        "jwt",  # PyJWT
        "httpx",
        "psycopg",
    ],
)
def test_dependencias_de_produccion_importan(modulo: str) -> None:
    """Las ocho dependencias de producción tienen que poder importarse.

    Son las mismas que Vercel instalará desde requirements.txt.
    """
    __import__(modulo)


@pytest.mark.unit
def test_paquete_app_es_importable() -> None:
    """`api/app` se expone como paquete `app` (pip install -e .)."""
    import app

    assert app.__name__ == "app"


@pytest.mark.unit
def test_versiones_minimas() -> None:
    """Las versiones mayores deben coincidir con las fijadas en pyproject."""
    minimos = {
        "fastapi": 0,
        "pydantic": 2,
        "SQLAlchemy": 2,
        "PyJWT": 2,
        "alembic": 1,
    }
    for paquete, major_minimo in minimos.items():
        major = int(version(paquete).split(".")[0])
        assert major >= major_minimo, f"{paquete} {version(paquete)} es anterior a lo requerido"


@pytest.mark.unit
def test_decimal_para_dinero_no_float() -> None:
    """Recordatorio ejecutable de la regla de oro del proyecto.

    El dinero se maneja con Decimal, nunca con float: `0.1 + 0.2 != 0.3`
    en coma flotante, y los centavos no se redondean solos.
    Ver 02_Documento_Tecnico §6.1 y §7.
    """
    from decimal import Decimal

    assert 0.1 + 0.2 != 0.3
    assert Decimal("0.1") + Decimal("0.2") == Decimal("0.3")
