"""Las cuatro tarjetas de color del tablero.

Diseño de Gustavo: `documentacion/mockups/tarjetas.png` — fondo sólido,
el signo pesos grande recortado contra el borde y el símbolo que
identifica cada una arriba a la derecha.

Todo lo que se verifica acá es contraste, y se **calcula**. Es lo que
obligó a apartarse del diseño original en dos puntos, y si alguien
cambia un color o una opacidad sin recalcular, estas pruebas lo frenan.
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
KPI_JS = RAIZ / "web" / "src" / "js" / "components" / "kpi.js"

Color = tuple[int, int, int]
BLANCO: Color = (255, 255, 255)
NEGRO: Color = (0, 0, 0)

# Los cuatro fondos, por el token que los define.
TARJETAS = (
    "--color-card-inc",
    "--color-card-egr",
    "--color-card-dia",
    "--color-card-pat",
)


def _hex(texto: str) -> Color:
    t = texto.lstrip("#")
    return (int(t[0:2], 16), int(t[2:4], 16), int(t[4:6], 16))


def _token(nombre: str) -> str:
    m = re.search(rf"{re.escape(nombre)}:\s*([^;]+);", TOKENS.read_text(encoding="utf-8"))
    assert m, f"falta el token {nombre}"
    return m.group(1).strip()


def _alfa_de_rgba(texto: str) -> tuple[Color, float]:
    m = re.match(r"rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)", texto)
    assert m, f"no es un rgba: {texto}"
    return ((int(m[1]), int(m[2]), int(m[3])), float(m[4]))


def _encima(color: Color, alfa: float, fondo: Color) -> Color:
    return tuple(round(color[i] * alfa + fondo[i] * (1 - alfa)) for i in range(3))  # type: ignore[return-value]


def _css() -> str:
    return COMPONENTES.read_text(encoding="utf-8")


def _regla(nombre: str) -> str:
    m = re.search(re.escape(nombre) + r"\s*\{([^}]*)\}", _css())
    assert m, f"no existe la regla {nombre}"
    return m.group(1)


# ------------------------------------------------------------- el fondo


@pytest.mark.unit
@pytest.mark.parametrize("tarjeta", TARJETAS)
def test_el_blanco_se_lee_sobre_cada_tarjeta(tarjeta: str) -> None:
    """Los cuatro fondos están elegidos para esto.

    No son los colores semánticos sin más: se bajaron hasta llegar a
    5:1 con blanco. El ámbar es el que más bajó —blanco sobre
    `--color-warn` puro da 2,95:1, menos de la mitad del mínimo.
    """
    r = contraste(BLANCO, _hex(_token(tarjeta)))
    assert r >= 4.5, f"blanco sobre {tarjeta} da {r:.2f}:1"


@pytest.mark.unit
def test_los_cuatro_fondos_son_distintos() -> None:
    """Si dos se parecieran, dejarían de identificar nada, que es para
    lo que están."""
    valores = {_token(t) for t in TARJETAS}
    assert len(valores) == 4, f"hay fondos repetidos: {valores}"


@pytest.mark.unit
def test_el_fondo_es_solido_y_no_vidrio() -> None:
    cuerpo = _regla(".kpi-color")
    assert "background: var(--c-card)" in cuerpo
    assert "backdrop-filter" not in cuerpo


@pytest.mark.unit
def test_la_tarjeta_de_color_no_lleva_el_brillo_diagonal() -> None:
    """Sobre un fondo sólido, el degradado blanco de `.shell::before`
    ensucia el color en lugar de dar profundidad."""
    m = re.search(r"\.kpi-color::before \{([^}]*)\}", _css())
    assert m, "falta anular el brillo diagonal en la tarjeta de color"
    assert "content: none" in m.group(1)


# -------------------------------------------- el signo pesos, el punto clave


@pytest.mark.unit
@pytest.mark.parametrize("tarjeta", TARJETAS)
def test_la_cifra_se_lee_aunque_caiga_sobre_el_signo_pesos(tarjeta: str) -> None:
    """Esta es la prueba que define el diseño.

    En el diseño original el signo pesos es MÁS CLARO que la tarjeta.
    Así, la cifra blanca que le cae encima baja de 5:1 a 3,3:1 y queda
    por debajo del mínimo del sistema. Y no alcanza con bajarle la
    opacidad: ni al 10% llega a 4,5:1.

    Por eso acá el signo va más OSCURO. La cifra encima sube a 6,8:1 —
    mejor que sobre la tarjeta lisa. Es decoración que además ayuda a
    leer.
    """
    color, alfa = _alfa_de_rgba(_token("--peso-sombra"))
    assert color == NEGRO, (
        f"el signo pesos tiene que oscurecer la tarjeta, no aclararla: está en {color}"
    )

    fondo = _hex(_token(tarjeta))
    sobre_el_signo = _encima(color, alfa, fondo)
    r = contraste(BLANCO, sobre_el_signo)
    assert r >= 4.5, f"la cifra blanca sobre el signo pesos de {tarjeta} da {r:.2f}:1"
    assert r >= contraste(BLANCO, fondo), (
        "oscureciendo, el contraste tiene que SUBIR respecto de la tarjeta lisa"
    )


@pytest.mark.unit
@pytest.mark.parametrize("tarjeta", TARJETAS)
def test_el_signo_pesos_se_ve(tarjeta: str) -> None:
    """Oscurecer de más lo convierte en una mancha; de menos, no se ve."""
    color, alfa = _alfa_de_rgba(_token("--peso-sombra"))
    fondo = _hex(_token(tarjeta))
    r = contraste(_encima(color, alfa, fondo), fondo)
    assert 1.1 <= r <= 1.8, (
        f"el signo pesos sobre {tarjeta} da {r:.2f}:1 contra la tarjeta: "
        "fuera del rango en que se lee como marca de agua"
    )


@pytest.mark.unit
def test_el_signo_pesos_usa_la_tipografia_de_las_cifras() -> None:
    """Va como texto y no como trazo dibujado: así es el mismo glifo con
    el que se escriben los importes, no un dibujo que se le parece."""
    cuerpo = _regla(".kpi-peso")
    assert "font-family: var(--font-display)" in cuerpo
    assert "font-size: var(--text-peso)" in cuerpo
    assert ">$</span>" in KPI_JS.read_text(encoding="utf-8"), (
        "el signo tiene que ser el carácter, no un path"
    )


@pytest.mark.unit
def test_el_signo_pesos_no_se_puede_seleccionar_ni_tocar() -> None:
    """Es decoración: seleccionable aparece en medio del texto al copiar
    la tarjeta, y sin `pointer-events` se come los toques."""
    cuerpo = _regla(".kpi-peso")
    assert "user-select: none" in cuerpo
    assert "pointer-events: none" in cuerpo


@pytest.mark.unit
def test_el_signo_pesos_se_recorta_contra_el_borde() -> None:
    """El efecto del diseño es que el signo sea más grande que la
    tarjeta. Si la tarjeta no recortara, se saldría encima de la de al
    lado en la rejilla."""
    assert "overflow: hidden" in _regla(".kpi"), "sin recorte, el signo invade las tarjetas vecinas"
    cuerpo = _regla(".kpi-peso")
    assert re.search(r"bottom:\s*-\d", cuerpo), "el signo tiene que desbordar abajo"


# -------------------------------------------------- el símbolo de identidad


@pytest.mark.unit
def test_el_simbolo_va_claro_porque_nada_le_pasa_por_encima() -> None:
    """Al revés que el signo pesos: vive arriba a la derecha, donde no
    cae ninguna cifra, así que puede ser claro sin costo."""
    cuerpo = _regla(".kpi-glifo")
    assert "color: var(--color-on-accent)" in cuerpo
    assert "opacity: var(--glifo-op)" in cuerpo
    assert re.search(r"top:\s*\d", cuerpo) and re.search(r"right:\s*\d", cuerpo)


@pytest.mark.unit
def test_la_etiqueta_no_se_mete_debajo_del_simbolo() -> None:
    """«Gasto de hoy» es la etiqueta más larga y llega hasta la esquina."""
    assert "padding-right" in _regla(".kpi-color .kpi-label")


@pytest.mark.unit
def test_cada_tarjeta_tiene_su_simbolo() -> None:
    js = KPI_JS.read_text(encoding="utf-8")
    m = re.search(r"const TARJETAS = \{(.*?)\n\};", js, re.S)
    assert m, "falta el catálogo de tarjetas"
    glifos = re.findall(r'glifo:\s*"([\w-]+)"', m.group(1))
    assert len(glifos) == 4, f"tienen que ser cuatro: {glifos}"
    assert len(set(glifos)) == 4, f"hay símbolos repetidos: {glifos}"


@pytest.mark.unit
def test_la_tarjeta_de_color_no_lleva_ademas_el_cuadradito_de_icono() -> None:
    """La composición del fondo ya identifica la tarjeta; las dos cosas
    juntas sobrecargan la esquina."""
    js = KPI_JS.read_text(encoding="utf-8")
    m = re.search(r"if \(t\) \{(.*?)\n  \}", js, re.S)
    assert m, "no se encontró la rama de la tarjeta de color"
    assert "kpi-ico" not in m.group(1)


# ----------------------------------------------------- el texto, sin medias tintas


@pytest.mark.unit
def test_el_texto_de_la_tarjeta_de_color_es_blanco_pleno() -> None:
    """Sin opacidades intermedias: al 92% ya da 4,52:1, demasiado al
    límite. La jerarquía la hacen el tamaño y el peso."""
    m = re.search(
        r"\.kpi-color \.kpi-label,\s*\.kpi-color \.kpi-num,\s*\.kpi-color \.kpi-sub \{([^}]*)\}",
        _css(),
    )
    assert m, "falta la regla del texto de la tarjeta de color"
    assert "var(--color-on-accent)" in m.group(1)
    assert "rgba" not in m.group(1), "el texto no lleva opacidad"


def _saturacion(c: Color) -> float:
    """La S de HLS, que es como se percibe «cuánto color» tiene."""
    r, g, b = (v / 255 for v in c)
    alto, bajo = max(r, g, b), min(r, g, b)
    if alto == bajo:
        return 0.0
    luz = (alto + bajo) / 2
    return (alto - bajo) / (2 - alto - bajo) if luz > 0.5 else (alto - bajo) / (alto + bajo)


@pytest.mark.unit
@pytest.mark.parametrize("tarjeta", TARJETAS)
def test_la_tarjeta_no_tiene_mas_color_que_el_acento_del_sistema(tarjeta: str) -> None:
    """Pedido de Gustavo después de verlas: «tiene mucho color vivo y
    fuerte, que sea acorde a lo que es todo el formato».

    Una tarjeta de color sólido es una superficie grande, no un acento
    chico. Con la saturación de los colores semánticos —entre 56% y
    76%— se sale del tono grafito del resto de la aplicación y pesa más
    que la información que lleva encima. El techo es la saturación de
    `--color-accent`, que es la referencia de lo «grafito» del sistema.
    """
    techo = _saturacion(_hex(_token("--color-accent")))
    tiene = _saturacion(_hex(_token(tarjeta)))
    assert tiene <= techo + 0.02, (
        f"{tarjeta} tiene {tiene:.0%} de saturación y el acento del "
        f"sistema tiene {techo:.0%}: queda fuera de tono"
    )


@pytest.mark.unit
def test_las_cuatro_tarjetas_pesan_lo_mismo() -> None:
    """Si una contrasta mucho más que otra, la fila se ve como cuatro
    oscuridades distintas en lugar de como un conjunto."""
    contrastes = [contraste(BLANCO, _hex(_token(t))) for t in TARJETAS]
    assert max(contrastes) - min(contrastes) <= 0.5, (
        "las cuatro tarjetas tienen que contrastar parecido: "
        + ", ".join(f"{t}={c:.2f}" for t, c in zip(TARJETAS, contrastes, strict=True))
    )
