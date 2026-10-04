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
