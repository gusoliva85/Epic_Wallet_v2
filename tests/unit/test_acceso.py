"""Pantalla de inicio de sesión. Corresponde a F02-T09.

El comportamiento se prueba en `tests/js/acceso.test.mjs` con jsdom: el
ojito, el envío doble, los mensajes, el foco y el `autocomplete`. Acá va
lo que jsdom no puede ver:

* **El teclado del celular.** jsdom no tiene teclado virtual, así que el
  criterio «se ve bien con el teclado abierto» se verifica sobre las
  reglas de CSS que lo hacen posible. No es lo mismo que mirarlo en un
  teléfono —eso lo hace Gustavo— pero sí impide que alguien saque la
  regla sin darse cuenta de para qué estaba.
* **El contraste** del mensaje de error y del botón, que se calcula.
* **Que la pantalla esté integrada al enrutador** y que no se haya
  colado en las barras de navegación.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from .test_contraste import _hex, _token, contraste

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
INDEX = WEB / "index.html"
CSS = WEB / "src" / "styles" / "components.css"
TOKENS = WEB / "src" / "styles" / "tokens.css"
ACCESO_JS = WEB / "src" / "js" / "acceso.js"
ROUTER_JS = WEB / "src" / "js" / "router.js"
NAV_JS = WEB / "src" / "js" / "nav.js"

pytestmark = pytest.mark.unit

MINIMO_TEXTO = 4.5


def _css() -> str:
    return CSS.read_text(encoding="utf-8")


def _html() -> str:
    return INDEX.read_text(encoding="utf-8")


def _regla(selector: str) -> str:
    """El cuerpo de una regla de CSS, para poder afirmar sobre ella."""
    m = re.search(
        rf"^\{re.escape(selector)}?\s*\{{(.*?)^\}}",
        _css(),
        re.S | re.M,
    )
    if m is None:
        m = re.search(rf"^{re.escape(selector)}\s*\{{(.*?)^\}}", _css(), re.S | re.M)
    assert m, f"no se encuentra la regla {selector}"
    return m.group(1)


# ============================================ el teclado del celular


def test_la_pantalla_se_puede_desplazar() -> None:
    """Con el teclado abierto queda menos de la mitad de la pantalla.

    Si el contenedor no se puede desplazar, el botón de ingresar queda
    debajo del teclado y no hay forma de llegar a él: el formulario se
    vuelve imposible de enviar con el dedo, que es exactamente el
    criterio de aceptación.
    """
    regla = _regla(".acceso")
    assert "overflow-y: auto" in regla, (
        "la pantalla de acceso no se puede desplazar: con el teclado abierto "
        "el botón de ingresar queda inalcanzable"
    )
    assert "place-items: center" in regla, "la tarjeta tiene que quedar centrada"


def test_la_tarjeta_no_tiene_alto_fijo() -> None:
    """Un alto fijo la recortaría en lugar de dejarla crecer, y con el
    teclado abierto se perdería justo el final del formulario."""
    regla = _regla(".acceso-card")
    assert not re.search(r"\bheight:", regla), (
        "la tarjeta tiene alto fijo: con el teclado abierto se recorta"
    )
    assert "max-width" in regla, "la tarjeta tiene que tener un ancho máximo"


def test_respeta_el_area_segura_de_abajo() -> None:
    """Sin el `env(safe-area-inset-bottom)`, en un teléfono con barra de
    gestos el último elemento queda debajo de la barra y no se toca."""
    assert "env(safe-area-inset-bottom)" in _regla(".acceso"), (
        "la pantalla no respeta el área segura de abajo"
    )


def test_los_campos_no_hacen_zoom_en_ios() -> None:
    """Un campo con menos de 16 px hace que iOS acerque la pantalla al
    enfocarlo, y la página queda corrida con el formulario a medias
    fuera de la vista. Ya estaba resuelto para `.inp`; esta prueba lo
    fija, porque es una regla que se borra fácil al limpiar CSS."""
    css = _css()
    m = re.search(r"--text-campo-movil:\s*([\d.]+)px", TOKENS.read_text(encoding="utf-8"))
    assert m, "no está el token del tamaño de campo en móvil"
    assert float(m.group(1)) >= 16, (
        f"el campo mide {m.group(1)}px en móvil: con menos de 16, iOS hace zoom"
    )
    assert "var(--text-campo-movil)" in css


def test_el_ojito_llega_al_area_tactil_del_sistema() -> None:
    """El recuadro mide 36 px para no desbordar el campo. El área táctil
    tiene que llegar a los 44 del sistema con un `::after`; si alguien lo
    borra, el botón queda en 36 y se falla el toque en el teléfono."""
    regla = _regla(".clave-ojo::after")
    assert "width: 44px" in regla and "height: 44px" in regla, (
        "el ojito no llega a los 44 px de área táctil"
    )


def test_el_campo_deja_lugar_para_el_ojito() -> None:
    """Sin relleno a la derecha, una contraseña larga pasa por debajo
    del botón y no se lee."""
    assert "padding-right" in _regla(".clave-wrap .inp"), "el campo no deja lugar para el ojito"


def test_el_boton_llega_al_alto_minimo() -> None:
    m = re.search(r"min-height:\s*(\d+)px", _regla(".btn"))
    assert m, "el botón no declara alto mínimo"
    assert int(m.group(1)) >= 44, f"el botón mide {m.group(1)}px y el mínimo es 44"


# ======================================================= contraste


@pytest.mark.parametrize("oscuro", [False, True])
def test_el_mensaje_de_error_se_lee(oscuro: bool) -> None:
    """El rojo puro sobre vidrio no llega al mínimo: el texto va al 60 %
    contra la tinta y el fondo al 15 %, la misma mezcla que los avisos.

    Se calcula en vez de confiar en que «se ve bien»: es la diferencia
    entre un mensaje que alguien puede leer en el teléfono al sol y uno
    que no.
    """
    crit = _token("--color-crit", oscuro=oscuro)
    tinta = _token("--mix-ink", oscuro=oscuro)
    tinte = _token("--mix-tint", oscuro=oscuro)

    def mezcla(a, b, p):
        return tuple(round(a[i] * p + b[i] * (1 - p)) for i in range(3))

    texto = mezcla(crit, tinta, 0.60)
    fondo = mezcla(crit, tinte, 0.15)

    r = contraste(texto, fondo)
    assert r >= MINIMO_TEXTO, (
        f"el mensaje de error da {r:.2f}:1 en tema "
        f"{'oscuro' if oscuro else 'claro'} y el mínimo es {MINIMO_TEXTO}"
    )


@pytest.mark.parametrize("oscuro", [False, True])
def test_el_texto_del_boton_se_lee(oscuro: bool) -> None:
    """El botón es un degradado entre dos acentos: se mide contra el más
    claro de los dos, que es el peor caso para el texto."""
    encima = _token("--color-on-accent", oscuro=oscuro)
    peor = min(
        (_token("--color-accent", oscuro=oscuro), _token("--color-accent-2", oscuro=oscuro)),
        key=lambda c: abs(contraste(encima, c)),
    )
    r = contraste(encima, peor)
    assert r >= MINIMO_TEXTO, (
        f"el texto del botón da {r:.2f}:1 en tema {'oscuro' if oscuro else 'claro'}"
    )


@pytest.mark.parametrize("oscuro", [False, True])
def test_la_etiqueta_del_campo_se_lee(oscuro: bool) -> None:
    """Mide 10,5 px: es el texto más chico de la pantalla y el que más
    fácil queda por debajo del mínimo."""
    r = contraste(
        _token("--color-ink-3", oscuro=oscuro),
        _hex("#ffffff") if not oscuro else _token("--color-bg-2", oscuro=True),
    )
    assert r >= MINIMO_TEXTO, f"la etiqueta da {r:.2f}:1"


# ========================================= integrada al enrutador


def test_la_ruta_de_login_existe_y_no_es_una_seccion() -> None:
    """Es una ruta de verdad —con hash, historial y «atrás»— pero no una
    sección: si entrara en `SECCIONES` aparecería como una posición más
    en las dos barras de navegación."""
    nav = NAV_JS.read_text(encoding="utf-8")
    secciones = nav.split("export const SECCIONES")[1].split("\n];")[0]

    assert '"login"' not in secciones, (
        "`login` está en SECCIONES: va a aparecer en las barras de navegación"
    )
    assert "PUBLICAS" in nav, "no están declaradas las rutas de cuenta"
    assert re.search(r'PUBLICAS\s*=\s*\[\s*\{\s*id:\s*"login"', nav), "`login` no está en PUBLICAS"


def test_el_enrutador_conoce_las_rutas_publicas() -> None:
    """Sin esto, `#/login` cae en el inicio y la pantalla no se puede
    abrir por URL."""
    js = ROUTER_JS.read_text(encoding="utf-8")
    assert "PUBLICAS" in js, "el enrutador no incluye las rutas de cuenta"
    assert re.search(r"RUTAS\s*=\s*\[\s*\.\.\.SECCIONES", js)


def test_la_aplicacion_queda_inerte_detras_de_la_pantalla() -> None:
    """Es lo que hace que la pantalla sea de verdad modal.

    Sin `inert`, el tabulador sigue recorriendo la aplicación tapada
    —se sale del formulario sin que nada lo muestre— y el lector de
    pantalla la lee igual, aunque no se vea nada de ella.
    """
    js = ROUTER_JS.read_text(encoding="utf-8")
    assert "app.inert" in js, "la aplicación de atrás no queda inerte"
    assert "aria-hidden" in js, (
        "falta `aria-hidden` además de `inert`: hay lectores que todavía no implementan `inert`"
    )


def test_la_pantalla_esta_por_encima_de_las_barras() -> None:
    """Las barras son `fixed` con su propio `z-index`: si la pantalla
    quedara por debajo, se verían la barra superior y la inferior
    encima del formulario."""
    m = re.search(r"z-index:\s*(\d+)", _regla(".acceso"))
    assert m, "la pantalla de acceso no declara z-index"
    propio = int(m.group(1))

    css = _css()
    for selector in (".topbar", ".botnav", ".fab"):
        bloque = re.search(rf"^{re.escape(selector)}\s*\{{(.*?)^\}}", css, re.S | re.M)
        if not bloque:
            continue
        z = re.search(r"z-index:\s*(\d+)", bloque.group(1))
        if z:
            assert propio > int(z.group(1)), (
                f"{selector} tiene z-index {z.group(1)} y la pantalla {propio}: "
                "se va a ver por encima del formulario"
            )


# ====================================== lo que no se puede perder


def test_el_enlace_a_crear_cuenta_esta_y_dice_que_todavia_no() -> None:
    """La tarea pide el enlace a *Crear cuenta*, y la pantalla de
    registro es F02-T10.

    Un enlace que lleva a una pantalla que no existe se siente roto; con
    el motivo a la vista se lee como lo que es. Es la misma decisión que
    `.grafico-pendiente`: decir **qué** falta y **cuándo** llega, en vez
    de dejar algo que parezca cargando para siempre.
    """
    html = _html()
    assert "Crear cuenta" in html, "falta el enlace a crear cuenta"
    assert "acceso-pendiente" in html, "el enlace a crear cuenta no está marcado como pendiente"
    # Y que no sea un enlace de verdad a una ruta que no existe.
    assert not re.search(r'href="#/registro"', html), (
        "hay un enlace a #/registro y esa pantalla todavía no existe (F02-T10)"
    )


def test_la_pantalla_no_se_muestra_sola() -> None:
    """Arranca con `hidden` y la muestra el enrutador.

    Importa ahora: la guardia de rutas es F02-T12 y el registro es
    F02-T10. Si esta pantalla se mostrara sola al no haber sesión,
    nadie podría entrar a la aplicación hasta que exista el registro.
    """
    html = _html()
    m = re.search(r'<div class="acceso" id="acceso"([^>]*)>', html)
    assert m, "no se encuentra el contenedor de la pantalla de acceso"
    assert "hidden" in m.group(1), "la pantalla de acceso no arranca oculta: taparía la aplicación"

    js = ACCESO_JS.read_text(encoding="utf-8")
    for prohibido in ("haySesion", "usuarioActual"):
        assert prohibido not in js, (
            f"`acceso.js` consulta la sesión ({prohibido}): quién ve esta "
            "pantalla lo decide el enrutador, y dos lugares decidiendo lo "
            "mismo terminan discrepando"
        )


def test_el_piso_de_respuesta_existe_y_es_razonable() -> None:
    """Iguala el tiempo de los dos casos que comparten mensaje.

    Es el agujero que queda después de igualar los textos: si «no existe
    la cuenta» contestara notablemente más rápido que «contraseña
    incorrecta», el tiempo contaría lo mismo que contaría un mensaje
    distinto.
    """
    m = re.search(r"PISO_DE_RESPUESTA\s*=\s*(\d+)", ACCESO_JS.read_text(encoding="utf-8"))
    assert m, "no hay piso de respuesta: el tiempo delata qué cuentas existen"
    piso = int(m.group(1))
    assert 200 <= piso <= 1200, (
        f"piso de {piso} ms: por debajo de 200 no tapa la diferencia y por "
        "encima de 1200 se siente lento"
    )


def test_no_hay_javascript_en_linea() -> None:
    """Lo bloquea la política de contenido (`script-src 'self'`), así
    que un `onclick` en el HTML no sería un problema de estilo sino un
    botón que no funciona en producción y sí en local."""
    html = _html()
    acceso = html[html.index('<div class="acceso"') :]
    assert not re.search(r"\son\w+=", acceso), (
        "hay un manejador en línea en la pantalla de acceso: la CSP lo bloquea"
    )
