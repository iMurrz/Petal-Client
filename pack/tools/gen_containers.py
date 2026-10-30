"""Paints the container window backgrounds (inventory, chest, furnace, ...).

These are the big sheets behind every GUI. The panel bounds and slot positions
come from tools/container_layout.json, which records where the game expects
slots to sit; all of the art here is painted fresh in Petal's dark style.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from petal_paint import *  # noqa: F403

OUT = Path(__file__).resolve().parents[1] / "Petal-UI-64x" / "assets" / "minecraft" / "textures" / "gui"
LAYOUT = json.loads((Path(__file__).with_name("container_layout.json")).read_text())
S = SCALE
written = []


def panel(img, box, radius, accent=True):
    """A Petal window: near-black body, hairline border, pink top accent."""
    x0, y0, x1, y1 = box
    rrect_grad(img, (x0, y0, x1, y1), radius, PANEL_HI, PANEL)
    top_light(img, (x0 + 1, y0 + 1, x1 - 1, y1 - 1), max(1, S), (255, 255, 255, 26))
    inner_shadow(img, (x0 + 1, y0 + 1, x1 - 1, y1 - 1), max(2, S), (0, 0, 0, 120))
    d = draw(img)
    d.rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=radius, outline=LINE, width=max(1, S // 2))
    if accent:
        inset = radius
        d.rounded_rectangle([x0 + inset, y0 + max(1, S), x1 - 1 - inset, y0 + max(2, S) + S // 2],
                            radius=S // 2, fill=alpha(PINK, 0.85))


def well(img, box, radius):
    """One sunken slot."""
    x0, y0, x1, y1 = box
    rrect_grad(img, (x0, y0, x1, y1), radius, INK, SLOT_BG)
    inner_shadow(img, (x0, y0, x1, y1), max(2, S), (0, 0, 0, 165))
    draw(img).rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=radius,
                                outline=alpha(LINE, 0.9), width=max(1, S // 2))


def group_slots(slots):
    """Clusters adjacent slots into blocks so each gets one shared tray."""
    rows = {}
    for x, y, w, h in slots:
        rows.setdefault(y, []).append((x, y, w, h))
    groups = []
    for y in sorted(rows):
        band = sorted(rows[y])
        run = [band[0]]
        for s in band[1:]:
            if s[0] - (run[-1][0] + run[-1][2]) <= 2:
                run.append(s)
            else:
                groups.append(run)
                run = [s]
        groups.append(run)
    # merge vertically adjacent runs that share x extents
    merged = []
    for g in groups:
        gx0, gy0 = g[0][0], g[0][1]
        gx1 = g[-1][0] + g[-1][2]
        gy1 = gy0 + g[0][3]
        placed = False
        for m in merged:
            if m["x0"] == gx0 and m["x1"] == gx1 and abs(m["y1"] - gy0) <= 2:
                m["y1"] = gy1
                placed = True
                break
        if not placed:
            merged.append({"x0": gx0, "y0": gy0, "x1": gx1, "y1": gy1})
    return merged


def paint_sheet(rel, info):
    w, h = info["size"]
    img = new(w * S, h * S)
    body = info["body"]
    slots = info["slots"]

    if body:
        bx, by, bw, bh = body
        # grow by the 3px frame vanilla leaves around the body
        x0, y0 = max(0, (bx - 3)) * S, max(0, (by - 3)) * S
        x1, y1 = (bx + bw + 3) * S, (by + bh + 3) * S
        panel(img, (x0, y0, x1, y1), radius=max(4, 5 * S))

    for g in group_slots(slots):
        gx0, gy0, gx1, gy1 = g["x0"] * S, g["y0"] * S, g["x1"] * S, g["y1"] * S
        pad = max(1, S // 2)
        rrect_grad(img, (gx0 - pad, gy0 - pad, gx1 + pad, gy1 + pad), max(2, S),
                   alpha(INK_SOFT, 0.9), alpha(INK, 0.9))

    for x, y, sw, sh in slots:
        well(img, (x * S, y * S, (x + sw) * S, (y + sh) * S), radius=max(2, S))

    save(img, OUT / rel)
    written.append(rel)


def main():
    for rel, info in LAYOUT.items():
        if not info["slots"] and not info["body"]:
            continue
        paint_sheet(rel, info)
    print(f"container sheets: {len(written)}")


if __name__ == "__main__":
    main()
