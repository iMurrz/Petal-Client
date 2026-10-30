"""Draws a 16x16 character map as a 64x64 texture.

Minecraft items read best when they are authored on the real 16x16 grid, so
tools, armour and weapons are written as ASCII maps here and each logical pixel
becomes a 4x4 block with a lit top-left edge and a little grain.
"""
import random
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from petal_paint import CELL, N, clamp, new, shade  # noqa: F401

GRID = 16


def render(rows, palette, seed=0, bevel=True):
    """rows: 16 strings of 16 chars. palette: char -> RGBA. '.' is transparent."""
    assert len(rows) == GRID, f"need {GRID} rows, got {len(rows)}"
    for i, r in enumerate(rows):
        assert len(r) == GRID, f"row {i} has {len(r)} chars, need {GRID}"

    img = new(N, N)
    px = img.load()
    rnd = random.Random(seed)
    step = N // GRID

    for gy in range(GRID):
        for gx in range(GRID):
            ch = rows[gy][gx]
            if ch == ".":
                continue
            color = palette[ch]
            # a lit pixel is one whose up/left neighbour is empty: gives an edge
            lit = False
            if bevel:
                up = rows[gy - 1][gx] if gy > 0 else "."
                left = rows[gy][gx - 1] if gx > 0 else "."
                lit = up == "." or left == "."
            base = shade(color, 0.16) if lit else color
            n = rnd.randint(-6, 6)
            c = (clamp(base[0] + n), clamp(base[1] + n), clamp(base[2] + n), base[3])
            for y in range(gy * step, gy * step + step):
                for x in range(gx * step, gx * step + step):
                    px[x, y] = c
    return img
