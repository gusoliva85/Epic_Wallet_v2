"""La documentación de la fase 1. Corresponde a F01-T14.

Un documento que explica el sistema de estilo **envejece solo**: alguien
toca un token, el documento sigue diciendo el valor viejo y el próximo
que lo lea copia algo que ya no existe.

Estas pruebas atan el documento al código. Son los tres criterios de
aceptación de la tarea: que el cuadro de tokens coincida con
`tokens.css`, que cada componente tenga ejemplo de uso y que haya
capturas en claro y en oscuro.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
DOC = RAIZ / "docs" / "FASE_01_SISTEMA_DE_ESTILO.md"
INDICE = RAIZ / "docs" / "INDICE.md"
CAPTURAS = RAIZ / "docs" / "capturas"
TOKENS = RAIZ / "web" / "src" / "styles" / "tokens.css"
GENERADOR = RAIZ / "scripts" / "tabla-tokens.py"


def _doc() -> str:
    return DOC.read_text(encoding="utf-8")


# ------------------------------------------- el cuadro coincide con el código


@pytest.mark.unit
def test_el_documento_existe() -> None:
    assert DOC.exists(), f"falta {DOC.name}"


@pytest.mark.unit
def test_el_cuadro_de_tokens_coincide_con_tokens_css() -> None:
    """Criterio de aceptación.

    OJO: acá NO se corre el generador. La primera versión de esta
    prueba lo corría antes de comparar, y entonces arreglaba justo lo
    que tenía que detectar: cambiar un token y no regenerar la tabla
    pasaba sin falla. Se compara el documento tal como está contra
    `tokens.css`, y regenerar es trabajo del que toca el token.
    """
    doc = _doc()
    css = TOKENS.read_text(encoding="utf-8")
    i_dark = css.index('html[data-theme="dark"] {')
    claros = dict(re.findall(r"(--[\w-]+):\s*([^;]+);", css[:i_dark], re.S))

    faltan = []
    distintos = []
    for token, valor in claros.items():
        limpio = re.sub(r"\s+", " ", valor).strip()
        if f"| `{token}` |" not in doc:
            faltan.append(token)
        elif f"| `{token}` | `{limpio}` |" not in doc:
            distintos.append(token)

    assert not faltan, f"estos tokens no están en el cuadro: {faltan}"
    assert not distintos, (
        f"estos tokens figuran con otro valor que en tokens.css: {distintos}. "
        "Corré `python scripts/tabla-tokens.py`."
    )


@pytest.mark.unit
def test_el_cuadro_se_genera_y_no_se_escribe_a_mano() -> None:
    """Si se escribiera a mano, la prueba de arriba fallaría cada vez
    que alguien toca un token y habría que editar el documento. Con las
    marcas, se regenera con un comando."""
    doc = _doc()
    assert "<!-- TOKENS:INICIO -->" in doc and "<!-- TOKENS:FIN -->" in doc
    assert "scripts/tabla-tokens.py" in doc, "el documento tiene que decir cómo se regenera"


# ------------------------------------------ cada componente, con su ejemplo


@pytest.mark.unit
@pytest.mark.parametrize(
    "componente",
    [
        "tarjetaHeroe",
        "tarjetaMetrica",
        "filaMovimiento",
        "filaCategoria",
        "separadorDia",
        "crearHoja",
        "aviso",
        "pildora",
        "toast",
        "navegar",
    ],
)
def test_cada_componente_tiene_ejemplo_de_uso(componente: str) -> None:
    """Criterio de aceptación: ejemplo **de uso** de cada uno.

    Se busca una llamada, `componente(`, y no el nombre a secas: con el
    nombre alcanzaba la línea del `import`, y un import no es un ejemplo
    de uso. Se vio mutando el documento.
    """
    bloques = re.findall(r"```javascript\n(.*?)```", _doc(), re.S)
    llamada = re.compile(rf"\b{re.escape(componente)}\s*\(")
    assert any(llamada.search(b) for b in bloques), (
        f"{componente} aparece pero nunca se lo llama: falta el ejemplo de uso"
    )


@pytest.mark.unit
def test_los_ejemplos_son_copiables() -> None:
    """Un ejemplo sin el import no se puede pegar y usar."""
    bloques = re.findall(r"```javascript\n(.*?)```", _doc(), re.S)
    assert len(bloques) >= 5, f"hay pocos ejemplos: {len(bloques)}"
    con_import = [b for b in bloques if "import" in b]
    assert len(con_import) >= 4, "la mayoría de los ejemplos tiene que traer su import"


@pytest.mark.unit
def test_los_componentes_del_ejemplo_existen_de_verdad() -> None:
    """Un ejemplo que llama a una función que no existe es peor que no
    tener ejemplo."""
    doc = _doc()
    rutas = re.findall(r'from "\./((?:components/)?[\w-]+\.js)"', doc)
    assert rutas, "los ejemplos no muestran de dónde importar"
    for ruta in set(rutas):
        archivo = RAIZ / "web" / "src" / "js" / ruta
        assert archivo.exists(), f"el ejemplo importa de {ruta}, que no existe"


# ------------------------------------------------ capturas en los dos temas


@pytest.mark.unit
def test_hay_capturas_en_claro_y_en_oscuro() -> None:
    """Criterio de aceptación."""
    assert CAPTURAS.is_dir(), "falta la carpeta de capturas"
    claras = list(CAPTURAS.glob("*-claro.png"))
    oscuras = list(CAPTURAS.glob("*-oscuro.png"))
    assert claras, "no hay capturas en tema claro"
    assert oscuras, "no hay capturas en tema oscuro"
    assert len(claras) == len(oscuras), (
        f"{len(claras)} capturas claras y {len(oscuras)} oscuras: "
        "tienen que ser las mismas pantallas en los dos temas"
    )


@pytest.mark.unit
def test_hay_capturas_de_las_siete_vistas() -> None:
    nombres = {p.name for p in CAPTURAS.glob("*.png")}
    for vista in (
        "inicio",
        "movimientos",
        "historial",
        "cartera",
        "patrimonio",
        "analisis",
        "ajustes",
    ):
        assert f"{vista}-movil-claro.png" in nombres, f"falta la captura de {vista}"


@pytest.mark.unit
def test_todas_las_capturas_que_el_documento_nombra_existen() -> None:
    """Una imagen rota en la documentación es peor que no tenerla: da a
    entender que había algo y se perdió."""
    rotas = [
        c for c in re.findall(r"\]\((capturas/[^)]+)\)", _doc()) if not (RAIZ / "docs" / c).exists()
    ]
    assert not rotas, f"el documento nombra capturas que no existen: {rotas}"


@pytest.mark.unit
def test_las_capturas_se_pueden_rehacer_con_un_comando() -> None:
    """Versionar sólo las imágenes las deja viejas en cuanto cambie el
    diseño."""
    assert (RAIZ / "scripts" / "capturas.mjs").exists()
    assert "npm run capturas" in _doc()


# ------------------------------------------------------------ el índice


@pytest.mark.unit
def test_el_indice_apunta_a_la_fase_1() -> None:
    indice = INDICE.read_text(encoding="utf-8")
    assert "FASE_01_SISTEMA_DE_ESTILO.md" in indice, (
        "el índice todavía dice que la fase 1 está pendiente"
    )


@pytest.mark.unit
def test_el_documento_dice_la_regla_del_sistema() -> None:
    """Es lo que la tarea pide explícitamente: que quede escrito que
    ningún componente nuevo introduce valores fuera de los tokens."""
    doc = _doc()
    assert re.search(r"[Nn]ingún componente nuevo introduce valores fuera de los tokens", doc), (
        "falta la regla que la tarea pide dejar escrita"
    )


@pytest.mark.unit
def test_el_generador_del_cuadro_anda() -> None:
    """La prueba de arriba no lo corre a propósito, así que hace falta
    comprobar aparte que el comando que se documenta funcione."""
    resultado = subprocess.run(
        [sys.executable, str(GENERADOR)],
        cwd=RAIZ,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=60,
    )
    assert resultado.returncode == 0, resultado.stderr or resultado.stdout


@pytest.mark.unit
def test_el_recuento_de_pruebas_del_documento_es_real() -> None:
    """La primera versión decía 358 y eran 301.

    Un número inventado en la documentación es peor que no ponerlo:
    hace dudar de todo lo demás. Se compara contra lo que la suite
    declara de verdad.
    """
    doc = _doc()
    m = re.search(r"(\d+) de pytest y (\d+) de jsdom", doc)
    assert m, "el documento no dice cuántas pruebas hay"
    dice_py, dice_js = int(m.group(1)), int(m.group(2))

    reales_py = sum(
        len(re.findall(r"^def test_", f.read_text(encoding="utf-8"), re.M))
        for f in (RAIZ / "tests").rglob("test_*.py")
    )
    reales_js = sum(
        len(re.findall(r"^\s*test\(", f.read_text(encoding="utf-8"), re.M))
        for f in (RAIZ / "tests" / "js").glob("*.test.mjs")
    )

    # Las parametrizadas hacen que `pytest` cuente más que `def test_`,
    # así que el documento puede decir más, nunca menos.
    assert dice_py >= reales_py, (
        f"el documento dice {dice_py} pruebas de pytest y hay al menos {reales_py}"
    )
    assert dice_js == reales_js, f"el documento dice {dice_js} pruebas de jsdom y hay {reales_js}"
