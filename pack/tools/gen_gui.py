"""Paints the Petal 64x GUI: widgets, containers, HUD, toasts, bars.

Every sprite is written at 4x its vanilla pixel size, so it drops straight into
a resource pack. Nine-slice .mcmeta files are re-written with vanilla's logical
numbers (plain geometry, not artwork) so stretching still behaves.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, str(Path(__file__).parent))
from petal_paint import *  # noqa: F403

OUT = Path(__file__).resolve().parents[1] / "Petal-UI-64x" / "assets" / "minecraft" / "textures" / "gui"
S = SCALE
written = []


def put(rel, img, mcmeta=None):
    path = OUT / rel
    save(img, path)
    written.append(rel)
    if mcmeta:
        path.with_suffix(".png.mcmeta").write_text(json.dumps(mcmeta, indent=4) + "\n")
        written.append(rel + ".mcmeta")


def nine(w, h, border):
    return {"gui": {"scaling": {"type": "nine_slice", "width": w, "height": h, "border": border}}}


def stretch():
    return {"gui": {"scaling": {"type": "stretch"}}}


# ===================================================================== widgets
def button_face(w, h, top, bottom, edge, glow=None, sheen=True):
    img = new(w, h)
    r = max(3, h // 5)
    rrect_grad(img, (0, 0, w, h), r, top, bottom)
    if sheen:
        diag_sheen(img, (0, 0, w, h), MILK, 0.22, 0.26)
    top_light(img, (1, 1, w - 1, h - 1), max(1, h // 14), (255, 255, 255, 95))
    inner_shadow(img, (1, 1, w - 1, h - 1), max(2, h // 9), (0, 0, 0, 120))
    draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, outline=edge, width=max(1, h // 20))
    if glow:
        halo = new(w, h)
        draw(halo).rounded_rectangle([1, 1, w - 2, h - 2], radius=r, outline=glow,
                                     width=max(2, h // 12))
        halo = halo.filter(ImageFilter.GaussianBlur(max(1, h // 10)))
        img.alpha_composite(halo)
        draw(img).rounded_rectangle([1, 1, w - 2, h - 2], radius=r, outline=glow, width=max(1, h // 22))
    return img


def gen_widgets():
    bw, bh = 200 * S, 20 * S

    put("sprites/widget/button.png",
        button_face(bw, bh, PINK, PINK_DEEP, shade(PINK_DEEP, -0.35)), nine(200, 20, 3))
    put("sprites/widget/button_highlighted.png",
        button_face(bw, bh, lerp(PINK_MID, LILAC, 0.25), ORCHID, PINK_PALE, glow=PINK_SOFT),
        nine(200, 20, 3))

    dis = new(bw, bh)
    rrect_grad(dis, (0, 0, bw, bh), max(3, bh // 5), PANEL_HI, PANEL)
    inner_shadow(dis, (1, 1, bw - 1, bh - 1), max(2, bh // 9), (0, 0, 0, 130))
    draw(dis).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=max(3, bh // 5),
                                outline=shade(PANEL, -0.3), width=max(1, bh // 20))
    put("sprites/widget/button_disabled.png", dis, nine(200, 20, 3))

    # ---- sliders: a sunken track, the handle is a separate sprite
    for name, hi in (("slider", False), ("slider_highlighted", True)):
        img = new(bw, bh)
        r = max(3, bh // 5)
        rrect_grad(img, (0, 0, bw, bh), r, INK_SOFT, INK)
        inner_shadow(img, (2, 2, bw - 2, bh - 2), max(3, bh // 6), (0, 0, 0, 150))
        inset = max(2, bh // 5)
        rrect_grad(img, (inset, bh // 2 - bh // 8, bw - inset, bh // 2 + bh // 8),
                   max(2, bh // 10), PINK, PURPLE)
        draw(img).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=r,
                                    outline=PINK_SOFT if hi else LINE, width=max(1, bh // 20))
        put(f"sprites/widget/{name}.png", img, nine(200, 20, 1))

    hw, hh = 8 * S, 20 * S
    for name, hi in (("slider_handle", False), ("slider_handle_highlighted", True)):
        img = new(hw, hh)
        r = max(3, hw // 3)
        rrect_grad(img, (0, 0, hw, hh), r, MILK if not hi else (255, 255, 255, 255),
                   MUTED if not hi else PINK_PALE)
        draw(img).rounded_rectangle([0, 0, hw - 1, hh - 1], radius=r,
                                    outline=PINK if hi else shade(MUTED, -0.4), width=max(1, hw // 10))
        gx = hw // 2
        for off in (-hw // 5, 0, hw // 5):
            draw(img).line([(gx + off, hh // 3), (gx + off, hh - hh // 3)],
                           fill=alpha(PURPLE, 0.55), width=max(1, hw // 14))
        put(f"sprites/widget/{name}.png", img, nine(8, 20, 1))

    # ---- text fields
    for name, focus in (("text_field", False), ("text_field_highlighted", True)):
        img = new(bw, bh)
        r = max(2, bh // 7)
        rrect_grad(img, (0, 0, bw, bh), r, INK, INK_SOFT)
        inner_shadow(img, (1, 1, bw - 1, bh - 1), max(2, bh // 8), (0, 0, 0, 140))
        draw(img).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=r,
                                    outline=PINK_MID if focus else LINE, width=max(1, bh // 18))
        put(f"sprites/widget/{name}.png", img, nine(200, 20, 1))

    # ---- scroller + its track
    sw, sh = 6 * S, 32 * S
    img = new(sw, sh)
    rrect_grad(img, (0, 0, sw, sh), sw // 2, PINK_MID, PURPLE)
    draw(img).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=sw // 2,
                                outline=alpha(MILK, 0.35), width=max(1, sw // 8))
    put("sprites/widget/scroller.png", img, nine(6, 32, 1))

    img = new(sw, sh)
    rrect_grad(img, (0, 0, sw, sh), sw // 2, INK, INK_SOFT)
    inner_shadow(img, (0, 0, sw, sh), max(1, sw // 4), (0, 0, 0, 130))
    put("sprites/widget/scroller_background.png", img, nine(6, 32, 1))

    # ---- checkboxes
    cw = 20 * S
    for name, sel, hi in (("checkbox", False, False), ("checkbox_highlighted", False, True),
                          ("checkbox_selected", True, False), ("checkbox_selected_highlighted", True, True)):
        img = new(cw, cw)
        r = max(3, cw // 6)
        if sel:
            rrect_grad(img, (0, 0, cw, cw), r, PINK, PURPLE)
        else:
            rrect_grad(img, (0, 0, cw, cw), r, INK_SOFT, INK)
            inner_shadow(img, (1, 1, cw - 1, cw - 1), max(2, cw // 10), (0, 0, 0, 140))
        draw(img).rounded_rectangle([0, 0, cw - 1, cw - 1], radius=r,
                                    outline=PINK_PALE if hi else (LINE if not sel else alpha(MILK, 0.5)),
                                    width=max(1, cw // 16))
        if sel:
            d = draw(img)
            lw = max(2, cw // 9)
            d.line([(cw * 0.28, cw * 0.52), (cw * 0.45, cw * 0.70)], fill=MILK, width=lw)
            d.line([(cw * 0.45, cw * 0.70), (cw * 0.74, cw * 0.32)], fill=MILK, width=lw)
        put(f"sprites/widget/{name}.png", img)

    # ---- tabs
    tw, th = 130 * S, 24 * S
    for name, selected, hi in (("tab", False, False), ("tab_highlighted", False, True),
                               ("tab_selected", True, False), ("tab_selected_highlighted", True, True)):
        img = new(tw, th)
        r = max(3, th // 5)
        if selected:
            rrect_grad(img, (0, 0, tw, th), r, PINK, PURPLE)
            diag_sheen(img, (0, 0, tw, th), MILK, 0.2, 0.25)
        else:
            rrect_grad(img, (0, 0, tw, th), r, PANEL_HI, PANEL)
        draw(img).rounded_rectangle([0, 0, tw - 1, th - 1], radius=r,
                                    outline=PINK_PALE if hi else LINE, width=max(1, th // 22))
        draw(img).rectangle([0, th - max(2, th // 12), tw - 1, th - 1],
                            fill=PINK_SOFT if selected else alpha(LINE, 0.6))
        put(f"sprites/widget/{name}.png", img, nine(130, 24, 2))

    # ---- small icon buttons
    def icon_button(size, kind, hot):
        img = new(size, size)
        r = max(2, size // 5)
        rrect_grad(img, (0, 0, size, size), r,
                   lerp(PINK_MID, LILAC, 0.2) if hot else PANEL_HI,
                   ORCHID if hot else PANEL)
        draw(img).rounded_rectangle([0, 0, size - 1, size - 1], radius=r,
                                    outline=PINK_PALE if hot else LINE, width=max(1, size // 18))
        d = draw(img)
        lw = max(2, size // 9)
        m = size * 0.3
        if kind == "cross":
            d.line([(m, m), (size - m, size - m)], fill=MILK, width=lw)
            d.line([(size - m, m), (m, size - m)], fill=MILK, width=lw)
        elif kind in ("forward", "backward"):
            pts = [(m, m), (size - m, size / 2), (m, size - m)]
            if kind == "backward":
                pts = [(size - m, m), (m, size / 2), (size - m, size - m)]
            d.line(pts, fill=MILK, width=lw, joint="curve")
        elif kind in ("lock", "unlock"):
            bw2 = size * 0.44
            d.rounded_rectangle([size / 2 - bw2 / 2, size * 0.46, size / 2 + bw2 / 2, size * 0.78],
                                radius=max(1, size // 12), fill=MILK)
            arc_top = size * 0.18 if kind == "lock" else size * 0.12
            d.arc([size / 2 - bw2 / 2.6, arc_top, size / 2 + bw2 / 2.6, size * 0.56],
                  start=180, end=360, fill=MILK, width=lw)
        return img

    def arrow_button(w, h, kind, hot):
        """Page arrows are wide (23x13 in vanilla), so they get their own shape."""
        img = new(w, h)
        r = max(2, h // 4)
        rrect_grad(img, (0, 0, w, h), r,
                   lerp(PINK_MID, LILAC, 0.2) if hot else PANEL_HI,
                   ORCHID if hot else PANEL)
        draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=r,
                                    outline=PINK_PALE if hot else LINE, width=max(1, h // 12))
        d = draw(img)
        lw = max(2, h // 6)
        mx, my = w * 0.32, h * 0.26
        pts = [(mx, my), (w - mx, h / 2), (mx, h - my)]
        if kind == "backward":
            pts = [(w - mx, my), (mx, h / 2), (w - mx, h - my)]
        d.line(pts, fill=MILK, width=lw, joint="curve")
        return img

    put("sprites/widget/cross_button.png", icon_button(14 * S, "cross", False))
    put("sprites/widget/cross_button_highlighted.png", icon_button(14 * S, "cross", True))
    for base, kind in (("page_forward", "forward"), ("page_backward", "backward")):
        put(f"sprites/widget/{base}.png", arrow_button(23 * S, 13 * S, kind, False))
        put(f"sprites/widget/{base}_highlighted.png", arrow_button(23 * S, 13 * S, kind, True))
    put("sprites/widget/locked_button.png", icon_button(20 * S, "lock", False))
    put("sprites/widget/locked_button_highlighted.png", icon_button(20 * S, "lock", True))
    put("sprites/widget/locked_button_disabled.png", icon_button(20 * S, "lock", False))

    # slot frame used by recipe widgets (vanilla is 80x80)
    fs = 80 * S
    img = new(fs, fs)
    rrect_grad(img, (0, 0, fs, fs), max(2, fs // 8), PANEL_HI, PANEL)
    draw(img).rounded_rectangle([0, 0, fs - 1, fs - 1], radius=max(2, fs // 8),
                                outline=PINK_MID, width=max(2, fs // 40))
    put("sprites/widget/slot_frame.png", img)


# ================================================================== containers
def slot_sprite(size, radius_div=7, glow=None):
    img = new(size, size)
    r = max(2, size // radius_div)
    rrect_grad(img, (0, 0, size, size), r, SLOT_BG, shade(SLOT_BG, 0.22))
    inner_shadow(img, (1, 1, size - 1, size - 1), max(2, size // 7), (0, 0, 0, 150))
    draw(img).rounded_rectangle([0, 0, size - 1, size - 1], radius=r,
                                outline=glow or alpha(LINE, 0.85), width=max(1, size // 18))
    return img


def gen_containers():
    put("sprites/container/slot.png", slot_sprite(18 * S), nine(18, 18, 1))

    hb = 24 * S
    back = new(hb, hb)
    rrect_grad(back, (0, 0, hb, hb), max(3, hb // 7), alpha(PINK, 0.55), alpha(PURPLE, 0.55))
    put("sprites/container/slot_highlight_back.png", back, nine(24, 24, 4))

    front = new(hb, hb)
    r = max(3, hb // 7)
    draw(front).rounded_rectangle([0, 0, hb - 1, hb - 1], radius=r, outline=PINK_PALE,
                                  width=max(2, hb // 14))
    halo = new(hb, hb)
    draw(halo).rounded_rectangle([1, 1, hb - 2, hb - 2], radius=r, outline=PINK_SOFT,
                                 width=max(2, hb // 10))
    front.alpha_composite(halo.filter(ImageFilter.GaussianBlur(hb // 10)))
    put("sprites/container/slot_highlight_front.png", front, nine(24, 24, 4))

    # bundle
    put("sprites/container/bundle/slot_background.png", slot_sprite(24 * S))
    put("sprites/container/bundle/slot_highlight_back.png", back.copy(), nine(24, 24, 4))
    put("sprites/container/bundle/slot_highlight_front.png", front.copy(), nine(24, 24, 4))

    pb = 12 * S
    img = new(pb, pb)
    draw(img).rounded_rectangle([0, 0, pb - 1, pb - 1], radius=max(2, pb // 5),
                                outline=MUTED, width=max(1, pb // 10))
    put("sprites/container/bundle/bundle_progressbar_border.png", img)
    fill = new(6 * S, 6 * S)
    vgrad(fill, (0, 0, 6 * S, 6 * S), PINK_MID, PURPLE)
    put("sprites/container/bundle/bundle_progressbar_fill.png", fill)
    full = new(6 * S, 6 * S)
    vgrad(full, (0, 0, 6 * S, 6 * S), PINK_PALE, PINK)
    put("sprites/container/bundle/bundle_progressbar_full.png", full)

    # furnace family: flame + arrow
    for fam in ("furnace", "blast_furnace", "smoker"):
        w, h = 24 * S, 16 * S
        arrow = new(w, h)
        d = draw(arrow)
        bar_h = max(3, h // 4)
        y0 = h // 2 - bar_h // 2
        d.rectangle([0, y0, w - h // 2, y0 + bar_h], fill=PINK_MID)
        d.polygon([(w - h // 2 - 1, 2), (w - 1, h // 2), (w - h // 2 - 1, h - 3)], fill=PINK_MID)
        hgrad_layer = new(w, h)
        hgrad(hgrad_layer, (0, 0, w, h), PINK, PURPLE_MID)
        hgrad_layer.putalpha(arrow.split()[3])
        put(f"sprites/container/{fam}/burn_progress.png", hgrad_layer)

        fw = 14 * S
        flame = new(fw, fw)
        d = draw(flame)
        d.polygon([(fw * 0.5, fw * 0.08), (fw * 0.84, fw * 0.5), (fw * 0.72, fw * 0.92),
                   (fw * 0.28, fw * 0.92), (fw * 0.16, fw * 0.5)], fill=ORCHID)
        d.polygon([(fw * 0.5, fw * 0.3), (fw * 0.70, fw * 0.6), (fw * 0.5, fw * 0.86),
                   (fw * 0.3, fw * 0.6)], fill=PINK_SOFT)
        put(f"sprites/container/{fam}/lit_progress.png", flame)

    # brewing stand
    w, h = 9 * S, 28 * S
    img = new(w, h)
    vgrad(img, (0, 0, w, h), PINK_PALE, PURPLE)
    put("sprites/container/brewing_stand/brew_progress.png", img)
    w, h = 12 * S, 29 * S
    img = new(w, h)
    blobs(img, (0, 0, w, h), 26, max(1, S), PINK_SOFT, 11)
    put("sprites/container/brewing_stand/bubbles.png", img)
    w, h = 18 * S, 4 * S
    img = new(w, h)
    hgrad(img, (0, 0, w, h), MINT, MINT_DEEP)
    put("sprites/container/brewing_stand/fuel_length.png", img)

    # villager / stonecutter / loom / creative scrollers
    for rel, size in (("container/villager/scroller.png", (6, 27)),
                      ("container/villager/scroller_disabled.png", (6, 27)),
                      ("container/stonecutter/scroller.png", (12, 15)),
                      ("container/stonecutter/scroller_disabled.png", (12, 15)),
                      ("container/loom/scroller.png", (12, 15)),
                      ("container/loom/scroller_disabled.png", (12, 15)),
                      ("container/creative_inventory/scroller.png", (12, 15)),
                      ("container/creative_inventory/scroller_disabled.png", (12, 15))):
        w, h = size[0] * S, size[1] * S
        img = new(w, h)
        off = "disabled" in rel
        rrect_grad(img, (0, 0, w, h), max(2, min(w, h) // 3),
                   PANEL_HI if off else PINK_MID, PANEL if off else PURPLE)
        draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(2, min(w, h) // 3),
                                    outline=alpha(MILK, 0.2 if off else 0.4), width=max(1, w // 10))
        put(f"sprites/{rel}", img)

    # villager trade arrows + xp bars
    w, h = 10 * S, 9 * S
    for name, col in (("trade_arrow", PINK_MID), ("trade_arrow_out_of_stock", shade(MUTED, -0.2))):
        img = new(w, h)
        d = draw(img)
        bar = max(2, h // 3)
        d.rectangle([0, h // 2 - bar // 2, w - h // 2, h // 2 + bar // 2], fill=col)
        d.polygon([(w - h // 2 - 1, 1), (w - 1, h // 2), (w - h // 2 - 1, h - 2)], fill=col)
        put(f"sprites/container/villager/{name}.png", img)

    for name, a, b in (("experience_bar_background", INK, INK_SOFT),
                       ("experience_bar_current", MINT, MINT_DEEP),
                       ("experience_bar_result", PINK_SOFT, PINK)):
        w, h = 102 * S, 5 * S
        img = new(w, h)
        rrect_grad(img, (0, 0, w, h), h // 2, a, b)
        put(f"sprites/container/villager/{name}.png", img)

    # enchanting table rows
    w, h = 108 * S, 19 * S
    for name, tone, edge in (("enchantment_slot", PANEL_HI, LINE),
                             ("enchantment_slot_highlighted", ORCHID, PINK_PALE),
                             ("enchantment_slot_disabled", PANEL, shade(PANEL, -0.25))):
        img = new(w, h)
        rrect_grad(img, (0, 0, w, h), max(2, h // 6), shade(tone, 0.1), tone)
        draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(2, h // 6),
                                    outline=edge, width=max(1, h // 18))
        put(f"sprites/container/enchanting_table/{name}.png", img, nine(108, 19, 1))

    for lvl in (1, 2, 3):
        for suffix, on in (("", True), ("_disabled", False)):
            size = 16 * S
            img = new(size, size)
            d = draw(img)
            col = GOLD if on else shade(MUTED, -0.25)
            for i in range(lvl):
                y = size * (0.22 + i * 0.26)
                d.ellipse([size * 0.2, y, size * 0.8, y + size * 0.2], fill=col)
            put(f"sprites/container/enchanting_table/level_{lvl}{suffix}.png", img)

    # beacon buttons
    bs = 22 * S
    for name, tone, edge in (("button", PANEL_HI, LINE), ("button_disabled", PANEL, shade(PANEL, -0.3)),
                             ("button_highlighted", ORCHID, PINK_PALE), ("button_selected", PINK, PINK_PALE)):
        img = new(bs, bs)
        rrect_grad(img, (0, 0, bs, bs), max(2, bs // 6), shade(tone, 0.12), tone)
        draw(img).rounded_rectangle([0, 0, bs - 1, bs - 1], radius=max(2, bs // 6),
                                    outline=edge, width=max(1, bs // 18))
        put(f"sprites/container/beacon/{name}.png", img)
    for name, col, kind in (("confirm", MINT, "check"), ("cancel", PINK_MID, "cross")):
        size = 18 * S
        img = new(size, size)
        d = draw(img)
        lw = max(2, size // 8)
        if kind == "check":
            d.line([(size * 0.22, size * 0.52), (size * 0.42, size * 0.72)], fill=col, width=lw)
            d.line([(size * 0.42, size * 0.72), (size * 0.78, size * 0.28)], fill=col, width=lw)
        else:
            d.line([(size * 0.26, size * 0.26), (size * 0.74, size * 0.74)], fill=col, width=lw)
            d.line([(size * 0.74, size * 0.26), (size * 0.26, size * 0.74)], fill=col, width=lw)
        put(f"sprites/container/beacon/{name}.png", img)

    # error icons (anvil, smithing, grindstone, cartography, villager stock)
    for rel, size in (("container/anvil/error.png", (28, 21)),
                      ("container/smithing/error.png", (28, 21)),
                      ("container/grindstone/error.png", (28, 21)),
                      ("container/cartography_table/error.png", (28, 21)),
                      ("container/villager/out_of_stock.png", (28, 21)),
                      ("container/loom/error.png", (26, 26))):
        w, h = size[0] * S, size[1] * S
        img = new(w, h)
        d = draw(img)
        lw = max(2, h // 7)
        m = min(w, h) * 0.26
        d.line([(w / 2 - m, h / 2 - m), (w / 2 + m, h / 2 + m)], fill=PINK_MID, width=lw)
        d.line([(w / 2 + m, h / 2 - m), (w / 2 - m, h / 2 + m)], fill=PINK_MID, width=lw)
        put(f"sprites/{rel}", img)

    # anvil text field
    for name, on in (("text_field", True), ("text_field_disabled", False)):
        w, h = 110 * S, 16 * S
        img = new(w, h)
        rrect_grad(img, (0, 0, w, h), max(2, h // 6), INK, INK_SOFT)
        inner_shadow(img, (1, 1, w - 1, h - 1), max(2, h // 7), (0, 0, 0, 140))
        draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(2, h // 6),
                                    outline=PINK_MID if on else LINE, width=max(1, h // 14))
        put(f"sprites/container/anvil/{name}.png", img, nine(110, 16, 1))

    # inventory effect panels
    for rel, size in (("container/inventory/effect_background.png", 32),
                      ("container/inventory/effect_background_ambient.png", 32),
                      ("hud/effect_background.png", 24),
                      ("hud/effect_background_ambient.png", 24)):
        d2 = size * S
        img = new(d2, d2)
        ambient = "ambient" in rel
        rrect_grad(img, (0, 0, d2, d2), max(3, d2 // 7),
                   alpha(PANEL_HI, 0.9) if not ambient else alpha(PURPLE_DEEP, 0.85),
                   alpha(INK, 0.95))
        draw(img).rounded_rectangle([0, 0, d2 - 1, d2 - 1], radius=max(3, d2 // 7),
                                    outline=PINK_MID if not ambient else MINT, width=max(1, d2 // 22))
        put(f"sprites/{rel}", img)

    # crafter + stonecutter recipe cells
    put("sprites/container/crafter/disabled_slot.png",
        slot_sprite(18 * S, glow=alpha(PINK_DEEP, 0.7)), nine(18, 18, 1))
    for name, tone, edge in (("recipe", PANEL, LINE), ("recipe_highlighted", PANEL_HI, PINK_SOFT),
                             ("recipe_selected", ORCHID, PINK_PALE)):
        w, h = 16 * S, 18 * S
        img = new(w, h)
        rrect_grad(img, (0, 0, w, h), max(2, w // 7), shade(tone, 0.12), tone)
        draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(2, w // 7),
                                    outline=edge, width=max(1, w // 16))
        put(f"sprites/container/stonecutter/{name}.png", img)
    for name, tone, edge in (("pattern", PANEL, LINE), ("pattern_highlighted", PANEL_HI, PINK_SOFT),
                             ("pattern_selected", ORCHID, PINK_PALE)):
        d2 = 14 * S
        img = new(d2, d2)
        rrect_grad(img, (0, 0, d2, d2), max(2, d2 // 7), shade(tone, 0.12), tone)
        draw(img).rounded_rectangle([0, 0, d2 - 1, d2 - 1], radius=max(2, d2 // 7),
                                    outline=edge, width=max(1, d2 // 14))
        put(f"sprites/container/loom/{name}.png", img)

    # creative inventory tabs
    tw, th = 26 * S, 32 * S
    for pos in ("top", "bottom"):
        for i in range(1, 8):
            for state in ("selected", "unselected"):
                img = new(tw, th)
                sel = state == "selected"
                r = max(3, tw // 5)
                body = (0, 0, tw, th - th // 8) if pos == "top" else (0, th // 8, tw, th)
                rrect_grad(img, body, r, PINK if sel else PANEL_HI, PURPLE if sel else PANEL)
                draw(img).rounded_rectangle([body[0], body[1], body[2] - 1, body[3] - 1],
                                            radius=r, outline=PINK_PALE if sel else LINE,
                                            width=max(1, tw // 22))
                put(f"sprites/container/creative_inventory/tab_{pos}_{state}_{i}.png", img)


# ========================================================================= HUD
def pip(size, kind, full=True, half=False):
    """One HUD pip: a soft diamond/round shape rather than vanilla's heart."""
    img = new(size, size)
    d = draw(img)
    pad = max(1, size // 10)
    box = [pad, pad, size - 1 - pad, size - 1 - pad]
    colors = {
        "heart": (PINK_MID, PINK_DEEP),
        "heart_poison": (MINT, MINT_DEEP),
        "heart_wither": ((80, 60, 100, 255), (40, 28, 56, 255)),
        "heart_absorbing": (GOLD, GOLD_DEEP),
        "heart_frozen": ((168, 230, 255, 255), (63, 159, 214, 255)),
        "food": ((255, 179, 107, 255), (198, 116, 54, 255)),
        "armor": (LILAC, PURPLE),
        "air": ((168, 230, 255, 255), (63, 159, 214, 255)),
    }
    light, dark = colors.get(kind, (PINK_MID, PINK_DEEP))
    if not full:
        light, dark = alpha(INK_SOFT, 0.85), alpha(INK, 0.9)
    if kind.startswith("heart") or kind == "armor":
        d.polygon([(size / 2, box[1]), (box[2], size / 2), (size / 2, box[3]), (box[0], size / 2)],
                  fill=dark)
        d.polygon([(size / 2, box[1] + size * 0.14), (box[2] - size * 0.14, size / 2),
                   (size / 2, box[3] - size * 0.14), (box[0] + size * 0.14, size / 2)], fill=light)
    else:
        d.ellipse(box, fill=dark)
        d.ellipse([box[0] + size * 0.12, box[1] + size * 0.12,
                   box[2] - size * 0.12, box[3] - size * 0.12], fill=light)
    if half:
        d.rectangle([size / 2, 0, size - 1, size - 1], fill=CLEAR)
    gloss = new(size, size)
    draw(gloss).ellipse([size * 0.26, size * 0.18, size * 0.58, size * 0.42], fill=alpha(MILK, 0.55))
    gloss = gloss.filter(ImageFilter.GaussianBlur(max(1, size // 14)))
    if full:
        img.alpha_composite(gloss)
    return pixelate(img, 2)


def gen_hud():
    # hotbar + selection
    w, h = 182 * S, 22 * S
    bar = new(w, h)
    rrect_grad(bar, (0, 0, w, h), max(3, h // 5), alpha(PANEL_HI, 0.92), alpha(INK, 0.95))
    top_light(bar, (1, 1, w - 1, h - 1), max(1, h // 16), (255, 255, 255, 60))
    inner_shadow(bar, (1, 1, w - 1, h - 1), max(2, h // 10), (0, 0, 0, 120))
    d = draw(bar)
    slot = (w - 2 * S) / 9
    for i in range(1, 9):
        x = 1 * S + slot * i
        d.line([(x, h * 0.18), (x, h * 0.82)], fill=alpha(LINE, 0.8), width=max(1, S // 2))
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=max(3, h // 5), outline=alpha(PINK_MID, 0.5),
                        width=max(1, h // 22))
    put("sprites/hud/hotbar.png", bar, nine(182, 22, 1))

    sw, sh = 24 * S, 23 * S
    sel = new(sw, sh)
    r = max(3, sw // 6)
    draw(sel).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=r, outline=PINK_PALE, width=max(2, sw // 12))
    halo = new(sw, sh)
    draw(halo).rounded_rectangle([1, 1, sw - 2, sh - 2], radius=r, outline=PINK_MID, width=max(2, sw // 9))
    sel.alpha_composite(halo.filter(ImageFilter.GaussianBlur(sw // 8)))
    draw(sel).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=r, outline=MILK, width=max(1, sw // 20))
    put("sprites/hud/hotbar_selection.png", sel, nine(24, 23, 1))

    # hearts and the rest of the pips
    ps = 9 * S
    hearts = {
        "heart/full": ("heart", True, False), "heart/half": ("heart", True, True),
        "heart/container": ("heart", False, False), "heart/container_blinking": ("heart", False, False),
        "heart/poisoned_full": ("heart_poison", True, False), "heart/poisoned_half": ("heart_poison", True, True),
        "heart/withered_full": ("heart_wither", True, False), "heart/withered_half": ("heart_wither", True, True),
        "heart/absorbing_full": ("heart_absorbing", True, False), "heart/absorbing_half": ("heart_absorbing", True, True),
        "heart/frozen_full": ("heart_frozen", True, False), "heart/frozen_half": ("heart_frozen", True, True),
        "food_full": ("food", True, False), "food_half": ("food", True, True), "food_empty": ("food", False, False),
        "food_full_hunger": ("food", True, False), "food_half_hunger": ("food", True, True),
        "food_empty_hunger": ("food", False, False),
        "armor_full": ("armor", True, False), "armor_half": ("armor", True, True),
        "armor_empty": ("armor", False, False),
        "air": ("air", True, False), "air_bursting": ("air", True, True), "air_empty": ("air", False, False),
    }
    for rel, (kind, full, half) in hearts.items():
        img = pip(ps, kind, full, half)
        if rel.endswith("blinking"):
            img = Image.alpha_composite(img, Image.new("RGBA", img.size, alpha(MILK, 0.25)))
        put(f"sprites/hud/{rel}.png", img)

    # experience + jump bars
    for rel, a, b in (("experience_bar_background", INK, INK_SOFT),
                      ("jump_bar_background", INK, INK_SOFT),
                      ("experience_bar_progress", MINT, MINT_DEEP),
                      ("jump_bar_progress", PINK_MID, PURPLE),
                      ("jump_bar_cooldown", PANEL_HI, PANEL)):
        w, h = 182 * S, 5 * S
        img = new(w, h)
        rrect_grad(img, (0, 0, w, h), h // 2, a, b)
        if "progress" in rel:
            draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=h // 2,
                                        outline=alpha(MILK, 0.3), width=max(1, h // 6))
        put(f"sprites/hud/{rel}.png", img)

    # crosshair + attack indicator
    cs = 15 * S
    ch = new(cs, cs)
    d = draw(ch)
    arm = max(2, cs // 14)
    gap = cs * 0.14
    d.rectangle([cs / 2 - arm / 2, cs * 0.06, cs / 2 + arm / 2, cs / 2 - gap], fill=MILK)
    d.rectangle([cs / 2 - arm / 2, cs / 2 + gap, cs / 2 + arm / 2, cs * 0.94], fill=MILK)
    d.rectangle([cs * 0.06, cs / 2 - arm / 2, cs / 2 - gap, cs / 2 + arm / 2], fill=MILK)
    d.rectangle([cs / 2 + gap, cs / 2 - arm / 2, cs * 0.94, cs / 2 + arm / 2], fill=MILK)
    d.rectangle([cs / 2 - arm, cs / 2 - arm, cs / 2 + arm, cs / 2 + arm], fill=PINK_MID)
    put("sprites/hud/crosshair.png", ch)

    w, h = 16 * S, 4 * S
    bg = new(w, h)
    rrect_grad(bg, (0, 0, w, h), h // 2, INK, INK_SOFT)
    put("sprites/hud/crosshair_attack_indicator_background.png", bg)
    pr = new(w, h)
    rrect_grad(pr, (0, 0, w, h), h // 2, PINK_MID, PURPLE)
    put("sprites/hud/crosshair_attack_indicator_progress.png", pr)
    fs = 16 * S
    full = new(fs, fs)
    d = draw(full)
    d.polygon([(fs * 0.5, fs * 0.1), (fs * 0.86, fs * 0.5), (fs * 0.5, fs * 0.9), (fs * 0.14, fs * 0.5)],
              fill=PINK_PALE)
    put("sprites/hud/crosshair_attack_indicator_full.png", full)


# ====================================================== backgrounds and frames
def gen_backgrounds():
    tile = new(16 * S, 16 * S)
    vgrad(tile, (0, 0, 16 * S, 16 * S), alpha(INK_SOFT, 0.97), alpha(INK, 0.99))
    noise(tile, (0, 0, 16 * S, 16 * S), 4, 5)
    put("menu_background.png", tile, {"gui": {"scaling": {"type": "tile", "width": 16, "height": 16}}})

    tile2 = new(16 * S, 16 * S)
    vgrad(tile2, (0, 0, 16 * S, 16 * S), alpha(PANEL, 0.92), alpha(INK_SOFT, 0.96))
    noise(tile2, (0, 0, 16 * S, 16 * S), 4, 6)
    put("menu_list_background.png", tile2, {"gui": {"scaling": {"type": "tile", "width": 16, "height": 16}}})

    inworld = new(16 * S, 16 * S)
    vgrad(inworld, (0, 0, 16 * S, 16 * S), alpha(PURPLE_DEEP, 0.55), alpha(INK, 0.80))
    put("inworld_menu_background.png", inworld, {"gui": {"scaling": {"type": "tile", "width": 16, "height": 16}}})
    put("inworld_menu_list_background.png", inworld.copy(),
        {"gui": {"scaling": {"type": "tile", "width": 16, "height": 16}}})

    for rel in ("header_separator.png", "footer_separator.png",
                "inworld_header_separator.png", "inworld_footer_separator.png"):
        w, h = 32 * S, 2 * S
        img = new(w, h)
        hgrad(img, (0, 0, w, h), alpha(PINK, 0.0), alpha(PINK_MID, 0.95))
        hgrad2 = new(w, h)
        hgrad(hgrad2, (0, 0, w, h), alpha(PURPLE, 0.95), alpha(PURPLE, 0.0))
        img.alpha_composite(hgrad2)
        put(rel, img, {"gui": {"scaling": {"type": "tile", "width": 32, "height": 2}}})

    # tooltip and popup panels, at vanilla's own sprite sizes
    def panel_sprite(w, h, radius, framed):
        img = new(w, h)
        if framed:
            draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius,
                                        outline=PINK_MID, width=max(3, w // 30))
            draw(img).rounded_rectangle([max(3, w // 30), max(3, w // 30),
                                         w - 1 - max(3, w // 30), h - 1 - max(3, w // 30)],
                                        radius=max(1, radius - w // 30), outline=alpha(PURPLE, 0.8),
                                        width=max(2, w // 50))
        else:
            rrect_grad(img, (0, 0, w, h), radius, alpha(PANEL_HI, 0.96), alpha(INK, 0.98))
        return img

    put("sprites/popup/background.png", panel_sprite(236 * S, 34 * S, max(4, 34 * S // 5), False),
        nine(236, 34, 6))
    put("sprites/tooltip/background.png", panel_sprite(100 * S, 100 * S, 14 * S, False),
        nine(100, 100, 9))
    put("sprites/tooltip/frame.png", panel_sprite(100 * S, 100 * S, 14 * S, True),
        {"gui": {"scaling": {"type": "nine_slice", "width": 100, "height": 100,
                             "border": 10, "stretch_inner": True}}})

    # toasts
    def toast(w, h, accent):
        img = new(w, h)
        rrect_grad(img, (0, 0, w, h), max(4, h // 6), alpha(PANEL_HI, 0.97), alpha(INK, 0.98))
        draw(img).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(4, h // 6),
                                    outline=PINK_MID, width=max(1, h // 24))
        draw(img).rounded_rectangle([max(2, S), max(2, S), max(2, S) + max(3, S), h - 1 - max(2, S)],
                                    radius=max(1, S // 2), fill=accent)
        return img

    for rel, accent in (("sprites/toast/advancement.png", GOLD),
                        ("sprites/toast/recipe.png", MINT),
                        ("sprites/toast/tutorial.png", PINK_SOFT)):
        put(rel, toast(160 * S, 32 * S, accent), nine(160, 32, 4))
    put("sprites/toast/system.png", toast(160 * S, 64 * S, PINK_SOFT),
        {"gui": {"scaling": {"type": "nine_slice", "width": 160, "height": 64,
                             "border": {"left": 17, "top": 30, "right": 4, "bottom": 4}}}})

    # boss bars
    for color, (a, b) in {
        "pink": (PINK_MID, PINK_DEEP), "purple": (ORCHID, PURPLE_DEEP),
        "blue": ((122, 168, 255, 255), (47, 86, 184, 255)),
        "red": ((255, 110, 140, 255), (178, 24, 72, 255)),
        "green": (MINT, MINT_DEEP), "yellow": (GOLD, GOLD_DEEP),
        "white": (MILK, MUTED),
    }.items():
        w, h = 182 * S, 5 * S
        bgi = new(w, h)
        rrect_grad(bgi, (0, 0, w, h), h // 2, INK_SOFT, INK)
        put(f"sprites/boss_bar/{color}_background.png", bgi)
        pri = new(w, h)
        rrect_grad(pri, (0, 0, w, h), h // 2, a, b)
        draw(pri).rounded_rectangle([0, 0, w - 1, h - 1], radius=h // 2,
                                    outline=alpha(MILK, 0.28), width=max(1, h // 6))
        put(f"sprites/boss_bar/{color}_progress.png", pri)

    for notches in (6, 10, 12, 20):
        w, h = 182 * S, 5 * S
        bgi = new(w, h)
        rrect_grad(bgi, (0, 0, w, h), h // 2, INK_SOFT, INK)
        step = w / notches
        for i in range(1, notches):
            draw(bgi).line([(step * i, 0), (step * i, h)], fill=alpha(PINK_DEEP, 0.8), width=max(1, S // 2))
        put(f"sprites/boss_bar/notched_{notches}_background.png", bgi)
        pri = new(w, h)
        rrect_grad(pri, (0, 0, w, h), h // 2, PINK_MID, PURPLE)
        for i in range(1, notches):
            draw(pri).line([(step * i, 0), (step * i, h)], fill=alpha(INK, 0.55), width=max(1, S // 2))
        put(f"sprites/boss_bar/notched_{notches}_progress.png", pri)


if __name__ == "__main__":
    gen_widgets()
    gen_containers()
    gen_hud()
    gen_backgrounds()
    print(f"GUI textures written: {len([w for w in written if w.endswith('.png')])}")
    print(f"mcmeta written:       {len([w for w in written if w.endswith('.mcmeta')])}")
