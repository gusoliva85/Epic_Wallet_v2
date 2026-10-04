"""Barra de mes. Corresponde a F01-T08.

El comportamiento —qué botón queda apagado en qué mes, el tope del
futuro, la vuelta a hoy— se prueba en `tests/js/barra-mes.test.mjs` con
jsdom. Acá va lo estático: que la barra esté en el HTML, que el estado
deshabilitado se VEA y que el título no se corte en una pantalla
angosta, que son los tres criterios de aceptación de la tarea.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from tests.unit.ayudas_html import botones_mudos

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
INDEX = WEB / "index.html"
COMPONENTES = WEB / "src" / "styles" / "components.css"
MES_JS = WEB / "src" / "js" / "barra-mes.js"


def _html() -> str:
    return INDEX.read_text(encoding="utf-8")


def _css() -> str:
    return COMPONENTES.read_text(encoding="utf-8")


def _regla(nombre: str) -> str:
    m = re.search(re.escape(nombre) + r"\s*\{([^}]*)\}", _css())
    assert m, f"no existe la regla {nombre}"
    return m.group(1)


# -------------------------------------------------------- está y es como el mockup


@pytest.mark.unit
def test_la_barra_de_mes_esta() -> None:
    html = _html()
    assert 'class="monthbar shell"' in html, "la barra de mes es una superficie de vidrio"
    for ident in ("mes-anterior", "mes-siguiente", "mes-hoy", "mes-titulo", "mes-estado"):
        assert f'id="{ident}"' in html, f"falta {ident}"


@pytest.mark.unit
def test_tiene_los_tres_controles_del_documento_general() -> None:
    """General §12.1 pide mes anterior, mes siguiente y volver al actual."""
    html = _html()
    assert 'aria-label="Mes anterior"' in html
    assert 'aria-label="Mes siguiente"' in html
    assert re.search(r'id="mes-hoy"[^>]*>\s*Hoy', html, re.S), (
        "el botón de volver al mes actual tiene que decir Hoy"
    )


@pytest.mark.unit
def test_la_barra_va_arriba_de_las_vistas() -> None:
    """Es la cabecera del mes en pantalla: debajo de las vistas no se
    entendería que aplica a todas."""
    html = _html()
    assert html.index('class="monthbar') < html.index('class="view"')


# ------------------------------------------------ el estado deshabilitado se ve


@pytest.mark.unit
def test_el_estado_deshabilitado_se_ve() -> None:
    """Criterio de aceptación. Sin estilo propio, un botón apagado se ve
    igual que uno activo y parece que la aplicación no responde."""
    cuerpo = _regla(".chip:disabled")
    assert "opacity" in cuerpo, "el botón apagado tiene que verse distinto"
    assert "cursor: not-allowed" in cuerpo


@pytest.mark.unit
def test_el_apagado_no_se_come_los_toques_del_de_al_lado() -> None:
    """El área táctil de la píldora es más grande que su recuadro. Si la
    de un botón apagado se mantuviera, un toque al lado del de al lado
    caería en el apagado y no pasaría nada.
    """
    assert "content: none" in _regla(".chip:disabled::after")


@pytest.mark.unit
def test_el_hover_no_se_aplica_a_lo_apagado() -> None:
    """Un botón que se levanta al pasarle el dedo parece tocable."""
    css = _css()
    assert ".chip:hover:not(:disabled)" in css, (
        "el hover de la píldora tiene que excluir el estado apagado"
    )
    assert ".chip:active:not(:disabled)" in css


@pytest.mark.unit
def test_las_pildoras_llegan_a_44px() -> None:
    """Las flechas son los botones más chicos de la aplicación."""
    cuerpo = _regla(".chip::after")
    assert "min-width: 44px" in cuerpo
    assert "height: 44px" in cuerpo
    assert "translate(-50%, -50%)" in cuerpo


# -------------------------------------------- el título no se corta


@pytest.mark.unit
def test_el_titulo_se_recorta_antes_de_desbordar() -> None:
    """Criterio de aceptación. En 320 px, con las dos flechas y «Hoy» a
    los costados, «Septiembre 2026» queda justo."""
    assert "min-width: 0" in _regla(".mb-title"), (
        "sin min-width:0 el título no se encoge y empuja los botones fuera"
    )
    for sel in (".mb-title b", ".mb-title span"):
        cuerpo = _regla(sel)
        assert "text-overflow: ellipsis" in cuerpo
        assert "white-space: nowrap" in cuerpo
        assert "overflow: hidden" in cuerpo, f"{sel}: ellipsis sin overflow no recorta"


@pytest.mark.unit
def test_los_controles_no_se_encogen() -> None:
    """Si el flex los comprime, dejan de ser tocables antes de que el
    título se recorte."""
    assert "flex: none" in _regla(".mb-nav")


# ------------------------------------------------------------- accesibilidad


@pytest.mark.unit
def test_el_cambio_de_mes_se_anuncia() -> None:
    """Quien no ve la pantalla toca la flecha y, sin región viva, no se
    entera de a qué mes pasó."""
    html = _html()
    m = re.search(r'<div class="mb-title"[^>]*>', html)
    assert m and 'aria-live="polite"' in m.group(0), "el título del mes va en una región aria-live"


@pytest.mark.unit
def test_los_botones_de_la_barra_de_mes_se_anuncian() -> None:
    mudos = botones_mudos(_html())
    assert not mudos, f"botones que no dicen nada: {mudos}"


@pytest.mark.unit
def test_la_barra_tiene_nombre() -> None:
    m = re.search(r"<section class=\"monthbar[^>]*>", _html())
    assert m and "aria-label" in m.group(0), (
        "una región sin nombre no se distingue al navegar con un lector"
    )


# --------------------------------------------------------- nada escrito a mano


@pytest.mark.unit
def test_el_mes_no_esta_escrito_a_mano() -> None:
    """Un título fijo sería mentira el mes que viene."""
    js = MES_JS.read_text(encoding="utf-8")
    assert "Intl.DateTimeFormat" in js, "el nombre del mes se calcula"
    html = _html()
    m = re.search(r'id="mes-titulo">([^<]*)<', html)
    assert m and m.group(1).strip() in ("—", ""), (
        f"el HTML trae un mes escrito a mano: {m.group(1) if m else '?'}"
    )


@pytest.mark.unit
def test_la_aplicacion_razona_en_hora_argentina() -> None:
    """Con la zona del dispositivo, alguien de viaje vería un mes que no
    es el suyo, y el día 1 o el 31 el mes cambiaría de nombre."""
    js = MES_JS.read_text(encoding="utf-8")
    assert "America/Argentina/Buenos_Aires" in js
