"""Reads the slot layout out of vanilla's container backgrounds.

Only *geometry* is taken: where the panel sits inside the 256x256 sheet and
where each 18x18 slot well is. No pixels are copied; the painter then draws
Petal's own panel art at those coordinates so containers line up with the
positions the game hard-codes for its slots.
"""
import json
from pathlib import Path

from PIL import Image

VAN = Path("/tmp/claude-0/van/assets/minecraft/textures/gui")
SLOT_IN = (139, 139, 139, 255)   # vanilla slot interior
PANEL = (198, 198, 198, 255)     # vanilla panel face


def used_box(im):
    """Bounding box of every non-transparent pixel."""
    return im.getbbox()


def find_slots(im):
    """18x18 wells: find 16x16 runs of the slot interior colour."""
    w, h = im.size
    px = im.load()
    is_slot = [[px[x, y] == SLOT_IN for x in range(w)] for y in range(h)]
    found = []
    taken = [[False] * w for _ in range(h)]
    for y in range(h - 15):
        for x in range(w - 15):
            if taken[y][x] or not is_slot[y][x]:
                continue
            if not all(is_slot[y][x + i] for i in range(16)):
                continue
            if not all(is_slot[y + j][x] for j in range(16)):
                continue
            block = all(is_slot[y + j][x + i] for j in range(16) for i in range(16))
            if not block:
                continue
            found.append((x - 1, y - 1, 18, 18))   # the well includes its 1px rim
            for j in range(16):
                for i in range(16):
                    taken[y + j][x + i] = True
    return found


def panel_rects(im, slots):
    """Solid panel-face runs, used to know where the window body is."""
    w, h = im.size
    px = im.load()
    rows = []
    for y in range(h):
        run = None
        for x in range(w + 1):
            face = x < w and px[x, y] == PANEL
            if face and run is None:
                run = x
            elif not face and run is not None:
                if x - run > 20:
                    rows.append((run, y, x - run))
                run = None
    return rows


def main():
    out = {}
    for p in sorted((VAN / "container").rglob("*.png")):
        rel = str(p.relative_to(VAN))
        im = Image.open(p).convert("RGBA")
        slots = find_slots(im)
        box = used_box(im)
        rows = panel_rects(im, slots)
        # the window body: widest contiguous band of panel face
        body = None
        if rows:
            width = max(r[2] for r in rows)
            band = [r for r in rows if r[2] >= width - 2]
            x0 = min(r[0] for r in band)
            y0 = min(r[1] for r in band)
            y1 = max(r[1] for r in band) + 1
            body = (x0, y0, width, y1 - y0)
        out[rel] = {"size": im.size, "bbox": box, "body": body, "slots": sorted(slots, key=lambda s: (s[1], s[0]))}
        print(f"{rel:46s} body={body} slots={len(slots)}")
    Path(__file__).with_name("container_layout.json").write_text(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
