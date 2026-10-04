"""Filas de lista. Corresponde a F01-T10.

El signo, el color, el escape y la barra se prueban en
`tests/js/rows.test.mjs`. Acá va lo que es CSS y no se puede verificar
desde jsdom, porque jsdom no aplica hojas de estilo: el foco visible,
el hover y que el nombre largo de una categoría no empuje el importe
fuera de la fila.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
INDEX = WEB / "index.html"
COMPONENTES = WEB / "src" / "styles" / "components.css"
BASE = WEB / "src" / "styles" / "base.css"
ROWS_JS = WEB / "src" / "js" / "components" / "rows.js"


def _css() -> str:
    return COMPONENTES.read_text(encoding="utf-8")


def _regla(nombre: str) -> str:
    m = re.search(re.escape(nombre) + r"\s*\{([^}]*)\}", _css())
    assert m, f"no existe la regla {nombre}"
    return m.group(1)


# --------------------------------------------------------- el foco visible


@pytest.mark.unit
def test_la_fila_tiene_foco_visible() -> None:
    """Criterio de aceptación de la tarea."""
    cuerpo = _regla(".row:focus-visible")
    assert "var(--accent-ring)" in cuerpo, "el halo de foco sale del token del sistema"


@pytest.mark.unit
def test_el_foco_le_gana_al_hover() -> None:
    """Este es el detalle que casi se pasa.

    `:focus-visible` de base.css pone el halo con un selector de menor
    especificidad que `.row:hover`, que reemplaza `box-shadow`. Al pasar
    el dedo por una fila enfocada, el halo desaparecía. Por eso hay una
    regla propia con la misma especificidad, y lleva el halo dentro de
    su propia `box-shadow`.
    """
    css = _css()
    assert ".row:focus-visible" in css, "sin regla propia, el hover de la fila tapa el halo de foco"
    cuerpo = _regla(".row:focus-visible")
    assert "box-shadow" in cuerpo
    # El halo va primero: dibujado después de la sombra del vidrio
    # quedaría por debajo.
    assert cuerpo.index("var(--accent-ring)") < cuerpo.index("var(--glass-in)"), (
        "el halo tiene que ir antes que la sombra del vidrio"
    )


@pytest.mark.unit
def test_base_sigue_poniendo_el_foco_general() -> None:
    """La regla de la fila es una excepción, no un reemplazo: todo lo
    demás sigue tomando el foco de base.css."""
    base = BASE.read_text(encoding="utf-8")
    assert ":focus-visible" in base
    assert "var(--accent-ring)" in base


# -------------------------------------------------- hover y estado activo


@pytest.mark.unit
def test_la_fila_responde_al_hover_y_al_toque() -> None:
    """Criterio de aceptación: estados hover y activo."""
    assert "translateX(3px)" in _regla(".row:hover")
    assert "transform" in _regla(".row:active"), (
        "sin estado activo, en el teléfono no hay respuesta al toque: "
        "no hay hover en una pantalla táctil"
    )


# ------------------------------------------- el importe no se va de la fila


@pytest.mark.unit
def test_el_nombre_largo_se_recorta_y_no_empuja_el_importe() -> None:
    assert "min-width: 0" in _regla(".row-main"), (
        "sin min-width:0 la columna del medio no se encoge y el importe se sale de la fila"
    )
    for sel in (".row-main b", ".row-main > span"):
        cuerpo = _regla(sel)
        assert "text-overflow: ellipsis" in cuerpo
        assert "white-space: nowrap" in cuerpo
        assert "overflow: hidden" in cuerpo


@pytest.mark.unit
def test_la_rejilla_de_la_fila_es_de_tres_columnas() -> None:
    """Marca, contenido y valor. El valor en `auto`: ocupa lo que
    necesite y el medio se adapta."""
    assert "grid-template-columns: 34px 1fr auto" in _regla(".row")


# ----------------------------------------------------- color y contraste


@pytest.mark.unit
def test_los_importes_no_usan_el_color_puro() -> None:
    """El verde y el rojo puros sobre vidrio quedan por debajo del
    contraste mínimo. Se mezclan con la tinta."""
    for sel, token in ((".amt-in", "--color-inc"), (".amt-out", "--color-egr")):
        cuerpo = _regla(sel)
        assert "color-mix" in cuerpo, f"{sel} usa el color puro"
        assert token in cuerpo
        assert "var(--mix-ink)" in cuerpo, f"{sel} tiene que mezclar con la tinta del tema vigente"


# ------------------------------------------------- el menos tipográfico


@pytest.mark.unit
def test_el_menos_es_el_tipografico_y_no_un_guion() -> None:
    """El guión del teclado es más corto y a otra altura: al lado de un
    `+` en una columna de cifras, se nota."""
    js = ROWS_JS.read_text(encoding="utf-8")
    # El caracter se escribe por código: literal, queda confundible con
    # un guión en el propio archivo de la prueba.
    menos = chr(0x2212)
    assert "\u2212" in js or menos in js, "el signo menos tiene que ser U+2212, no el guión"


# --------------------------------------------------- los contenedores


@pytest.mark.unit
def test_las_listas_de_inicio_estan_y_van_vacias() -> None:
    html = INDEX.read_text(encoding="utf-8")
    for ident in ("movimientos-inicio", "categorias-inicio"):
        m = re.search(rf'<div class="rows" id="{ident}">(.*?)</div>', html, re.S)
        assert m, f"falta la lista {ident}"
        assert not m.group(1).strip(), f"{ident} la llena views/inicio.js"


@pytest.mark.unit
def test_cada_panel_se_puede_identificar() -> None:
    """Dos paneles seguidos sin nada que los nombre no se distinguen al
    recorrer la página con un lector de pantalla.

    Vale cualquiera de las dos formas: un `aria-labelledby` o un título
    visible adentro. Exigir el atributo a un panel que ya muestra su
    `<h2>` sería marcado de más que repite lo que ya está.
    """
    html = INDEX.read_text(encoding="utf-8")
    paneles = re.findall(r"<article class=\"card shell\"[^>]*>(.*?)</article>", html, re.S)
    assert len(paneles) >= 8, f"se esperaban los paneles de las siete vistas: {len(paneles)}"

    aperturas = re.findall(r"<article class=\"card shell\"[^>]*>", html, re.S)
    anonimos = [
        a
        for a, cuerpo in zip(aperturas, paneles, strict=True)
        if "aria-label" not in a and not re.search(r"<h[23][^>]*>", cuerpo)
    ]
    assert not anonimos, f"paneles sin título ni nombre: {anonimos}"


@pytest.mark.unit
def test_las_filas_no_llevan_estilos_de_animacion_en_linea() -> None:
    """El mockup escalona con `style="animation:..."` en cada fila. Acá
    el escalonado es `.stagger` en CSS: el retardo vive con el estilo y
    el componente no tiene que saber en qué posición lo van a pintar.
    """
    js = ROWS_JS.read_text(encoding="utf-8")
    assert "animation" not in js
    assert "animation-delay" not in js
