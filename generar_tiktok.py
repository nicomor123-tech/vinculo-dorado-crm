#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera 30 imágenes verticales 1080x1920 para TikTok, una por frase.

Cada imagen tiene:
  - Fondo con degradado suave (rota entre 6 paletas modernas).
  - La frase en español, centrada, en tipografía blanca elegante y legible,
    con buen margen y una sombra sutil para que siempre se lea bien.
  - Abajo, en pequeño, el usuario (@____).

Los PNG se guardan en la carpeta "salida" y al final se comprime todo en
"salida.zip" para descargar.

Uso:
    python3 generar_tiktok.py            # usa el usuario por defecto
    python3 generar_tiktok.py @mi_user   # usa el usuario indicado
"""

import os
import sys
import zipfile

from PIL import Image, ImageDraw, ImageFont, ImageFilter

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

ANCHO, ALTO = 1080, 1920
MARGEN_LATERAL = 130          # margen a cada lado para el texto
CARPETA_SALIDA = "salida"
ZIP_SALIDA = "salida.zip"

# Cambia esto o pásalo como argumento al ejecutar el script.
USUARIO = sys.argv[1] if len(sys.argv) > 1 else "@____"

# 30 frases originales, cortas y emotivas sobre amor y desamor.
FRASES = [
    "Te fuiste y aprendí a habitar los silencios.",
    "No te extraño a ti, extraño quien era contigo.",
    "Hay amores que no terminan, solo cambian de tiempo verbal.",
    "Me quisiste a media luz y yo necesitaba todo el sol.",
    "Aprendí a quererme en los espacios que dejaste vacíos.",
    "Algunos adioses tardan años en hacerse verdad.",
    "Te pensé tanto que por un momento casi vuelves.",
    "No fue falta de amor, fue exceso de mal momento.",
    "Quererte fue fácil; soltarte se volvió un oficio.",
    "Me enseñaste a amar y te llevaste el manual.",
    "Sigo guardando tu nombre donde nadie pueda leerlo.",
    "Volver a ti sería traicionar a quien llegué a ser sin ti.",
    "Hay personas que se quedan aunque ya no estén.",
    "Te perdoné, pero todavía no aprendo a olvidarte.",
    "El amor no me dolió; me dolió tu manera de irte.",
    "A veces extraño la versión tuya que yo inventé.",
    "Te di mis mejores días y tú andabas distraído.",
    "Aún brindo, en voz baja, por lo que pudimos ser.",
    "Me dejaste y, sin querer, me encontré.",
    "No sé amar a medias, por eso me perdí entero.",
    "Te sigo escribiendo aunque ya no leas mis silencios.",
    "Lo nuestro fue verdad aunque no fuera para siempre.",
    "Caí por ti como quien no le teme al suelo.",
    "Hoy tu recuerdo pesa un poco menos que ayer.",
    "Esperé un mensaje que en el fondo ya sabía no llegaría.",
    "Te amé incluso cuando dejaste de quedarte.",
    "Entendí que rogar amor también es perderlo.",
    "Eras mi lugar favorito y te volviste geografía ajena.",
    "Soltar tu mano, al final, fue salvarme la vida.",
    "Algún día tu nombre será solo una palabra más.",
]

# 6 paletas bonitas y modernas (color superior, color inferior) para el
# degradado diagonal. Tonos suaves y elegantes.
PALETAS = [
    ((255, 154, 158), (250, 208, 196)),  # coral / durazno
    ((161, 140, 209), (251, 194, 235)),  # lavanda / rosa
    ((132, 250, 176), (143, 211, 244)),  # menta / cielo
    ((255, 175, 189), (255, 195, 160)),  # rosa / melocotón cálido
    ((48, 67, 132), (110, 69, 226)),     # azul noche / violeta
    ((233, 100, 121), (255, 184, 140)),  # frambuesa / ámbar
]

# ---------------------------------------------------------------------------
# Tipografía
# ---------------------------------------------------------------------------

RUTAS_FUENTE_FRASE = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]
RUTAS_FUENTE_USUARIO = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]


def _primera_fuente(rutas):
    for r in rutas:
        if os.path.exists(r):
            return r
    return None


RUTA_FRASE = _primera_fuente(RUTAS_FUENTE_FRASE)
RUTA_USUARIO = _primera_fuente(RUTAS_FUENTE_USUARIO)


def cargar_fuente(ruta, tam):
    if ruta:
        return ImageFont.truetype(ruta, tam)
    return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Utilidades de dibujo
# ---------------------------------------------------------------------------

def crear_degradado(color_sup, color_inf):
    """Degradado diagonal suave entre dos colores, con un velo central que
    aumenta la legibilidad del texto."""
    base = Image.new("RGB", (ANCHO, ALTO), color_sup)
    arr = base.load()
    r1, g1, b1 = color_sup
    r2, g2, b2 = color_inf
    diag = ANCHO + ALTO
    for y in range(ALTO):
        for x in range(0, ANCHO, 2):  # paso de 2 px: rápido y sin diferencia visible
            t = (x + y) / diag
            r = int(r1 + (r2 - r1) * t)
            g = int(g1 + (g2 - g1) * t)
            b = int(b1 + (b2 - b1) * t)
            arr[x, y] = (r, g, b)
            if x + 1 < ANCHO:
                arr[x + 1, y] = (r, g, b)

    # Velo oscuro muy sutil en el centro para realzar el texto blanco.
    velo = Image.new("L", (ANCHO, ALTO), 0)
    vd = ImageDraw.Draw(velo)
    vd.rectangle([0, ALTO * 0.18, ANCHO, ALTO * 0.82], fill=70)
    velo = velo.filter(ImageFilter.GaussianBlur(160))
    negro = Image.new("RGB", (ANCHO, ALTO), (0, 0, 0))
    base = Image.composite(negro, base, velo)
    return base


def ajustar_lineas(draw, texto, fuente, ancho_max):
    """Divide el texto en líneas que quepan en ancho_max."""
    palabras = texto.split()
    lineas, actual = [], ""
    for palabra in palabras:
        prueba = (actual + " " + palabra).strip()
        ancho = draw.textbbox((0, 0), prueba, font=fuente)[2]
        if ancho <= ancho_max or not actual:
            actual = prueba
        else:
            lineas.append(actual)
            actual = palabra
    if actual:
        lineas.append(actual)
    return lineas


def medir_bloque(draw, lineas, fuente, interlineado):
    alto = 0
    for ln in lineas:
        bbox = draw.textbbox((0, 0), ln, font=fuente)
        alto += (bbox[3] - bbox[1]) + interlineado
    return alto - interlineado if lineas else 0


def dibujar_frase(img, frase):
    draw = ImageDraw.Draw(img)
    ancho_max = ANCHO - 2 * MARGEN_LATERAL

    # Tamaño de fuente adaptativo: que el bloque ocupe bien sin pasarse.
    tam = 92
    while tam > 48:
        fuente = cargar_fuente(RUTA_FRASE, tam)
        interlineado = int(tam * 0.32)
        lineas = ajustar_lineas(draw, frase, fuente, ancho_max)
        alto_bloque = medir_bloque(draw, lineas, fuente, interlineado)
        if alto_bloque <= ALTO * 0.62 and len(lineas) <= 6:
            break
        tam -= 4

    y = (ALTO - alto_bloque) / 2
    for ln in lineas:
        bbox = draw.textbbox((0, 0), ln, font=fuente)
        ancho_linea = bbox[2] - bbox[0]
        alto_linea = bbox[3] - bbox[1]
        x = (ANCHO - ancho_linea) / 2 - bbox[0]
        y_dib = y - bbox[1]
        # Sombra suave para legibilidad sobre cualquier paleta.
        for dx, dy in ((3, 3), (2, 2)):
            draw.text((x + dx, y_dib + dy), ln, font=fuente,
                      fill=(0, 0, 0, 120))
        draw.text((x, y_dib), ln, font=fuente, fill=(255, 255, 255))
        y += alto_linea + interlineado


def dibujar_usuario(img):
    draw = ImageDraw.Draw(img)
    fuente = cargar_fuente(RUTA_USUARIO, 44)
    bbox = draw.textbbox((0, 0), USUARIO, font=fuente)
    ancho = bbox[2] - bbox[0]
    x = (ANCHO - ancho) / 2 - bbox[0]
    y = ALTO - 150
    draw.text((x + 2, y + 2), USUARIO, font=fuente, fill=(0, 0, 0, 110))
    draw.text((x, y), USUARIO, font=fuente, fill=(255, 255, 255))


# ---------------------------------------------------------------------------
# Programa principal
# ---------------------------------------------------------------------------

def main():
    os.makedirs(CARPETA_SALIDA, exist_ok=True)

    archivos = []
    for i, frase in enumerate(FRASES, start=1):
        color_sup, color_inf = PALETAS[(i - 1) % len(PALETAS)]
        img = crear_degradado(color_sup, color_inf)
        dibujar_frase(img, frase)
        dibujar_usuario(img)

        nombre = f"frase_{i:02d}.png"
        ruta = os.path.join(CARPETA_SALIDA, nombre)
        img.save(ruta, "PNG")
        archivos.append(ruta)
        print(f"[{i:02d}/30] {nombre}  ->  {frase}")

    # Comprimir todo en un zip.
    with zipfile.ZipFile(ZIP_SALIDA, "w", zipfile.ZIP_DEFLATED) as z:
        for ruta in archivos:
            z.write(ruta, os.path.basename(ruta))

    print(f"\nListo: {len(archivos)} imágenes en '{CARPETA_SALIDA}/'")
    print(f"Comprimido en '{ZIP_SALIDA}' (usuario: {USUARIO})")


if __name__ == "__main__":
    main()
