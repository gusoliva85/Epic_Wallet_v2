"""Un espacio antes de `::view-transition-*` anula la regla · F12-T02.

Esta prueba existe contra la política general de no testear CSS, y el
motivo es el criterio con el que esa política se escribió: *si el test
falla, ¿me enteré de algo que la pantalla no me hubiera mostrado?*

Acá la respuesta es sí, y de la peor manera. Los pseudoelementos de una
view transition cuelgan del **elemento raíz**, no de un descendiente
suyo:

    :root:not([x])::view-transition-new(root)     <-- alcanza
    :root:not([x]) ::view-transition-new(root)    <-- no matchea nada

Con el espacio, el navegador **descarta la regla en silencio**: no hay
error en consola, no hay nada raro al leer el CSS, y la transición sigue
ocurriendo — pero con las animaciones de fábrica del navegador (un
fundido cruzado de 250 ms) en lugar de las del proyecto. La pantalla
queda *casi* bien, así que mirándola no se nota. Es exactamente el
agujero que la política de pruebas deja abierto a propósito para lo
visual, y exactamente el caso en que no alcanza.

Ya pasó dos veces:

* una en `components.css`, donde quedó el comentario de aviso;
* y otra del 2026-10-23 al 2026-10-27, cuando `162b932` (F12-T04) le
  agregó el prefijo `:not([data-transicion-vista])` a reglas que antes
  eran `::view-transition-old(root)` a secas y les metió el espacio. En
  esos cuatro días el cambio de tema no hizo su círculo en ningún
  dispositivo: hacía el fundido del navegador. Se encontró leyendo
  `document.getAnimations()` durante la transición y viendo que todos
  los nombres empezaban con `-ua-`.

La prueba es una sola afirmación sobre los archivos de estilo, no una
prueba de estructura ni de tokens: busca el patrón que no puede existir.
"""

from __future__ import annotations

import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ESTILOS = RAIZ / "web" / "src" / "styles"

# Un selector, uno o más espacios, y el pseudoelemento. `^` y el inicio
# de línea no sirven: un selector suelto en su propia línea
# (`::view-transition-old(root) {`) es válido y es como estaban antes.
ESPACIO_ANTES = re.compile(r"[\w\)\]]\s+::view-transition-")


def _sin_comentarios(css: str) -> str:
    """Los comentarios de estos archivos citan el patrón malo a propósito,
    para explicarlo. Si no se saca el comentario, la prueba falla por el
    aviso que la documenta, que sería un chiste."""
    return re.sub(r"/\*.*?\*/", "", css, flags=re.S)


def test_ninguna_regla_tiene_un_espacio_antes_del_pseudoelemento() -> None:
    culpables = []
    for archivo in sorted(ESTILOS.glob("*.css")):
        for n, linea in enumerate(_sin_comentarios(archivo.read_text(encoding="utf-8")).splitlines(), 1):
            if ESPACIO_ANTES.search(linea):
                culpables.append(f"{archivo.name}:{n}  {linea.strip()}")

    assert not culpables, (
        "hay reglas de view transition que el navegador va a descartar en silencio:\n"
        + "\n".join(culpables)
        + "\n\nSacá el espacio antes de `::view-transition-`: el pseudoelemento "
        "cuelga del elemento raíz, no de un descendiente."
    )


def test_el_circulo_del_cambio_de_tema_sigue_declarado() -> None:
    """El contrapeso: sin esto, borrar las reglas pasaría la prueba de
    arriba por no tener nada que revisar. Verde por vacío es el peor
    verde."""
    base = (ESTILOS / "base.css").read_text(encoding="utf-8")
    assert "circulo-de-tema" in base, "desapareció la animación del círculo del cambio de tema"
    assert re.search(r":root:not\(\[data-transicion-vista\]\)::view-transition-new\(root\)", base), (
        "la regla que aplica el círculo al pseudoelemento nuevo ya no está"
    )
