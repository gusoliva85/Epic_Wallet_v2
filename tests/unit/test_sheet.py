"""Hoja inferior y cajón lateral. Corresponde a F01-T11.

El comportamiento —Escape, el foco atrapado, el fondo que no hace
scroll— se prueba en `tests/js/sheet.test.mjs` con jsdom, porque son
los cuatro criterios de aceptación y ninguno se verifica leyendo
código.

Acá va lo que jsdom no puede ver, que es todo CSS: las dos variantes de
escritorio y la duración de la transición.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
INDEX = WEB / "index.html"
COMPONENTES = WEB / "src" / "styles" / "components.css"
SHEET_JS = WEB / "src" / "js" / "components" / "sheet.js"


def _css() -> str:
    return COMPONENTES.read_text(encoding="utf-8")


def _regla(nombre: str) -> str:
    m = re.search(re.escape(nombre) + r"\s*\{([^}]*)\}", _css())
    assert m, f"no existe la regla {nombre}"
    return m.group(1)


def _escritorio() -> str:
    """Los bloques de 900 px, que es donde cambian las variantes."""
    bloques = re.findall(r"@media \(min-width: 900px\) \{(.*?)\n\}", _css(), re.S)
    assert bloques, "no hay ningún bloque de 900 px"
    return "\n".join(bloques)


# ------------------------------------------------- la duración del gesto


@pytest.mark.unit
def test_la_hoja_usa_la_curva_y_la_duracion_de_la_tabla() -> None:
    """Criterio de aceptación. La tabla del Técnico §13.6 fija 380 ms y
    la curva del sistema para la hoja y el cajón."""
    cuerpo = _regla(".hoja")
    assert "transform 0.38s var(--ease)" in cuerpo, f"la transición no es la de la tabla: {cuerpo}"


@pytest.mark.unit
def test_el_movimiento_reducido_anula_tambien_la_hoja() -> None:
    """La regla general de base.css alcanza, pero conviene que esté
    comprobado: una hoja que sigue deslizando con movimiento reducido es
    de las que más molestan."""
    base = (WEB / "src" / "styles" / "base.css").read_text(encoding="utf-8")
    m = re.search(r"@media \(prefers-reduced-motion: reduce\) \{(.*?)\n\}", base, re.S)
    assert m, "falta el bloque de movimiento reducido"
    assert "transition-duration: 0.01ms !important" in m.group(1)


# --------------------------------------------- las dos variantes de 900 px


@pytest.mark.unit
def test_desde_900px_el_detalle_es_un_cajon_lateral() -> None:
    """Técnico §13.5. En una pantalla ancha, una hoja a todo lo ancho
    deja el contenido perdido en el medio."""
    bloque = _escritorio()
    m = re.search(r"\.hoja--cajon \{(.*?)\n  \}", bloque, re.S)
    assert m, "falta la variante de cajón lateral"
    cuerpo = m.group(1)
    assert "right: 22px" in cuerpo, "el cajón va pegado a la derecha"
    assert "left: auto" in cuerpo, (
        "sin anular el `left: 0` de la hoja, el cajón ocupa todo el ancho"
    )
    assert "translateX(" in cuerpo, "el cajón entra por el costado, no desde abajo"


@pytest.mark.unit
def test_desde_900px_el_formulario_es_un_modal_centrado() -> None:
    bloque = _escritorio()
    m = re.search(r"\.hoja--modal \{(.*?)\n  \}", bloque, re.S)
    assert m, "falta la variante de modal centrado"
    cuerpo = m.group(1)
    assert "translate(-50%" in cuerpo, "el modal va centrado"
    assert "opacity: 0" in cuerpo, "el modal aparece creciendo con un fundido, no deslizando"


@pytest.mark.unit
def test_el_asa_desaparece_cuando_ya_no_se_arrastra() -> None:
    """El asa es para el dedo. En un cajón lateral o un modal centrado
    no significa nada y confunde."""
    bloque = _escritorio()
    assert re.search(
        r"\.hoja--cajon \.hoja-asa,\s*\.hoja--modal \.hoja-asa \{\s*display: none",
        bloque,
    ), "el asa tiene que esconderse en las dos variantes de escritorio"


@pytest.mark.unit
def test_el_cajon_no_hereda_el_alto_maximo_de_la_hoja() -> None:
    """`max-height: 88vh` tiene sentido para una hoja que sube desde
    abajo; en un cajón de borde a borde, deja un hueco raro abajo."""
    m = re.search(r"\.hoja--cajon \{(.*?)\n  \}", _escritorio(), re.S)
    assert "max-height: none" in m.group(1)


# ------------------------------------------------------ el marcado


@pytest.mark.unit
def test_la_hoja_de_detalle_es_un_cajon() -> None:
    html = INDEX.read_text(encoding="utf-8")
    m = re.search(r'<aside[^>]*id="hoja-detalle"[^>]*>', html, re.S)
    assert m, "falta la hoja de detalle"
    assert "hoja--cajon" in m.group(0)


@pytest.mark.unit
@pytest.mark.parametrize("ident", ["hoja-mas", "hoja-detalle"])
def test_cada_hoja_es_un_dialogo_con_nombre(ident: str) -> None:
    html = INDEX.read_text(encoding="utf-8")
    m = re.search(rf'<aside[^>]*id="{ident}"[^>]*>', html, re.S)
    assert m, f"falta {ident}"
    tag = m.group(0)
    assert 'role="dialog"' in tag
    assert 'aria-modal="true"' in tag
    assert "aria-labelledby" in tag, "un diálogo sin nombre no se anuncia"


@pytest.mark.unit
def test_la_hoja_de_detalle_puede_recibir_el_foco() -> None:
    """Cuando no hay nada accionable adentro, el foco va a la hoja. Sin
    `tabindex="-1"` no lo puede recibir y se queda en el fondo, que
    está inerte."""
    html = INDEX.read_text(encoding="utf-8")
    m = re.search(r'<aside[^>]*id="hoja-detalle"[^>]*>', html, re.S)
    assert 'tabindex="-1"' in m.group(0)


# --------------------------------------------- lo que no se puede probar


@pytest.mark.unit
def test_el_bloqueo_del_fondo_no_usa_overflow_hidden() -> None:
    """`overflow: hidden` en el body es lo que se usa habitualmente y NO
    alcanza: iOS lo ignora para el scroller del documento y el fondo se
    sigue moviendo detrás de la hoja.

    jsdom no tiene scroll de verdad, así que la prueba de comportamiento
    sólo puede comprobar que se use `position: fixed`. Que ese sea el
    arreglo correcto para iOS se verifica acá, por el negativo: que no
    se haya vuelto al atajo que no funciona.
    """
    # Sin quitar los comentarios, la prueba encuentra la explicación que
    # el propio módulo da de por qué NO usa overflow, y falla sola.
    js = re.sub(r"/\*.*?\*/", "", SHEET_JS.read_text(encoding="utf-8"), flags=re.S)
    js = re.sub(r"^\s*//.*$", "", js, flags=re.M)

    assert 'style.position = "fixed"' in js
    assert "overflow" not in js, "el bloqueo del fondo volvió a overflow:hidden, que iOS ignora"


@pytest.mark.unit
def test_la_hoja_usa_el_vidrio_de_las_barras_y_no_el_de_una_tarjeta() -> None:
    """Pedido de Gustavo al ver los dos modales: «es muy transparente,
    necesito que sea más sólido, como el header y la barra inferior».

    Es el mismo problema que tenían las barras. Una hoja se abre ENCIMA
    de la aplicación y lleva texto: con el 52% de opacidad de una
    tarjeta, el contenido de atrás se mezcla con el de adelante y las
    dos cosas se leen peor.
    """
    cuerpo = _regla(".hoja")
    assert "var(--glass-bar-bg)" in cuerpo, (
        "la hoja tiene que usar el vidrio casi opaco de las barras"
    )
    assert "var(--glass-shell-bg)" not in cuerpo, "quedó el vidrio semitransparente de tarjeta"
    assert "var(--glass-bar-blur)" in cuerpo, "el desenfoque también es el de la barra"


@pytest.mark.unit
def test_la_hoja_tiene_su_respaldo_opaco() -> None:
    """Sin `backdrop-filter`, el texto de la hoja quedaría sobre un
    fondo semitransparente sin desenfocar."""
    bloques = re.findall(r"@supports not \(.*?\{(.*?)\n\}", _css(), re.S)
    assert any(".hoja" in b and "--glass-bar-fallback" in b for b in bloques), (
        "la hoja necesita su propio respaldo opaco"
    )
