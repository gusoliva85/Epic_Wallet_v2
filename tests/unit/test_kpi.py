"""Tarjetas de indicador. Corresponde a F01-T09.

El escape, las variantes y la barra se prueban en
`tests/js/kpi.test.mjs` con jsdom: insertar un `<img onerror>` y mirar
si corrió es lo único que verifica de verdad que `esc()` está puesto y
bien puesto.

Acá va lo que esa prueba no alcanza: la rejilla en los tres cortes, el
escalonado de 60 ms —los dos son CSS— y una cosa que jsdom no puede
distinguir y se explica abajo.
"""

from __future__ import annotations

import re
from itertools import pairwise
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
INDEX = WEB / "index.html"
COMPONENTES = WEB / "src" / "styles" / "components.css"
KPI_JS = WEB / "src" / "js" / "components" / "kpi.js"


def _css() -> str:
    return COMPONENTES.read_text(encoding="utf-8")


def _regla(nombre: str) -> str:
    m = re.search(re.escape(nombre) + r"\s*\{([^}]*)\}", _css())
    assert m, f"no existe la regla {nombre}"
    return m.group(1)


def _media(ancho: int) -> str:
    """Junta todos los bloques de un ancho dado."""
    bloques = re.findall(rf"@media \(min-width: {ancho}px\) \{{(.*?)\n\}}", _css(), re.S)
    assert bloques, f"no hay bloques de {ancho}px"
    return "\n".join(bloques)


# ------------------------------------------------- la rejilla en los tres cortes


@pytest.mark.unit
def test_la_rejilla_arranca_en_dos_columnas() -> None:
    """Mobile-first. Tres columnas no entran en 390 px sin que las
    cifras se corten."""
    assert "grid-template-columns: repeat(2, 1fr)" in _regla(".kpi-grid")


@pytest.mark.unit
def test_la_rejilla_pasa_a_cuatro_y_a_seis() -> None:
    """Criterio de aceptación: los tres cortes de la skill §5."""
    assert re.search(r"\.kpi-grid \{\s*grid-template-columns: repeat\(4, 1fr\)", _media(640)), (
        "faltan las cuatro columnas desde 640 px"
    )
    assert re.search(r"\.kpi-grid \{\s*grid-template-columns: repeat\(6, 1fr\)", _media(1024)), (
        "faltan las seis columnas desde 1024 px"
    )


@pytest.mark.unit
def test_la_heroe_ocupa_media_fila_en_cada_corte() -> None:
    """Así la cifra importante conserva su peso cuando hay más
    columnas: 2 de 2, 2 de 4 y 3 de 6."""
    assert "grid-column: span 2" in _regla(".kpi--hero")
    assert re.search(r"\.kpi--hero \{\s*grid-column: span 3", _media(1024)), (
        "con seis columnas la héroe tiene que ocupar tres"
    )


# ------------------------------------------------------- el escalonado


@pytest.mark.unit
def test_el_escalonado_es_de_60ms() -> None:
    """Criterio de aceptación. La tabla de la skill §6 pide 500 ms de
    duración y +60 ms por tarjeta."""
    css = _css()
    assert re.search(r"\.stagger > \* \{\s*animation: entrada 0\.5s", css), (
        "la duración de la entrada de tarjeta es de 500 ms"
    )

    retardos = [
        int(m)
        for m in re.findall(r"\.stagger > \*:nth-child\(\d+\) \{\s*animation-delay: (\d+)ms", css)
    ]
    assert len(retardos) >= 6, f"hay pocos escalones declarados: {retardos}"
    assert retardos == sorted(retardos), f"los retardos no crecen: {retardos}"
    pasos = {b - a for a, b in pairwise(retardos)}
    assert pasos == {60}, f"el escalón tiene que ser de 60 ms y es de {pasos}"


@pytest.mark.unit
def test_el_escalonado_se_congela_pasada_la_octava() -> None:
    """Con 20 filas, la última entraría más de un segundo después y
    parecería que la pantalla se cuelga por partes."""
    assert re.search(r"\.stagger > \*:nth-child\(n \+ 9\) \{\s*animation-delay: \d+ms", _css()), (
        "falta el tope del escalonado"
    )


@pytest.mark.unit
def test_el_movimiento_reducido_tambien_anula_el_retardo() -> None:
    """`base.css` anula la DURACIÓN de las animaciones, no el retardo.
    Sin esto, con movimiento reducido las tarjetas siguen apareciendo de
    a una, sólo que de golpe.
    """
    css = _css()
    m = re.search(r"@media \(prefers-reduced-motion: reduce\) \{(.*?)\n\}", css, re.S)
    assert m, "falta el bloque de movimiento reducido en components.css"
    assert "animation-delay: 0ms !important" in m.group(1)


@pytest.mark.unit
def test_el_escalonado_no_usa_estilos_en_linea() -> None:
    """En CSS y no con `style` desde JavaScript: el retardo vive con el
    resto del estilo y un componente no tiene que saber en qué posición
    lo van a pintar."""
    js = KPI_JS.read_text(encoding="utf-8")
    assert "animation-delay" not in js
    assert "animation:" not in js


# --------------------------------------------- lo que jsdom no puede distinguir


@pytest.mark.unit
def test_la_barra_crece_en_el_frame_siguiente() -> None:
    """Esto se comprueba leyendo el código, y es a propósito.

    `requestAnimationFrame` y `queueMicrotask` son indistinguibles en
    jsdom: con los dos, la prueba ve el ancho puesto después. En un
    navegador no: una microtarea corre ANTES del pintado, así que el
    ancho se junta con el primer render y la transición no se ve. Como
    la diferencia no es observable en la suite, se verifica la forma del
    código y queda dicho por qué.
    """
    js = KPI_JS.read_text(encoding="utf-8")
    assert "requestAnimationFrame" in js
    assert "queueMicrotask" not in js
    assert "setTimeout" not in js, "un setTimeout acá haría que la barra crezca tarde y a destiempo"


@pytest.mark.unit
def test_la_barra_nace_en_cero_desde_el_css() -> None:
    """El ancho inicial va en la hoja de estilos, no en el HTML: si
    viniera en el atributo `style`, el valor real que pone el JavaScript
    tendría que pelearle la especificidad."""
    assert re.search(r"width:\s*0", _regla(".fin-fill"))
    assert "transition:" in _regla(".fin-fill")


# -------------------------------------------------- el contenedor de la muestra


@pytest.mark.unit
def test_la_rejilla_de_inicio_esta_y_va_vacia() -> None:
    html = INDEX.read_text(encoding="utf-8")
    m = re.search(r'<div class="kpi-grid stagger" id="kpis-inicio">(.*?)</div>', html, re.S)
    assert m, "falta la rejilla de inicio"
    assert not m.group(1).strip(), "la rejilla la llena views/inicio.js"


@pytest.mark.unit
def test_la_pantalla_avisa_que_las_cifras_son_de_muestra() -> None:
    """Una cifra creíble sin aclaración es peor que una vacía: se puede
    tomar por un dato real."""
    html = INDEX.read_text(encoding="utf-8")
    assert re.search(r"cifras de muestra", html, re.I), (
        "la vista de inicio tiene que decir que las cifras son de muestra"
    )
