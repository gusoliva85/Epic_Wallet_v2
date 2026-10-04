"""Genera los iconos y el logotipo a partir de los originales.

Uso:  python scripts/generar_iconos.py

Fuentes (no se tocan, se leen):
    documentacion/ejemplos/icono.png    1024x1024
    documentacion/ejemplos/logo.png     1376x768

Salidas en web/icons/:
    icon-192.png       lanzador de Android
    icon-512.png       pantalla de arranque y tiendas
    maskable-512.png   con la zona segura del 20% que Android recorta
    logo.png           el logotipo recortado, con fondo transparente
    logo@2x.png        el mismo al doble, para pantallas densas

Qué hace con cada original:

- **icono.png** trae el símbolo arriba y el texto "Epic Wallet" abajo.
  Para un icono de aplicación el texto sobra —lo pone el sistema bajo
  el icono—, así que se recorta sólo el símbolo.

- **logo.png** tiene el logotipo sobre un fondo oscuro con mucho aire.
  Se recorta al contenido y se vuelve transparente el fondo, para que
  se pueda apoyar sobre cualquier superficie.

Referencia: 02_Documento_Tecnico.md §15
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ORIGENES = RAIZ / "documentacion" / "ejemplos"
DESTINO = RAIZ / "web" / "icons"

# El recuadro del icono dentro de icono.png, medido sobre el original.
# El texto "Epic Wallet" arranca en y 890 y queda fuera a propósito.
# Se recorta por DENTRO de su borde redondeado: el PNG de un icono
# tiene que llenar el cuadrado, porque el sistema le aplica su propia
# forma. Si trajera sus esquinas ya redondeadas, Android dibujaría un
# recorte sobre otro y se vería el borde interno.
RECUADRO = (137, 126, 882, 858)
INSET = 44

# Recortes dentro de logo.png (1376x768), medidos sobre el original.
# LOGOTIPO: el conjunto completo, símbolo más texto, con su fondo.
# ISOTIPO: sólo el símbolo, que al ser luminoso funciona sobre
# cualquier superficie y sirve para la barra superior.
LOGOTIPO = (160, 215, 1215, 500)
ISOTIPO = (172, 228, 522, 492)


def _recortar_cuadrado(img: Image.Image, caja: tuple[int, int, int, int]) -> Image.Image:
    """Recorta y deja un cuadrado perfecto, centrado en la caja dada."""
    x0, y0, x1, y1 = caja
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    lado = max(x1 - x0, y1 - y0)
    mitad = lado // 2
    return img.crop((cx - mitad, cy - mitad, cx + mitad, cy + mitad))


def _sin_borde(img: Image.Image, inset: int) -> Image.Image:
    """Recorta hacia adentro para dejar fuera el borde redondeado."""
    w, h = img.size
    return img.crop((inset, inset, w - inset, h - inset))


def _color_interior(img: Image.Image) -> tuple[int, int, int]:
    """Color del fondo del icono, muestreado dentro del recuadro.

    Se promedian puntos del perímetro interior, lejos del símbolo, para
    que las esquinas rellenadas se confundan con el fondo del icono.
    """
    lado = img.size[0]
    px = img.load()
    assert px is not None
    d = round(lado * 0.09)
    puntos = [
        (d, d),
        (lado - d, d),
        (d, lado - d),
        (lado - d, lado - d),
        (lado // 2, d),
        (lado // 2, lado - d),
        (d, lado // 2),
        (lado - d, lado // 2),
    ]
    muestras = [px[x, y] for x, y in puntos]
    return tuple(round(sum(c[i] for c in muestras) / len(muestras)) for i in range(3))  # type: ignore[return-value]


def generar_iconos() -> None:
    fuente = Image.open(ORIGENES / "icono.png").convert("RGB")
    simbolo = _sin_borde(_recortar_cuadrado(fuente, RECUADRO), INSET)

    # --- iconos normales: el símbolo tal cual, a tamaño ---
    for lado in (192, 512):
        img = simbolo.resize((lado, lado), Image.Resampling.LANCZOS)
        ruta = DESTINO / f"icon-{lado}.png"
        img.save(ruta, "PNG", optimize=True)
        print(f"    {ruta.name:20} {lado}x{lado}  normal     {ruta.stat().st_size / 1024:5.1f} KB")

    # --- maskable: Android recorta hasta el 20% de cada borde, así que
    #     el símbolo se achica y se centra sobre el color del fondo ---
    lado = 512
    seguro = round(lado * 0.74)  # deja ~13% de margen a cada lado
    lienzo = Image.new("RGB", (lado, lado), _color_interior(simbolo))
    centro = simbolo.resize((seguro, seguro), Image.Resampling.LANCZOS)
    pos = (lado - seguro) // 2
    lienzo.paste(centro, (pos, pos))
    ruta = DESTINO / "maskable-512.png"
    lienzo.save(ruta, "PNG", optimize=True)
    print(f"    {ruta.name:20} {lado}x{lado}  maskable   {ruta.stat().st_size / 1024:5.1f} KB")


def generar_logo() -> None:
    """Dos piezas a partir de logo.png.

    El logotipo está pensado para fondo oscuro: su texto es blanco y el
    subtítulo gris claro. Sobre una superficie clara no se leería. Por
    eso se genera de dos formas:

    - `logo.png` conserva su fondo oscuro y funciona como una placa
      apoyable sobre cualquier superficie, en tema claro u oscuro.
    - `isotipo.png` es sólo el símbolo, con fondo transparente. Al ser
      un trazo luminoso y saturado se lee bien sobre claro y sobre
      oscuro, así que sirve para la barra superior junto al nombre
      escrito con la tipografía de la aplicación.
    """
    fuente = Image.open(ORIGENES / "logo.png").convert("RGB")

    # --- logotipo completo, con su fondo ---
    placa = fuente.crop(LOGOTIPO)
    for sufijo, ancho in (("", 560), ("@2x", 1120)):
        alto = round(placa.size[1] * ancho / placa.size[0])
        img = placa.resize((ancho, alto), Image.Resampling.LANCZOS)
        ruta = DESTINO / f"logo{sufijo}.png"
        img.save(ruta, "PNG", optimize=True)
        print(f"    {ruta.name:20} {ancho}x{alto}  logotipo   {ruta.stat().st_size / 1024:5.1f} KB")

    # --- isotipo, con el fondo oscuro vuelto transparente ---
    simbolo = fuente.crop(ISOTIPO).convert("RGBA")
    px = simbolo.load()
    assert px is not None
    w, h = simbolo.size
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            lum = (r * 299 + g * 587 + b * 114) // 1000
            if lum < 26:
                alfa = 0
            elif lum < 70:
                alfa = round((lum - 26) * 255 / 44)
            else:
                alfa = 255
            px[x, y] = (r, g, b, alfa)
    for sufijo, ancho in (("", 240), ("@2x", 480)):
        alto = round(h * ancho / w)
        img = simbolo.resize((ancho, alto), Image.Resampling.LANCZOS)
        ruta = DESTINO / f"isotipo{sufijo}.png"
        img.save(ruta, "PNG", optimize=True)
        print(f"    {ruta.name:20} {ancho}x{alto}  isotipo    {ruta.stat().st_size / 1024:5.1f} KB")


def main() -> None:
    DESTINO.mkdir(parents=True, exist_ok=True)
    print("\n  Iconos y logotipo de Epic Wallet")
    generar_iconos()
    generar_logo()
    print(f"\n  en {DESTINO.relative_to(RAIZ)}\n")


if __name__ == "__main__":
    main()
