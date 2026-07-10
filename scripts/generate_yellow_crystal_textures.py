from __future__ import annotations

import math
import os
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


WIDTH = 1024
HEIGHT = 512
SEED = 20260313
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "static" / "materials" / "yellow-crystal"


def clamp(value: float, low: float = 0.0, high: float = 255.0) -> int:
    return int(max(low, min(high, round(value))))


def smoothstep(edge0: float, edge1: float, x: float) -> float:
    if edge0 == edge1:
        return 0.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3.0 - 2.0 * t)


def mix(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def color_mix(c1: tuple[int, int, int], c2: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(clamp(mix(c1[i], c2[i], t)) for i in range(3))


def fractal_noise(x: float, y: float) -> float:
    value = 0.0
    amplitude = 1.0
    frequency = 1.0
    total = 0.0
    for _ in range(4):
        sample = math.sin((x * frequency * 2.5) + 0.9) * math.cos((y * frequency * 2.0) - 0.6)
        sample += 0.5 * math.sin((x + y) * frequency * 3.2 + 1.3)
        value += sample * amplitude
        total += amplitude
        amplitude *= 0.5
        frequency *= 2.03
    return (value / total + 1.0) * 0.5


def build_basecolor() -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT))
    px = img.load()

    top_color = (243, 200, 74)
    bottom_color = (158, 106, 22)
    glow_color = (255, 232, 133)
    streak_color = (250, 210, 82)

    for y in range(HEIGHT):
        v = y / (HEIGHT - 1)
        for x in range(WIDTH):
            u = x / (WIDTH - 1)
            base = color_mix(top_color, bottom_color, smoothstep(0.02, 0.98, v))

            long_noise = fractal_noise(u * 3.0, v * 1.2)
            cloud_noise = fractal_noise(u * 8.0 + 7.4, v * 7.0 + 1.1)

            band_center = 0.54 + math.sin((u * 4.3) - 0.4) * 0.012
            band = math.exp(-((v - band_center) ** 2) / 0.00045)
            band *= 0.75 + 0.25 * fractal_noise(u * 24.0, v * 4.0)

            warm_glow = math.exp(-(((u - 0.73) ** 2) / 0.025 + ((v - 0.50) ** 2) / 0.18))
            inner_depth = math.exp(-(((u - 0.5) ** 2) / 0.12 + ((v - 0.55) ** 2) / 0.5))

            r = base[0] + long_noise * 16 + cloud_noise * 9 + band * 28 + warm_glow * 18 + inner_depth * 10
            g = base[1] + long_noise * 10 + cloud_noise * 7 + band * 18 + warm_glow * 13 + inner_depth * 7
            b = base[2] + long_noise * 3 + cloud_noise * 4 + band * 8 + warm_glow * 5 + inner_depth * 2

            streak_mix = max(0.0, min(1.0, band * 0.8))
            color = color_mix((clamp(r), clamp(g), clamp(b)), streak_color, streak_mix * 0.35)
            color = color_mix(color, glow_color, warm_glow * 0.12)
            px[x, y] = color

    draw = ImageDraw.Draw(img, "RGBA")
    random.seed(SEED)

    for _ in range(55):
        x = random.randint(0, WIDTH - 1)
        y = random.randint(0, HEIGHT - 1)
        radius = random.randint(1, 3)
        alpha = random.randint(24, 66)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 245, 210, alpha))

    for _ in range(8):
        start_x = random.randint(0, WIDTH - 1)
        start_y = random.randint(int(HEIGHT * 0.32), int(HEIGHT * 0.68))
        length = random.randint(140, 260)
        offset = random.randint(-12, 12)
        draw.rounded_rectangle(
            (start_x, start_y, min(WIDTH, start_x + length), start_y + 4 + abs(offset) // 4),
            radius=4,
            fill=(255, 224, 110, 26),
        )

    return img.filter(ImageFilter.GaussianBlur(0.4))


def build_roughness() -> Image.Image:
    img = Image.new("L", (WIDTH, HEIGHT))
    px = img.load()

    for y in range(HEIGHT):
        v = y / (HEIGHT - 1)
        for x in range(WIDTH):
            u = x / (WIDTH - 1)
            grain = fractal_noise(u * 10.0 + 1.2, v * 10.0 + 4.7)
            band = math.exp(-((v - 0.54) ** 2) / 0.0008)
            edge_soft = abs(v - 0.5) * 2.0
            value = 52 + grain * 36 + edge_soft * 22 - band * 18
            px[x, y] = clamp(value, 26, 140)

    return img.filter(ImageFilter.GaussianBlur(0.8))


def build_normal() -> Image.Image:
    height_map = Image.new("L", (WIDTH, HEIGHT))
    hpx = height_map.load()

    for y in range(HEIGHT):
        v = y / (HEIGHT - 1)
        for x in range(WIDTH):
            u = x / (WIDTH - 1)
            fine = fractal_noise(u * 14.0 + 2.0, v * 14.0 + 8.0)
            band = math.exp(-((v - (0.54 + math.sin(u * 7.0) * 0.01)) ** 2) / 0.001)
            hpx[x, y] = clamp(126 + fine * 24 + band * 22, 0, 255)

    nrm = Image.new("RGB", (WIDTH, HEIGHT))
    npix = nrm.load()
    src = height_map.load()

    for y in range(HEIGHT):
        ym = max(0, y - 1)
        yp = min(HEIGHT - 1, y + 1)
        for x in range(WIDTH):
            xm = (x - 1) % WIDTH
            xp = (x + 1) % WIDTH
            dx = (src[xp, y] - src[xm, y]) / 255.0
            dy = (src[x, yp] - src[x, ym]) / 255.0
            nx = -dx * 3.0
            ny = -dy * 3.0
            nz = 1.0
            length = math.sqrt(nx * nx + ny * ny + nz * nz)
            nx /= length
            ny /= length
            nz /= length
            npix[x, y] = (
                clamp((nx * 0.5 + 0.5) * 255.0),
                clamp((ny * 0.5 + 0.5) * 255.0),
                clamp((nz * 0.5 + 0.5) * 255.0),
            )

    return nrm


def build_alpha() -> Image.Image:
    img = Image.new("L", (WIDTH, HEIGHT))
    px = img.load()

    for y in range(HEIGHT):
        v = y / (HEIGHT - 1)
        for x in range(WIDTH):
            u = x / (WIDTH - 1)
            density = fractal_noise(u * 6.0 + 1.5, v * 5.0 + 3.2)
            band = math.exp(-((v - 0.54) ** 2) / 0.0007)
            value = 214 + density * 22 + band * 12
            px[x, y] = clamp(value, 190, 245)

    return img.filter(ImageFilter.GaussianBlur(0.6))


def build_preview(basecolor: Image.Image) -> Image.Image:
    preview = basecolor.resize((768, 768))
    mask = Image.new("L", (768, 768), 0)
    ImageDraw.Draw(mask).ellipse((24, 24, 744, 744), fill=255)

    orb = Image.new("RGBA", (768, 768), (0, 0, 0, 0))
    orb.paste(preview, (0, 0))
    orb.putalpha(mask)

    shadow = Image.new("RGBA", (768, 768), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((120, 590, 690, 730), fill=(46, 24, 0, 75))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))

    gloss = Image.new("RGBA", (768, 768), (0, 0, 0, 0))
    draw = ImageDraw.Draw(gloss, "RGBA")
    draw.ellipse((110, 135, 330, 350), fill=(255, 255, 255, 165))
    draw.rounded_rectangle((160, 350, 620, 385), radius=24, fill=(255, 246, 202, 110))
    draw.ellipse((540, 220, 690, 390), fill=(255, 227, 124, 44))
    gloss = gloss.filter(ImageFilter.GaussianBlur(14))

    rim = Image.new("RGBA", (768, 768), (0, 0, 0, 0))
    rim_draw = ImageDraw.Draw(rim, "RGBA")
    rim_draw.ellipse((18, 18, 750, 750), outline=(255, 240, 192, 120), width=8)
    rim = rim.filter(ImageFilter.GaussianBlur(1.5))

    canvas = Image.new("RGBA", (768, 768), (245, 245, 245, 255))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas = Image.alpha_composite(canvas, orb)
    canvas = Image.alpha_composite(canvas, gloss)
    canvas = Image.alpha_composite(canvas, rim)
    return canvas.convert("RGB")


def save_image(image: Image.Image, name: str) -> None:
    path = OUTPUT_DIR / name
    image.save(path, optimize=True)
    print(path.relative_to(OUTPUT_DIR.parents[2]))


def main() -> None:
    random.seed(SEED)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    basecolor = build_basecolor()
    roughness = build_roughness()
    normal = build_normal()
    alpha = build_alpha()
    preview = build_preview(basecolor)

    save_image(basecolor, "yellow-crystal-basecolor.png")
    save_image(roughness, "yellow-crystal-roughness.png")
    save_image(normal, "yellow-crystal-normal.png")
    save_image(alpha, "yellow-crystal-alpha.png")
    save_image(preview, "yellow-crystal-preview.png")


if __name__ == "__main__":
    main()
