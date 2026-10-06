"""Verifica la barra superior. Corresponde a F01-T05.

Los tres criterios de aceptación de la tarea son todos cosas que sólo
se notan en el teléfono y tarde: que la barra quede pegada al hacer
scroll sin tapar contenido, que no desborde en una pantalla angosta y
que todo botón de sólo icono se anuncie al lector de pantalla.

Las pruebas van contra el HTML y el CSS fuente porque no hay navegador
en la suite. Lo que comprueban es que las decisiones que hacen falta
para cumplir esos criterios estén escritas, no el resultado pintado.
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
NAV_JS = WEB / "src" / "js" / "nav.js"
BARRA_JS = WEB / "src" / "js" / "barra-superior.js"


def _html() -> str:
    return INDEX.read_text(encoding="utf-8")


def _css() -> str:
    return COMPONENTES.read_text(encoding="utf-8")


def _regla(nombre: str) -> str:
    """Devuelve el cuerpo de una regla CSS por su selector exacto."""
    m = re.search(re.escape(nombre) + r"\s*\{([^}]*)\}", _css())
    assert m, f"no existe la regla {nombre}"
    return m.group(1)


# ---------------------------------------------------------------- pegada


@pytest.mark.unit
def test_la_barra_queda_pegada_al_hacer_scroll() -> None:
    cuerpo = _regla(".topbar")
    assert "position: sticky" in cuerpo, "la barra tiene que quedar pegada"
    assert re.search(r"top:\s*\d", cuerpo), "sticky sin `top` no se pega: el valor es obligatorio"


@pytest.mark.unit
def test_la_barra_se_pinta_por_encima_del_contenido() -> None:
    """Sin z-index el contenido pasa por arriba del vidrio al hacer
    scroll y la barra se ve atravesada por las filas."""
    assert re.search(r"z-index:\s*\d+", _regla(".topbar")), "falta z-index"


# ------------------------------------------------------------- no desborda


@pytest.mark.unit
def test_el_nombre_se_recorta_antes_de_desbordar() -> None:
    """En 320 px el nombre y las tres acciones compiten por el ancho.

    `min-width: 0` es lo que permite que un hijo de flex se encoja por
    debajo de su contenido; sin eso el nombre empuja las acciones fuera
    de la barra en lugar de recortarse.
    """
    assert "min-width: 0" in _regla(".marca-app"), (
        "sin min-width:0 el bloque de la marca no se encoge y desborda"
    )
    for sel in (".marca-texto b", ".marca-texto span"):
        cuerpo = _regla(sel)
        assert "text-overflow: ellipsis" in cuerpo, f"{sel} tiene que recortarse"
        assert "white-space: nowrap" in cuerpo
        assert "overflow: hidden" in cuerpo, f"{sel}: ellipsis sin overflow:hidden no recorta nada"


@pytest.mark.unit
def test_las_acciones_no_se_encogen() -> None:
    """Son áreas táctiles: si el flex las comprime, dejan de ser
    tocables antes de que el nombre se recorte."""
    assert "flex: none" in _regla(".acciones")
    assert "flex: none" in _regla(".marca-sello")


@pytest.mark.unit
def test_las_pestanas_aparecen_recien_en_escritorio() -> None:
    """Por debajo de 960 px manda la barra inferior (F01-T06). Siete
    pestañas no entran en un teléfono."""
    assert "display: none" in _regla(".nav-escritorio"), (
        "las pestañas arrancan ocultas: mobile-first"
    )
    assert re.search(
        r"@media \(min-width: 960px\) \{\s*\.nav-escritorio \{\s*display: flex", _css()
    ), "faltan las pestañas desde 960 px"


@pytest.mark.unit
def test_los_margenes_respetan_la_zona_segura() -> None:
    """En un teléfono con muesca o pantalla curva, el contenido pegado
    al borde queda debajo del marco."""
    cuerpo = _regla(".app")
    for lado in ("left", "right", "bottom"):
        assert f"env(safe-area-inset-{lado})" in cuerpo, f"falta la zona segura {lado}"


# --------------------------------------------------------------- accesible


@pytest.mark.unit
def test_todo_boton_de_solo_icono_se_anuncia() -> None:
    """Criterio de aceptación de la tarea. Un botón cuyo contenido es un
    SVG o dos iniciales no dice nada al lector sin `aria-label`.

    Los botones con texto visible quedan afuera: no lo necesitan, y
    ponerlo de más puede tapar el texto que se ve.
    """
    mudos = botones_mudos(_html())
    assert not mudos, f"botones que no dicen nada: {mudos}"


@pytest.mark.unit
def test_todo_boton_declara_su_tipo() -> None:
    """Sin `type` explícito, un botón dentro de un formulario envía.

    El `type` tiene que estar, pero no tiene que ser `button`: desde
    F02-T09 hay un formulario de verdad y su botón es `submit`, que es
    justamente lo que hace que Enter envíe desde los campos. Lo que no
    puede haber es un botón **sin** `type`: dentro de un formulario el
    valor por omisión es `submit`, así que enviaría sin que nadie lo
    haya decidido.
    """
    faltan = [
        t
        for t in re.findall(r"<button\b[^>]*>", _html())
        if not re.search(r'type="(button|submit|reset)"', t)
    ]
    assert not faltan, f"botones sin type: {faltan}"


@pytest.mark.unit
def test_el_acceso_a_configuracion_es_un_boton() -> None:
    """En el mockup el avatar es un `div` con `title`: no se alcanza con
    teclado ni lo anuncia el lector. Acá tiene que ser un botón."""
    html = _html()
    assert re.search(r'<button[^>]*class="avatar"', html), (
        "el avatar tiene que ser un <button>, no un div"
    )
    assert not re.search(r'<div[^>]*class="avatar"', html)


@pytest.mark.unit
def test_las_areas_tactiles_llegan_a_44px() -> None:
    """La skill §5 pide 44 px mínimos. El recuadro visible mide 37 px
    para no desarmar la proporción de la barra, así que el área se
    agranda con un ::after invisible. Si se borra, queda en 37.
    """
    for sel in (".boton-icono::after", ".avatar::after"):
        cuerpo = _regla(sel)
        assert "width: 44px" in cuerpo and "height: 44px" in cuerpo, (
            f"{sel} tiene que llevar el área táctil a 44 px"
        )
        assert "translate(-50%, -50%)" in cuerpo, (
            f"{sel}: el área ampliada va centrada sobre el botón"
        )


@pytest.mark.unit
def test_el_contador_no_se_lee_dos_veces() -> None:
    """La cuenta ya va en el aria-label del botón. Si el globo no está
    oculto, el lector dice «Alertas: 4 sin leer, 4»."""
    html = _html()
    globo = re.search(r'<span class="contador"[^>]*>', html)
    assert globo, "falta el contador de alertas"
    assert 'aria-hidden="true"' in globo.group(0)

    boton = re.search(r'<button[^>]*id="btn-alertas"[^>]*>', html, re.S)
    assert boton and "aria-label" in boton.group(0), "el botón necesita etiqueta"

    # Desde que las alertas viven en su hoja (F01-T13), la cuenta sale
    # de los datos y no del HTML: escrita a mano, el botón diría un
    # número y la hoja mostraría otro.
    js = (WEB / "src" / "js" / "views" / "vistas.js").read_text(encoding="utf-8")
    assert "sin leer" in js, "el aria-label con la cuenta lo pone el JavaScript"
    assert "D.ALERTAS.length" in js, "la cuenta tiene que salir de la lista"


@pytest.mark.unit
def test_sin_alertas_el_globo_desaparece() -> None:
    """Un cero rojo en la esquina alarma sin motivo."""
    assert ".contador[hidden]" in _css(), (
        "falta la regla que esconde el globo: `display:grid` gana a [hidden]"
    )


@pytest.mark.unit
def test_las_pestanas_son_navegacion_y_no_un_grupo_de_pestanas() -> None:
    """Hasta F01-T06 esto era un `tablist`. Dejó de serlo en F01-T07:
    cambian la URL y el historial del navegador, y eso es navegación.

    Un grupo de pestañas no se puede marcar como enlace ni se recorre
    con el botón «atrás»; anunciarlo como pestañas le miente a quien usa
    un lector de pantalla sobre lo que va a pasar al activarlas.
    """
    html = _html()
    nav = re.search(r'<nav[^>]*id="nav-escritorio"[^>]*>', html)
    assert nav, "falta el contenedor"
    assert "aria-label" in nav.group(0), "la navegación necesita nombre"
    assert 'role="tablist"' not in nav.group(0), "no es un tablist: cambia la URL, es navegación"

    js = BARRA_JS.read_text(encoding="utf-8")
    assert 'role="tab"' not in js
    assert "aria-selected" not in js, (
        "la posición activa se marca con aria-current, no con aria-selected"
    )
    assert "aria-current" in js


# ------------------------------------------------------------ las secciones


@pytest.mark.unit
def test_las_siete_secciones_estan_y_no_se_repiten() -> None:
    # Sólo el bloque de `SECCIONES`. Desde F02-T09 `nav.js` tiene
    # también `PUBLICAS`, con las pantallas de cuenta: son rutas de
    # verdad pero NO secciones, y no van en las barras de navegación.
    # Leyendo el archivo entero, `login` contaba como una octava
    # sección.
    fuente = NAV_JS.read_text(encoding="utf-8")
    bloque = fuente.split("export const SECCIONES")[1].split("\n];")[0]
    ids = re.findall(r'id:\s*"([\w-]+)"', bloque)
    assert len(ids) == 7, f"tienen que ser siete secciones, hay {len(ids)}: {ids}"
    assert len(set(ids)) == 7, f"ids repetidos: {ids}"
    esperadas = {
        "inicio",
        "movimientos",
        "historial",
        "inversiones",
        "patrimonio",
        "analisis",
        "config",
    }
    assert set(ids) == esperadas, f"faltan o sobran: {esperadas ^ set(ids)}"


@pytest.mark.unit
def test_el_reparto_entre_las_dos_barras_esta_declarado() -> None:
    """La barra inferior (F01-T06) tiene cinco posiciones: cuatro
    secciones más el acceso a la hoja «Más», donde van las otras tres.
    El reparto lo decide nav.js, que es de esta tarea.
    """
    js = NAV_JS.read_text(encoding="utf-8")
    fijas = js.count("en_barra_inferior: true")
    assert fijas == 4, f"cuatro secciones fijas más «Más» completan las cinco; hay {fijas}"
    assert js.count("en_barra_inferior: false") == 3, "las otras tres van en «Más»"


@pytest.mark.unit
def test_las_pestanas_salen_de_nav_y_no_del_html() -> None:
    """Si se escriben a mano en el HTML, la barra superior, la inferior y
    el enrutador se desincronizan en cuanto cambia una sección."""
    nav = re.search(r'<nav[^>]*id="nav-escritorio"[^>]*>(.*?)</nav>', _html(), re.S)
    assert nav, "falta el contenedor de pestañas"
    assert not nav.group(1).strip(), "el contenedor va vacío: lo llena barra-superior.js"
    assert 'from "./nav.js"' in BARRA_JS.read_text(encoding="utf-8")


@pytest.mark.unit
def test_el_interruptor_de_tema_vive_en_la_barra() -> None:
    """Estaba provisorio en la pantalla de presentación. Acá se comprueba
    que se mudó y que la pantalla vieja ya no está."""
    html = _html()
    boton = re.search(r"<button[^>]*data-tema[^>]*>", html)
    assert boton, "falta el interruptor de tema"
    assert "boton-icono" in boton.group(0), (
        "en la barra usa la clase de los botones de icono, no la provisoria"
    )
    assert boton.start() > html.index('<div class="acciones">'), (
        "el interruptor va en el bloque de acciones"
    )
    css = _css()
    assert "boton-tema" not in css, "quedó el CSS del botón provisorio"
    assert ".pantalla" not in css, "quedó el CSS de la pantalla de presentación"
