"""Verifica el contraste de la tinta sobre las superficies de vidrio.

Corresponde a F01-T03. El sistema exige 4,5:1 para texto normal y 3:1
para elementos gráficos, en los dos temas (SKILL §12).

Se mide contra el **fondo opaco de respaldo** del vidrio, que es el peor
caso: cuando el navegador no soporta `backdrop-filter`, la superficie
deja de desenfocar y el texto queda sobre ese color. Si ahí se lee, se
lee en todos lados.

Esta prueba encontró que `--color-ink-3` daba 3,78:1 en tema claro, por
debajo del mínimo, y es el color de todo el texto secundario.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
TOKENS = RAIZ / "web" / "src" / "styles" / "tokens.css"

Color = tuple[int, int, int]


def _luminancia(c: Color) -> float:
    def canal(v: int) -> float:
        x = v / 255
        return x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4

    return 0.2126 * canal(c[0]) + 0.7152 * canal(c[1]) + 0.0722 * canal(c[2])


def contraste(a: Color, b: Color) -> float:
    la, lb = _luminancia(a), _luminancia(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def _sobre(frente: Color, alfa: float, fondo: Color) -> Color:
    return (
        round(frente[0] * alfa + fondo[0] * (1 - alfa)),
        round(frente[1] * alfa + fondo[1] * (1 - alfa)),
        round(frente[2] * alfa + fondo[2] * (1 - alfa)),
    )


def _hex(valor: str) -> Color:
    valor = valor.strip().lstrip("#")
    return (int(valor[0:2], 16), int(valor[2:4], 16), int(valor[4:6], 16))


def _token(nombre: str, *, oscuro: bool = False) -> Color:
    """Lee un token del bloque claro o del bloque oscuro."""
    css = TOKENS.read_text(encoding="utf-8")
    if oscuro:
        css = css[css.index('html[data-theme="dark"] {') :]
    hallado = re.search(rf"{re.escape(nombre)}:\s*(#[0-9a-fA-F]{{6}})", css)
    assert hallado, f"no se encontró {nombre} ({'oscuro' if oscuro else 'claro'})"
    return _hex(hallado.group(1))


# El peor caso: el fondo de respaldo del vidrio sobre el lavado más
# contrastante. Los valores de alfa salen de --glass-*-fallback.
def _superficies(oscuro: bool) -> dict[str, Color]:
    if oscuro:
        lavado = _token("--color-wash-a", oscuro=True)
        base = (13, 15, 17)
        return {
            "shell": _sobre(base, 0.94, lavado),
            "cg": _sobre(base, 0.96, lavado),
        }
    lavado = _token("--color-wash-a")
    base = (255, 255, 255)
    return {"shell": _sobre(base, 0.92, lavado), "cg": _sobre(base, 0.94, lavado)}


# Mínimo exigido por rol. ink-4 sólo se usa en ejes de gráfico y en
# elementos deshabilitados, que WCAG trata como gráficos (3:1).
MINIMOS = {
    "--color-ink": 4.5,
    "--color-ink-2": 4.5,
    "--color-ink-3": 4.5,
    "--color-ink-4": 3.0,
}


@pytest.mark.unit
@pytest.mark.parametrize("oscuro", [False, True], ids=["claro", "oscuro"])
@pytest.mark.parametrize("superficie", ["shell", "cg"])
@pytest.mark.parametrize("tinta", list(MINIMOS))
def test_la_tinta_contrasta_sobre_el_vidrio(tinta: str, superficie: str, oscuro: bool) -> None:
    fondo = _superficies(oscuro)[superficie]
    color = _token(tinta, oscuro=oscuro)
    r = contraste(color, fondo)
    minimo = MINIMOS[tinta]
    assert r >= minimo, (
        f"{tinta} sobre .{superficie} en tema {'oscuro' if oscuro else 'claro'} "
        f"da {r:.2f}:1 y el mínimo es {minimo}:1"
    )


@pytest.mark.unit
@pytest.mark.parametrize("oscuro", [False, True], ids=["claro", "oscuro"])
def test_la_semantica_financiera_se_distingue(oscuro: bool) -> None:
    """Ingresos y egresos tienen que leerse, no sólo distinguirse.

    El color nunca es el único portador de información —siempre hay
    signo e icono— pero igual tiene que contrastar con la superficie.
    """
    fondo = _superficies(oscuro)["shell"]
    for token in ("--color-inc", "--color-egr", "--color-sav"):
        r = contraste(_token(token, oscuro=oscuro), fondo)
        assert r >= 3.0, (
            f"{token} en tema {'oscuro' if oscuro else 'claro'} da {r:.2f}:1 "
            "sobre el vidrio; el mínimo para un elemento con significado es 3:1"
        )


@pytest.mark.unit
@pytest.mark.parametrize("oscuro", [False, True], ids=["claro", "oscuro"])
def test_el_acento_contrasta_con_su_contenido(oscuro: bool) -> None:
    """El blanco (o el grafito en oscuro) sobre una superficie de acento."""
    acento = _token("--color-accent-2", oscuro=oscuro)
    encima = _token("--color-on-accent", oscuro=oscuro)
    r = contraste(encima, acento)
    assert r >= 4.5, (
        f"--color-on-accent sobre --color-accent-2 da {r:.2f}:1 "
        f"en tema {'oscuro' if oscuro else 'claro'}"
    )


@pytest.mark.unit
def test_los_cuatro_niveles_estan_ordenados() -> None:
    """ink es el más contrastante y ink-4 el menos, en los dos temas.

    Si se invirtieran, la jerarquía visual quedaría al revés sin que
    nadie lo note leyendo el CSS.
    """
    for oscuro in (False, True):
        fondo = _superficies(oscuro)["shell"]
        ratios = [contraste(_token(t, oscuro=oscuro), fondo) for t in MINIMOS]
        assert ratios == sorted(ratios, reverse=True), (
            f"la jerarquía de tinta está desordenada en tema "
            f"{'oscuro' if oscuro else 'claro'}: {[round(r, 2) for r in ratios]}"
        )
