"""Ayudantes para leer el HTML en las pruebas.

Está aparte porque lo usan las pruebas de las tres barras y la regla
que implementa es una sola: **un botón necesita `aria-label` cuando no
tiene texto visible**. Repetida en cada archivo, se arregla en uno y se
queda vieja en los otros.
"""

from __future__ import annotations

import re

# Un <button ...>contenido</button> completo, con el contenido aparte.
_BOTON = re.compile(r"(<button\b[^>]*>)(.*?)</button>", re.S)


def botones(html: str) -> list[tuple[str, str]]:
    """Devuelve (etiqueta de apertura, contenido) de cada botón."""
    return _BOTON.findall(html)


def texto_visible(contenido: str) -> str:
    """El texto que se lee en pantalla, sin etiquetas ni comentarios.

    Un `<svg>` no es texto: un botón cuyo contenido es sólo un icono no
    dice nada al lector de pantalla y necesita `aria-label`.
    """
    sin_comentarios = re.sub(r"<!--.*?-->", "", contenido, flags=re.S)
    sin_svg = re.sub(r"<svg\b.*?</svg>", "", sin_comentarios, flags=re.S)
    return re.sub(r"<[^>]*>", "", sin_svg).strip()


def botones_mudos(html: str) -> list[str]:
    """Los botones que no dicen nada: sin texto visible y sin `aria-label`.

    Un botón con texto visible NO necesita `aria-label`; ponerlo de más
    puede incluso tapar el texto que se ve. Por eso la regla distingue y
    no exige la etiqueta a todos.
    """
    mudos = []
    for apertura, contenido in botones(html):
        if texto_visible(contenido) or "aria-label" in apertura:
            continue
        clase = re.search(r'class="([^"]*)"', apertura)
        ident = re.search(r'id="([^"]*)"', apertura)
        mudos.append(clase.group(1) if clase else (ident.group(1) if ident else apertura))
    return mudos
