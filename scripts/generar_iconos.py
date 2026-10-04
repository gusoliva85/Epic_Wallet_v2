"""Genera los iconos de la PWA.

Uso:  python scripts/generar_iconos.py

Dibuja la marca de Epic Wallet —el símbolo de billetera sobre el
degradado de acento del sistema Vidrio Grafito— y escribe los tres
PNG que pide el manifest:

    icon-192.png       lanzador de Android
    icon-512.png       pantalla de arranque y tiendas
    maskable-512.png   igual, con la zona segura del 20% que Android
                       necesita para recortarlo en círculo, cuadrado
                       redondeado o la forma que use el teléfono

Se versiona el script y no sólo los PNG: así los iconos se pueden
regenerar si cambia el acento, sin depender de un editor de imágenes.

Referencia: 02_Documento_Tecnico.md §15 · tokens en
.claude/skills/epic-wallet-ui/SKILL.md §1
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "web" / "icons"

# Tokens del sistema. Si cambia --accent, se cambia acá y se regenera.
ACENTO = (71, 121, 156)  # #47799c
ACENTO_2 = (51, 92, 120)  # #335c78
BLANCO = (255, 255, 255)

# Se dibuja a 4x y se reduce al final: así los bordes quedan suaves
# sin depender de antialias de Pillow, que no lo aplica a los polígonos.
ESCALA = 4


def _degradado(lado: int) -> Image.Image:
    """Degradado diagonal de acento a acento-2, como la marca del mockup."""
    img = Image.new("RGB", (lado, lado))
    pix = img.load()
    assert pix is not None
    for y in range(lado):
        for x in range(lado):
            # 155° en el mockup: diagonal con más peso vertical
            t = (x * 0.42 + y * 0.58) / lado
            t = min(1.0, max(0.0, t))
            pix[x, y] = tuple(  # type: ignore[assignment]
                round(a + (b - a) * t) for a, b in zip(ACENTO, ACENTO_2, strict=True)
            )
    return img


def _reflejo(img: Image.Image) -> None:
    """El brillo diagonal del sistema: un degradado suave, no un corte.

    Se construye como máscara de alfa que decae hacia el centro, igual
    que el `linear-gradient(125deg, rgba(255,255,255,.55), transparent 50%)`
    que llevan las superficies en CSS.
    """
    lado = img.size[0]
    mascara = Image.new("L", (lado, lado))
    pix = mascara.load()
    assert pix is not None
    for y in range(lado):
        for x in range(lado):
            # 125°: la diagonal va de arriba-izquierda a abajo-derecha
            t = (x * 0.58 + y * 0.42) / lado
            # se apaga del todo antes de la mitad, como el `transparent 50%`
            valor = 0 if t >= 0.5 else round(78 * (1 - t / 0.5) ** 1.4)
            pix[x, y] = valor  # type: ignore[index]
    img.paste(Image.new("RGB", (lado, lado), BLANCO), (0, 0), mascara)


def _billetera(img: Image.Image, lado: int, margen: float) -> None:
    """El símbolo: cuerpo de billetera, bolsillo interior y botón.

    Sigue el trazo del SVG de la marca del mockup, simplificado para
    que se lea a 48 px en el lanzador del teléfono.
    """
    d = ImageDraw.Draw(img)
    grosor = max(2, round(lado * 0.040))

    caja = lado * (1 - 2 * margen)
    x0 = lado * margen
    ancho = caja
    alto = caja * 0.74
    y0 = lado * margen + (caja - alto) / 2

    # Cuerpo
    d.rounded_rectangle(
        [x0, y0, x0 + ancho, y0 + alto],
        radius=alto * 0.28,
        outline=BLANCO,
        width=grosor,
    )

    # Bolsillo: una banda interior a la derecha, bien dentro del cuerpo.
    margen_interior = grosor * 1.9
    bx1 = x0 + ancho - margen_interior
    bx0 = x0 + ancho * 0.36
    by0 = y0 + alto * 0.33
    by1 = y0 + alto * 0.67
    d.rounded_rectangle(
        [bx0, by0, bx1, by1],
        radius=(by1 - by0) * 0.46,
        outline=BLANCO,
        width=grosor,
    )

    # Botón, a la izquierda del bolsillo.
    r = alto * 0.062
    cx = x0 + ancho * 0.21
    cy = y0 + alto * 0.5
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=BLANCO)


def generar(lado: int, nombre: str, *, maskable: bool = False) -> Path:
    grande = lado * ESCALA
    img = _degradado(grande)
    _reflejo(img)

    # maskable: Android recorta hasta el 20% de cada borde, así que el
    # símbolo tiene que quedar dentro de la zona segura central.
    margen = 0.30 if maskable else 0.22
    _billetera(img, grande, margen)

    if not maskable:
        # Los iconos normales llevan esquinas redondeadas propias; los
        # maskable NO, porque el sistema les aplica su propia forma.
        mascara = Image.new("L", (grande, grande), 0)
        ImageDraw.Draw(mascara).rounded_rectangle(
            [0, 0, grande - 1, grande - 1], radius=round(grande * 0.22), fill=255
        )
        salida = Image.new("RGBA", (grande, grande), (0, 0, 0, 0))
        salida.paste(img, (0, 0), mascara)
        img = salida  # type: ignore[assignment]
    else:
        img = img.convert("RGBA")  # type: ignore[assignment]

    img = img.resize((lado, lado), Image.Resampling.LANCZOS)
    ruta = DESTINO / nombre
    img.save(ruta, "PNG", optimize=True)
    return ruta


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    pedidos = [
        (192, "icon-192.png", False),
        (512, "icon-512.png", False),
        (512, "maskable-512.png", True),
    ]
    print("\n  Iconos de Epic Wallet")
    for lado, nombre, maskable in pedidos:
        ruta = generar(lado, nombre, maskable=maskable)
        kb = ruta.stat().st_size / 1024
        etiqueta = "maskable" if maskable else "normal"
        print(f"    {nombre:20} {lado}x{lado}  {etiqueta:9} {kb:5.1f} KB")
    print(f"\n  en {DESTINO.relative_to(RAIZ)}\n")


if __name__ == "__main__":
    main()
