"""Verifica la navegación del teléfono. Corresponde a F01-T06.

Los cuatro criterios de aceptación son cosas que sólo se descubren con
el teléfono en la mano: que todo se alcance con una mano en 390 px, que
la barra del sistema no tape la fila de iconos, que las áreas táctiles
lleguen a 44 px y que en escritorio no queden dos navegaciones.

Las pruebas van contra el HTML, el CSS y el JS fuente porque no hay
navegador en la suite: comprueban que las decisiones necesarias estén
escritas, no el resultado pintado.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
INDEX = WEB / "index.html"
COMPONENTES = WEB / "src" / "styles" / "components.css"
NAV_JS = WEB / "src" / "js" / "nav.js"
BARRA_JS = WEB / "src" / "js" / "barra-inferior.js"


def _html() -> str:
    return INDEX.read_text(encoding="utf-8")


def _css() -> str:
    return COMPONENTES.read_text(encoding="utf-8")


def _js() -> str:
    return BARRA_JS.read_text(encoding="utf-8")


def _escritorio() -> str:
    """Junta todos los bloques de 960 px. Hay más de uno: el de las
    pestañas es de F01-T05 y el de la barra inferior de esta tarea."""
    bloques = re.findall(r"@media \(min-width: 960px\) \{(.*?)\n\}", _css(), re.S)
    assert bloques, "no hay ningún bloque de escritorio"
    return "\n".join(bloques)


def _sin_comentarios(texto: str) -> str:
    """Quita comentarios de bloque y de línea.

    Hace falta porque las propias explicaciones nombran los atributos
    que la prueba busca, y entonces la prueba se aprueba a sí misma.
    """
    texto = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
    return re.sub(r"^\s*//.*$", "", texto, flags=re.M)


def _regla(nombre: str) -> str:
    m = re.search(re.escape(nombre) + r"\s*\{([^}]*)\}", _css())
    assert m, f"no existe la regla {nombre}"
    return m.group(1)


# ------------------------------------------------- la barra del sistema


@pytest.mark.unit
def test_la_barra_no_queda_bajo_la_franja_de_gestos() -> None:
    """Criterio de aceptación. En un teléfono con gestos, los últimos
    píxeles de abajo son de la barra del sistema: la fila de iconos
    queda debajo y no se puede tocar.
    """
    cuerpo = _regla(".botnav")
    assert "env(safe-area-inset-bottom)" in cuerpo, (
        "la barra inferior tiene que descontar la franja de gestos"
    )
    assert "position: fixed" in cuerpo


@pytest.mark.unit
def test_el_boton_flotante_tampoco() -> None:
    assert "env(safe-area-inset-bottom)" in _regla(".fab")


@pytest.mark.unit
def test_el_cuerpo_de_la_hoja_tampoco() -> None:
    """El último botón de la hoja es el que queda debajo de la barra
    del sistema, y es el que hay que tocar."""
    assert "env(safe-area-inset-bottom)" in _regla(".hoja-cuerpo")


# ------------------------------------------------------ alcance y tamaño


@pytest.mark.unit
def test_las_cinco_posiciones_llegan_a_44px() -> None:
    """La skill §5 pide 44 px. Con el icono, el hueco y la etiqueta el
    alto sale solo, pero si alguien acorta la etiqueta el botón baja sin
    que se note: por eso queda declarado.
    """
    assert "min-height: 44px" in _regla(".botnav button")


@pytest.mark.unit
def test_el_boton_de_cerrar_la_hoja_llega_a_44px() -> None:
    """El recuadro mide 31 px por proporción; el área se agranda con un
    ::after invisible. Si se borra, queda en 31."""
    cuerpo = _regla(".hoja-cerrar::after")
    assert "width: 44px" in cuerpo and "height: 44px" in cuerpo
    assert "translate(-50%, -50%)" in cuerpo


@pytest.mark.unit
def test_las_opciones_de_la_hoja_son_comodas() -> None:
    assert "min-height: 56px" in _regla(".hoja-opcion")


@pytest.mark.unit
def test_el_boton_de_alta_esta_al_alcance_del_pulgar() -> None:
    """Abajo y a la derecha, arriba de la barra inferior. Si estuviera
    arriba, cargar un gasto pediría las dos manos."""
    cuerpo = _regla(".fab")
    assert re.search(r"right:\s*\d", cuerpo), "va pegado al borde derecho"
    assert "bottom: calc(84px" in cuerpo, "va arriba de la barra inferior, no tapándola"


@pytest.mark.unit
def test_hay_hueco_para_la_barra_al_final_del_contenido() -> None:
    """La barra es `fixed`: sin relleno abajo tapa las últimas filas y
    nunca se llega al final de una lista."""
    cuerpo = _regla(".app")
    assert "104px" in cuerpo and "env(safe-area-inset-bottom)" in cuerpo


# ------------------------------------------------------------ escritorio


@pytest.mark.unit
def test_en_escritorio_no_quedan_dos_navegaciones() -> None:
    """Criterio de aceptación. Desde 960 px aparecen las pestañas de la
    barra superior; si la de abajo siguiera, habría dos posiciones
    activas que mantener de acuerdo.
    """
    assert re.search(r"\.botnav \{\s*display: none", _escritorio()), (
        "la barra inferior tiene que desaparecer en escritorio"
    )


@pytest.mark.unit
def test_en_escritorio_el_hueco_de_abajo_se_reduce() -> None:
    """Sin barra inferior, 104 px de relleno dejan un vacío raro."""
    assert re.search(r"\.app \{\s*padding-bottom:", _escritorio()), (
        "el relleno de abajo tiene que bajar cuando no hay barra inferior"
    )


@pytest.mark.unit
def test_el_boton_de_alta_se_queda_en_escritorio() -> None:
    """Cargar un movimiento es la acción principal en cualquier tamaño.
    Lo que cambia es su altura, porque ya no tiene barra debajo."""
    bloque = _escritorio()
    assert not re.search(r"\.fab \{\s*display: none", bloque), (
        "el botón de alta no se esconde en escritorio"
    )
    assert re.search(r"\.fab \{\s*bottom:", bloque), (
        "sin barra inferior debajo, el botón baja a su lugar"
    )


# ------------------------------------------------ el reparto de secciones


@pytest.mark.unit
def test_son_cinco_posiciones_cuatro_secciones_y_mas() -> None:
    """Siete posiciones en 390 px dan 53 px cada una y las etiquetas no
    se leen. Por eso tres secciones se mudan a la hoja."""
    js = _js()
    assert "en_barra_inferior" in js, "el reparto se lee de nav.js"
    assert "data-hoja" in js, "falta la quinta posición, la que abre la hoja"
    nav = NAV_JS.read_text(encoding="utf-8")
    assert nav.count("en_barra_inferior: true") == 4
    assert nav.count("en_barra_inferior: false") == 3


@pytest.mark.unit
def test_las_posiciones_salen_de_nav_y_no_del_html() -> None:
    """Escritas a mano se desincronizan de la barra superior y del
    enrutador en cuanto una sección cambie de nombre."""
    barra = re.search(r'<nav[^>]*id="barra-inferior"[^>]*>(.*?)</nav>', _html(), re.S)
    assert barra, "falta el contenedor de la barra inferior"
    assert not barra.group(1).strip(), "va vacío: lo llena barra-inferior.js"
    cuerpo = re.search(r'<div class="hoja-cuerpo">(.*?)</div>', _html(), re.S)
    assert cuerpo and not cuerpo.group(1).strip(), "las opciones de la hoja también salen de nav.js"
    assert 'from "./nav.js"' in _js()


@pytest.mark.unit
def test_la_barra_inferior_usa_la_etiqueta_corta() -> None:
    """«Movimientos» no entra en 71 px de ancho; `corta` existe para
    eso. Si se usara `label`, la etiqueta se recortaría."""
    assert "s.corta" in _js(), "la barra inferior tiene que usar la etiqueta corta"
    nav = NAV_JS.read_text(encoding="utf-8")
    assert 'corta: "Movim."' in nav


@pytest.mark.unit
def test_la_etiqueta_no_se_parte_en_dos_lineas() -> None:
    """Partida, rompe la altura de la fila y las cinco quedan desparejas."""
    cuerpo = _regla(".botnav button span")
    assert "white-space: nowrap" in cuerpo
    assert "text-overflow: ellipsis" in cuerpo
    assert "overflow: hidden" in cuerpo


# --------------------------------------------------------- accesibilidad


@pytest.mark.unit
def test_la_posicion_activa_no_se_marca_solo_con_color() -> None:
    """La skill: el color nunca es el único portador de información."""
    cuerpo = _regla(".botnav button.activa")
    assert "color:" in cuerpo
    assert "background:" in cuerpo, (
        "la posición activa necesita también fondo, no sólo color de texto"
    )


@pytest.mark.unit
def test_la_posicion_activa_se_anuncia() -> None:
    """`aria-current` y no `aria-selected`: esto es navegación, no un
    grupo de pestañas."""
    js = _sin_comentarios(_js())
    assert "aria-current" in js
    assert "aria-selected" not in js


@pytest.mark.unit
def test_todo_boton_de_la_navegacion_se_anuncia() -> None:
    """Los iconos de la barra y el `+` flotante no dicen nada solos."""
    sin_etiqueta = []
    for tag in re.findall(r"<button\b[^>]*>", _html()):
        if "aria-label" not in tag:
            clase = re.search(r'class="([^"]*)"', tag)
            sin_etiqueta.append(clase.group(1) if clase else tag)
    assert not sin_etiqueta, f"botones sin aria-label: {sin_etiqueta}"
    # Los que pinta el JS también.
    js = _js()
    assert js.count("aria-label") >= 2, "las posiciones y el acceso a la hoja necesitan aria-label"


@pytest.mark.unit
def test_los_iconos_decorativos_no_se_leen() -> None:
    """El botón ya tiene su aria-label; si el SVG no está oculto, el
    lector lo anuncia dos veces."""
    js = _js()
    svgs = list(re.finditer(r"<svg[^>]*>", js))
    assert svgs, "el JS tiene que pintar iconos"

    expuestos = []
    for m in svgs:
        if "aria-hidden" in m.group(0):
            continue
        # Vale que lo oculte el envoltorio: el <span> que lo contiene.
        envoltorio = None
        for s in re.finditer(r"<span[^>]*>", js[: m.start()]):
            envoltorio = s.group(0)
        if not envoltorio or "aria-hidden" not in envoltorio:
            expuestos.append(m.group(0))

    assert not expuestos, f"estos iconos los lee el lector además del aria-label: {expuestos}"


@pytest.mark.unit
def test_el_acceso_a_la_hoja_dice_que_despliega() -> None:
    js = _js()
    assert "aria-expanded" in js, "el botón que abre la hoja necesita aria-expanded"
    assert "aria-controls" in js, "y decir qué abre"
    assert 'setAttribute("aria-expanded", "true")' in js, (
        "aria-expanded tiene que actualizarse al abrir, no quedar fijo"
    )


# ------------------------------------------------------------- la hoja


@pytest.mark.unit
def test_la_hoja_es_un_dialogo() -> None:
    html = _html()
    hoja = re.search(r'<aside[^>]*id="hoja-mas"[^>]*>', html, re.S)
    assert hoja, "falta la hoja"
    tag = hoja.group(0)
    assert 'role="dialog"' in tag
    assert "aria-labelledby" in tag, "el diálogo necesita nombre"


@pytest.mark.unit
def test_la_hoja_cerrada_no_se_alcanza_con_el_tabulador() -> None:
    """Corrida con `transform` sigue estando: el tabulador entra en sus
    botones invisibles y el foco desaparece de la pantalla."""
    cuerpo = _regla(".hoja:not(.abierta)")
    assert "visibility: hidden" in cuerpo, (
        "fuera de la pantalla no basta: hace falta visibility para "
        "sacarla del árbol de accesibilidad"
    )
    assert "visibility 0s linear 0.38s" in cuerpo, (
        "la visibilidad se demora lo que dura la transición, o la salida no se ve"
    )


@pytest.mark.unit
def test_la_hoja_se_cierra_de_las_tres_formas() -> None:
    """Toque afuera, Escape y botón. Sin las tres es una trampa."""
    js = _js()
    assert "fondo.addEventListener" in js, "falta el cierre por toque afuera"
    assert 'ev.key === "Escape"' in js, "falta el cierre con Escape"
    assert "[data-cerrar]" in js, "falta el botón de cerrar"
    assert "data-cerrar" in _html()


@pytest.mark.unit
def test_escape_se_escucha_en_el_documento() -> None:
    """Puesto en la hoja no recibe la tecla cuando el foco está afuera."""
    js = _js()
    m = re.search(r'document\.addEventListener\("keydown"', js)
    assert m, "el listener de Escape va en document"


@pytest.mark.unit
def test_el_velo_cerrado_no_bloquea_la_aplicacion() -> None:
    """Es una capa a pantalla completa: sin esto, cerrada deja la
    aplicación entera sin reaccionar a los toques."""
    assert "pointer-events: none" in _regla(".fondo-hoja")
    assert "pointer-events: auto" in _regla(".fondo-hoja.abierto")


@pytest.mark.unit
def test_el_velo_no_parpadea_al_abrir() -> None:
    """Animado desde `transparent`, Chrome interpola pasando por negro.
    Por eso el estado inicial declara el mismo color con alfa cero."""
    tokens = (WEB / "src" / "styles" / "tokens.css").read_text(encoding="utf-8")
    assert "--scrim-0" in tokens and "--scrim:" in tokens
    assert "transparent" not in _regla(".fondo-hoja"), (
        "el velo cerrado usa --scrim-0, no transparent"
    )


@pytest.mark.unit
def test_el_foco_vuelve_al_cerrar() -> None:
    """Si no, queda en un botón que se acaba de esconder y el tabulador
    reaparece al principio de la página."""
    js = _sin_comentarios(_js())
    assert "document.activeElement" in js, "hay que recordar de dónde se venía"
    # Recordarlo no alcanza: hay que devolverlo.
    assert re.search(r"devolverFocoA\??\.focus\??\.?\(\)", js), (
        "falta devolver el foco a donde estaba antes de abrir"
    )


@pytest.mark.unit
def test_al_abrir_el_foco_entra_en_la_hoja() -> None:
    js = _js()
    assert re.search(r'hoja\.querySelector\("button"\)\??\.focus\(\)', js), (
        "el foco va al primer elemento accionable de la hoja"
    )


@pytest.mark.unit
def test_elegir_una_seccion_cierra_la_hoja() -> None:
    """Dejarla abierta taparía la sección que se acaba de abrir."""
    js = _js()
    m = re.search(r"hoja\.addEventListener\(\"click\".*?\}\);", js, re.S)
    assert m and "cerrar()" in m.group(0), "al elegir una opción, la hoja tiene que cerrarse"


@pytest.mark.unit
def test_el_scroll_de_la_hoja_no_arrastra_el_fondo() -> None:
    """Al llegar al final de la hoja, el gesto sigue en la página de
    atrás y se pierde el lugar."""
    assert "overscroll-behavior: contain" in _regla(".hoja")


@pytest.mark.unit
def test_la_hoja_no_tapa_toda_la_pantalla() -> None:
    """Tiene que quedar fondo visible arriba: es lo que indica que se
    cierra tocando afuera."""
    assert re.search(r"max-height:\s*8\d+vh", _regla(".hoja"))
