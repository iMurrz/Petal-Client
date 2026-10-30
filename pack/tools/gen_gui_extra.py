"""Covers the rest of Minecraft's interface so no base pack shows through.

Petal UI sits on top of a base pack such as Faithful. Anywhere Petal doesn't
paint, the pack underneath shows its own (light) interface, which clashes. This
module fills every remaining piece of UI chrome: advancements, the recipe book,
server and world lists, statistics, social interactions, icons, toasts, the
remaining heart states and the leftover HUD bits.

Deliberately left to the base pack: hanging-sign backgrounds, Realms promo art,
world-preset icons and the title-screen logo and panorama. Those are artwork
rather than chrome, and Petal Client draws its own title screen anyway.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from petal_paint import *  # noqa: F403
from gen_gui import pip

VAN = Path("/tmp/claude-0/van/assets/minecraft/textures/gui")
OUT = Path(__file__).resolve().parents[1] / "Petal-UI-64x" / "assets" / "minecraft" / "textures" / "gui"
S = SCALE
written = []


def put(rel, img, mcmeta=None):
    save(img, OUT / rel)
    written.append(rel)
    if mcmeta:
        (OUT / rel).with_suffix(".png.mcmeta").write_text(json.dumps(mcmeta, indent=4) + "\n")


def nine(w, h, border):
    return {"gui": {"scaling": {"type": "nine_slice", "width": w, "height": h, "border": border}}}


def vsize(rel):
    return Image.open(VAN / rel).size


# ------------------------------------------------------------------ helpers
def chip(w, h, tone, edge, radius=None, grad=None):
    """A small rounded control: the base shape most of these sprites share."""
    img = new(w, h)
    r = radius if radius is not None else max(2, min(w, h) // 4)
    top, bot = grad if grad else (shade(tone, 0.14), tone)
    rrect_grad(img, (0, 0, w, h), r, top, bot)
    if edge:
        draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, outline=edge,
                                    width=max(1, min(w, h) // 14))
    return img


def glyph(w, h, fn, color=MILK):
    img = new(w, h)
    fn(draw(img), w, h, color)
    return img


def icon_button(w, h, state, fn, radius=None):
    """state: normal | hover | selected | disabled"""
    tone = {"normal": PANEL_HI, "hover": PANEL_HI, "selected": PINK, "disabled": PANEL}[state]
    grad = {"hover": (lerp(PINK_MID, LILAC, 0.2), ORCHID),
            "selected": (PINK, PURPLE)}.get(state)
    edge = {"normal": LINE, "hover": PINK_PALE, "selected": PINK_PALE, "disabled": shade(PANEL, -0.25)}[state]
    img = chip(w, h, tone, edge, radius, grad)
    col = MILK if state != "disabled" else MUTED
    if fn:
        fn(draw(img), w, h, col)
    return img


# glyph primitives -----------------------------------------------------------
def arrow(direction):
    def fn(d, w, h, c):
        lw = max(2, min(w, h) // 8)
        mx, my = w * 0.30, h * 0.28
        pts = {
            "right": [(mx, my), (w - mx, h / 2), (mx, h - my)],
            "left": [(w - mx, my), (mx, h / 2), (w - mx, h - my)],
            "up": [(mx, h - my), (w / 2, my), (w - mx, h - my)],
            "down": [(mx, my), (w / 2, h - my), (w - mx, my)],
        }[direction]
        d.line(pts, fill=c, width=lw, joint="curve")
    return fn


def play_glyph(d, w, h, c):
    d.polygon([(w * 0.34, h * 0.24), (w * 0.76, h / 2), (w * 0.34, h * 0.76)], fill=c)


def cross_glyph(d, w, h, c):
    lw = max(2, min(w, h) // 8)
    m = min(w, h) * 0.28
    d.line([(m, m), (w - m, h - m)], fill=c, width=lw)
    d.line([(w - m, m), (m, h - m)], fill=c, width=lw)


def check_glyph(d, w, h, c):
    lw = max(2, min(w, h) // 7)
    d.line([(w * 0.22, h * 0.52), (w * 0.42, h * 0.74)], fill=c, width=lw)
    d.line([(w * 0.42, h * 0.74), (w * 0.78, h * 0.26)], fill=c, width=lw)


def bang_glyph(d, w, h, c):
    bw = max(2, w // 7)
    d.rectangle([w / 2 - bw / 2, h * 0.22, w / 2 + bw / 2, h * 0.62], fill=c)
    d.ellipse([w / 2 - bw / 2, h * 0.70, w / 2 + bw / 2, h * 0.70 + bw], fill=c)


def tri_warn_glyph(d, w, h, c):
    d.polygon([(w / 2, h * 0.18), (w * 0.86, h * 0.80), (w * 0.14, h * 0.80)], outline=c,
              width=max(2, w // 12))
    bang_glyph(d, w, h * 1.08, c)


def search_glyph(d, w, h, c):
    lw = max(2, w // 8)
    d.ellipse([w * 0.14, h * 0.14, w * 0.68, h * 0.68], outline=c, width=lw)
    d.line([(w * 0.62, h * 0.62), (w * 0.88, h * 0.88)], fill=c, width=lw)


def globe_glyph(d, w, h, c):
    lw = max(1, w // 12)
    d.ellipse([w * 0.1, h * 0.1, w * 0.9, h * 0.9], outline=c, width=lw)
    d.line([(w * 0.1, h / 2), (w * 0.9, h / 2)], fill=c, width=lw)
    d.ellipse([w * 0.32, h * 0.1, w * 0.68, h * 0.9], outline=c, width=lw)


def link_glyph(d, w, h, c):
    lw = max(2, w // 8)
    d.rounded_rectangle([w * 0.10, h * 0.36, w * 0.56, h * 0.64], radius=max(2, h // 6),
                        outline=c, width=lw)
    d.rounded_rectangle([w * 0.44, h * 0.36, w * 0.90, h * 0.64], radius=max(2, h // 6),
                        outline=c, width=lw)


def person_glyph(d, w, h, c):
    d.ellipse([w * 0.34, h * 0.14, w * 0.66, h * 0.46], fill=c)
    d.pieslice([w * 0.18, h * 0.46, w * 0.82, h * 1.06], start=180, end=360, fill=c)


def speaker_glyph(muted):
    def fn(d, w, h, c):
        d.polygon([(w * 0.18, h * 0.40), (w * 0.34, h * 0.40), (w * 0.52, h * 0.22),
                   (w * 0.52, h * 0.78), (w * 0.34, h * 0.60), (w * 0.18, h * 0.60)], fill=c)
        lw = max(2, w // 10)
        if muted:
            d.line([(w * 0.60, h * 0.36), (w * 0.86, h * 0.64)], fill=c, width=lw)
            d.line([(w * 0.86, h * 0.36), (w * 0.60, h * 0.64)], fill=c, width=lw)
        else:
            d.arc([w * 0.52, h * 0.26, w * 0.92, h * 0.74], start=300, end=60, fill=c, width=lw)
    return fn


def flag_glyph(d, w, h, c):
    lw = max(2, w // 10)
    d.line([(w * 0.30, h * 0.16), (w * 0.30, h * 0.86)], fill=c, width=lw)
    d.polygon([(w * 0.34, h * 0.20), (w * 0.80, h * 0.34), (w * 0.34, h * 0.50)], fill=c)


def pick_glyph(d, w, h, c):
    lw = max(2, w // 9)
    d.arc([w * 0.12, h * 0.16, w * 0.88, h * 0.72], start=200, end=340, fill=c, width=lw)
    d.line([(w * 0.5, h * 0.36), (w * 0.5, h * 0.86)], fill=c, width=lw)


def box_glyph(d, w, h, c):
    lw = max(2, w // 10)
    d.rectangle([w * 0.22, h * 0.26, w * 0.78, h * 0.78], outline=c, width=lw)
    d.line([(w * 0.22, h * 0.42), (w * 0.78, h * 0.42)], fill=c, width=lw)


def hand_glyph(d, w, h, c):
    d.rounded_rectangle([w * 0.32, h * 0.30, w * 0.68, h * 0.84], radius=max(2, w // 8), fill=c)
    d.rounded_rectangle([w * 0.20, h * 0.46, w * 0.34, h * 0.78], radius=max(2, w // 10), fill=c)


def mouse_glyph(d, w, h, c):
    lw = max(2, w // 10)
    d.rounded_rectangle([w * 0.28, h * 0.16, w * 0.72, h * 0.86], radius=max(3, w // 4),
                        outline=c, width=lw)
    d.line([(w * 0.5, h * 0.22), (w * 0.5, h * 0.44)], fill=c, width=lw)


def keys_glyph(d, w, h, c):
    s = w * 0.24
    for cx, cy in ((0.5, 0.26), (0.26, 0.64), (0.5, 0.64), (0.74, 0.64)):
        d.rounded_rectangle([w * cx - s / 2, h * cy - s / 2, w * cx + s / 2, h * cy + s / 2],
                            radius=max(1, int(s / 4)), fill=c)


def tree_glyph(d, w, h, c):
    d.polygon([(w * 0.5, h * 0.12), (w * 0.84, h * 0.58), (w * 0.16, h * 0.58)], fill=c)
    d.rectangle([w * 0.44, h * 0.58, w * 0.56, h * 0.88], fill=c)


def planks_glyph(d, w, h, c):
    for i in range(3):
        y = h * (0.26 + i * 0.22)
        d.rectangle([w * 0.16, y, w * 0.84, y + h * 0.12], fill=c)


def note_glyph(d, w, h, c):
    d.ellipse([w * 0.18, h * 0.58, w * 0.46, h * 0.84], fill=c)
    d.rectangle([w * 0.42, h * 0.18, w * 0.50, h * 0.72], fill=c)
    d.polygon([(w * 0.50, h * 0.18), (w * 0.82, h * 0.26), (w * 0.50, h * 0.34)], fill=c)


def book_glyph(d, w, h, c):
    lw = max(2, w // 12)
    d.rectangle([w * 0.18, h * 0.20, w * 0.82, h * 0.80], outline=c, width=lw)
    d.line([(w * 0.5, h * 0.20), (w * 0.5, h * 0.80)], fill=c, width=lw)


def tp_glyph(d, w, h, c):
    person_glyph(d, w, h, c)
    lw = max(2, w // 10)
    d.line([(w * 0.08, h * 0.5), (w * 0.26, h * 0.5)], fill=c, width=lw)


def eye_glyph(d, w, h, c):
    lw = max(2, w // 10)
    d.ellipse([w * 0.08, h * 0.28, w * 0.92, h * 0.72], outline=c, width=lw)
    d.ellipse([w * 0.40, h * 0.40, w * 0.60, h * 0.60], fill=c)


# ----------------------------------------------------------------- sections
def gen_hearts():
    """Hardcore, blinking, vehicle and absorbing states Petal was missing."""
    kinds = {"": "heart", "poisoned_": "heart_poison", "withered_": "heart_wither",
             "absorbing_": "heart_absorbing", "frozen_": "heart_frozen"}
    for prefix, kind in kinds.items():
        for half in (False, True):
            for hardcore in (False, True):
                for blink in (False, True):
                    if not hardcore and not blink and prefix == "":
                        continue  # full/half already exist
                    name = f"{prefix}{'hardcore_' if hardcore else ''}{'half' if half else 'full'}"
                    if blink:
                        name += "_blinking"
                    rel = f"sprites/hud/heart/{name}.png"
                    if not (VAN / rel).exists():
                        continue
                    img = pip(9 * S, kind, True, half)
                    if hardcore:
                        d = draw(img)
                        d.polygon([(9 * S / 2, 2), (9 * S - 3, 9 * S / 2), (9 * S / 2, 9 * S - 3),
                                   (2, 9 * S / 2)], outline=INK, width=max(2, S // 2))
                    if blink:
                        img = Image.alpha_composite(img, Image.new("RGBA", img.size, alpha(MILK, 0.35)))
                    put(rel, img)

    for name in ("container_hardcore", "container_hardcore_blinking"):
        img = pip(9 * S, "heart", False, False)
        if name.endswith("blinking"):
            img = Image.alpha_composite(img, Image.new("RGBA", img.size, alpha(MILK, 0.22)))
        put(f"sprites/hud/heart/{name}.png", img)

    for name, half in (("vehicle_full", False), ("vehicle_half", True)):
        put(f"sprites/hud/heart/{name}.png", pip(9 * S, "heart_absorbing", True, half))
    put("sprites/hud/heart/vehicle_container.png", pip(9 * S, "heart_absorbing", False, False))


def gen_hud_rest():
    d2 = 18 * S
    bg = chip(d2, d2, INK_SOFT, LINE, radius=max(2, S))
    put("sprites/hud/hotbar_attack_indicator_background.png", bg)
    pr = chip(d2, d2, PINK, None, radius=max(2, S), grad=(PINK_MID, PURPLE))
    put("sprites/hud/hotbar_attack_indicator_progress.png", pr)

    for side in ("left", "right"):
        w, h = 29 * S, 24 * S
        img = new(w, h)
        rrect_grad(img, (0, 0, w, h), max(3, h // 5), alpha(PANEL_HI, 0.92), alpha(INK, 0.95))
        draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(3, h // 5),
                                    outline=alpha(PINK_MID, 0.45), width=max(1, S // 2))
        put(f"sprites/hud/hotbar_offhand_{side}.png", img)

    w, h = 12 * S, 5 * S
    bar = new(w, h)
    rrect_grad(bar, (0, 0, w, h), h // 2, alpha(INK_SOFT, 0.9), alpha(INK, 0.95))
    put("sprites/hud/locator_bar_background.png", bar,
        {"gui": {"scaling": {"type": "nine_slice", "width": 12, "height": 5, "border": 2}}})

    for d3 in ("up", "down"):
        w, h = 7 * S, 10 * S
        put(f"sprites/hud/locator_bar_arrow_{d3}.png", glyph(w, h, arrow(d3), PINK_SOFT))

    for i, col in enumerate((PINK_MID, PINK_SOFT, LILAC, MINT)):
        img = new(9 * S, 9 * S)
        draw(img).ellipse([S, S, 8 * S, 8 * S], fill=col)
        draw(img).ellipse([2 * S, 2 * S, 5 * S, 5 * S], fill=alpha(MILK, 0.5))
        put(f"sprites/hud/locator_bar_dot/default_{i}.png", img)
    bow = new(9 * S, 9 * S)
    draw(bow).polygon([(S, S), (8 * S, 8 * S), (8 * S, S), (S, 8 * S)], fill=PINK_PALE)
    put("sprites/hud/locator_bar_dot/bowtie.png", bow)


def gen_advancements():
    for state, tone, edge in (("obtained", PANEL_HI, PINK_MID), ("unobtained", PANEL, LINE)):
        for kind, radius in (("task", 4), ("goal", 10), ("challenge", 7)):
            d2 = 26 * S
            img = new(d2, d2)
            if kind == "challenge":
                pts = [(d2 / 2, 0), (d2, d2 / 2), (d2 / 2, d2), (0, d2 / 2)]
                draw(img).polygon(pts, fill=shade(tone, 0.1), outline=edge, width=max(2, S))
            else:
                rrect_grad(img, (0, 0, d2, d2), radius * S // 2, shade(tone, 0.14), tone)
                draw(img).rounded_rectangle([0, 0, d2 - 1, d2 - 1], radius=radius * S // 2,
                                            outline=edge, width=max(2, S // 2))
            put(f"sprites/advancements/{kind}_frame_{state}.png", img)

        w, h = 200 * S, 26 * S
        box = new(w, h)
        rrect_grad(box, (0, 0, w, h), max(3, h // 6), alpha(shade(tone, 0.12), 0.97), alpha(tone, 0.97))
        draw(box).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(3, h // 6),
                                    outline=edge, width=max(1, S // 2))
        put(f"sprites/advancements/box_{state}.png", box, nine(200, 26, 10))

    w, h = 200 * S, 26 * S
    title = new(w, h)
    rrect_grad(title, (0, 0, w, h), max(3, h // 6), alpha(PANEL_HI, 0.97), alpha(INK, 0.97))
    draw(title).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(3, h // 6),
                                  outline=PINK, width=max(1, S // 2))
    put("sprites/advancements/title_box.png", title, nine(200, 26, 10))

    for side in ("above", "below"):
        for pos in ("left", "middle", "right"):
            for sel in ("", "_selected"):
                w, h = 28 * S, 32 * S
                img = new(w, h)
                r = max(3, w // 6)
                body = (0, 0, w, h - h // 8) if side == "above" else (0, h // 8, w, h)
                if sel:
                    rrect_grad(img, body, r, PINK, PURPLE)
                else:
                    rrect_grad(img, body, r, PANEL_HI, PANEL)
                draw(img).rounded_rectangle([body[0], body[1], body[2] - 1, body[3] - 1],
                                            radius=r, outline=PINK_PALE if sel else LINE,
                                            width=max(1, S // 2))
                put(f"sprites/advancements/tab_{side}_{pos}{sel}.png", img)
    for side in ("left", "right"):
        for pos in ("top", "middle", "bottom"):
            for sel in ("", "_selected"):
                w, h = 32 * S, 28 * S
                img = new(w, h)
                r = max(3, h // 6)
                body = (0, 0, w - w // 8, h) if side == "left" else (w // 8, 0, w, h)
                if sel:
                    rrect_grad(img, body, r, PINK, PURPLE)
                else:
                    rrect_grad(img, body, r, PANEL_HI, PANEL)
                draw(img).rounded_rectangle([body[0], body[1], body[2] - 1, body[3] - 1],
                                            radius=r, outline=PINK_PALE if sel else LINE,
                                            width=max(1, S // 2))
                put(f"sprites/advancements/tab_{side}_{pos}{sel}.png", img)

    for name, tint in (("stone", PANEL), ("nether", (58, 20, 34, 255)), ("end", (26, 20, 46, 255)),
                       ("adventure", (34, 24, 20, 255)), ("husbandry", (22, 34, 26, 255))):
        d2 = 16 * S
        tile = new(d2, d2)
        vgrad(tile, (0, 0, d2, d2), shade(tint, 0.08), tint)
        noise(tile, (0, 0, d2, d2), 5, hash(name) % 99)
        put(f"advancements/backgrounds/{name}.png", tile,
            {"gui": {"scaling": {"type": "tile", "width": 16, "height": 16}}})


def gen_recipe_book():
    put("sprites/recipe_book/button.png", icon_button(20 * S, 18 * S, "normal", book_glyph))
    put("sprites/recipe_book/button_highlighted.png", icon_button(20 * S, 18 * S, "hover", book_glyph))

    for fam in ("crafting_", "furnace_"):
        for state in ("enabled", "disabled"):
            for hi in ("", "_highlighted"):
                w, h = 26 * S, 16 * S
                img = icon_button(w, h, "selected" if state == "enabled" else "normal", None)
                if hi:
                    img = icon_button(w, h, "hover", None)
                d = draw(img)
                d.ellipse([w * 0.22, h * 0.26, w * 0.46, h * 0.74], fill=MILK)
                d.rectangle([w * 0.56, h * 0.40, w * 0.80, h * 0.60], fill=MILK)
                put(f"sprites/recipe_book/{'' if fam == 'crafting_' else fam}filter_{state}{hi}.png", img)

        for state in ("", "_disabled"):
            for hi in ("", "_highlighted"):
                d2 = 24 * S
                tone = "disabled" if state else ("hover" if hi else "normal")
                put(f"sprites/recipe_book/{fam}overlay{state}{hi}.png",
                    icon_button(d2, d2, tone, check_glyph if not state else cross_glyph))

    for name, state in (("slot_craftable", "selected"), ("slot_many_craftable", "selected"),
                        ("slot_uncraftable", "normal"), ("slot_many_uncraftable", "normal")):
        d2 = 25 * S
        img = chip(d2, d2, SLOT_BG if "un" in name else PANEL_HI,
                   PINK_MID if state == "selected" else LINE, radius=max(2, S))
        if "many" in name:
            draw(img).rounded_rectangle([d2 * 0.62, d2 * 0.62, d2 - S, d2 - S],
                                        radius=max(1, S // 2), fill=PINK_SOFT)
        put(f"sprites/recipe_book/{name}.png", img)

    for name, sel in (("tab", False), ("tab_selected", True)):
        w, h = 35 * S, 27 * S
        img = new(w, h)
        r = max(3, h // 6)
        if sel:
            rrect_grad(img, (0, 0, w, h), r, PINK, PURPLE)
        else:
            rrect_grad(img, (0, 0, w, h), r, PANEL_HI, PANEL)
        draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=r,
                                    outline=PINK_PALE if sel else LINE, width=max(1, S // 2))
        put(f"sprites/recipe_book/{name}.png", img)

    for d3 in ("forward", "backward"):
        for hi in ("", "_highlighted"):
            put(f"sprites/recipe_book/page_{d3}{hi}.png",
                icon_button(12 * S, 17 * S, "hover" if hi else "normal",
                            arrow("right" if d3 == "forward" else "left")))

    d2 = 32 * S
    ov = new(d2, d2)
    draw(ov).rounded_rectangle([0, 0, d2 - 1, d2 - 1], radius=max(3, S),
                               outline=PINK_SOFT, width=max(2, S // 2))
    put("sprites/recipe_book/overlay_recipe.png", ov,
        {"gui": {"scaling": {"type": "nine_slice", "width": 32, "height": 32, "border": 4}}})


def gen_lists_and_icons():
    # 32x32 list buttons
    lists = {
        "server_list": {"join": play_glyph, "move_up": arrow("up"), "move_down": arrow("down")},
        "world_list": {"join": play_glyph, "marked_join": play_glyph,
                       "error": cross_glyph, "warning": tri_warn_glyph},
        "transferable_list": {"select": check_glyph, "unselect": cross_glyph,
                              "move_up": arrow("up"), "move_down": arrow("down")},
    }
    for group, items in lists.items():
        for name, fn in items.items():
            for hi in ("", "_highlighted"):
                state = "hover" if hi else "normal"
                if name == "marked_join":
                    state = "selected" if not hi else "hover"
                put(f"sprites/{group}/{name}{hi}.png", icon_button(32 * S, 32 * S, state, fn))

    # ping meters
    def ping_bars(level, color):
        def fn(d, w, h, c):
            bars = 5
            bw = w / (bars * 1.6)
            for i in range(bars):
                x = w * 0.08 + i * bw * 1.5
                bh = h * (0.22 + i * 0.17)
                d.rectangle([x, h - bh - h * 0.1, x + bw, h - h * 0.1],
                            fill=color if i < level else alpha(LINE, 0.9))
        return fn

    for group in ("icon", "server_list"):
        for lvl in range(1, 6):
            col = MINT if lvl >= 4 else (GOLD if lvl == 3 else PINK_MID)
            put(f"sprites/{group}/ping_{lvl}.png", glyph(10 * S, 8 * S, ping_bars(6 - lvl, col)))
    put("sprites/icon/ping_unknown.png", glyph(10 * S, 8 * S, ping_bars(0, MUTED)))
    for lvl in range(1, 6):
        put(f"sprites/server_list/pinging_{lvl}.png", glyph(10 * S, 8 * S, ping_bars(lvl, MUTED)))
    put("sprites/server_list/unreachable.png", glyph(10 * S, 8 * S, cross_glyph, PINK_MID))
    put("sprites/server_list/incompatible.png", glyph(10 * S, 8 * S, bang_glyph, GOLD))

    icons = {
        "accessibility": (15, 15, person_glyph), "language": (15, 15, globe_glyph),
        "link": (15, 15, link_glyph), "link_highlighted": (15, 15, link_glyph),
        "video_link": (15, 15, play_glyph), "video_link_highlighted": (15, 15, play_glyph),
        "search": (12, 12, search_glyph), "info": (20, 20, bang_glyph),
        "invite": (14, 14, person_glyph), "news": (14, 14, box_glyph),
        "draft_report": (15, 15, flag_glyph), "checkmark": (9, 8, check_glyph),
        "chat_modified": (9, 9, bang_glyph),
    }
    for name, (w, h, fn) in icons.items():
        col = PINK_SOFT if "highlighted" in name else MILK
        put(f"sprites/icon/{name}.png", glyph(w * S, h * S, fn, col))

    dot = new(10 * S, 10 * S)
    draw(dot).ellipse([S, S, 9 * S, 9 * S], fill=PINK)
    put("sprites/icon/unseen_notification.png", dot)

    nr = icon_button(40 * S, 20 * S, "selected", None)
    d = draw(nr)
    lw = max(2, S)
    d.line([(40 * S * 0.5 - 6 * S, 10 * S), (40 * S * 0.5 + 6 * S, 10 * S)], fill=MILK, width=lw)
    d.line([(40 * S * 0.5, 10 * S - 6 * S), (40 * S * 0.5, 10 * S + 6 * S)], fill=MILK, width=lw)
    put("sprites/icon/new_realm.png", nr)

    strip = new(16 * S, 128 * S)
    for i in range(8):
        note_glyph(draw(strip.crop((0, 0, 1, 1))), 1, 1, MILK) if False else None
    for i in range(8):
        cell = glyph(16 * S, 16 * S, note_glyph, PINK_SOFT)
        strip.alpha_composite(cell, (0, i * 16 * S))
    put("sprites/icon/music_notes.png", strip)

    trial = new(8 * S, 48 * S)
    for i in range(6):
        c = glyph(8 * S, 8 * S, check_glyph, GOLD)
        trial.alpha_composite(c, (0, i * 8 * S))
    put("sprites/icon/trial_available.png", trial)

    for i in range(1, 6):
        img = new(8 * S, 8 * S)
        draw(img).ellipse([0, 0, 8 * S - 1, 8 * S - 1], fill=PINK)
        put(f"sprites/notification/{i}.png", img)
    more = new(8 * S, 8 * S)
    draw(more).ellipse([0, 0, 8 * S - 1, 8 * S - 1], fill=PURPLE)
    put("sprites/notification/more.png", more)

    for name, fn, col in (("make_operator", arrow("up"), MINT),
                          ("remove_operator", arrow("down"), GOLD),
                          ("remove_player", cross_glyph, PINK_MID)):
        put(f"sprites/player_list/{name}.png", glyph(8 * S, 7 * S, fn, col))

    for name, col in (("open", MINT), ("closed", MUTED), ("expired", PINK_MID)):
        img = new(10 * S, 28 * S)
        rrect_grad(img, (0, 0, 10 * S, 28 * S), max(2, S), shade(col, 0.1), col)
        put(f"sprites/realm_status/{name}.png", img)
    soon = new(10 * S, 56 * S)
    for i in range(2):
        part = new(10 * S, 28 * S)
        rrect_grad(part, (0, 0, 10 * S, 28 * S), max(2, S), GOLD, GOLD_DEEP)
        soon.alpha_composite(part, (0, i * 28 * S))
    put("sprites/realm_status/expires_soon.png", soon,
        {"animation": {"frametime": 20}})

    for name, fn in (("accept", check_glyph), ("reject", cross_glyph)):
        for hi in ("", "_highlighted"):
            put(f"sprites/pending_invite/{name}{hi}.png",
                icon_button(18 * S, 18 * S, "hover" if hi else "normal", fn))


def gen_misc_screens():
    stats = {"block_mined": pick_glyph, "item_broken": cross_glyph, "item_crafted": box_glyph,
             "item_dropped": arrow("down"), "item_picked_up": arrow("up"), "item_used": hand_glyph,
             "header": box_glyph, "sort_up": arrow("up"), "sort_down": arrow("down")}
    for name, fn in stats.items():
        put(f"sprites/statistics/{name}.png", icon_button(18 * S, 18 * S, "normal", fn))

    w, h = 236 * S, 34 * S
    bgp = new(w, h)
    rrect_grad(bgp, (0, 0, w, h), max(4, h // 6), alpha(PANEL_HI, 0.96), alpha(INK, 0.98))
    draw(bgp).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(4, h // 6),
                                outline=LINE, width=max(1, S // 2))
    put("sprites/social_interactions/background.png", bgp, nine(236, 34, 8))
    for name, fn, state in (("mute_button", speaker_glyph(True), "normal"),
                            ("mute_button_highlighted", speaker_glyph(True), "hover"),
                            ("unmute_button", speaker_glyph(False), "normal"),
                            ("unmute_button_highlighted", speaker_glyph(False), "hover"),
                            ("report_button", flag_glyph, "normal"),
                            ("report_button_highlighted", flag_glyph, "hover"),
                            ("report_button_disabled", flag_glyph, "disabled")):
        put(f"sprites/social_interactions/{name}.png", icon_button(20 * S, 20 * S, state, fn))

    for name, fn in (("close", cross_glyph), ("scroll_left", arrow("left")),
                     ("scroll_right", arrow("right")), ("teleport_to_player", tp_glyph),
                     ("teleport_to_team", person_glyph)):
        put(f"sprites/spectator/{name}.png", glyph(16 * S, 16 * S, fn, MILK))

    for name, state in (("warning_button", "normal"), ("warning_button_highlighted", "hover"),
                        ("warning_button_disabled", "disabled")):
        put(f"sprites/dialog/{name}.png", icon_button(20 * S, 20 * S, state, tri_warn_glyph))

    put("sprites/gamemode_switcher/slot.png", chip(26 * S, 26 * S, PANEL, LINE, radius=max(3, S)))
    sel = chip(26 * S, 26 * S, PINK, PINK_PALE, radius=max(3, S), grad=(PINK, PURPLE))
    put("sprites/gamemode_switcher/selection.png", sel)

    for name, fn, col in (("mouse", mouse_glyph, MILK), ("movement_keys", keys_glyph, MILK),
                          ("recipe_book", book_glyph, MINT), ("right_click", mouse_glyph, PINK_SOFT),
                          ("social_interactions", person_glyph, LILAC), ("tree", tree_glyph, MINT),
                          ("wooden_planks", planks_glyph, GOLD)):
        put(f"sprites/toast/{name}.png", glyph(20 * S, 20 * S, fn, col))

    w, h = 160 * S, 32 * S
    np = new(w, h)
    rrect_grad(np, (0, 0, w, h), max(4, h // 6), alpha(PANEL_HI, 0.97), alpha(INK, 0.98))
    draw(np).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(4, h // 6),
                               outline=PINK_MID, width=max(1, S // 2))
    draw(np).rounded_rectangle([S, S, S + max(3, S), h - 1 - S], radius=max(1, S // 2), fill=LILAC)
    put("sprites/toast/now_playing.png", np, nine(160, 32, 4))

    for name, fn in (("powered_redstone", bang_glyph), ("unpowered_redstone", bang_glyph)):
        col = PINK if "unpowered" not in name else MUTED
        put(f"sprites/container/crafter/{name}.png", glyph(16 * S, 16 * S, fn, col))

    ghosts = {"banner": flag_glyph, "banner_pattern": flag_glyph, "saddle": hand_glyph,
              "horse_armor": box_glyph, "llama_armor": box_glyph,
              "nautilus_armor": box_glyph, "nautilus_armor_inventory": box_glyph}
    for name, fn in ghosts.items():
        put(f"sprites/container/slot/{name}.png",
            glyph(16 * S, 16 * S, fn, (150, 132, 176, 190)))

    w, h = 90 * S, 54 * S
    cs = new(w, h)
    for r in range(3):
        for c in range(5):
            x, y = c * 18 * S, r * 18 * S
            rrect_grad(cs, (x, y, x + 18 * S, y + 18 * S), max(2, S), INK, SLOT_BG)
            draw(cs).rounded_rectangle([x, y, x + 18 * S - 1, y + 18 * S - 1], radius=max(2, S),
                                       outline=alpha(LINE, 0.9), width=max(1, S // 2))
    put("sprites/container/horse/chest_slots.png", cs)

    for name, size in (("map", (66, 66)), ("scaled_map", (66, 66)), ("duplicated_map", (50, 66))):
        w, h = size[0] * S, size[1] * S
        img = new(w, h)
        rrect_grad(img, (0, 0, w, h), max(2, S), (198, 180, 148, 255), (156, 138, 106, 255))
        draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(2, S),
                                    outline=(110, 94, 68, 255), width=max(2, S // 2))
        put(f"sprites/container/cartography_table/{name}.png", img)
    put("sprites/container/cartography_table/locked.png",
        glyph(10 * S, 14 * S, lambda d, w, h, c: d.rounded_rectangle(
            [w * 0.1, h * 0.42, w * 0.9, h * 0.95], radius=max(1, S // 2), fill=c), MUTED))

    st = new(9 * S, 2 * S)
    draw(st).rectangle([0, 0, 9 * S - 1, 2 * S - 1], fill=PINK_MID)
    put("sprites/container/villager/discount_strikethrough.png", st)

    for name, state in (("unlocked_button", "normal"), ("unlocked_button_highlighted", "hover"),
                        ("unlocked_button_disabled", "disabled")):
        def unlock(d, w, h, c):
            bw = w * 0.44
            d.rounded_rectangle([w / 2 - bw / 2, h * 0.46, w / 2 + bw / 2, h * 0.78],
                                radius=max(1, w // 12), fill=c)
            d.arc([w / 2 - bw / 2.6 + w * 0.18, h * 0.10, w / 2 + bw / 2.6 + w * 0.18, h * 0.56],
                  start=180, end=360, fill=c, width=max(2, w // 9))
        put(f"sprites/widget/{name}.png", icon_button(20 * S, 20 * S, state, unlock))


def gen_big_sheets():
    """Full-sheet backgrounds: advancement window, recipe book, book, demo."""
    for rel, radius in (("advancements/window.png", 6), ("recipe_book.png", 5),
                        ("book.png", 6), ("demo_background.png", 6),
                        ("container/gamemode_switcher.png", 5)):
        vw, vh = vsize(rel)
        src = Image.open(VAN / rel).convert("RGBA")
        bbox = src.getbbox() or (0, 0, vw, vh)
        img = new(vw * S, vh * S)
        x0, y0, x1, y1 = (v * S for v in bbox)
        rrect_grad(img, (x0, y0, x1, y1), radius * S, alpha(PANEL_HI, 0.97), alpha(INK, 0.98))
        top_light(img, (x0 + 1, y0 + 1, x1 - 1, y1 - 1), max(1, S), (255, 255, 255, 24))
        draw(img).rounded_rectangle([x0, y0, x1 - 1, y1 - 1], radius=radius * S,
                                    outline=LINE, width=max(1, S // 2))
        inset = radius * S
        draw(img).rounded_rectangle([x0 + inset, y0 + max(1, S), x1 - 1 - inset,
                                     y0 + max(2, S) + S // 2], radius=S // 2, fill=alpha(PINK, 0.85))
        put(rel, img)

    tile = new(16 * S, 16 * S)
    vgrad(tile, (0, 0, 16 * S, 16 * S), alpha(PANEL, 0.95), alpha(INK_SOFT, 0.97))
    put("tab_header_background.png", tile,
        {"gui": {"scaling": {"type": "tile", "width": 16, "height": 16}}})


if __name__ == "__main__":
    gen_hearts()
    gen_hud_rest()
    gen_advancements()
    gen_recipe_book()
    gen_lists_and_icons()
    gen_misc_screens()
    gen_big_sheets()
    print(f"extra GUI textures: {len(written)}")
