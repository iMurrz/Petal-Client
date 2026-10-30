"""Shared palette and painting helpers for the Petal 64x pack.

Everything is painted from scratch with Pillow: no vanilla pixels are copied,
so the pack is original artwork that happens to sit at vanilla's sprite sizes.
"""
import math
import random

from PIL import Image, ImageDraw, ImageFilter

SCALE = 4   # 16px vanilla -> 64px ("x64")
N = 64      # block/item texture size
CELL = 4    # chunky pixel grid: 64 / 4 = 16 logical pixels

# ------------------------------------------------- UI palette (dark mode)
# Near-black panels so the pink reads as light in a dark room; purple is kept
# for secondary accents only.
INK        = (10, 7, 16, 255)
INK_SOFT   = (16, 12, 24, 255)
PANEL      = (21, 17, 30, 255)
PANEL_HI   = (31, 25, 43, 255)
LINE       = (48, 40, 63, 255)
SLOT_BG    = (13, 10, 19, 255)

PINK_DEEP  = (178, 24, 108, 255)
PINK       = (232, 36, 139, 255)
PINK_MID   = (255, 95, 174, 255)
PINK_SOFT  = (255, 154, 207, 255)
PINK_PALE  = (255, 211, 234, 255)

PURPLE_DEEP = (76, 29, 149, 255)
PURPLE      = (109, 40, 217, 255)
PURPLE_MID  = (139, 92, 246, 255)
ORCHID      = (178, 59, 230, 255)
LILAC       = (200, 166, 255, 255)

MINT       = (143, 245, 210, 255)
MINT_DEEP  = (63, 191, 147, 255)
GOLD       = (255, 217, 138, 255)
GOLD_DEEP  = (224, 163, 63, 255)
MILK       = (247, 238, 255, 255)
MUTED      = (176, 162, 196, 255)
SHADOW     = (0, 0, 0, 90)
CLEAR      = (0, 0, 0, 0)

# ------------------------------------------- material palette (vanilla-true)
# Blocks and items follow the colours players expect from the game, painted at
# 64x with extra shading. (light, mid, dark) per material.
MAT = {
    "diamond":   ((152, 248, 236, 255), (78, 226, 212, 255), (41, 161, 155, 255)),
    "iron":      ((232, 232, 232, 255), (198, 198, 198, 255), (136, 136, 136, 255)),
    "gold":      ((252, 238, 122, 255), (246, 208, 62, 255), (186, 142, 28, 255)),
    "netherite": ((106, 94, 96, 255), (74, 65, 67, 255), (44, 38, 40, 255)),
    "stone":     ((168, 168, 168, 255), (125, 125, 125, 255), (86, 86, 86, 255)),
    "wood":      ((188, 152, 98, 255), (150, 114, 68, 255), (104, 78, 46, 255)),
    "emerald":   ((122, 247, 164, 255), (65, 243, 132, 255), (23, 162, 76, 255)),
    "lapis":     ((106, 140, 220, 255), (58, 90, 190, 255), (34, 54, 124, 255)),
    "redstone":  ((255, 86, 86, 255), (214, 26, 26, 255), (140, 12, 12, 255)),
    "copper":    ((231, 124, 86, 255), (192, 96, 60, 255), (134, 66, 42, 255)),
    "coal":      ((72, 72, 72, 255), (46, 46, 46, 255), (24, 24, 24, 255)),
    "amethyst":  ((198, 148, 232, 255), (166, 106, 212, 255), (110, 62, 152, 255)),
    "quartz":    ((248, 244, 236, 255), (226, 220, 206, 255), (180, 172, 156, 255)),
    "leather":   ((178, 124, 80, 255), (140, 94, 58, 255), (96, 62, 36, 255)),
    "chain":     ((162, 162, 170, 255), (122, 122, 132, 255), (78, 78, 88, 255)),
}


def mat(name):
    return MAT[name]


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def shade(c, amount):
    """amount > 0 lightens toward white, < 0 darkens toward black."""
    if amount >= 0:
        return lerp(c, (255, 255, 255, c[3]), amount)
    return lerp(c, (0, 0, 0, c[3]), -amount)


def alpha(c, a):
    return (c[0], c[1], c[2], round(255 * a))


# ---------------------------------------------------------------- canvas
def new(w, h, fill=CLEAR):
    return Image.new("RGBA", (w, h), fill)


def draw(img):
    return ImageDraw.Draw(img)


def vgrad(img, box, top, bottom):
    """Vertical gradient inside box=(x0, y0, x1, y1), exclusive of x1/y1."""
    x0, y0, x1, y1 = box
    d = draw(img)
    span = max(1, y1 - y0 - 1)
    for y in range(y0, y1):
        d.rectangle([x0, y, x1 - 1, y], fill=lerp(top, bottom, (y - y0) / span))


def hgrad(img, box, left, right):
    x0, y0, x1, y1 = box
    d = draw(img)
    span = max(1, x1 - x0 - 1)
    for x in range(x0, x1):
        d.rectangle([x, y0, x, y1 - 1], fill=lerp(left, right, (x - x0) / span))


def diag_sheen(img, box, color, width_frac=0.26, pos=0.3):
    """A soft diagonal highlight band, the Petal signature on buttons."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    band = new(w, h)
    d = draw(band)
    bw = max(2, int(w * width_frac))
    cx = int(w * pos)
    for i in range(-bw, bw):
        t = 1 - abs(i) / bw
        d.line([(cx + i, 0), (cx + i - h, h)], fill=alpha(color, 0.30 * t), width=1)
    band = band.filter(ImageFilter.GaussianBlur(max(1, w // 60)))
    img.alpha_composite(band, (x0, y0))


def inner_shadow(img, box, depth, color=(0, 0, 0, 110)):
    """Darkens the bottom and right inside edges: gives slots real depth."""
    x0, y0, x1, y1 = box
    d = draw(img)
    for i in range(depth):
        a = color[3] * (1 - i / max(1, depth))
        c = (color[0], color[1], color[2], round(a))
        d.line([(x0 + i, y1 - 1 - i), (x1 - 1 - i, y1 - 1 - i)], fill=c)
        d.line([(x1 - 1 - i, y0 + i), (x1 - 1 - i, y1 - 1 - i)], fill=c)


def top_light(img, box, depth, color=(255, 255, 255, 80)):
    x0, y0, x1, y1 = box
    d = draw(img)
    for i in range(depth):
        a = color[3] * (1 - i / max(1, depth))
        c = (color[0], color[1], color[2], round(a))
        d.line([(x0 + i, y0 + i), (x1 - 1 - i, y0 + i)], fill=c)
        d.line([(x0 + i, y0 + i), (x0 + i, y1 - 1 - i)], fill=c)


def rrect(img, box, radius, fill, outline=None, width=1):
    d = draw(img)
    x0, y0, x1, y1 = box
    d.rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=radius, fill=fill,
                        outline=outline, width=width)


def rrect_grad(img, box, radius, top, bottom, outline=None, width=1):
    """Rounded rect filled with a vertical gradient."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    layer = new(w, h)
    vgrad(layer, (0, 0, w, h), top, bottom)
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    layer.putalpha(mask)
    img.alpha_composite(layer, (x0, y0))
    if outline:
        draw(img).rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=radius,
                                    outline=outline, width=width)


# ---------------------------------------------------------------- texture
def noise(img, box, amount, seed, mono=True):
    """Per-pixel grain so blocks do not read as flat vector fills."""
    rnd = random.Random(seed)
    x0, y0, x1, y1 = box
    px = img.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if mono:
                n = rnd.randint(-amount, amount)
                px[x, y] = (clamp(r + n), clamp(g + n), clamp(b + n), a)
            else:
                px[x, y] = (clamp(r + rnd.randint(-amount, amount)),
                            clamp(g + rnd.randint(-amount, amount)),
                            clamp(b + rnd.randint(-amount, amount)), a)


def clamp(v):
    return 0 if v < 0 else (255 if v > 255 else int(v))


def blobs(img, box, count, size, color, seed, jitter=0.3):
    """Scattered soft lumps: gravel, ore speckle, stone mottle."""
    rnd = random.Random(seed)
    x0, y0, x1, y1 = box
    d = draw(img)
    for _ in range(count):
        cx = rnd.randint(x0, x1 - 1)
        cy = rnd.randint(y0, y1 - 1)
        r = max(1, int(size * (1 + rnd.uniform(-jitter, jitter))))
        c = shade(color, rnd.uniform(-0.12, 0.12))
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)


def pixelate(img, block):
    """Snap to a chunkier grid so 64x art still reads as Minecraft."""
    w, h = img.size
    small = img.resize((max(1, w // block), max(1, h // block)), Image.NEAREST)
    return small.resize((w, h), Image.NEAREST)


def bevel_cube(size, top, side, dark, seed, grain=10, cell=4):
    """A flat block face: lit top band, body, shaded bottom, with grain."""
    img = new(size, size)
    d = draw(img)
    d.rectangle([0, 0, size - 1, size - 1], fill=side)
    d.rectangle([0, 0, size - 1, max(1, size // 8)], fill=top)
    d.rectangle([0, size - max(1, size // 8), size - 1, size - 1], fill=dark)
    noise(img, (0, 0, size, size), grain, seed)
    return pixelate(img, cell)


def outline_px(img, color=(0, 0, 0, 120), thickness=1):
    """Dark outline around opaque pixels: keeps items readable in a slot."""
    w, h = img.size
    a = img.split()[3]
    grown = a.filter(ImageFilter.MaxFilter(1 + 2 * thickness))
    ring = Image.new("RGBA", (w, h), color)
    ring.putalpha(Image.eval(grown, lambda v: v).point(lambda v: v))
    out = Image.alpha_composite(ring, img)
    # keep only where the grown mask is set
    mask = grown.point(lambda v: 255 if v > 0 else 0)
    out.putalpha(Image.composite(mask, Image.new("L", (w, h), 0), mask))
    return out


def save(img, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)
