"""Verifica el sistema de tokens de diseño.

Corresponde a F01-T01. La regla del sistema es que **ningún valor de
color, sombra o radio se escribe fuera de `tokens.css`**, y que toda
variable tiene su contraparte en los dos bloques oscuros.

Sin estas pruebas, lo que pasa es predecible: alguien agrega un token,
olvida el bloque oscuro, y el tema oscuro queda roto en ese detalle
hasta que alguien lo nota a ojo. Son 44 variables en tres bloques.

Referencia: .claude/skills/epic-wallet-ui/SKILL.md §1
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
ESTILOS = RAIZ / "web" / "src" / "styles"
TOKENS = ESTILOS / "tokens.css"

# No cambian con el tema: medidas, familias y curvas.
INVARIANTES = {
    "--radius-btn",
    "--radius-sm",
    "--radius-card",
    "--radius-lg",
    "--font-display",
    "--font-sans",
    "--ease-glass",
    "--ease",
    "--glass-shell-blur",
    "--glass-content-blur",
}
# La escala tipográfica y el interletrado tampoco: son medidas.
INVARIANTES |= set(
    re.findall(
        r"(--(?:text|tracking)-[\w-]+)\s*:",
        (ESTILOS / "tokens.css").read_text(encoding="utf-8"),
    )
)


def _css() -> str:
    return TOKENS.read_text(encoding="utf-8")


def _variables(bloque: str) -> set[str]:
    return set(re.findall(r"(--[\w-]+)\s*:", bloque))


def _bloques() -> tuple[set[str], set[str], set[str]]:
    """Devuelve las variables de (claro, data-theme oscuro, media oscuro)."""
    s = _css()
    i_theme = s.index("@theme {")
    f_theme = s.index("}", s.index("--ease-glass"))
    i_root = s.index(":root {")
    f_root = s.index("}", s.index("--ease:"))
    i_dark = s.index('html[data-theme="dark"] {')
    f_dark = s.index("}", s.index("--sh-lg", i_dark))
    i_media = s.index("@media (prefers-color-scheme: dark)")

    claro = _variables(s[i_theme:f_theme]) | _variables(s[i_root:f_root])
    oscuro = _variables(s[i_dark:f_dark])
    media = _variables(s[i_media:])
    return claro, oscuro, media


@pytest.mark.unit
def test_toda_variable_tiene_version_oscura() -> None:
    claro, oscuro, _ = _bloques()
    faltan = sorted(claro - oscuro - INVARIANTES)
    assert not faltan, (
        f"estas variables no están redefinidas en html[data-theme='dark']: {faltan}. "
        "Si de verdad no cambian con el tema, agregalas a INVARIANTES."
    )


@pytest.mark.unit
def test_los_dos_bloques_oscuros_coinciden() -> None:
    """`data-theme="dark"` y `prefers-color-scheme` tienen que decir lo mismo.

    Si no, la primera visita de alguien con el sistema en oscuro se vería
    distinta de cuando aprieta el botón de tema.
    """
    _, oscuro, media = _bloques()
    assert not (oscuro - media), (
        f"están en data-theme pero no en la media query: {sorted(oscuro - media)}"
    )
    assert not (media - oscuro), (
        f"están en la media query pero no en data-theme: {sorted(media - oscuro)}"
    )


@pytest.mark.unit
def test_estan_los_tokens_que_exige_el_sistema() -> None:
    """Los cuatro grupos que la skill define como obligatorios."""
    claro, _, _ = _bloques()
    exigidos = {
        # cuatro niveles de tinta
        "--color-ink",
        "--color-ink-2",
        "--color-ink-3",
        "--color-ink-4",
        # semántica financiera
        "--color-inc",
        "--color-egr",
        "--color-sav",
        # severidad de alertas
        "--color-ok",
        "--color-warn",
        "--color-pend",
        "--color-crit",
        # las dos capas de vidrio
        "--glass-shell-bg",
        "--glass-shell-fallback",
        "--glass-content-bg",
        "--glass-content-fallback",
        "--glass-in",
        "--glass-sheen",
        # mezcla para color-mix
        "--mix-tint",
        "--mix-ink",
    }
    faltan = sorted(exigidos - claro)
    assert not faltan, f"faltan tokens que el sistema da por sentados: {faltan}"


@pytest.mark.unit
@pytest.mark.parametrize("archivo", ["base.css", "components.css"])
def test_ningun_color_fuera_de_tokens(archivo: str) -> None:
    """La regla número uno del sistema de diseño.

    Se permite el SVG embebido del ruido, que no puede usar variables.
    """
    texto = (ESTILOS / archivo).read_text(encoding="utf-8")
    texto = re.sub(r'url\("data:image/svg\+xml[^"]*"\)', "", texto)
    texto = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)

    sueltos = re.findall(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d", texto)
    assert not sueltos, (
        f"{archivo} tiene {len(sueltos)} color(es) escrito(s) a mano: {sueltos}. "
        "Van en tokens.css, en los tres bloques."
    )


@pytest.mark.unit
def test_ningun_radio_fuera_de_tokens() -> None:
    """Los radios salen de --radius-*, salvo el 50% y el 99px de las píldoras."""
    texto = (ESTILOS / "components.css").read_text(encoding="utf-8")
    texto = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
    radios = re.findall(r"border-radius:\s*([^;]+);", texto)
    sueltos = [
        r.strip()
        for r in radios
        if "var(--radius" not in r and r.strip() not in {"50%", "99px", "0"}
    ]
    assert not sueltos, f"radios escritos a mano: {sueltos}. Usá var(--radius-*)."


@pytest.mark.unit
def test_el_vidrio_tiene_su_degradacion() -> None:
    """Sin el @supports, donde no hay backdrop-filter el texto queda ilegible."""
    texto = (ESTILOS / "components.css").read_text(encoding="utf-8")
    assert "@supports not" in texto, "falta el bloque de degradación del vidrio"
    assert "--glass-shell-fallback" in texto
    assert "--glass-content-fallback" in texto


@pytest.mark.unit
def test_el_movimiento_reducido_se_respeta() -> None:
    texto = (ESTILOS / "base.css").read_text(encoding="utf-8")
    assert "prefers-reduced-motion" in texto, "falta anular las animaciones"


# ==================================================================
#  Escala tipográfica (F01-T02)
# ==================================================================
@pytest.mark.unit
def test_la_escala_coincide_con_la_documentada() -> None:
    """Los tamaños salen de la tabla de la skill §4, que sale del mockup.

    Si alguien cambia uno, esta prueba lo obliga a actualizar también la
    skill, que es la referencia que lee cualquiera antes de escribir un
    componente.
    """
    esperados = {
        "--text-hero": "35px",
        "--text-amount": "33px",
        "--text-kpi": "27.5px",
        "--text-kpi-sm": "23px",
        "--text-sheet": "21.5px",
        "--text-panel": "20px",
        "--text-section": "19px",
        "--text-kv": "16.5px",
        "--text-base": "16.5px",
        "--text-amount-row": "16px",
        "--text-row": "15.5px",
        "--text-button": "15.5px",
        "--text-sub": "12px",
        "--text-pill": "11px",
        "--text-label": "10.5px",
        "--text-axis": "10px",
        "--text-axis-sm": "9.5px",
    }
    css = _css()
    for token, valor in esperados.items():
        hallado = re.search(rf"{re.escape(token)}:\s*([^;]+);", css)
        assert hallado, f"falta el token {token}"
        assert hallado.group(1).strip() == valor, (
            f"{token} vale {hallado.group(1).strip()} y la skill dice {valor}"
        )


@pytest.mark.unit
def test_ningun_tamano_de_fuente_suelto() -> None:
    """Los tamaños se piden por rol, no por medida."""
    texto = (ESTILOS / "base.css").read_text(encoding="utf-8")
    texto += (ESTILOS / "components.css").read_text(encoding="utf-8")
    texto = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
    sueltos = [t for t in re.findall(r"font-size:\s*([^;]+);", texto) if "var(--text" not in t]
    assert not sueltos, f"tamaños escritos a mano: {sueltos}. Usá var(--text-*)."


@pytest.mark.unit
def test_las_cifras_llevan_ancho_fijo() -> None:
    """Sin tabular-nums, una lista se mueve entera al recalcularse."""
    texto = (ESTILOS / "base.css").read_text(encoding="utf-8")
    assert "tabular-nums" in texto
    assert ".num" in texto


@pytest.mark.unit
def test_el_fondo_no_usa_background_attachment_fixed() -> None:
    """Safari en iOS lo ignora y el fondo se desplazaría con el contenido.

    Va en una capa `position: fixed` propia, que se comporta igual en
    todos los navegadores.
    """
    texto = (ESTILOS / "base.css").read_text(encoding="utf-8")
    sin_comentarios = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
    assert "background-attachment: fixed" not in sin_comentarios, (
        "usá una capa fija en lugar de background-attachment"
    )
    assert "body::after" in texto, "falta la capa del fondo"
    assert "z-index: -1" in texto, "la capa del fondo tiene que ir detrás del contenido"


# ==================================================================
#  Las dos capas de vidrio (F01-T03)
# ==================================================================
@pytest.mark.unit
def test_los_hijos_del_vidrio_van_sobre_el_brillo() -> None:
    """El ::before del brillo se pinta después de los hijos del flujo.

    Sin posicionarlos, el velo les pasa por arriba y el contenido de
    cualquier `.shell` nuevo se ve lavado. Resolverlo una vez acá evita
    que el error reaparezca con cada tarjeta que se agregue.
    """
    texto = (ESTILOS / "components.css").read_text(encoding="utf-8")
    assert ".shell > *" in texto, "falta posicionar los hijos directos de .shell"


@pytest.mark.unit
def test_las_dos_capas_tienen_desenfoques_distintos() -> None:
    """La jerarquía entre contenedor y contenido es la diferencia de blur.

    Si fueran iguales, `.cg` dentro de `.shell` no se distinguiría y se
    perdería la profundidad que da todo el sistema.
    """
    css = _css()
    shell = re.search(r"--glass-shell-blur:\s*(\d+)px", css)
    contenido = re.search(r"--glass-content-blur:\s*(\d+)px", css)
    assert shell and contenido
    assert int(shell.group(1)) > int(contenido.group(1)), (
        "el contenedor tiene que desenfocar más que el contenido"
    )


@pytest.mark.unit
def test_el_vidrio_lleva_el_prefijo_de_safari() -> None:
    """Safari necesita -webkit-backdrop-filter; sin él no desenfoca."""
    texto = (ESTILOS / "components.css").read_text(encoding="utf-8")
    normales = texto.count("backdrop-filter:") - texto.count("-webkit-backdrop-filter:")
    prefijadas = texto.count("-webkit-backdrop-filter:")
    assert prefijadas >= normales, (
        f"hay {normales} backdrop-filter y sólo {prefijadas} con prefijo de Safari"
    )


@pytest.mark.unit
def test_la_skill_no_miente_sobre_los_colores() -> None:
    """La skill es la referencia que se lee antes de escribir un componente.

    Si sus valores quedan viejos, alguien copia un color que ya no
    existe. Pasó: en F01-T03 se recalibró la tinta y la skill siguió
    mostrando los valores anteriores durante dos tareas, porque usa los
    nombres sin el prefijo `--color-` y el reemplazo no los encontró.
    """
    skill = (RAIZ / ".claude" / "skills" / "epic-wallet-ui" / "SKILL.md").read_text(
        encoding="utf-8"
    )
    css = _css()
    i_dark_css = css.index('html[data-theme="dark"] {')
    i_media_css = css.index("@media (prefers-color-scheme: dark)")
    claros = dict(re.findall(r"--color-([\w-]+):\s*(#[0-9a-fA-F]{6})", css[:i_dark_css]))
    oscuros = dict(
        re.findall(r"--color-([\w-]+):\s*(#[0-9a-fA-F]{6})", css[i_dark_css:i_media_css])
    )

    i_dark_skill = skill.index('html[data-theme="dark"]{')
    desfasados = []
    for texto, mapa, tema in (
        (skill[:i_dark_skill], claros, "claro"),
        (skill[i_dark_skill:], oscuros, "oscuro"),
    ):
        for nombre, valor in re.findall(r"--([\w-]+):(#[0-9a-fA-F]{6})", texto):
            real = mapa.get(nombre)
            if real and real.lower() != valor.lower():
                desfasados.append(f"--{nombre} ({tema}): la skill dice {valor} y es {real}")
    assert not desfasados, "la skill tiene colores viejos:\n  " + "\n  ".join(desfasados)
