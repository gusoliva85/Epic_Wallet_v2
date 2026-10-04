"""Verifica el cambio de tema claro / oscuro.

Corresponde a F01-T04. Lo que se prueba acá es sobre todo **cómo está
cargado** el script, porque de eso depende el criterio más difícil de la
tarea: que no haya un fogonazo blanco al abrir la aplicación con el
teléfono en modo oscuro.

Ese destello aparece si el tema se aplica después del primer pintado, y
eso pasa con `defer`, con `type="module"` o si el script va al final del
cuerpo. Son errores fáciles de cometer "ordenando" el HTML, y la única
forma de notarlos es abrir la app en oscuro y ver el parpadeo.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
WEB = RAIZ / "web"
TEMA_JS = WEB / "src" / "js" / "tema.js"
INDEX = WEB / "index.html"


def _html() -> str:
    return INDEX.read_text(encoding="utf-8")


def _js() -> str:
    return TEMA_JS.read_text(encoding="utf-8")


@pytest.mark.unit
def test_el_tema_se_carga_antes_del_primer_pintado() -> None:
    """Bloqueante, en el <head> y antes del </head>.

    Si se difiere, quien tenga el teléfono en oscuro ve un destello
    blanco mientras carga.
    """
    html = _html()
    etiqueta = re.search(r"<script[^>]*tema\.js[^>]*>", html)
    assert etiqueta, "falta cargar tema.js"
    tag = etiqueta.group(0)

    assert "defer" not in tag, "con defer el tema se aplica tarde y hay destello"
    assert 'type="module"' not in tag, (
        "los módulos son diferidos por defecto: el tema se aplicaría tarde"
    )
    assert "async" not in tag, "async no garantiza que corra antes del pintado"

    fin_head = html.index("</head>")
    assert etiqueta.start() < fin_head, "tema.js tiene que ir dentro del <head>"


@pytest.mark.unit
def test_el_tema_se_aplica_al_cargar_el_archivo() -> None:
    """No basta con definir funciones: hay que llamarlas en el acto."""
    js = _js()
    assert re.search(r"aplicar\(\s*efectivo\(\)\s*\)", js), (
        "tema.js define la lógica pero no la ejecuta al cargarse"
    )


@pytest.mark.unit
def test_recuerda_la_eleccion() -> None:
    js = _js()
    assert "localStorage.setItem" in js
    assert "localStorage.getItem" in js


@pytest.mark.unit
def test_el_almacenamiento_puede_fallar_sin_romper_nada() -> None:
    """En modo privado `localStorage` lanza. No puede tumbar la app.

    Toda lectura y escritura va dentro de try/catch (SKILL: el
    almacenamiento del navegador puede venir vacío o lanzar).
    """
    js = _js()
    accesos = len(re.findall(r"localStorage\.", js))
    intentos = len(re.findall(r"\btry\b", js))
    assert intentos >= accesos, (
        f"hay {accesos} accesos a localStorage y sólo {intentos} try: "
        "en modo privado lanzan y romperían la carga"
    )


@pytest.mark.unit
def test_la_primera_visita_sigue_al_sistema() -> None:
    js = _js()
    assert "prefers-color-scheme: dark" in js
    assert "guardado() || delSistema()" in js, (
        "el tema efectivo tiene que ser el elegido o, si no hay, el del sistema"
    )


@pytest.mark.unit
def test_la_barra_de_estado_acompana() -> None:
    """El `theme-color` cambia con el tema, si no la barra del teléfono
    queda del color del tema anterior."""
    js = _js()
    assert 'name="theme-color"' in js
    assert "#f1f2f3" in js and "#0c0d0e" in js, (
        "los dos colores de la barra tienen que coincidir con --color-bg-1"
    )


@pytest.mark.unit
def test_los_colores_de_la_barra_coinciden_con_los_tokens() -> None:
    """Si alguien cambia --color-bg-1 y no la barra, se nota en el borde
    superior de la pantalla del teléfono."""
    js = _js()
    tokens = (WEB / "src" / "styles" / "tokens.css").read_text(encoding="utf-8")

    claro = re.search(r"@theme \{.*?--color-bg-1:\s*(#[0-9a-fA-F]{6})", tokens, re.S)
    oscuro = re.search(
        r'html\[data-theme="dark"\] \{.*?--color-bg-1:\s*(#[0-9a-fA-F]{6})', tokens, re.S
    )
    assert claro and oscuro
    assert claro.group(1) in js, f"la barra clara no usa {claro.group(1)}"
    assert oscuro.group(1) in js, f"la barra oscura no usa {oscuro.group(1)}"


@pytest.mark.unit
def test_la_transicion_respeta_el_movimiento_reducido() -> None:
    js = _js()
    assert "prefers-reduced-motion" in js, (
        "la transición de tema tiene que anularse con movimiento reducido"
    )
    assert "startViewTransition" in js


@pytest.mark.unit
def test_el_boton_existe_y_es_accesible() -> None:
    html = _html()
    assert "data-tema" in html, "falta el interruptor"
    boton = re.search(r"<button[^>]*data-tema[^>]*>", html)
    assert boton, "el interruptor tiene que ser un <button>"
    assert "aria-label" in boton.group(0), "un botón de sólo icono necesita aria-label"
    assert 'type="button"' in boton.group(0), (
        "sin type explícito, dentro de un formulario enviaría"
    )
