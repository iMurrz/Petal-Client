"""Petal 64x tools, weapons, armour and the rest of the item set.

Tools and armour are authored as 16x16 pixel maps (see pixelmap.py) so their
silhouettes match what players expect; gems, ingots and food are painted.
"""
import random
import sys
from pathlib import Path

from PIL import ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from petal_paint import *  # noqa: F403
from pixelmap import render

ROOT = Path(__file__).resolve().parents[1] / "Petal-Textures-64x" / "assets" / "minecraft" / "textures" / "item"
written = []


def put(name, img):
    save(img, ROOT / f"{name}.png")
    written.append(name)


# Shared palette keys for every tool map:
#   D dark metal  L light metal  W white glint  A accent  H handle  h handle shade  G guard
# Faithful styling: vanilla's own material colours, just painted with more
# shading at 64x. Handles are oak, not purple.
HANDLE = (150, 114, 68, 255)
HANDLE_DK = (104, 78, 46, 255)

PICKAXE = [
    "................",
    "...DDDDDDDDDD...",
    "..DLLLLLLLLLLD..",
    "..DLWWLLLLLLLD..",
    "..DLLDDDDDDLLD..",
    "..DLD..HH..DLD..",
    "..DDD..HH..DDD..",
    ".......Hh.......",
    "......Hhh.......",
    ".....Hhh........",
    "....Hhh.........",
    "...Hhh..........",
    "..Hhh...........",
    "..hh............",
    "................",
    "................",
]

AXE = [
    "................",
    "....DDDDDD......",
    "...DLLLLLLD.....",
    "..DLWWLLLLLD....",
    "..DLLLLLLLLD....",
    "..DLLLLLLLLD....",
    "...DLLLLLLD.....",
    "....DDHHDD......",
    "....Hhh.........",
    "...Hhh..........",
    "..Hhh...........",
    ".Hhh............",
    ".hh.............",
    "................",
    "................",
    "................",
]

SHOVEL = [
    "................",
    "................",
    "......DDDD......",
    ".....DLWWLD.....",
    ".....DLLLLD.....",
    ".....DLLLLD.....",
    ".....DLLLLD.....",
    "......DHHD......",
    ".....Hhh........",
    "....Hhh.........",
    "...Hhh..........",
    "..Hhh...........",
    ".Hhh............",
    ".hh.............",
    "................",
    "................",
]

HOE = [
    "................",
    "....DDDDDDD.....",
    "...DLLLLLLLD....",
    "...DLWWLLLLD....",
    "...DDDDDLLLD....",
    "........DLLD....",
    "......DHHDD.....",
    ".....Hhh........",
    "....Hhh.........",
    "...Hhh..........",
    "..Hhh...........",
    ".Hhh............",
    ".hh.............",
    "................",
    "................",
    "................",
]

SWORD = [
    "................",
    "............DDD.",
    "...........DLWD.",
    "..........DLWLD.",
    ".........DLWLD..",
    "........DLWLD...",
    ".......DLWLD....",
    "......DLWLD.....",
    ".....DLLLD......",
    "..GGGDLD........",
    "..GGGGG.........",
    ".GGG.Hh.........",
    "....Hh..........",
    "...Hh...........",
    "..hh............",
    "................",
]

HELMET = [
    "................",
    "................",
    "....DDDDDDDD....",
    "...DLLLLLLLLD...",
    "..DLWWLLLLLLLD..",
    "..DLLLLLLLLLLD..",
    "..DLLLLLLLLLLD..",
    "..DAAAAAAAAAAD..",
    "..DLLLLLLLLLLD..",
    "..DLLD....DLLD..",
    "..DLLD....DLLD..",
    "..DDD......DDD..",
    "................",
    "................",
    "................",
    "................",
]

CHESTPLATE = [
    "................",
    "..DD........DD..",
    ".DLLD......DLLD.",
    ".DLLLDDDDDDLLLD.",
    ".DLLLLLLLLLLLLD.",
    ".DLWLLLLLLLLWLD.",
    ".DDLLLLAALLLLDD.",
    "...DLLLAALLLD...",
    "...DLLLAALLLD...",
    "...DLLLAALLLD...",
    "...DLLLLLLLLD...",
    "...DLLLLLLLLD...",
    "...DDLLLLLLDD...",
    ".....DDDDDD.....",
    "................",
    "................",
]

LEGGINGS = [
    "................",
    "..DDDDDDDDDDDD..",
    "..DAAAAAAAAAAD..",
    "..DLWLLLLLLLLD..",
    "..DLLLLLLLLLLD..",
    "..DLLLLLLLLLLD..",
    "..DLLLD..DLLLD..",
    "..DLLD....DLLD..",
    "..DLLD....DLLD..",
    "..DLLD....DLLD..",
    "..DLLD....DLLD..",
    "..DLLD....DLLD..",
    "..DLLD....DLLD..",
    "..DDD......DDD..",
    "................",
    "................",
]

BOOTS = [
    "................",
    "................",
    "................",
    "................",
    "..DDD......DDD..",
    "..DLWD....DLLD..",
    "..DLLD....DLLD..",
    "..DLLD....DLLD..",
    "..DLLDD...DLLDD.",
    "..DLLLLD..DLLLLD",
    "..DLLLLD..DLLLLD",
    "..DAAAAD..DAAAAD",
    "..DDDDDD..DDDDDD",
    "................",
    "................",
    "................",
]

BOW = [
    "..........DDD...",
    ".........DLLLD..",
    "........DLWLD.W.",
    "........DLLD..W.",
    ".......DLLD...W.",
    ".......DLD....W.",
    "......DLLD....W.",
    "......DLD.....W.",
    "......DLD.....W.",
    "......DLLD....W.",
    ".......DLD....W.",
    ".......DLLD...W.",
    "........DLLD..W.",
    "........DLWLD.W.",
    ".........DLLLD..",
    "..........DDD...",
]

ARROW = [
    "................",
    "............LLL.",
    "...........LWLL.",
    "..........LLLL..",
    ".........HhL....",
    "........Hh......",
    ".......Hh.......",
    "......Hh........",
    ".....Hh.........",
    "....Hh..........",
    "...Hh...........",
    "..AAh...........",
    ".AAAh...........",
    ".AAA............",
    "..A.............",
    "................",
]

STICK = [
    "................",
    "................",
    "...........HH...",
    "..........HhH...",
    ".........Hhh....",
    "........Hhh.....",
    ".......Hhh......",
    "......Hhh.......",
    ".....Hhh........",
    "....Hhh.........",
    "...Hhh..........",
    "..Hhh...........",
    "..hh............",
    "................",
    "................",
    "................",
]

TOOL_MAPS = {"pickaxe": PICKAXE, "axe": AXE, "shovel": SHOVEL, "hoe": HOE, "sword": SWORD}
ARMOR_MAPS = {"helmet": HELMET, "chestplate": CHESTPLATE, "leggings": LEGGINGS, "boots": BOOTS}

def _m(name):
    light, mid, dark = MAT[name]
    return light, dark, mid


MATERIALS = {
    "diamond":   _m("diamond"),
    "netherite": _m("netherite"),
    "iron":      _m("iron"),
    "golden":    _m("gold"),
    "stone":     _m("stone"),
    "wooden":    _m("wood"),
}


def tool_palette(light, dark, accent):
    return {
        "D": dark, "L": light, "W": MILK, "A": accent,
        "H": HANDLE, "h": HANDLE_DK, "G": GOLD_DEEP,
    }


def gen_tools():
    for mat, (light, dark, accent) in MATERIALS.items():
        pal = tool_palette(light, dark, accent)
        for kind, rows in TOOL_MAPS.items():
            put(f"{mat}_{kind}", render(rows, pal, seed=hash(mat + kind) % 9999))


def gen_armor():
    for mat in ("diamond", "netherite", "iron", "golden", "chainmail", "leather"):
        if mat in MATERIALS:
            light, dark, accent = MATERIALS[mat]
        else:
            l, m2, d2 = MAT["chain" if mat == "chainmail" else "leather"]
            light, dark, accent = l, d2, m2
        pal = tool_palette(light, dark, accent)
        for piece, rows in ARMOR_MAPS.items():
            put(f"{mat}_{piece}", render(rows, pal, seed=hash(mat + piece) % 9999))


def gen_misc_maps():
    wl, wm, wd = MAT["wood"]
    wood = {"D": wd, "L": wm, "W": MILK, "H": MILK, "A": wl, "h": wd, "G": GOLD_DEEP}
    put("bow", render(BOW, wood, seed=7))
    il, im_, id_ = MAT["iron"]
    arrow_pal = {"L": il, "W": MILK, "H": wm, "h": wd, "A": (236, 236, 236, 255), "D": id_, "G": GOLD}
    put("arrow", render(ARROW, arrow_pal, seed=8))
    stick_pal = {"H": wm, "h": wd, "D": wd, "L": wl, "W": MILK, "A": wl, "G": GOLD}
    put("stick", render(STICK, stick_pal, seed=9))


# ----------------------------------------------------------- painted items
def gem(light, dark, facets=True):
    img = new(N, N)
    d = draw(img)
    d.polygon([(32, 8), (54, 26), (44, 54), (20, 54), (10, 26)], fill=dark)
    d.polygon([(32, 14), (48, 28), (41, 48), (23, 48), (16, 28)], fill=light)
    if facets:
        d.line([(32, 14), (32, 48)], fill=shade(light, -0.25), width=2)
        d.line([(16, 28), (48, 28)], fill=shade(light, -0.18), width=2)
        d.polygon([(32, 16), (40, 27), (32, 30), (24, 27)], fill=shade(light, 0.32))
    d.rectangle([24, 18, 29, 23], fill=MILK)
    return pixelate(img, CELL)


def ingot(light, dark):
    img = new(N, N)
    d = draw(img)
    d.polygon([(14, 24), (50, 24), (56, 44), (8, 44)], fill=dark)
    d.polygon([(18, 27), (46, 27), (50, 40), (14, 40)], fill=light)
    d.line([(21, 31), (43, 31)], fill=shade(light, 0.32), width=3)
    return pixelate(img, CELL)


def gen_painted():
    put("diamond", gem(MAT["diamond"][0], MAT["diamond"][2]))
    put("emerald", gem(MAT["emerald"][0], MAT["emerald"][2]))
    put("amethyst_shard", gem(MAT["amethyst"][0], MAT["amethyst"][2]))
    put("lapis_lazuli", gem(MAT["lapis"][0], MAT["lapis"][2], facets=False))
    put("quartz", gem(MAT["quartz"][0], MAT["quartz"][2]))

    put("iron_ingot", ingot(MAT["iron"][0], MAT["iron"][2]))
    put("gold_ingot", ingot(MAT["gold"][0], MAT["gold"][2]))
    put("copper_ingot", ingot(MAT["copper"][0], MAT["copper"][2]))
    put("netherite_ingot", ingot(MAT["netherite"][0], MAT["netherite"][2]))

    img = new(N, N)
    d = draw(img)
    d.polygon([(20, 18), (44, 14), (52, 36), (38, 50), (16, 44)], fill=MAT["coal"][2])
    d.polygon([(26, 22), (40, 20), (45, 34), (34, 44), (23, 39)], fill=MAT["coal"][1])
    d.polygon([(29, 24), (36, 23), (38, 30), (31, 33)], fill=MAT["coal"][0])
    put("coal", pixelate(img, CELL))

    img = new(N, N)
    d = draw(img)
    rnd = random.Random(31)
    for _ in range(28):
        x, y = rnd.randrange(8, 52), rnd.randrange(8, 52)
        d.rectangle([x, y, x + 5, y + 5],
                    fill=MAT["redstone"][1] if rnd.random() > 0.4 else MAT["redstone"][2])
    put("redstone", pixelate(img, CELL))

    for name, body, leaf in (("apple", (214, 46, 46, 255), (90, 170, 70, 255)),
                             ("golden_apple", MAT["gold"][1], (90, 170, 70, 255))):
        img = new(N, N)
        d = draw(img)
        d.ellipse([12, 18, 52, 56], fill=shade(body, -0.3))
        d.ellipse([16, 21, 48, 52], fill=body)
        d.ellipse([21, 26, 33, 37], fill=alpha(MILK, 0.6))
        d.rectangle([30, 10, 34, 22], fill=MAT["wood"][2])
        d.polygon([(34, 12), (49, 8), (44, 21)], fill=leaf)
        put(name, pixelate(img, CELL))

    img = new(N, N)
    d = draw(img)
    d.ellipse([12, 12, 52, 52], fill=(24, 92, 80, 255))
    d.ellipse([17, 17, 47, 47], fill=(60, 180, 150, 255))
    d.ellipse([23, 21, 36, 32], fill=alpha(MILK, 0.7))
    put("ender_pearl", pixelate(img, CELL))

    img = new(N, N)
    d = draw(img)
    d.polygon([(26, 10), (38, 10), (38, 24), (52, 28), (52, 38), (38, 36), (38, 56), (26, 56),
               (26, 36), (12, 38), (12, 28), (26, 24)], fill=MAT["gold"][2])
    d.polygon([(29, 13), (35, 13), (35, 27), (49, 31), (49, 35), (35, 33), (35, 53), (29, 53),
               (29, 33), (15, 35), (15, 31), (29, 27)], fill=MAT["gold"][1])
    d.ellipse([25, 13, 39, 27], fill=(46, 160, 118, 255))
    d.ellipse([28, 16, 34, 22], fill=(96, 212, 168, 255))
    put("totem_of_undying", pixelate(img, CELL))

    for name, liquid in (("potion", (226, 60, 110, 255)), ("splash_potion", (150, 90, 220, 255)),
                         ("experience_bottle", (120, 210, 120, 255))):
        img = new(N, N)
        d = draw(img)
        d.polygon([(25, 12), (39, 12), (39, 24), (49, 36), (49, 53), (15, 53), (15, 36), (25, 24)],
                  fill=(232, 223, 245, 120))
        d.polygon([(28, 27), (36, 27), (44, 38), (44, 49), (20, 49), (20, 38)], fill=liquid)
        d.polygon([(28, 27), (31, 27), (31, 38), (23, 46), (20, 46), (20, 38)],
                  fill=alpha(MILK, 0.35))
        d.rectangle([25, 7, 39, 14], fill=MAT["wood"][2])
        put(name, pixelate(img, CELL))

    # blaze powder and glowstone dust, useful colour variety for brewing UIs
    for name, a, b in (("blaze_powder", (252, 196, 60, 255), (226, 118, 38, 255)),
                       ("glowstone_dust", (255, 240, 186, 255), (206, 168, 90, 255)),
                       ("sugar", (248, 248, 248, 255), (202, 202, 202, 255))):
        img = new(N, N)
        d = draw(img)
        rnd = random.Random(hash(name) % 999)
        for _ in range(30):
            x, y = rnd.randrange(10, 50), rnd.randrange(10, 50)
            d.rectangle([x, y, x + 5, y + 5], fill=a if rnd.random() > 0.45 else b)
        put(name, pixelate(img, CELL))


if __name__ == "__main__":
    gen_tools()
    gen_armor()
    gen_misc_maps()
    gen_painted()
    print(f"items written: {len(written)}")
