"""Enrutador por hash. Corresponde a F01-T07.

El comportamiento del enrutador se prueba en `tests/js/router.test.mjs`
con jsdom, porque los criterios de aceptación de la tarea son todos de
comportamiento —recargar en `#/inversiones`, volver con «atrás», caer
en inicio con una ruta inválida, no recargar la página— y una prueba
que lea el código fuente no puede verificar ninguno.

Este archivo hace dos cosas: correr esas pruebas desde pytest, para que
`pytest` siga siendo el único comando que hay que recordar y para que no
queden fuera de la verificación por olvido, y comprobar lo que sí es
estático: que el HTML tenga las siete vistas y que el enrutador arranque
después de las barras.
"""

from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
INDEX = WEB / "index.html"
ROUTER = WEB / "src" / "js" / "router.js"
PRUEBAS_JS = RAIZ / "tests" / "js"

SECCIONES = (
    "inicio",
    "movimientos",
    "historial",
    "inversiones",
    "patrimonio",
    "analisis",
    "config",
)


def _html() -> str:
    return INDEX.read_text(encoding="utf-8")


def _etiquetas_de_vista() -> list[str]:
    """Las siete etiquetas <section class="view" ...> completas.

    Prettier reparte los atributos en varias lineas, asi que no sirve
    buscarlos en la misma linea que el class.
    """
    return re.findall(r'<section[^>]*class="view"[^>]*>', _html(), re.S)


# ------------------------------------------------------ las pruebas de jsdom


@pytest.mark.unit
def test_las_pruebas_de_comportamiento_del_enrutador_pasan() -> None:
    """Corre `node --test tests/js/`.

    Si Node no está instalado la prueba se salta en lugar de fallar: el
    backend tiene que poder verificarse sin el entorno del frontend. En
    la máquina de desarrollo y en CI, Node está y esto corre.
    """
    node = shutil.which("node")
    if node is None:
        pytest.skip("Node no está instalado: las pruebas del enrutador se saltan")

    resultado = subprocess.run(
        [node, "--test", "tests/js/*.test.mjs"],
        cwd=RAIZ,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=180,
    )
    assert resultado.returncode == 0, (
        "fallaron pruebas del enrutador:\n" + (resultado.stdout or "") + (resultado.stderr or "")
    )
    # Que de verdad haya corrido algo: un glob que no encaje con nada
    # también devuelve 0 y la prueba pasaría sin probar nada.
    assert re.search(r"# pass (\d+)", resultado.stdout) or "pass " in resultado.stdout, (
        f"node no informó pruebas ejecutadas:\n{resultado.stdout}"
    )
    pasaron = re.search(r"pass (\d+)", resultado.stdout)
    assert pasaron and int(pasaron.group(1)) >= 15, (
        f"se esperaban al menos 15 pruebas del enrutador:\n{resultado.stdout}"
    )


@pytest.mark.unit
def test_las_pruebas_js_estan_donde_pytest_las_busca() -> None:
    """Si alguien mueve la carpeta, la prueba de arriba se saltaría en
    silencio en lugar de fallar."""
    archivos = list(PRUEBAS_JS.glob("*.test.mjs"))
    assert archivos, f"no hay pruebas .test.mjs en {PRUEBAS_JS}"


# --------------------------------------------------------- lo que es estático


@pytest.mark.unit
def test_las_siete_vistas_estan_en_el_html() -> None:
    vistas = [re.search(r'data-vista="([\w-]+)"', e).group(1) for e in _etiquetas_de_vista()]
    assert set(vistas) == set(SECCIONES), f"faltan o sobran vistas: {set(SECCIONES) ^ set(vistas)}"
    assert len(vistas) == 7, f"hay {len(vistas)} secciones y tienen que ser 7"


@pytest.mark.unit
def test_las_vistas_arrancan_ocultas() -> None:
    """La activa la decide el enrutador según el hash. Si alguna viniera
    visible desde el HTML, se vería un parpadeo de dos vistas antes de
    que el JavaScript corra.
    """
    secciones = _etiquetas_de_vista()
    assert len(secciones) == 7
    sin_ocultar = [s for s in secciones if "hidden" not in s]
    assert not sin_ocultar, f"estas vistas no arrancan ocultas: {sin_ocultar}"


@pytest.mark.unit
def test_cada_vista_tiene_nombre() -> None:
    """Una sección sin nombre accesible no se distingue de otra al
    navegar por regiones con un lector de pantalla."""
    html = _html()
    sin_nombre = [
        s
        for s in re.findall(r"<section class=\"view\"[^>]*>", html, re.S)
        if "aria-labelledby" not in s and "aria-label" not in s
    ]
    assert not sin_nombre, f"vistas sin nombre accesible: {sin_nombre}"


@pytest.mark.unit
def test_el_enrutador_arranca_despues_de_las_barras() -> None:
    """El orden importa: las dos barras registran su escucha de
    `epic:ruta` al conectarse, y el enrutador emite la primera ruta al
    arrancar. Al revés, esa primera ruta se emite sin nadie escuchando y
    ninguna de las dos barras queda marcada hasta el primer toque.
    """
    html = _html()
    orden = re.findall(r'<script type="module" src="/src/js/([\w-]+)\.js">', html)
    assert "app" in orden, "falta el punto de entrada"
    for barra in ("barra-superior", "barra-inferior"):
        assert barra in orden, f"falta {barra}"
        assert orden.index(barra) < orden.index("app"), (
            f"{barra} tiene que cargarse antes que app.js"
        )


@pytest.mark.unit
def test_el_enrutador_espera_al_dom() -> None:
    """Aunque el orden de los <script> alcance hoy, arrancar sin esperar
    al DOM rompería en cuanto alguien cambie un `type="module"` por un
    script normal."""
    js = ROUTER.read_text(encoding="utf-8")
    assert 'document.readyState === "loading"' in js
    assert "DOMContentLoaded" in js


@pytest.mark.unit
def test_el_enrutador_no_escribe_html_del_servidor() -> None:
    """Regla 5 de la skill. Acá no hay datos del servidor todavía, pero
    si alguien agrega `innerHTML` con una ruta sin escapar, la ruta
    viene del hash, que lo controla quien abre el enlace.
    """
    js = ROUTER.read_text(encoding="utf-8")
    assert "innerHTML" not in js, "el enrutador no tiene que escribir HTML: sólo muestra y esconde"
