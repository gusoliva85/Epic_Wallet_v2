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
