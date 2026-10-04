"""El vidrio de las dos barras de navegación y el tinte de las tarjetas.

Correcciones pedidas por Gustavo después de ver F01-T10 en el teléfono:
las barras tenían tanta transparencia que las letras se confundían con
el contenido que pasaba por detrás, y las tarjetas de métrica no se
distinguían entre sí.

Las dos cosas son de contraste, así que acá se calcula de verdad y no
se mira si el CSS «dice» algo.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from tests.unit.test_contraste import contraste

RAIZ = Path(__file__).resolve().parents[2]
ESTILOS = RAIZ / "web" / "src" / "styles"
TOKENS = ESTILOS / "tokens.css"
COMPONENTES = ESTILOS / "components.css"

Color = tuple[int, int, int]


def _hex(texto: str) -> Color:
    t = texto.lstrip("#")
    return (int(t[0:2], 16), int(t[2:4], 16), int(t[4:6], 16))


def _token(nombre: str, *, oscuro: bool = False) -> str:
    css = TOKENS.read_text(encoding="utf-8")
    if oscuro:
        css = css[css.index('html[data-theme="dark"] {') :]
    m = re.search(rf"{re.escape(nombre)}:\s*([^;]+);", css)
    assert m, f"falta {nombre} ({'oscuro' if oscuro else 'claro'})"
    return m.group(1).strip()


def _rgba(texto: str) -> tuple[Color, float]:
    m = re.match(r"rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)", texto)
    assert m, f"no es un rgba: {texto}"
    return ((int(m[1]), int(m[2]), int(m[3])), float(m[4]))


def _sobre(base: Color, alfa: float, fondo: Color) -> Color:
    return tuple(round(base[i] * alfa + fondo[i] * (1 - alfa)) for i in range(3))  # type: ignore[return-value]


def _mezcla(a: Color, b: Color, parte: float) -> Color:
    return tuple(round(a[i] * parte + b[i] * (1 - parte)) for i in range(3))  # type: ignore[return-value]


def _css() -> str:
    return COMPONENTES.read_text(encoding="utf-8")


def _regla(nombre: str) -> str:
    m = re.search(re.escape(nombre) + r"\s*\{([^}]*)\}", _css())
    assert m, f"no existe la regla {nombre}"
    return m.group(1)


def _tintes_del_fondo() -> list[int]:
    """Los porcentajes de tinte de la declaración `background`.

    No sirve buscarlos en toda la regla: el borde lleva un tinte más
    fuerte a propósito, y ahí no hay texto encima.
    """
    fondo = re.search(r"background:(.*?);", _regla(".kpi-color"), re.S)
    assert fondo, "la tarjeta teñida no declara background"
    valores = [int(x) for x in re.findall(r"var\(--c\) (\d+)%", fondo.group(1))]
    assert valores, "no se encontró el tinte del fondo"
    return valores


# --------------------------------------------------- las barras, legibles


@pytest.mark.unit
@pytest.mark.parametrize("oscuro", [False, True], ids=["claro", "oscuro"])
def test_el_vidrio_de_las_barras_es_casi_opaco(oscuro: bool) -> None:
    """Es lo que arruinaba la lectura: con el vidrio de una tarjeta
    —52% de opacidad— las letras de las barras se mezclaban con el
    contenido que pasa por detrás al hacer scroll.
    """
    _, alfa = _rgba(_token("--glass-bar-bg", oscuro=oscuro))
    assert alfa >= 0.9, f"el vidrio de las barras está al {alfa:.0%} y tiene que ser casi opaco"

    _, alfa_tarjeta = _rgba(_token("--glass-shell-bg", oscuro=oscuro))
    assert alfa > alfa_tarjeta, "la barra tiene que ser MÁS opaca que una tarjeta, no igual"


@pytest.mark.unit
def test_el_desenfoque_de_las_barras_es_el_minimo() -> None:
    barra = int(_token("--glass-bar-blur").removesuffix("px"))
    tarjeta = int(_token("--glass-shell-blur").removesuffix("px"))
    assert barra < tarjeta, "la barra se desenfoca menos que una tarjeta"


@pytest.mark.unit
@pytest.mark.parametrize("oscuro", [False, True], ids=["claro", "oscuro"])
def test_la_tinta_contrasta_sobre_las_barras(oscuro: bool) -> None:
    """El peor caso: el respaldo opaco de la barra sobre el lavado más
    contrastante del fondo.

    La etiqueta de la barra inferior usa `--color-ink-3` a 9,5 px, que
    es el texto más chico de la aplicación: es el que tiene que pasar.
    """
    base, alfa = _rgba(_token("--glass-bar-fallback", oscuro=oscuro))
    lavado = _hex(_token("--color-wash-a", oscuro=oscuro))
    fondo = _sobre(base, alfa, lavado)

    minimos = {"--color-ink": 4.5, "--color-ink-2": 4.5, "--color-ink-3": 4.5}
    for tinta, minimo in minimos.items():
        r = contraste(_hex(_token(tinta, oscuro=oscuro)), fondo)
        assert r >= minimo, (
            f"{tinta} sobre la barra en tema "
            f"{'oscuro' if oscuro else 'claro'} da {r:.2f}:1, mínimo {minimo}:1"
        )


@pytest.mark.unit
def test_las_barras_no_llevan_el_brillo_diagonal() -> None:
    """`.shell::before` pone un degradado blanco encima del contenido.
    Sobre una etiqueta de 9,5 px, ese velo es la diferencia entre leerla
    y no leerla.
    """
    css = _css()
    m = re.search(r"\.topbar::before,\s*\.botnav::before \{([^}]*)\}", css)
    assert m, "falta anular el brillo diagonal en las dos barras"
    assert "content: none" in m.group(1)


@pytest.mark.unit
def test_las_barras_tienen_su_degradacion() -> None:
    """Sin `backdrop-filter`, opacas del todo: si no, el texto queda
    sobre un fondo semitransparente sin desenfocar."""
    css = _css()
    # Prettier parte `@supports not (` en dos líneas, así que el patrón
    # no puede exigir los dos paréntesis seguidos.
    bloques = re.findall(r"@supports not \(.*?\{(.*?)\n\}", css, re.S)
    assert any("--glass-bar-fallback" in b for b in bloques), (
        "las barras necesitan su propio respaldo opaco"
    )


@pytest.mark.unit
def test_la_barra_inferior_achico_la_letra_pero_no_el_area_tactil() -> None:
    """Gustavo pidió la barra «apenas más chica», con los iconos igual.
    Lo que se achicó es el texto y el relleno; los 44 px de área táctil
    no se tocan.
    """
    assert _token("--text-nav") == "9.5px"
    assert "min-height: 44px" in _regla(".botnav button"), "el área táctil de 44 px no se negocia"
    assert "width: 19px" in _regla(".botnav button svg"), "el icono queda del mismo tamaño"


# ------------------------------------------- las tarjetas, identificables


@pytest.mark.unit
@pytest.mark.parametrize("oscuro", [False, True], ids=["claro", "oscuro"])
def test_el_tinte_de_la_tarjeta_no_arruina_el_subtitulo(oscuro: bool) -> None:
    """Esto es lo que obligó a subir un nivel de tinta.

    Sobre el vidrio neutro, `--color-ink-3` da justo 4,5:1. Con la
    tarjeta teñida el fondo deja de ser neutro y cae a 3,89:1, por
    debajo del mínimo del propio sistema. Por eso la etiqueta y el
    subtítulo de una tarjeta teñida usan `--color-ink-2`.
    """
    base, alfa = _rgba(_token("--glass-shell-fallback", oscuro=oscuro))
    lavado = _hex(_token("--color-wash-a", oscuro=oscuro))
    vidrio = _sobre(base, alfa, lavado)

    # El más fuerte de los dos extremos del degradado del fondo.
    tinte = max(_tintes_del_fondo()) / 100

    ink2 = _hex(_token("--color-ink-2", oscuro=oscuro))
    for color in ("--color-inc", "--color-egr", "--color-warn", "--color-accent"):
        fondo = _mezcla(_hex(_token(color, oscuro=oscuro)), vidrio, tinte)
        r = contraste(ink2, fondo)
        assert r >= 4.5, (
            f"el subtítulo sobre una tarjeta de {color} en tema "
            f"{'oscuro' if oscuro else 'claro'} da {r:.2f}:1"
        )


@pytest.mark.unit
def test_la_tarjeta_tenida_sube_la_tinta_de_etiqueta_y_subtitulo() -> None:
    css = _css()
    m = re.search(r"\.kpi-color \.kpi-label,\s*\.kpi-color \.kpi-sub \{([^}]*)\}", css)
    assert m, "falta subir la tinta en la tarjeta teñida"
    assert "var(--color-ink-2)" in m.group(1)


@pytest.mark.unit
def test_el_tinte_es_sutil() -> None:
    """Gustavo: «no tiene que tapar la información, tiene que ser muy
    sutil». Un tinte fuerte hace que el fondo compita con la cifra."""
    tinte = max(_tintes_del_fondo())
    assert tinte <= 20, f"el tinte del fondo está en {tinte}% y es demasiado"


@pytest.mark.unit
def test_la_silueta_es_muy_traslucida() -> None:
    assert "opacity: var(--marca-op)" in _regla(".kpi-marca")
    claro = float(_token("--marca-op"))
    oscuro = float(_token("--marca-op", oscuro=True))
    assert claro <= 0.2, f"la silueta clara está al {claro:.0%}: se ve como una mancha"
    assert oscuro > claro, (
        "en oscuro hace falta más opacidad: un trazo al 13% sobre un fondo casi negro no se ve"
    )


@pytest.mark.unit
def test_la_silueta_no_recibe_toques() -> None:
    """Está encima de la tarjeta: sin esto se come los clics."""
    assert "pointer-events: none" in _regla(".kpi-marca")


@pytest.mark.unit
def test_la_silueta_toma_el_color_de_la_tarjeta() -> None:
    cuerpo = _regla(".kpi-marca")
    assert "var(--c" in cuerpo, "la silueta tiene que ser del color de la tarjeta"
    assert "stroke: currentColor" in cuerpo
    assert "fill: none" in cuerpo, "es una silueta de trazo, no una figura rellena"
