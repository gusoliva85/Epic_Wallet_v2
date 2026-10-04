"""Avisos, píldoras y notificaciones. Corresponde a F01-T12.

El toast y el escape se prueban en `tests/js/avisos.test.mjs`. Acá va
el criterio que no se puede ver con jsdom, porque jsdom no aplica hojas
de estilo: **que las cuatro severidades se distingan en claro y en
oscuro**. Eso es contraste y se calcula.
"""

from __future__ import annotations

import re
from itertools import combinations
from pathlib import Path

import pytest

from tests.unit.test_contraste import contraste

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
INDEX = WEB / "index.html"
ESTILOS = WEB / "src" / "styles"
TOKENS = ESTILOS / "tokens.css"
COMPONENTES = ESTILOS / "components.css"

Color = tuple[int, int, int]

# Las cuatro severidades más la informativa.
SEVERIDADES = ("--color-ok", "--color-warn", "--color-pend", "--color-crit")
TODAS = (*SEVERIDADES, "--color-accent")


def _hex(texto: str) -> Color:
    """Acepta las dos formas. `--mix-tint` vale `#fff` en tema claro, y
    leerlo como si fuera de seis dígitos da una cadena vacía."""
    t = texto.strip().lstrip("#")
    if len(t) == 3:
        t = "".join(c * 2 for c in t)
    assert len(t) == 6, f"no es un color hexadecimal: {texto}"
    return (int(t[0:2], 16), int(t[2:4], 16), int(t[4:6], 16))


def _token(nombre: str, *, oscuro: bool = False) -> str:
    css = TOKENS.read_text(encoding="utf-8")
    if oscuro:
        css = css[css.index('html[data-theme="dark"] {') :]
    m = re.search(rf"{re.escape(nombre)}:\s*([^;]+);", css)
    assert m, f"falta {nombre} ({'oscuro' if oscuro else 'claro'})"
    return m.group(1).strip()


def _mezcla(a: Color, b: Color, parte: float) -> Color:
    return tuple(round(a[i] * parte + b[i] * (1 - parte)) for i in range(3))  # type: ignore[return-value]


def _css() -> str:
    return COMPONENTES.read_text(encoding="utf-8")


def _regla(nombre: str) -> str:
    m = re.search(re.escape(nombre) + r"\s*\{([^}]*)\}", _css())
    assert m, f"no existe la regla {nombre}"
    return m.group(1)


def _proporciones(selector: str) -> tuple[float, float]:
    """Las dos mezclas de una regla: la del fondo y la del texto."""
    cuerpo = _regla(selector)
    fondo = re.search(r"background: color-mix\(in srgb, var\(--c\) (\d+)%", cuerpo)
    texto = re.search(r"color: color-mix\(in srgb, var\(--c\) (\d+)%", cuerpo)
    assert fondo and texto, f"{selector} no mezcla fondo y texto como se espera"
    return int(fondo.group(1)) / 100, int(texto.group(1)) / 100


def _superficie(sev: str, parte: float, *, oscuro: bool) -> Color:
    tinte = _hex(_token("--mix-tint", oscuro=oscuro))
    return _mezcla(_hex(_token(sev, oscuro=oscuro)), tinte, parte)


def _tinta(sev: str, parte: float, *, oscuro: bool) -> Color:
    ink = _hex(_token("--mix-ink", oscuro=oscuro))
    return _mezcla(_hex(_token(sev, oscuro=oscuro)), ink, parte)


# --------------------------------------- se leen, en los dos temas


@pytest.mark.unit
@pytest.mark.parametrize("oscuro", [False, True], ids=["claro", "oscuro"])
@pytest.mark.parametrize("sev", TODAS)
def test_la_pildora_se_lee(sev: str, oscuro: bool) -> None:
    """El mockup mezclaba el texto al 80% del color. En tema claro, con
    esa proporción el ámbar daba 3,51:1 y el naranja 4,29:1, los dos por
    debajo del mínimo. Por eso acá el texto va al 60%.
    """
    fondo_p, texto_p = _proporciones(".pill")
    r = contraste(_tinta(sev, texto_p, oscuro=oscuro), _superficie(sev, fondo_p, oscuro=oscuro))
    assert r >= 4.5, f"la píldora {sev} en tema {'oscuro' if oscuro else 'claro'} da {r:.2f}:1"


@pytest.mark.unit
@pytest.mark.parametrize("oscuro", [False, True], ids=["claro", "oscuro"])
@pytest.mark.parametrize("sev", TODAS)
def test_el_icono_del_aviso_se_distingue_de_su_fondo(sev: str, oscuro: bool) -> None:
    """Un icono es un gráfico, no texto: el mínimo es 3:1. Por eso
    conserva más color que el texto de la píldora."""
    fondo_p, texto_p = _proporciones(".alert-ico")
    r = contraste(_tinta(sev, texto_p, oscuro=oscuro), _superficie(sev, fondo_p, oscuro=oscuro))
    assert r >= 3.0, f"el icono de {sev} en tema {'oscuro' if oscuro else 'claro'} da {r:.2f}:1"


# ------------------------------------- se distinguen ENTRE SÍ


def _iconos_por_severidad() -> dict[str, str]:
    js = (WEB / "src" / "js" / "components" / "avisos.js").read_text(encoding="utf-8")
    m = re.search(r"const SEVERIDADES = \{(.*?)\n\};", js, re.S)
    assert m, "falta el catálogo de severidades"
    return dict(re.findall(r'(\w+): \{[^}]*icono: "([\w-]+)"', m.group(1)))


@pytest.mark.unit
@pytest.mark.parametrize("oscuro", [False, True], ids=["claro", "oscuro"])
def test_las_severidades_parecidas_se_distinguen_por_la_forma(oscuro: bool) -> None:
    """Criterio de aceptación de la tarea, resuelto por donde se puede.

    Medir esto reveló algo que no se arregla con CSS: **el ámbar y el
    naranja son colores parecidos**. En el fondo de la píldora, que es
    una mezcla al 15%, la distancia entre los dos es de 7 sobre 765; en
    el texto, al 60%, sube sólo a 31. Ninguna proporción los separa de
    verdad, y subirla más rompe el contraste del texto.

    Por eso la regla del sistema no es «que los colores se distingan»
    sino que **el color no sea el único portador**. Lo que esta prueba
    exige: dos severidades de color parecido tienen que llevar iconos
    distintos. `warn` y `crit` comparten el triángulo, y pueden, porque
    sus colores están lejos (81 contra 31).
    """
    _, texto_p = _proporciones(".pill")
    tintas = {s: _tinta(s, texto_p, oscuro=oscuro) for s in SEVERIDADES}
    iconos = _iconos_por_severidad()

    confundibles = []
    for a, b in combinations(SEVERIDADES, 2):
        distancia = sum(abs(tintas[a][i] - tintas[b][i]) for i in range(3))
        corto_a, corto_b = a.removeprefix("--color-"), b.removeprefix("--color-")
        if distancia < 60 and iconos.get(corto_a) == iconos.get(corto_b):
            confundibles.append(
                f"{corto_a} y {corto_b}: distancia de color {distancia} y el "
                f"mismo icono «{iconos.get(corto_a)}»"
            )

    assert not confundibles, (
        f"en tema {'oscuro' if oscuro else 'claro'} no hay forma de distinguir: {confundibles}"
    )


@pytest.mark.unit
def test_el_color_no_es_lo_unico_que_dice_la_gravedad() -> None:
    """Regla del sistema. Quien no distingue el rojo del ámbar necesita
    que cambien la forma y el texto, no sólo el tono."""
    js = (WEB / "src" / "js" / "components" / "avisos.js").read_text(encoding="utf-8")
    m = re.search(r"const SEVERIDADES = \{(.*?)\n\};", js, re.S)
    assert m, "falta el catálogo de severidades"

    iconos = re.findall(r'icono:\s*"([\w-]+)"', m.group(1))
    nombres = re.findall(r'nombre:\s*"([^"]+)"', m.group(1))
    assert len(nombres) == 5, f"cada severidad necesita su nombre: {nombres}"
    assert len(set(nombres)) == 5, f"nombres repetidos: {nombres}"
    # El dibujo puede repetirse (el triángulo sirve para «atención» y
    # para «crítico»), pero no todos pueden ser el mismo.
    assert len(set(iconos)) >= 3, f"casi todos usan el mismo icono: {iconos}"


# ------------------------------------------------- la región del toast


@pytest.mark.unit
def test_la_region_del_toast_existe_vacia_en_el_html() -> None:
    """Un lector anuncia los CAMBIOS dentro de una región `aria-live`.
    Creada junto con el texto, no hay cambio que anunciar y el mensaje
    pasa en silencio. Por eso está en el HTML desde el principio.
    """
    html = INDEX.read_text(encoding="utf-8")
    m = re.search(r'<div[^>]*id="toast"[^>]*>(.*?)</div>', html, re.S)
    assert m, "falta la región del toast"
    assert 'aria-live="polite"' in m.group(0)
    assert 'aria-atomic="true"' in m.group(0), (
        "sin aria-atomic, el lector puede anunciar sólo la parte que cambió"
    )
    assert not m.group(1).strip(), "la región tiene que arrancar vacía"


@pytest.mark.unit
def test_el_toast_no_tapa_la_barra_inferior() -> None:
    """Tapado por la barra o por el botón flotante, el mensaje no se
    lee."""
    cuerpo = _regla(".toast")
    assert "150px" in cuerpo and "env(safe-area-inset-bottom)" in cuerpo
    m = re.search(r"@media \(min-width: 960px\) \{\s*\.toast \{\s*bottom:", _css())
    assert m, "sin barra inferior debajo, el mensaje tiene que bajar"


@pytest.mark.unit
def test_el_toast_vacio_no_ocupa_lugar_ni_desaparece_del_arbol() -> None:
    """Con `display: none` el lector dejaría de observar la región."""
    cuerpo = _regla(".toast:empty")
    assert "display" not in cuerpo, (
        "la región no se puede ocultar con display: dejaría de anunciarse"
    )
    assert "padding: 0" in cuerpo


@pytest.mark.unit
def test_la_salida_del_toast_dura_lo_que_dice_el_javascript() -> None:
    """El módulo espera `SALIDA` antes de sacar el siguiente de la cola.
    Si el CSS tardara más, los dos mensajes se cruzarían en pantalla.
    """
    js = (WEB / "src" / "js" / "components" / "toast.js").read_text(encoding="utf-8")
    m = re.search(r"export const SALIDA = (\d+);", js)
    assert m, "falta la constante de salida"
    salida_js = int(m.group(1)) / 1000

    duraciones = [float(x) for x in re.findall(r"(\d*\.?\d+)s var\(--ease\)", _regla(".toast"))]
    assert duraciones, "la transición del toast no usa la curva del sistema"
    assert max(duraciones) <= salida_js, (
        f"el CSS tarda {max(duraciones)}s en irse y el JavaScript espera "
        f"{salida_js}s: los dos mensajes se cruzan"
    )
