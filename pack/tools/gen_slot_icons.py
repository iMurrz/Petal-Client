"""The faint icons vanilla shows in empty slots (armour, brewing, smithing).

They reuse the item silhouettes so an empty helmet slot shows a helmet, drawn
flat in a dim lilac that reads against Petal's dark wells.
"""
import sys
from pathlib import Path

from PIL import ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from petal_paint import *  # noqa: F403
from pixelmap import render
import gen_items as G

OUT = (Path(__file__).resolve().parents[1] / "Petal-UI-64x" / "assets" / "minecraft"
       / "textures" / "gui" / "sprites" / "container" / "slot")
GHOST = (150, 132, 176, 190)
GHOST_DK = (108, 92, 132, 190)
written = []


def flat(rows):
    """One-colour silhouette: every solid char becomes the ghost tone."""
    pal = {c: (GHOST if c in "LWA" else GHOST_DK) for c in "DLWAHhG"}
    return render(rows, pal, seed=3, bevel=False)


def shape(fn):
    """Paints a small glyph on a 64x64 canvas in the ghost tone."""
    img = new(N, N)
    fn(draw(img))
    return pixelate(img, CELL)


def main():
    maps = {
        "helmet": G.HELMET, "chestplate": G.CHESTPLATE, "leggings": G.LEGGINGS,
        "boots": G.BOOTS, "sword": G.SWORD, "pickaxe": G.PICKAXE, "axe": G.AXE,
        "shovel": G.SHOVEL, "hoe": G.HOE,
    }
    for name, rows in maps.items():
        save(flat(rows), OUT / f"{name}.png")
        written.append(name)

    def gem_glyph(d):
        d.polygon([(32, 10), (52, 26), (42, 52), (22, 52), (12, 26)], fill=GHOST_DK)
        d.polygon([(32, 17), (46, 28), (39, 46), (25, 46), (18, 28)], fill=GHOST)

    def ingot_glyph(d):
        d.polygon([(14, 24), (50, 24), (56, 44), (8, 44)], fill=GHOST_DK)
        d.polygon([(19, 28), (45, 28), (49, 40), (15, 40)], fill=GHOST)

    def dust_glyph(d):
        for x, y in ((18, 22), (30, 16), (42, 24), (24, 36), (38, 40), (30, 28)):
            d.rectangle([x, y, x + 7, y + 7], fill=GHOST)

    def potion_glyph(d):
        d.polygon([(25, 12), (39, 12), (39, 24), (49, 36), (49, 53), (15, 53), (15, 36), (25, 24)],
                  fill=GHOST_DK)
        d.polygon([(28, 28), (36, 28), (44, 38), (44, 48), (20, 48), (20, 38)], fill=GHOST)

    def shield_glyph(d):
        d.polygon([(14, 10), (50, 10), (50, 34), (32, 54), (14, 34)], fill=GHOST_DK)
        d.polygon([(20, 16), (44, 16), (44, 32), (32, 46), (20, 32)], fill=GHOST)

    def flame_glyph(d):
        d.polygon([(32, 8), (48, 30), (42, 54), (22, 54), (16, 30)], fill=GHOST_DK)
        d.polygon([(32, 22), (41, 34), (36, 48), (28, 48), (23, 34)], fill=GHOST)

    def template_glyph(d):
        d.rectangle([14, 12, 50, 52], outline=GHOST_DK, width=5)
        d.rectangle([24, 22, 40, 42], fill=GHOST)

    def spear_glyph(d):
        d.line([(16, 50), (44, 20)], fill=GHOST_DK, width=7)
        d.polygon([(42, 10), (56, 8), (52, 24)], fill=GHOST)

    glyphs = {
        "diamond": gem_glyph, "emerald": gem_glyph, "amethyst_shard": gem_glyph,
        "lapis_lazuli": gem_glyph, "quartz": gem_glyph,
        "ingot": ingot_glyph, "dye": dust_glyph, "redstone_dust": dust_glyph,
        "potion": potion_glyph, "shield": shield_glyph, "brewing_fuel": flame_glyph,
        "smithing_template_armor_trim": template_glyph,
        "smithing_template_netherite_upgrade": template_glyph,
        "spear": spear_glyph,
    }
    for name, fn in glyphs.items():
        save(shape(fn), OUT / f"{name}.png")
        written.append(name)

    print(f"slot icons: {len(written)}")


if __name__ == "__main__":
    main()
