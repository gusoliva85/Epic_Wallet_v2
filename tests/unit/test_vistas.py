"""Las siete vistas maquetadas. Corresponde a F01-T13.

Los criterios de aceptación de la tarea son cuatro, y tres se pueden
verificar acá: que ninguna vista tenga scroll horizontal salvo las
tablas, que el orden del tablero sea el del mockup y que los cuatro
estados estén maquetados. El cuarto —«se ven terminadas en el
celular»— es de ojo y lo mira Gustavo.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
INDEX = WEB / "index.html"
COMPONENTES = WEB / "src" / "styles" / "components.css"
VISTAS_JS = WEB / "src" / "js" / "views" / "vistas.js"
DATOS_JS = WEB / "src" / "js" / "datos-muestra.js"
ESTADOS_JS = WEB / "src" / "js" / "components" / "estados.js"

VISTAS = (
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


def _css() -> str:
    return COMPONENTES.read_text(encoding="utf-8")


def _regla(nombre: str) -> str:
    m = re.search(re.escape(nombre) + r"\s*\{([^}]*)\}", _css())
    assert m, f"no existe la regla {nombre}"
    return m.group(1)


def _cuerpo_de_vista(vista: str) -> str:
    html = _html()
    ini = html.index(f'data-vista="{vista}"')
    fin = html.find("<section", ini)
    if fin == -1:
        fin = html.index("</main>")
    return html[ini:fin]


# ------------------------------------------- las siete están y tienen contenido


@pytest.mark.unit
@pytest.mark.parametrize("vista", VISTAS)
def test_cada_vista_tiene_contenido_propio(vista: str) -> None:
    """Ninguna queda con la nota provisoria de «acá va a haber»."""
    cuerpo = _cuerpo_de_vista(vista)
    assert "card shell" in cuerpo or "kpi-grid" in cuerpo, f"la vista {vista} no tiene ningún panel"
    assert "Fase " not in cuerpo, f"la vista {vista} todavía tiene la nota provisoria de su fase"


@pytest.mark.unit
def test_el_orden_del_tablero_es_el_del_mockup() -> None:
    """Criterio de aceptación. Los indicadores arriba, después los dos
    gráficos y después las dos listas.

    Las alertas estaban al final del tablero y se mudaron a su propia
    hoja, que abre la campanita: ahí competían con los indicadores y
    empujaban el resto de la pantalla hacia abajo.
    """
    cuerpo = _cuerpo_de_vista("inicio")
    orden = [
        "kpis-inicio",
        "Comportamiento diario",
        "Últimos seis meses",
        "Gastos por categoría",
        "Últimos movimientos",
    ]
    posiciones = []
    for pieza in orden:
        i = cuerpo.find(pieza)
        assert i != -1, f"falta «{pieza}» en el tablero"
        posiciones.append(i)
    assert posiciones == sorted(posiciones), f"el tablero no está en el orden del mockup: {orden}"


# --------------------------------- sin scroll horizontal, salvo las tablas


@pytest.mark.unit
def test_solo_las_tablas_tienen_scroll_horizontal() -> None:
    """Criterio de aceptación.

    Seis columnas de números no entran en 390 px, y partirlas en dos
    líneas hace ilegible la comparación entre meses, que es justo para
    lo que está la tabla. Así que ahí el scroll es a propósito — y en
    ningún otro lado.
    """
    css = _css()
    reglas = re.findall(r"([^{}]+)\{([^}]*overflow-x:\s*auto[^}]*)\}", css)
    selectores = [s.strip().splitlines()[-1].strip() for s, _ in reglas]

    permitidos = {".tbl-wrap", ".view-switch"}
    sobran = [s for s in selectores if s not in permitidos]
    assert not sobran, f"estos elementos tienen scroll horizontal y no deberían: {sobran}"


@pytest.mark.unit
def test_la_tabla_se_puede_desplazar_con_teclado() -> None:
    """Una región con scroll que no recibe foco no se puede desplazar
    sin mouse: el contenido de la derecha queda inalcanzable."""
    html = _html()
    envoltorios = re.findall(r'<div\s+class="tbl-wrap"[^>]*>', html, re.S)
    assert envoltorios, "no hay tablas"
    for e in envoltorios:
        assert 'tabindex="0"' in e, f"tabla sin foco: {e}"
        assert "aria-label" in e, "una región con foco necesita nombre"


@pytest.mark.unit
def test_ninguna_vista_fuerza_un_ancho_minimo() -> None:
    """Un `min-width` en un panel es la causa más común de scroll
    horizontal en el teléfono. El único permitido es el de la tabla."""
    css = _css()
    anchos = re.findall(r"([^{}]+)\{([^}]*min-width:\s*(\d+)px[^}]*)\}", css)
    grandes = [(s.strip().splitlines()[-1].strip(), px) for s, _, px in anchos if int(px) > 300]
    permitidos = {".tbl-wrap table"}
    sobran = [(s, px) for s, px in grandes if s not in permitidos]
    assert not sobran, f"estos fuerzan un ancho que desborda el teléfono: {sobran}"


# ------------------------------------------------- los cuatro estados


@pytest.mark.unit
@pytest.mark.parametrize(
    "clase",
    [".esqueleto", ".estado--error", ".estado--vacio", ".banda-offline"],
)
def test_los_cuatro_estados_estan_maquetados(clase: str) -> None:
    """Criterio de aceptación: maquetados aunque todavía no se
    disparen."""
    # Con la llave: `.banda-offline` a secas también encuentra
    # `.banda-offline-x`, y la prueba pasaría con la regla renombrada.
    assert re.search(re.escape(clase) + r"[\s,{]", _css()), f"falta el estado {clase}"


@pytest.mark.unit
def test_el_esqueleto_mide_lo_mismo_que_lo_que_viene_despues() -> None:
    """Si el esqueleto fuera más bajo, al llegar los datos la página
    salta y se pierde el lugar donde se estaba leyendo."""
    fila_esqueleto = _regla(".esqueleto--fila")
    assert "height: 56px" in fila_esqueleto
    # La fila real: 11px de relleno arriba y abajo más 34 de la marca.
    assert "min-height: 56px" in _regla(".hoja-opcion") or "34px" in _regla(".row-ico")


@pytest.mark.unit
def test_el_mes_consolidado_tiene_su_propio_texto() -> None:
    """Regla 4. Decir «no hay movimientos» de un mes consolidado es
    falso: los movimientos existieron, lo que se guarda son los
    totales. Por eso no se reusa el estado vacío.
    """
    js = ESTADOS_JS.read_text(encoding="utf-8")
    assert "consolidado" in js
    assert "Información histórica consolidada" in js
    m = re.search(r"export function consolidado\(\) \{(.*?)\n\}", js, re.S)
    assert m and "vacio(" not in m.group(1), "el mes consolidado no puede reusar el estado vacío"


@pytest.mark.unit
def test_la_banda_sin_conexion_consulta_el_estado_al_arrancar() -> None:
    """Si la aplicación se abre ya sin conexión, el evento `offline`
    nunca llega porque no hubo transición: hay que preguntar."""
    js = ESTADOS_JS.read_text(encoding="utf-8")
    assert "navigator.onLine" in js
    assert '"online"' in js and '"offline"' in js


@pytest.mark.unit
def test_los_esqueletos_avisan_al_lector() -> None:
    """Los esqueletos son decoración y no dicen nada: sin `aria-busy` y
    un texto, quien no ve la pantalla cree que la sección está vacía."""
    js = ESTADOS_JS.read_text(encoding="utf-8")
    assert 'aria-busy="true"' in js
    assert "solo-lector" in js


# ----------------------------------------------- los datos, en un solo lugar


@pytest.mark.unit
def test_ninguna_vista_inventa_un_numero() -> None:
    """Todo sale de `datos-muestra.js`. Si una vista escribiera un
    importe propio, al conectar la API quedaría un número fijo en medio
    de los reales y nadie se daría cuenta.
    """
    js = re.sub(r"/\*.*?\*/", "", VISTAS_JS.read_text(encoding="utf-8"), flags=re.S)
    js = re.sub(r"^\s*//.*$", "", js, flags=re.M)
    importes = re.findall(r"\$[\d.]{4,}", js)
    assert not importes, f"la vista tiene importes escritos a mano: {importes}"


@pytest.mark.unit
def test_los_importes_de_muestra_son_texto_ya_formateado() -> None:
    """Como los va a mandar el backend. Con números, las vistas se
    acostumbrarían a hacer cuentas y después habría que sacarlas: el
    frontend sólo formatea, nunca calcula.
    """
    js = DATOS_JS.read_text(encoding="utf-8")
    m = re.search(r"export const RESUMEN = \{(.*?)\n\};", js, re.S)
    assert m, "falta el resumen"
    sin_comillas = re.findall(r"\w+:\s*(-?\d[\d.]*)\s*,", m.group(1))
    assert not sin_comillas, f"estos importes son números y no texto: {sin_comillas}"


@pytest.mark.unit
def test_la_pantalla_avisa_que_los_datos_son_de_muestra() -> None:
    """Una cifra creíble sin aclaración se puede tomar por un dato
    real."""
    assert re.search(r"[Cc]ifras de muestra", _html()), (
        "falta el aviso de que los datos son de ejemplo"
    )


# ------------------------------------------- las reglas de negocio visibles


@pytest.mark.unit
def test_el_historial_distingue_el_tipo_de_cada_mes() -> None:
    """El tipo no es decorativo: decide si la pantalla puede mostrar
    movimientos (regla 4)."""
    js = VISTAS_JS.read_text(encoding="utf-8")
    m = re.search(r"const TIPO_MES = \{(.*?)\n\};", js, re.S)
    assert m, "falta el mapa de tipos de mes"
    for tipo in ("abierto", "transaccional", "consolidado"):
        assert tipo in m.group(1), f"falta el tipo {tipo}"


@pytest.mark.unit
def test_historial_y_cartera_explican_su_regla() -> None:
    """Las dos pantallas tienen una regla que no es obvia y que el
    documento general marca: un mes consolidado no se desglosa, y la
    cartera no es una bitácora de compras.
    """
    notas = re.findall(r'<p class="ghost-note">(.*?)</p>', _html(), re.S)
    assert len(notas) >= 2, "faltan las notas de regla"
    texto = " ".join(notas)
    assert "consolidado" in texto
    assert "bitácora" in texto or "transferencia patrimonial" in texto


@pytest.mark.unit
def test_el_interruptor_de_ajustes_es_accesible() -> None:
    """Un `div` con clase no se alcanza con teclado ni dice si está
    activado."""
    # El JS parte las plantillas en varios trozos unidos con `+`. Hay
    # que juntarlas antes de buscar: una etiqueta repartida en dos
    # trozos no se encuentra entera.
    js = re.sub(r"`\s*\+\s*`", "", VISTAS_JS.read_text(encoding="utf-8"))

    interruptores = re.findall(r"<button class=\"toggle\".*?>", js)
    sueltos = re.findall(r'class="toggle"', js)
    assert sueltos, "no hay interruptores"
    # TODOS, no el primero: con dos bloques de ajustes, comprobar uno
    # solo deja pasar que el otro quede sin accesibilidad.
    assert len(interruptores) == len(sueltos), (
        f"{len(sueltos)} interruptores y sólo {len(interruptores)} son <button>"
    )
    for i in interruptores:
        assert 'type="button"' in i, f"interruptor que no es botón: {i}"
        assert 'role="switch"' in i, f"interruptor sin role=switch: {i}"
        assert "aria-checked" in i, f"interruptor que no dice su estado: {i}"


# ------------------------------------------------- las alertas, en su hoja


@pytest.mark.unit
def test_las_alertas_no_estan_en_el_tablero() -> None:
    """Pedido de Gustavo: le gustan como están diseñadas pero no dentro
    del tablero. Ahí competían con los indicadores y empujaban el resto
    de la pantalla hacia abajo.
    """
    assert "avisos-inicio" not in _html(), "el panel de alertas sigue en el tablero"


@pytest.mark.unit
def test_la_campanita_abre_la_hoja_de_alertas() -> None:
    html = _html()
    boton = re.search(r'<button[^>]*id="btn-alertas"[^>]*>', html, re.S)
    assert boton, "falta la campanita"
    assert 'aria-controls="hoja-alertas"' in boton.group(0), "el botón tiene que decir qué abre"
    assert "aria-expanded" in boton.group(0)

    hoja = re.search(r'<aside[^>]*id="hoja-alertas"[^>]*>', html, re.S)
    assert hoja, "falta la hoja de alertas"
    assert 'role="dialog"' in hoja.group(0)
    assert "hoja--modal" in hoja.group(0), (
        "las alertas piden atención: van en modal, no en cajón lateral"
    )


@pytest.mark.unit
def test_el_contador_de_la_campanita_sale_de_la_lista() -> None:
    """Escrito a mano, el botón diría un número y la hoja mostraría
    otro."""
    js = VISTAS_JS.read_text(encoding="utf-8")
    m = re.search(r"function conectarAlertas\(\) \{(.*?)\n\}", js, re.S)
    assert m, "falta el armado de las alertas"
    cuerpo = m.group(1)

    # La asignación concreta, no que el número aparezca en algún lado
    # del bloque: con `textContent = "4"` y el aria-label derivado, la
    # prueba pasaba igual y el globo quedaba fijo.
    assert re.search(r"contador\.textContent = String\(D\.ALERTAS\.length\)", cuerpo), (
        "el número del globo tiene que salir de la lista de alertas"
    )
    assert "alertas-lista" in cuerpo, "la hoja se llena de la misma lista"


@pytest.mark.unit
def test_sin_alertas_el_globo_de_la_campanita_desaparece() -> None:
    """Un cero rojo en la esquina alarma sin motivo."""
    js = VISTAS_JS.read_text(encoding="utf-8")
    assert re.search(r"contador\.hidden = D\.ALERTAS\.length === 0", js)


# ------------------------------------------- los gráficos que todavía no están


@pytest.mark.unit
def test_los_graficos_que_faltan_lo_dicen() -> None:
    """Antes acá había un esqueleto de carga y estaba mal: un esqueleto
    que brilla para siempre dice «esto está cargando», no «esto llega
    más adelante», y quien abre la aplicación se queda esperando.
    """
    html = _html()
    assert "esqueleto--grafico" not in html, (
        "un esqueleto de carga permanente se lee como un cargando eterno"
    )
    marcadores = re.findall(r'<div class="grafico-pendiente"[^>]*>(.*?)</div>', html, re.S)
    assert len(marcadores) == 5, f"se esperaban cinco gráficos, hay {len(marcadores)}"
    for bruto in marcadores:
        # Prettier parte el texto en varias líneas: sin juntar los
        # espacios, «Llega en la fase 3» no se encuentra entero.
        m = re.sub(r"\s+", " ", bruto)
        assert re.search(r"Llega en la fase \d", m), f"el marcador no dice cuándo llega: {m[:90]}"
        assert re.search(r"<b>Gráfico de [^<]+</b>", m), (
            f"el marcador no dice qué gráfico va ahí: {m[:90]}"
        )


@pytest.mark.unit
def test_el_marcador_ocupa_el_alto_del_grafico() -> None:
    """Para poder revisar la maqueta con las proporciones reales."""
    assert "height: 180px" in _regla(".grafico-pendiente")


@pytest.mark.unit
def test_el_esqueleto_de_carga_sigue_existiendo_para_su_uso_real() -> None:
    """Sacarlo del HTML no significa borrarlo: es el estado de carga de
    verdad, el que se va a usar mientras la API responde."""
    assert ".esqueleto--grafico" in _css()
    assert "esqueleto" in ESTADOS_JS.read_text(encoding="utf-8")
