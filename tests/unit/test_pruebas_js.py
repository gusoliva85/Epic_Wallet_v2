"""Corre las pruebas de JavaScript desde pytest.

Hay comportamiento del frontend que una prueba estática no puede
verificar: recargar en una ruta, volver con «atrás», qué botón queda
apagado en el último mes. Eso se prueba en `tests/js/` con jsdom y el
corredor que ya trae Node.

Este archivo existe para que `pytest` siga siendo el único comando que
hay que recordar y, sobre todo, para que esas pruebas no queden fuera
de la verificación por olvido. También se pueden correr solas con
`npm test`.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
PRUEBAS_JS = RAIZ / "tests" / "js"


def _archivos() -> list[Path]:
    return sorted(PRUEBAS_JS.glob("*.test.mjs"))


@pytest.mark.unit
def test_las_pruebas_js_estan_donde_pytest_las_busca() -> None:
    """Si alguien mueve la carpeta, la prueba de abajo se saltaría en
    silencio en lugar de fallar."""
    assert _archivos(), f"no hay pruebas .test.mjs en {PRUEBAS_JS}"


@pytest.mark.unit
def test_las_pruebas_de_javascript_pasan() -> None:
    """Corre `node --test tests/js/*.test.mjs`.

    Si Node no está instalado se salta en lugar de fallar: el backend
    tiene que poder verificarse sin el entorno del frontend. En la
    máquina de desarrollo y en CI, Node está y esto corre.
    """
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node no está instalado: las pruebas de JavaScript se saltan")

    resultado = subprocess.run(
        [node, "--test", "tests/js/*.test.mjs"],
        cwd=RAIZ,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=300,
    )
    assert resultado.returncode == 0, (
        "fallaron pruebas de JavaScript:\n" + (resultado.stdout or "") + (resultado.stderr or "")
    )

    # Un glob que no encaje con nada también devuelve 0: sin comprobar
    # la cuenta, esta prueba pasaría sin haber corrido nada.
    # El resumen de node viene prefijado con U+2139 (INFORMATION SOURCE).
    # Se escribe por código y no literal para que no quede un caracter
    # confuso en el archivo.
    resumen = re.compile("^" + chr(0x2139) + r" pass (\d+)", re.M)
    pasaron = resumen.search(resultado.stdout)
    assert pasaron, f"node no informó cuántas pruebas pasaron:\n{resultado.stdout}"

    # Cuántas tiene que haber se cuenta de los archivos, no se escribe
    # acá: así agregar pruebas nuevas no obliga a tocar este número, y
    # si un archivo entero deja de correr, la cuenta no cuadra y falla.
    declaradas = sum(
        len(re.findall(r"^\s*test\(", f.read_text(encoding="utf-8"), re.M)) for f in _archivos()
    )
    assert int(pasaron.group(1)) == declaradas, (
        f"pasaron {pasaron.group(1)} pruebas y en tests/js hay {declaradas} "
        f"declaradas: algún archivo no se está corriendo\n{resultado.stdout}"
    )
