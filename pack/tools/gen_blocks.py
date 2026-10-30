"""Paints the Petal 64x core block set (items live in gen_items.py).

Blocks keep vanilla silhouettes and recognisable hues, warmed toward pink and
purple; ores glow, tools carry violet handles. Everything is drawn from scratch
at 64x64 and snapped to a chunky pixel grid so it still reads as Minecraft.
"""
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from petal_paint import *  # noqa: F403

ROOT = Path(__file__).resolve().parents[1] / "Petal-Textures-64x" / "assets" / "minecraft" / "textures"
written = []


def put(kind, name, img):
    rel = f"{kind}/{name}.png"
    save(img, ROOT / rel)
    written.append(rel)


# --------------------------------------------------------------- block bases
def stone_base(base, light, dark, seed, mottle=26, blob_size=4):
    img = new(N, N, base)
    blobs(img, (0, 0, N, N), mottle, blob_size, light, seed)
    blobs(img, (0, 0, N, N), mottle // 2, blob_size - 1, dark, seed + 1)
    noise(img, (0, 0, N, N), 9, seed + 2)
    return pixelate(img, CELL)


def ore(host, gem_light, gem_dark, seed, count=7, glow=True):
    """A host rock with a cluster of gems, plus a soft bloom for the pink set."""
    img = host.copy()
    rnd = random.Random(seed)
    d = draw(img)
    spots = []
    for _ in range(count):
        cx = rnd.randrange(8, N - 8)
        cy = rnd.randrange(8, N - 8)
        if any(abs(cx - a) < 12 and abs(cy - b) < 12 for a, b in spots):
            continue
        spots.append((cx, cy))
        r = rnd.choice([5, 6, 7])
        d.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=gem_dark)
        d.polygon([(cx, cy - r + 2), (cx + r - 2, cy), (cx, cy + r - 2), (cx - r + 2, cy)],
                  fill=gem_light)
        d.rectangle([cx - 2, cy - r + 3, cx, cy - r + 5], fill=MILK)
    img = pixelate(img, CELL)
    if glow:
        halo = new(N, N)
        hd = draw(halo)
        for cx, cy in spots:
            hd.ellipse([cx - 9, cy - 9, cx + 9, cy + 9], fill=alpha(gem_light, 0.30))
        img.alpha_composite(halo.filter(ImageFilter.GaussianBlur(5)))
    return img


def planks(base, light, dark, seed, rows=4):
    img = new(N, N, base)
    d = draw(img)
    rh = N // rows
    rnd = random.Random(seed)
    for r in range(rows):
        y = r * rh
        d.rectangle([0, y, N - 1, y + 1], fill=dark)
        d.rectangle([0, y + 2, N - 1, y + 3], fill=light)
        for _ in range(5):  # grain streaks
            gx = rnd.randrange(0, N)
            gw = rnd.randrange(6, 18)
            gy = y + rnd.randrange(4, max(5, rh - 3))
            d.rectangle([gx, gy, gx + gw, gy + rnd.randrange(1, 3)],
                        fill=shade(base, rnd.uniform(-0.12, 0.12)))
        # plank seam
        sx = rnd.randrange(12, N - 12)
        d.rectangle([sx, y, sx + 1, y + rh - 1], fill=dark)
    noise(img, (0, 0, N, N), 7, seed + 3)
    return pixelate(img, CELL)


def log_side(bark, bark_light, bark_dark, seed):
    img = new(N, N, bark)
    d = draw(img)
    rnd = random.Random(seed)
    for x in range(0, N, 4):
        c = shade(bark, rnd.uniform(-0.18, 0.18))
        d.rectangle([x, 0, x + 3, N - 1], fill=c)
    for _ in range(10):
        x = rnd.randrange(0, N - 4)
        y = rnd.randrange(0, N - 12)
        d.rectangle([x, y, x + 3, y + rnd.randrange(6, 16)], fill=bark_dark)
    for _ in range(6):
        x = rnd.randrange(0, N - 4)
        y = rnd.randrange(0, N - 10)
        d.rectangle([x, y, x + 3, y + rnd.randrange(5, 12)], fill=bark_light)
    noise(img, (0, 0, N, N), 8, seed + 1)
    return pixelate(img, CELL)


def log_top(ring_a, ring_b, core, seed):
    img = new(N, N, ring_a)
    d = draw(img)
    for i, r in enumerate(range(N // 2, 2, -5)):
        d.ellipse([N / 2 - r, N / 2 - r, N / 2 + r, N / 2 + r], fill=ring_b if i % 2 else ring_a)
    d.ellipse([N / 2 - 5, N / 2 - 5, N / 2 + 5, N / 2 + 5], fill=core)
    noise(img, (0, 0, N, N), 7, seed)
    return pixelate(img, CELL)


# ---------------------------------------------------------------- item bases
def item_canvas():
    return new(N, N)


def tool(head_light, head_dark, handle, kind, accent=None):
    """pickaxe / axe / shovel / sword / hoe, drawn on the vanilla diagonal."""
    img = item_canvas()
    d = draw(img)
    # handle runs bottom-left to upper-right
    d.line([(14, 54), (44, 22)], fill=shade(handle, -0.25), width=9)
    d.line([(14, 54), (44, 22)], fill=handle, width=6)
    d.line([(16, 52), (42, 24)], fill=shade(handle, 0.22), width=2)

    if kind == "pickaxe":
        d.polygon([(22, 20), (34, 8), (56, 14), (50, 24), (36, 20), (28, 28)], fill=head_dark)
        d.polygon([(25, 19), (35, 11), (52, 16), (48, 21), (36, 17), (29, 25)], fill=head_light)
        d.line([(36, 12), (49, 16)], fill=MILK, width=2)
    elif kind == "axe":
        d.polygon([(30, 10), (52, 8), (56, 26), (40, 30), (32, 22)], fill=head_dark)
        d.polygon([(33, 13), (50, 11), (53, 24), (41, 27), (35, 21)], fill=head_light)
        d.line([(38, 13), (49, 14)], fill=MILK, width=2)
    elif kind == "shovel":
        d.polygon([(36, 8), (54, 12), (52, 28), (36, 26)], fill=head_dark)
        d.polygon([(39, 11), (51, 14), (49, 25), (39, 23)], fill=head_light)
    elif kind == "hoe":
        d.polygon([(34, 10), (56, 10), (56, 18), (42, 18), (38, 24)], fill=head_dark)
        d.polygon([(37, 12), (53, 12), (53, 16), (41, 16)], fill=head_light)
    elif kind == "sword":
        img = item_canvas()
        d = draw(img)
        d.line([(16, 52), (24, 44)], fill=shade(handle, -0.2), width=8)   # grip
        d.line([(16, 52), (24, 44)], fill=handle, width=5)
        d.line([(18, 46), (30, 34)], fill=GOLD_DEEP, width=10)            # guard
        d.line([(19, 45), (29, 35)], fill=GOLD, width=6)
        d.polygon([(26, 38), (50, 10), (56, 10), (56, 16), (30, 42)], fill=head_dark)
        d.polygon([(28, 38), (50, 14), (53, 14), (53, 17), (31, 40)], fill=head_light)
        d.line([(34, 32), (50, 16)], fill=MILK, width=2)
    if accent:
        d.line([(14, 54), (18, 50)], fill=accent, width=6)
    img = pixelate(img, CELL)
    return img


def gem(light, dark, seed, facets=True):
    img = item_canvas()
    d = draw(img)
    d.polygon([(32, 8), (54, 26), (44, 54), (20, 54), (10, 26)], fill=dark)
    d.polygon([(32, 14), (48, 28), (41, 48), (23, 48), (16, 28)], fill=light)
    if facets:
        d.line([(32, 14), (32, 48)], fill=shade(light, -0.25), width=2)
        d.line([(16, 28), (48, 28)], fill=shade(light, -0.18), width=2)
        d.polygon([(32, 16), (40, 27), (32, 30), (24, 27)], fill=shade(light, 0.3))
    d.rectangle([26, 18, 30, 22], fill=MILK)
    return pixelate(img, CELL)


def ingot(light, dark, seed):
    img = item_canvas()
    d = draw(img)
    d.polygon([(14, 24), (50, 24), (56, 44), (8, 44)], fill=dark)
    d.polygon([(18, 27), (46, 27), (50, 40), (14, 40)], fill=light)
    d.line([(20, 30), (44, 30)], fill=shade(light, 0.3), width=3)
    return pixelate(img, CELL)


def armor_piece(kind, light, dark, trim):
    img = item_canvas()
    d = draw(img)
    if kind == "helmet":
        d.pieslice([10, 12, 54, 56], start=180, end=360, fill=dark)
        d.pieslice([15, 17, 49, 51], start=180, end=360, fill=light)
        d.rectangle([10, 34, 54, 44], fill=dark)
        d.rectangle([15, 36, 49, 41], fill=trim)
    elif kind == "chestplate":
        d.polygon([(12, 16), (24, 12), (40, 12), (52, 16), (52, 30), (44, 30), (44, 52),
                   (20, 52), (20, 30), (12, 30)], fill=dark)
        d.polygon([(18, 20), (26, 17), (38, 17), (46, 20), (46, 27), (40, 27), (40, 47),
                   (24, 47), (24, 27), (18, 27)], fill=light)
        d.rectangle([28, 24, 36, 44], fill=trim)
    elif kind == "leggings":
        d.polygon([(14, 12), (50, 12), (50, 24), (38, 24), (38, 52), (26, 52), (26, 24), (14, 24)],
                  fill=dark)
        d.polygon([(19, 15), (45, 15), (45, 21), (35, 21), (35, 48), (29, 48), (29, 21), (19, 21)],
                  fill=light)
        d.rectangle([14, 12, 50, 16], fill=trim)
    else:  # boots
        d.polygon([(16, 22), (32, 22), (32, 40), (52, 40), (52, 52), (16, 52)], fill=dark)
        d.polygon([(20, 26), (28, 26), (28, 44), (48, 44), (48, 48), (20, 48)], fill=light)
        d.rectangle([16, 48, 52, 52], fill=trim)
    return pixelate(img, CELL)


# -------------------------------------------------------------------- recipes
def gen_blocks():
    stone = stone_base((125, 125, 125, 255), (156, 156, 156, 255), (98, 98, 98, 255), 1)
    put("block", "stone", stone)
    put("block", "cobblestone",
        stone_base((122, 122, 122, 255), (160, 160, 160, 255), (86, 86, 86, 255), 2, 34, 6))
    deep = stone_base((79, 79, 82, 255), (102, 102, 106, 255), (56, 56, 59, 255), 3)
    put("block", "deepslate", deep)
    put("block", "cobbled_deepslate",
        stone_base((74, 74, 78, 255), (100, 100, 105, 255), (52, 52, 56, 255), 4, 34, 6))
    put("block", "andesite", stone_base((136, 136, 136, 255), (162, 162, 162, 255), (108, 108, 108, 255), 5))
    put("block", "granite", stone_base((154, 110, 92, 255), (180, 138, 118, 255), (122, 84, 70, 255), 6))
    put("block", "diorite", stone_base((206, 206, 206, 255), (232, 232, 232, 255), (172, 172, 172, 255), 7))
    put("block", "bedrock", stone_base((52, 52, 52, 255), (88, 88, 88, 255), (26, 26, 26, 255), 8, 30, 7))

    put("block", "dirt", stone_base((134, 96, 67, 255), (160, 120, 88, 255), (104, 72, 48, 255), 9, 30, 5))
    put("block", "sand", stone_base((219, 207, 163, 255), (238, 228, 188, 255), (190, 176, 134, 255), 10, 20, 4))
    put("block", "gravel", stone_base((136, 131, 128, 255), (170, 166, 162, 255), (102, 98, 95, 255), 11, 40, 5))

    grass_top = stone_base((124, 189, 107, 255), (150, 210, 128, 255), (96, 158, 84, 255), 12, 30, 5)
    put("block", "grass_block_top", grass_top)
    side = new(N, N)
    side.paste(stone_base((134, 96, 67, 255), (160, 120, 88, 255), (104, 72, 48, 255), 9, 30, 5), (0, 0))
    overlay = stone_base((124, 189, 107, 255), (150, 210, 128, 255), (96, 158, 84, 255), 13, 18, 4)
    side.paste(overlay.crop((0, 0, N, 18)), (0, 0))
    d = draw(side)
    rnd = random.Random(14)
    for x in range(0, N, CELL):
        d.rectangle([x, 16, x + CELL - 1, 16 + rnd.choice([0, 4, 8])], fill=(110, 174, 96, 255))
    put("block", "grass_block_side", pixelate(side, CELL))

    put("block", "oak_planks", planks((162, 130, 80, 255), (190, 158, 104, 255), (126, 98, 58, 255), 20))
    put("block", "cherry_planks", planks((226, 174, 178, 255), (244, 200, 202, 255), (190, 134, 140, 255), 21))
    put("block", "spruce_planks", planks((114, 84, 48, 255), (140, 106, 64, 255), (86, 62, 34, 255), 22))
    put("block", "oak_log", log_side((104, 82, 51, 255), (130, 104, 68, 255), (78, 60, 36, 255), 23))
    put("block", "oak_log_top", log_top((176, 143, 86, 255), (150, 120, 70, 255), (198, 166, 110, 255), 24))
    put("block", "cherry_log", log_side((60, 42, 46, 255), (84, 60, 64, 255), (44, 30, 34, 255), 25))
    put("block", "cherry_log_top", log_top((226, 174, 178, 255), (198, 146, 152, 255), (244, 200, 202, 255), 26))

    # ores: stone and deepslate hosts
    ores = {k: (MAT[k][0], MAT[k][2]) for k in
            ("coal", "iron", "gold", "diamond", "emerald", "redstone", "lapis", "copper")}
    for name, (lt, dk) in ores.items():
        put("block", f"{name}_ore", ore(stone, lt, dk, hash(name) % 9999, 7))
        put("block", f"deepslate_{name}_ore", ore(deep, lt, dk, hash(name) % 9999 + 1, 7))

    put("block", "obsidian", stone_base((21, 18, 30, 255), (44, 36, 60, 255), (12, 10, 18, 255), 40, 26, 5))
    put("block", "netherrack", stone_base((112, 54, 54, 255), (140, 72, 72, 255), (86, 38, 38, 255), 41, 36, 5))
    put("block", "amethyst_block", stone_base((166, 106, 212, 255), (198, 148, 232, 255), (110, 62, 152, 255), 42, 24, 6))
    put("block", "end_stone", stone_base((221, 225, 154, 255), (238, 241, 186, 255), (190, 194, 124, 255), 43, 22, 5))
    put("block", "quartz_block_side", stone_base((236, 230, 220, 255), (250, 246, 240, 255), (206, 198, 184, 255), 44, 16, 4))

    glass = new(N, N, (210, 232, 236, 70))
    gd = draw(glass)
    gd.rectangle([0, 0, N - 1, N - 1], outline=(238, 248, 250, 200), width=4)
    gd.line([(8, 52), (26, 10)], fill=(255, 255, 255, 120), width=4)
    put("block", "glass", pixelate(glass, CELL))


if __name__ == "__main__":
    gen_blocks()
    print(f"blocks: {len(written)}")
