from __future__ import annotations

import math
import os
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


WIDTH = 1024
HEIGHT = 512
SEED = 20260313 + 101
OUTPUT_DIR = Path(__file__).resolve().parents[1] / "static" / "materials" / "yellow-crystal-realistic"


def clamp(value: float, low: float = 0.0, high: float = 255.0) -> int:
    return int(max(low, min(high, round(value))))


def mix(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def mix_color(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(clamp(mix(a[i], b[i], t)) for i in range(3))


def noise(x: float, y: float) -> float:
    total = 0.0
    amp = 1.0
    freq = 1.0
    amp_sum = 0.0
    for _ in range(5):
        val = math.sin((x * 2.1 + 0.7) * freq) * math.cos((y * 1.9 - 0.3) * freq)
        val += 0.55 * math.sin((x + y) * 2.7 * freq + 1.8)
        total += val * amp
        amp_sum += amp
        amp *= 0.52
        freq *= 2.07
    return (total / amp_sum + 1.0) * 0.5


def build_basecolor() -> Image.Image:
    img = Image.new("RGB", (WIDTH, HEIGHT))
    px = img.load()

    top = (230, 176, 49)
    mid = (208, 154, 43)
    bottom = (121, 74, 11)
    warm = (255, 223, 120)
    dark_line = (66, 53, 14)

    for y in range(HEIGHT):
        v = y / (HEIGHT - 1)
        for x in range(WIDTH):
            u = x / (WIDTH - 1)

            if v < 0.52:
                base = mix_color(top, mid, v / 0.52)
            else:
                base = mix_color(mid, bottom, (v - 0.52) / 0.48)

            n1 = noise(u * 2.6, v * 1.5)
            n2 = noise(u * 8.0 + 5.7, v * 6.0 + 2.4)
            n3 = noise(u * 18.0 + 1.2, v * 2.0 + 3.1)

            diagonal = v - (0.61 - 0.21 * u)
            rod_core = math.exp(-(diagonal * diagonal) / 0.00022)
            rod_halo = math.exp(-(diagonal * diagonal) / 0.0018)
            rod_shadow = math.exp(-((v - (0.59 - 0.215 * u)) ** 2) / 0.00045)

            right_glow = math.exp(-(((u - 0.8) ** 2) / 0.01 + ((v - 0.43) ** 2) / 0.03))
            bowl_glow = math.exp(-(((u - 0.5) ** 2) / 0.18 + ((v - 0.84) ** 2) / 0.02))

            r = base[0] + n1 * 15 + n2 * 7 + rod_halo * 32 + right_glow * 28 + bowl_glow * 24
            g = base[1] + n1 * 10 + n2 * 5 + rod_halo * 18 + right_glow * 20 + bowl_glow * 16
            b = base[2] + n1 * 2 + n3 * 4 + rod_halo * 5 + right_glow * 8 + bowl_glow * 4

            color = (clamp(r), clamp(g), clamp(b))
            color = mix_color(color, warm, rod_core * 0.55)
            color = mix_color(color, dark_line, rod_shadow * 0.34)
            px[x, y] = color

    draw = ImageDraw.Draw(img, "RGBA")
    random.seed(SEED)
    for _ in range(70):
        x = random.randint(0, WIDTH - 1)
        y = random.randint(0, HEIGHT - 1)
        radius = random.randint(1, 3)
        alpha = random.randint(16, 48)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=(255, 243, 189, alpha))

    return img.filter(ImageFilter.GaussianBlur(0.35))


def build_roughness() -> Image.Image:
    img = Image.new("L", (WIDTH, HEIGHT))
    px = img.load()
    for y in range(HEIGHT):
        v = y / (HEIGHT - 1)
        for x in range(WIDTH):
            u = x / (WIDTH - 1)
            grain = noise(u * 14.0 + 2.0, v * 10.0 + 6.0)
            diagonal = v - (0.61 - 0.21 * u)
            rod = math.exp(-(diagonal * diagonal) / 0.0012)
            edge = abs(v - 0.5) * 1.8
            value = 48 + grain * 34 + edge * 20 - rod * 10
            px[x, y] = clamp(value, 20, 140)
    return img.filter(ImageFilter.GaussianBlur(0.8))


def build_alpha() -> Image.Image:
    img = Image.new("L", (WIDTH, HEIGHT))
    px = img.load()
    for y in range(HEIGHT):
        v = y / (HEIGHT - 1)
        for x in range(WIDTH):
            u = x / (WIDTH - 1)
            n = noise(u * 5.0 + 4.0, v * 4.5 + 1.0)
            diagonal = v - (0.61 - 0.21 * u)
            rod = math.exp(-(diagonal * diagonal) / 0.001)
            value = 216 + n * 20 + rod * 10
            px[x, y] = clamp(value, 194, 246)
    return img.filter(ImageFilter.GaussianBlur(0.55))


def build_normal() -> Image.Image:
    height = Image.new("L", (WIDTH, HEIGHT))
    hp = height.load()
    for y in range(HEIGHT):
        v = y / (HEIGHT - 1)
        for x in range(WIDTH):
            u = x / (WIDTH - 1)
            fine = noise(u * 12.0 + 1.1, v * 12.0 + 9.4)
            diagonal = v - (0.61 - 0.21 * u)
            rod = math.exp(-(diagonal * diagonal) / 0.0017)
            hp[x, y] = clamp(128 + fine * 24 + rod * 18, 0, 255)

    img = Image.new("RGB", (WIDTH, HEIGHT))
    px = img.load()
    sp = height.load()
    for y in range(HEIGHT):
        ym = max(0, y - 1)
        yp = min(HEIGHT - 1, y + 1)
        for x in range(WIDTH):
            xm = (x - 1) % WIDTH
            xp = (x + 1) % WIDTH
            dx = (sp[xp, y] - sp[xm, y]) / 255.0
            dy = (sp[x, yp] - sp[x, ym]) / 255.0
            nx = -dx * 3.4
            ny = -dy * 3.4
            nz = 1.0
            length = math.sqrt(nx * nx + ny * ny + nz * nz)
            nx /= length
            ny /= length
            nz /= length
            px[x, y] = (
                clamp((nx * 0.5 + 0.5) * 255.0),
                clamp((ny * 0.5 + 0.5) * 255.0),
                clamp((nz * 0.5 + 0.5) * 255.0),
            )
    return img


def build_preview(base: Image.Image) -> Image.Image:
    sphere = base.resize((768, 768))
    mask = Image.new("L", (768, 768), 0)
    ImageDraw.Draw(mask).ellipse((24, 24, 744, 744), fill=255)

    orb = Image.new("RGBA", (768, 768), (0, 0, 0, 0))
    orb.paste(sphere, (0, 0))
    orb.putalpha(mask)

    gloss = Image.new("RGBA", (768, 768), (0, 0, 0, 0))
    draw = ImageDraw.Draw(gloss, "RGBA")
    draw.polygon([(166, 222), (256, 164), (332, 252), (280, 370), (180, 326)], fill=(255, 255, 255, 195))
    draw.ellipse((512, 188, 720, 430), fill=(255, 232, 126, 82))
    draw.rounded_rectangle((138, 392, 666, 430), radius=18, fill=(255, 246, 196, 118))
    gloss = gloss.filter(ImageFilter.GaussianBlur(10))

    shadow = Image.new("RGBA", (768, 768), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).ellipse((150, 592, 704, 728), fill=(48, 24, 0, 92))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))

    rim = Image.new("RGBA", (768, 768), (0, 0, 0, 0))
    ImageDraw.Draw(rim, "RGBA").ellipse((18, 18, 750, 750), outline=(255, 239, 200, 118), width=7)
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
    print(path)


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    random.seed(SEED)

    base = build_basecolor()
    roughness = build_roughness()
    normal = build_normal()
    alpha = build_alpha()
    preview = build_preview(base)

    save_image(base, "yellow-crystal-realistic-basecolor.png")
    save_image(roughness, "yellow-crystal-realistic-roughness.png")
    save_image(normal, "yellow-crystal-realistic-normal.png")
    save_image(alpha, "yellow-crystal-realistic-alpha.png")
    save_image(preview, "yellow-crystal-realistic-preview.png")


if __name__ == "__main__":
    main()
