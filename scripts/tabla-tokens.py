"""Genera el cuadro de tokens para la documentación de la fase 1.

    python scripts/tabla-tokens.py

Lee `web/src/styles/tokens.css` y escribe la tabla en Markdown entre
las marcas `<!-- TOKENS:INICIO -->` y `<!-- TOKENS:FIN -->` de
`docs/FASE_01_SISTEMA_DE_ESTILO.md`.

Se genera en lugar de escribirse a mano por el mismo motivo por el que
se generan los iconos: una tabla copiada queda vieja en cuanto alguien
toca un token, y nadie se entera hasta que usa un valor que ya no
existe. `tests/unit/test_documentacion.py` comprueba que coincidan.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TOKENS = RAIZ / "web" / "src" / "styles" / "tokens.css"
DOC = RAIZ / "docs" / "FASE_01_SISTEMA_DE_ESTILO.md"

INICIO = "<!-- TOKENS:INICIO -->"
FIN = "<!-- TOKENS:FIN -->"

# El orden de las familias en la tabla, con su título. Lo que no entra
# en ninguna cae en «Otros», que así se nota y se puede acomodar.
FAMILIAS: list[tuple[str, str, tuple[str, ...]]] = [
    ("Fondo y lavados", "El ambiente sobre el que flota todo.", ("--color-bg", "--color-wash")),
    ("Tinta", "Cuatro niveles de jerarquía, calibrados por contraste.", ("--color-ink",)),
    (
        "Acento",
        "El azul grafito que da identidad.",
        ("--color-accent", "--color-navy", "--color-on-accent"),
    ),
    (
        "Semántica financiera",
        "Ingreso, egreso y ahorro.",
        ("--color-inc", "--color-egr", "--color-sav"),
    ),
    (
        "Severidad",
        "Las cuatro de los avisos.",
        ("--color-ok", "--color-warn", "--color-pend", "--color-crit"),
    ),
    ("Tarjetas de color", "Fondo sólido del tablero. No cambian con el tema.", ("--color-card",)),
    ("Avatar y decoración", "", ("--color-avatar", "--peso-", "--glifo-", "--marca-")),
    ("Líneas", "", ("--line",)),
    ("Vidrio", "Las dos capas, más el de las barras y las hojas.", ("--glass",)),
    (
        "Sombras y mezclas",
        "",
        ("--shadow", "--sh-", "--mix-", "--groove", "--scrim", "--accent-ring", "--solid-sheen"),
    ),
    ("Radios", "", ("--radius",)),
    ("Tipografía", "Un tamaño por ROL, nunca por medida.", ("--font", "--text-", "--tracking")),
    ("Movimiento", "", ("--ease",)),
]


def leer() -> tuple[dict[str, str], dict[str, str]]:
    css = TOKENS.read_text(encoding="utf-8")
    i_dark = css.index('html[data-theme="dark"] {')
    i_media = css.index("@media (prefers-color-scheme: dark)")

    def valores(texto: str) -> dict[str, str]:
        # Los valores multilínea (las sombras compuestas) se juntan en
        # una sola línea, o la tabla de Markdown se rompe.
        crudos = re.findall(r"(--[\w-]+):\s*([^;]+);", texto, re.S)
        return {k: re.sub(r"\s+", " ", v).strip() for k, v in crudos}

    return valores(css[:i_dark]), valores(css[i_dark:i_media])


def tabla() -> str:
    claro, oscuro = leer()
    usados: set[str] = set()
    partes: list[str] = []

    for titulo, bajada, prefijos in FAMILIAS:
        filas = [k for k in claro if any(k.startswith(p) for p in prefijos)]
        if not filas:
            continue
        usados.update(filas)

        partes.append(f"#### {titulo}")
        if bajada:
            partes.append("")
            partes.append(bajada)
        partes.append("")
        partes.append("| Token | Claro | Oscuro |")
        partes.append("|---|---|---|")
        for k in sorted(filas):
            o = oscuro.get(k, "—")
            partes.append(f"| `{k}` | `{claro[k]}` | {'`' + o + '`' if o != '—' else '*igual*'} |")
        partes.append("")

    sueltos = sorted(set(claro) - usados)
    if sueltos:
        partes.append("#### Otros")
        partes.append("")
        partes.append("| Token | Claro | Oscuro |")
        partes.append("|---|---|---|")
        for k in sueltos:
            o = oscuro.get(k, "—")
            partes.append(f"| `{k}` | `{claro[k]}` | {'`' + o + '`' if o != '—' else '*igual*'} |")
        partes.append("")

    partes.append(
        f"**{len(claro)} tokens en total**, de los cuales **{len(oscuro)} se redefinen "
        "en el tema oscuro.** Los que no aparecen en la columna oscura son los mismos "
        "en los dos temas: medidas, curvas y las tarjetas de color."
    )
    return "\n".join(partes)


def main() -> int:
    nueva = tabla()
    if not DOC.exists():
        sys.stdout.write(nueva + "\n")
        return 0

    texto = DOC.read_text(encoding="utf-8")
    if INICIO not in texto or FIN not in texto:
        sys.stderr.write(f"faltan las marcas {INICIO} / {FIN} en {DOC}\n")
        return 1

    antes = texto[: texto.index(INICIO) + len(INICIO)]
    despues = texto[texto.index(FIN) :]
    DOC.write_text(f"{antes}\n\n{nueva}\n\n{despues}", encoding="utf-8")
    sys.stdout.write(f"  cuadro de tokens actualizado en {DOC.name}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
