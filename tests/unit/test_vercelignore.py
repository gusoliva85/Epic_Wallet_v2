"""Lo que el build necesita tiene que llegar al build · F02-T08

Esta prueba nació de un despliegue roto que costó un rato encontrar.

`.vercelignore` excluía `scripts/`, decidido en F00 cuando el build no
usaba ninguno. En F02-T08 el build pasó a correr
`scripts/generar-config.mjs`, y entonces fallaba en Vercel con «Cannot
find module '/vercel/path0/scripts/generar-config.mjs'» mientras en
local andaba perfecto: en local el archivo está, y nada avisa que en el
despliegue no va a estar.

Lo peor del caso es cómo se presenta. Vercel deja publicada la versión
anterior, así que la aplicación sigue respondiendo y todo parece bien;
lo único que pasa es que los cambios nuevos no aparecen nunca. Sin
mirar el log del despliegue no hay forma de notarlo.

Así que acá se lee el comando de build, se sacan los archivos que
menciona, y se comprueba que ninguno esté excluido. Si mañana el build
necesita otro archivo de una carpeta ignorada, falla acá y no después
de empujar.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
VERCELIGNORE = RAIZ / ".vercelignore"
PACKAGE = RAIZ / "package.json"

pytestmark = pytest.mark.unit


# ===================================================================
#  Un intérprete de `.vercelignore`
# ===================================================================
#
# Cubre el vocabulario que el archivo usa de verdad: `dir/`, `dir/*`,
# rutas exactas, comodines simples y la negación con `!`. Gana la última
# regla que coincide, como en `.gitignore`.
#
# Se escribe acá en vez de traer una dependencia porque son veinte
# líneas, y porque la regla que importa —que excluir `dir/` impide que
# la negación de adentro tenga efecto— es justo la que una biblioteca
# genérica podría implementar distinto.


def _reglas() -> list[tuple[str, bool]]:
    reglas = []
    for linea in VERCELIGNORE.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#"):
            continue
        negada = linea.startswith("!")
        reglas.append((linea[1:] if negada else linea, negada))
    return reglas


def _coincide(patron: str, ruta: str) -> bool:
    if patron.endswith("/"):
        # `dir/` excluye el directorio entero, y Vercel no entra a
        # mirar lo que hay dentro.
        return ruta == patron[:-1] or ruta.startswith(patron)
    if patron.endswith("/*"):
        base = patron[:-2]
        return ruta.startswith(base + "/")
    regex = "^" + re.escape(patron).replace(r"\*", "[^/]*") + "$"
    return re.match(regex, ruta) is not None


def excluido(ruta: str) -> bool:
    """¿Vercel deja afuera esta ruta?

    Importa el orden: si una regla excluye el directorio completo
    (`scripts/`), una negación posterior sobre un archivo de adentro no
    lo rescata, porque el directorio ya no se recorre. Eso es
    exactamente lo que rompió el despliegue.
    """
    resultado = False
    directorio_cerrado = False
    for patron, negada in _reglas():
        if not _coincide(patron, ruta):
            continue
        if patron.endswith("/") and not negada:
            directorio_cerrado = True
            resultado = True
        elif negada:
            if not directorio_cerrado:
                resultado = False
        else:
            resultado = True
    return resultado


# ===================================================================


def archivos_que_el_build_necesita() -> list[str]:
    """Los archivos que menciona el comando de build.

    Se sacan del `package.json` y no de una lista escrita a mano: una
    lista a mano se queda vieja la primera vez que alguien toca el
    comando, que es el caso que hay que cubrir.
    """
    scripts = json.loads(PACKAGE.read_text(encoding="utf-8"))["scripts"]
    comando = scripts["build"]

    necesarios = []
    # `node algo.mjs`, y las rutas que se pasan con -i/--input.
    necesarios += re.findall(r"node\s+([\w./-]+\.(?:mjs|js|cjs))", comando)
    necesarios += re.findall(r"-i\s+([\w./-]+)", comando)
    return necesarios


def test_el_comando_de_build_menciona_archivos() -> None:
    """Si la extracción dejara de encontrar nada, la prueba de abajo
    pasaría sin comprobar nada. Verde por vacío es el peor verde."""
    necesarios = archivos_que_el_build_necesita()
    assert necesarios, (
        "no se encontró ningún archivo en el comando de build; ¿cambió la forma del comando?"
    )
    assert any(f.endswith(".mjs") for f in necesarios)


def test_nada_de_lo_que_el_build_necesita_esta_excluido() -> None:
    """El criterio de esta prueba: si el build lo nombra, tiene que
    llegar al build."""
    fuera = []
    for archivo in archivos_que_el_build_necesita():
        if not (RAIZ / archivo).exists():
            fuera.append(f"{archivo} (no existe en el repositorio)")
        elif excluido(archivo):
            fuera.append(f"{archivo} (lo excluye .vercelignore)")

    assert not fuera, (
        f"el build necesita estos archivos y no los va a tener: {fuera}. "
        "El despliegue va a fallar y Vercel va a dejar publicada la versión "
        "anterior, así que la aplicación va a parecer sana."
    )


def test_el_interprete_de_vercelignore_funciona() -> None:
    """La prueba de arriba vale lo que valga este intérprete.

    El caso central es el que rompió el despliegue: con `scripts/`, la
    negación de adentro no rescata nada; con `scripts/*`, sí.
    """
    assert excluido("tests/unit/test_tokens.py"), "tests/ tendría que estar excluido"
    assert excluido("documentacion/03_Roadmap.md")
    assert excluido("migrations/env.py")
    assert not excluido("web/index.html"), "web/ no tiene que estar excluido"
    assert not excluido("package.json")

    # Lo que se arregló: el script que el build necesita entra, y los
    # demás de la misma carpeta siguen afuera.
    assert not excluido("scripts/generar-config.mjs"), (
        "el script que el build necesita está excluido: es exactamente el "
        "fallo que esta prueba existe para evitar"
    )
    assert excluido("scripts/capturas.mjs"), "los scripts de desarrollo tendrían que seguir afuera"


def test_se_sigue_excluyendo_lo_que_no_tiene_que_subir() -> None:
    """El arreglo no tenía que abrir la puerta a todo.

    `.vercelignore` está para que el despliegue no cargue con lo que no
    sirve, y los secretos no tienen nada que hacer en el paquete de un
    despliegue estático.
    """
    for ruta in (
        ".env",
        ".venv/pyvenv.cfg",
        "tests/unit/test_tokens.py",
        "migrations/env.py",
        "documentacion/03_Roadmap.md",
        "docs/FASE_00_PUESTA_EN_MARCHA.md",
        "scripts/verificar_auth.py",
        "scripts/comparar_esquemas.py",
    ):
        assert excluido(ruta), f"{ruta} tendría que estar excluido del despliegue"
