package dev.petal.client.screen;

import dev.petal.client.PetalClient;
import dev.petal.client.config.ModuleSettings;
import dev.petal.client.config.PetalConfig;
import dev.petal.client.module.Category;
import dev.petal.client.module.Module;
import dev.petal.client.module.ModuleManager;
import dev.petal.client.ui.Draw;
import dev.petal.client.ui.Theme;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.util.FormattedCharSequence;
import net.minecraft.util.Mth;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The Right-Shift mod menu in the Petal 2.0 glass look: category pills, a grid of mod tiles with
 * Options / Enabled buttons, and a settings panel with a live preview.
 */
public final class PetalMenuScreen extends Screen {
    private static final int SIDE_W = 160;
    private static final int PAD = 12;
    private static final int CARD_H = 64;
    private static final int STRIP_H = 16;
    private static final int GAP = 6;
    private static final int PILL_H = 16;
    private static final int SEARCH_W = 110;
    private static final int EDIT_W = 62;

    private Category category; // null = all
    private Module selected = ModuleManager.COORDS;
    private EditBox search;
    private double scroll;
    private String dragging;

    public boolean isEditing() { return dragging != null; }

    private int x0, y0, w, h;
    /** Category pills laid out this frame: {x1, y1, x2, y2}, index 0 = All. */
    private final List<int[]> pills = new ArrayList<>();

    public PetalMenuScreen() {
        super(Component.literal("Petal"));
    }

    @Override
    protected void init() {
        w = Math.min(width - 16, 640);
        h = Math.min(height - 24, 340);
        x0 = (width - w) / 2;
        y0 = (height - h) / 2 + 4;
        String previous = search == null ? "" : search.getValue();
        int sx = searchX();
        search = new EditBox(font, sx + 16, y0 + 15, SEARCH_W - 22, 12, Component.literal("Search mods"));
        search.setBordered(false);
        search.setMaxLength(40);
        search.setTextColor(Theme.FROST);
        search.setHint(Component.literal("Search " + ModuleManager.all().size() + " mods").withColor(Theme.HAZE));
        search.setValue(previous);
        search.setResponder(v -> scroll = 0);
        addRenderableWidget(search);
    }

    // ---------- layout ----------

    private int mainX1() { return x0 + PAD; }
    private int mainX2() { return x0 + w - SIDE_W - PAD; }
    private int editX() { return mainX2() - EDIT_W; }
    private int searchX() { return editX() - 6 - SEARCH_W; }

    private void layoutPills() {
        pills.clear();
        int x = mainX1(), y = y0 + 38;
        for (int i = -1; i < Category.values().length; i++) {
            int pw = font.width(pillLabel(i)) + 16;
            if (x + pw > mainX2() && x > mainX1()) { x = mainX1(); y += PILL_H + 4; }
            pills.add(new int[]{x, y, x + pw, y + PILL_H});
            x += pw + 4;
        }
    }

    private static String pillLabel(int i) {
        return i < 0 ? "All" : Category.values()[i].label;
    }

    private int gridTop() { return (pills.isEmpty() ? y0 + 38 : pills.get(pills.size() - 1)[3]) + 10; }
    private int gridBottom() { return y0 + h - PAD; }
    private int columns() { int a = mainX2() - mainX1(); return a >= 400 ? 5 : a >= 310 ? 4 : a >= 220 ? 3 : a >= 140 ? 2 : 1; }
    private int cardW() { return (mainX2() - mainX1() - GAP * (columns() - 1)) / columns(); }
    private int cardX(int i) { return mainX1() + (i % columns()) * (cardW() + GAP); }
    private int cardY(int i) { return gridTop() + (i / columns()) * (CARD_H + GAP) - (int) scroll; }

    private List<Module> visible() {
        String q = search == null ? "" : search.getValue().trim().toLowerCase(Locale.ROOT);
        List<Module> out = new ArrayList<>();
        for (Module m : ModuleManager.all()) {
            if (category != null && m.category != category) continue;
            if (!q.isEmpty() && !(m.name + " " + m.description).toLowerCase(Locale.ROOT).contains(q)) continue;
            out.add(m);
        }
        return out;
    }

    private double maxScroll() {
        int rows = (visible().size() + columns() - 1) / columns();
        int content = Math.max(0, rows * (CARD_H + GAP) - GAP);
        return Math.max(0, content - (gridBottom() - gridTop()));
    }

    // ---------- rendering ----------

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        g.fill(0, 0, width, height, Theme.SCRIM);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        layoutPills();
        Draw.round(g, x0, y0, x0 + w, y0 + h, 12, Theme.GLASS);
        renderHeader(g, mouseX, mouseY);
        renderPills(g, mouseX, mouseY);
        renderGrid(g, mouseX, mouseY);
        renderSide(g, mouseX, mouseY);
        Draw.roundOutline(g, x0, y0, x0 + w, y0 + h, 12, Theme.GLASS_LINE);
        Draw.small(g, font, "RIGHT SHIFT  ·  ESC TO CLOSE", x0 + 2, y0 - 10, Theme.LILAC, 0.75f);
        super.render(g, mouseX, mouseY, partialTick);
    }

    private void renderHeader(GuiGraphics g, int mx, int my) {
        int top = y0 + 10;
        Draw.logo(g, mainX1(), top + 3, 2, Theme.BLOOM);
        g.drawString(font, "Petal", mainX1() + 20, top + 6, Theme.FROST, false);
        int on = 0;
        for (Module m : ModuleManager.all()) if (m.enabled()) on++;
        if (searchX() - (mainX1() + 54) > 70) {
            Draw.small(g, font, on + " of " + ModuleManager.all().size() + " on", mainX1() + 50, top + 7, Theme.HAZE, 0.75f);
        }

        int sx = searchX();
        Draw.round(g, sx, top, sx + SEARCH_W, top + 20, 6, Theme.GLASS_FIELD);
        Draw.roundOutline(g, sx, top, sx + SEARCH_W, top + 20, 6, search.isFocused() ? Theme.ORCHID : Theme.DIVIDER);
        searchGlyph(g, sx + 6, top + 6, Theme.HAZE);

        int ex = editX();
        boolean hover = Draw.inside(mx, my, ex, top, ex + EDIT_W, top + 20);
        Draw.bloom(g, ex, top, ex + EDIT_W, top + 20, 6);
        if (hover) Draw.round(g, ex, top, ex + EDIT_W, top + 20, 6, 0x22FFFFFF);
        g.drawCenteredString(font, "Edit HUD", ex + EDIT_W / 2, top + 6, 0xFFFFFFFF);
    }

    /** A small magnifier: ring plus handle. */
    private static void searchGlyph(GuiGraphics g, int x, int y, int color) {
        Draw.roundOutline(g, x, y, x + 7, y + 7, 3, color);
        g.fill(x + 6, y + 6, x + 7, y + 7, color);
        g.fill(x + 7, y + 7, x + 8, y + 8, color);
        g.fill(x + 8, y + 8, x + 9, y + 9, color);
    }

    private void renderPills(GuiGraphics g, int mx, int my) {
        for (int i = 0; i < pills.size(); i++) {
            int[] p = pills.get(i);
            Category c = i == 0 ? null : Category.values()[i - 1];
            boolean on = c == category;
            boolean hover = Draw.inside(mx, my, p[0], p[1], p[2], p[3]);
            if (on) {
                Draw.bloom(g, p[0], p[1], p[2], p[3], PILL_H / 2);
            } else {
                Draw.round(g, p[0], p[1], p[2], p[3], PILL_H / 2, hover ? Theme.GLASS_HOVER : 0x08FFFFFF);
                Draw.roundOutline(g, p[0], p[1], p[2], p[3], PILL_H / 2, Theme.DIVIDER);
            }
            g.drawCenteredString(font, pillLabel(i - 1), (p[0] + p[2]) / 2, p[1] + 4, on ? 0xFFFFFFFF : Theme.LILAC);
        }
    }

    private void renderGrid(GuiGraphics g, int mx, int my) {
        List<Module> list = visible();
        scroll = Mth.clamp(scroll, 0, maxScroll());
        int top = gridTop(), bottom = gridBottom(), cw = cardW();
        g.enableScissor(mainX1(), top, mainX2() + 8, bottom);
        for (int i = 0; i < list.size(); i++) {
            Module m = list.get(i);
            int cx = cardX(i), cy = cardY(i);
            if (cy + CARD_H < top || cy > bottom) continue;
            boolean inGrid = my >= top && my < bottom;
            boolean hover = inGrid && Draw.inside(mx, my, cx, cy, cx + cw, cy + CARD_H - STRIP_H);
            boolean sel = m == selected;
            boolean on = m.enabled();

            Draw.round(g, cx, cy, cx + cw, cy + CARD_H, 8, hover ? Theme.GLASS_HOVER : Theme.GLASS_CARD);
            Draw.roundOutline(g, cx, cy, cx + cw, cy + CARD_H, 8, sel ? 0xFFD69BFF : Theme.DIVIDER);
            if (sel) Draw.roundOutline(g, cx + 1, cy + 1, cx + cw - 1, cy + CARD_H - 1, 7, 0x80D69BFF);

            int tile = 22, tx = cx + (cw - tile) / 2, ty = cy + 7;
            tile(g, m, tx, ty, tile, on);
            String name = font.plainSubstrByWidth(m.name, cw - 8);
            g.drawCenteredString(font, name, cx + cw / 2, cy + 33, Theme.FROST);

            int sy = cy + CARD_H - STRIP_H, half = cw / 2;
            g.fill(cx + 1, sy, cx + cw - 1, sy + 1, Theme.DIVIDER);
            boolean optHover = inGrid && Draw.inside(mx, my, cx, sy, cx + half, cy + CARD_H);
            if (optHover) g.fill(cx + 1, sy + 1, cx + half, cy + CARD_H - 3, 0x0FFFFFFF);
            Draw.small(g, font, "Options", cx + half / 2 - Math.round(font.width("Options") * 0.375f), sy + 6, optHover ? Theme.FROST : Theme.LILAC, 0.75f);
            stateButton(g, cx + half, sy + 1, cx + cw, cy + CARD_H, on, inGrid && Draw.inside(mx, my, cx + half, sy, cx + cw, cy + CARD_H));
        }
        g.disableScissor();
        if (list.isEmpty()) g.drawCenteredString(font, "No mods match that search.", (mainX1() + mainX2()) / 2, top + 30, Theme.HAZE);

        double max = maxScroll();
        if (max > 0) {
            int trackH = bottom - top;
            int thumb = Math.max(20, (int) (trackH * trackH / (double) (trackH + max)));
            int ty = top + (int) ((trackH - thumb) * (scroll / max));
            Draw.round(g, mainX2() + 3, ty, mainX2() + 6, ty + thumb, 1, 0x40FFFFFF);
        }
    }

    /** Bottom-right half of a card: gradient "Enabled" or muted "Disabled", rounded only at the card's corner. */
    private void stateButton(GuiGraphics g, int x1, int y1, int x2, int y2, boolean on, boolean hover) {
        if (on) {
            Draw.bloom(g, x1, y1, x2, y2, 0);
            // Re-cut the card's bottom-right corner over the square gradient.
            for (int i = 0; i < 8; i++) {
                double d = 8 - i - 0.5;
                int in = (int) Math.round(8 - Math.sqrt(64 - d * d));
                if (in > 0) g.fill(x2 - in, y2 - 1 - i, x2, y2 - i, Theme.GLASS);
            }
        } else if (hover) {
            g.fill(x1, y1, x2 - 1, y2 - 3, 0x0FFFFFFF);
        }
        String label = on ? "Enabled" : "Disabled";
        int lw = Math.round(font.width(label) * 0.75f);
        Draw.small(g, font, label, (x1 + x2) / 2 - lw / 2, y1 + 5, on ? 0xFFFFFFFF : Theme.HAZE, 0.75f);
    }

    /** Rounded icon tile: bloom-tinted when the mod is on, muted when off. Shows the mod's initials. */
    private void tile(GuiGraphics g, Module m, int x, int y, int size, boolean on) {
        int r = Math.max(3, size / 3);
        if (on) {
            Draw.roundGradient(g, x, y, x + size, y + size, r, 0x52E8248B, 0x526D28D9);
            Draw.roundOutline(g, x, y, x + size, y + size, r, 0x30FFD3EA);
        } else {
            Draw.round(g, x, y, x + size, y + size, r, 0x0DFFFFFF);
        }
        String ini = m.initials();
        g.drawString(font, ini, x + (size - font.width(ini)) / 2 + 1, y + (size - 8) / 2 + 1, on ? 0xFFFFD3EA : 0xFF9E89B3, false);
    }

    // ---------- settings side panel ----------

    private int sideX1() { return x0 + w - SIDE_W; }
    private int sideX() { return sideX1() + 12; }
    private int sideW() { return SIDE_W - 24; }
    private int previewTop() { return y0 + (h < 280 ? 70 : 76); }
    private int previewHeight() { return Mth.clamp(h - 214, 22, 64); }
    private int scaleY() { return previewTop() + previewHeight() + 18; }
    private int opacityY() { return scaleY() + 24; }
    private int swatchY() { return opacityY() + 22; }
    private int footerY() { return y0 + h - 30; }

    private void renderSide(GuiGraphics g, int mx, int my) {
        int x1 = sideX1();
        // Lighter glass on the right, rounded only on the panel's own right corners.
        g.fill(x1, y0 + 12, x1 + 1, y0 + h - 12, Theme.DIVIDER);
        for (int y = y0; y < y0 + h; y++) {
            int row = Math.min(y - y0, y0 + h - 1 - y);
            int in = row >= 12 ? 0 : (int) Math.round(12 - Math.sqrt(144 - (11.5 - row) * (11.5 - row)));
            g.fill(x1 + 1, y, x0 + w - in, y + 1, Theme.GLASS_SIDE);
        }

        Module m = selected;
        ModuleSettings s = m.settings();
        int sx = sideX(), sw = sideW();

        tile(g, m, sx, y0 + 12, 22, s.enabled);
        g.drawString(font, font.plainSubstrByWidth(m.name, sw - 28), sx + 28, y0 + 13, Theme.FROST, false);
        Draw.small(g, font, m.category.label + " · " + (s.enabled ? "Enabled" : "Disabled"), sx + 28, y0 + 25, s.enabled ? Theme.SEAFOAM : Theme.HAZE, 0.75f);

        int ly = y0 + 42;
        List<FormattedCharSequence> lines = font.split(Component.literal(m.description), (int) (sw / 0.75f));
        for (int i = 0; i < Math.min(3, lines.size()); i++) {
            g.pose().pushMatrix();
            g.pose().translate(sx, ly);
            g.pose().scale(0.75f, 0.75f);
            g.drawString(font, lines.get(i), 0, 0, Theme.LILAC, false);
            g.pose().popMatrix();
            ly += 8;
        }

        if (m.hasHud()) {
            int pt = previewTop(), ph = previewHeight();
            Draw.roundGradient(g, sx, pt, sx + sw, pt + ph, 8, Theme.PREVIEW_TOP, Theme.PREVIEW_BOTTOM);
            Draw.small(g, font, "PREVIEW", sx + 5, pt + 4, 0xFFFFE3F1, 0.6f);
            float fit = Math.min(s.scale, Math.min((sw - 10f) / Math.max(1, m.lastWidth), (ph - 12f) / Math.max(1, m.lastHeight)));
            int pw = Math.round(m.lastWidth * fit), phh = Math.round(m.lastHeight * fit);
            g.enableScissor(sx, pt, sx + sw, pt + ph);
            g.pose().pushMatrix();
            g.pose().translate(sx + (sw - pw) / 2f, pt + 4 + (ph - 4 - phh) / 2f);
            g.pose().scale(fit, fit);
            int[] size = m.draw(g, minecraft, s, true);
            g.pose().popMatrix();
            g.disableScissor();
            if (size[0] > 0) { m.lastWidth = size[0]; m.lastHeight = size[1]; }

            slider(g, "Scale", String.format(Locale.ROOT, "%.2f×", s.scale), (s.scale - 0.5f) / 1.5f, scaleY());
            slider(g, "Background", Math.round(s.opacity * 100) + "%", s.opacity, opacityY());

            g.drawString(font, "Accent", sx, swatchY() - 10, Theme.FROST, false);
            for (int i = 0; i < Theme.ACCENTS.length; i++) {
                int bx = sx + i * 22;
                if ((s.accent | 0xFF000000) == Theme.ACCENTS[i]) Draw.roundOutline(g, bx - 2, swatchY() - 2, bx + 18, swatchY() + 18, 6, Theme.ACCENTS[i]);
                Draw.round(g, bx, swatchY(), bx + 16, swatchY() + 16, 4, Theme.ACCENTS[i]);
            }
        } else {
            int ny = previewTop();
            String note = m.menuNote() != null ? m.menuNote() : "This mod changes how the game plays or looks. It has no HUD panel.";
            for (FormattedCharSequence line : font.split(Component.literal(note), sw)) {
                g.drawString(font, line, sx, ny, Theme.HAZE, false);
                ny += 10;
            }
        }

        int by = footerY(), half = (sw - 6) * 2 / 5;
        boolean resetHover = Draw.inside(mx, my, sx, by, sx + half, by + 20);
        if (resetHover) Draw.round(g, sx, by, sx + half, by + 20, 6, Theme.GLASS_HOVER);
        Draw.roundOutline(g, sx, by, sx + half, by + 20, 6, 0x30FFFFFF);
        g.drawCenteredString(font, "Reset", sx + half / 2, by + 6, Theme.FROST);
        int ax = sx + half + 6;
        boolean actHover = Draw.inside(mx, my, ax, by, sx + sw, by + 20);
        Draw.bloom(g, ax, by, sx + sw, by + 20, 6);
        if (actHover) Draw.round(g, ax, by, sx + sw, by + 20, 6, 0x22FFFFFF);
        g.drawCenteredString(font, s.enabled ? "Disable" : "Enable", ax + (sx + sw - ax) / 2, by + 6, 0xFFFFFFFF);
    }

    private void slider(GuiGraphics g, String label, String value, float fraction, int y) {
        int sx = sideX(), sw = sideW();
        g.drawString(font, label, sx, y - 11, Theme.FROST, false);
        g.drawString(font, value, sx + sw - font.width(value), y - 11, Theme.LILAC, false);
        float f = Mth.clamp(fraction, 0f, 1f);
        Draw.round(g, sx, y, sx + sw, y + 4, 2, 0x1AFFFFFF);
        int filled = Math.round(sw * f);
        if (filled > 3) Draw.bloom(g, sx, y, sx + filled, y + 4, 2);
        int kx = sx + Math.round((sw - 8) * f);
        Draw.round(g, kx, y - 2, kx + 8, y + 6, 4, Theme.FROST);
    }

    // ---------- input ----------

    @Override
    public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
        double mx = event.x(), my = event.y();
        if (super.mouseClicked(event, doubleClick)) return true;
        if (event.button() != 0) return false;
        layoutPills();
        int top = y0 + 10;
        if (!Draw.inside(mx, my, searchX(), top, searchX() + SEARCH_W, top + 20)) search.setFocused(false);
        else { search.setFocused(true); return true; }

        if (Draw.inside(mx, my, editX(), top, editX() + EDIT_W, top + 20)) {
            PetalConfig.save();
            minecraft.setScreen(new HudEditorScreen(this));
            return true;
        }

        for (int i = 0; i < pills.size(); i++) {
            int[] p = pills.get(i);
            if (Draw.inside(mx, my, p[0], p[1], p[2], p[3])) {
                category = i == 0 ? null : Category.values()[i - 1];
                scroll = 0;
                return true;
            }
        }

        if (my >= gridTop() && my < gridBottom()) {
            List<Module> list = visible();
            int cw = cardW();
            for (int i = 0; i < list.size(); i++) {
                int cx = cardX(i), cy = cardY(i);
                if (!Draw.inside(mx, my, cx, cy, cx + cw, cy + CARD_H)) continue;
                Module m = list.get(i);
                if (Draw.inside(mx, my, cx + cw / 2, cy + CARD_H - STRIP_H, cx + cw, cy + CARD_H)) m.setEnabled(!m.enabled());
                selected = m;
                return true;
            }
        }

        Module m = selected;
        ModuleSettings s = m.settings();
        int sx = sideX(), sw = sideW();
        if (m.hasHud()) {
            if (Draw.inside(mx, my, sx - 2, scaleY() - 5, sx + sw + 2, scaleY() + 9)) { dragging = "scale"; drag(mx); return true; }
            if (Draw.inside(mx, my, sx - 2, opacityY() - 5, sx + sw + 2, opacityY() + 9)) { dragging = "opacity"; drag(mx); return true; }
            for (int i = 0; i < Theme.ACCENTS.length; i++) {
                int bx = sx + i * 22;
                if (Draw.inside(mx, my, bx, swatchY(), bx + 16, swatchY() + 16)) {
                    s.accent = Theme.ACCENTS[i];
                    PetalConfig.save();
                    return true;
                }
            }
        }
        int fy = footerY(), half = (sw - 6) * 2 / 5;
        if (Draw.inside(mx, my, sx, fy, sx + half, fy + 20)) { m.resetLook(); return true; }
        if (Draw.inside(mx, my, sx + half + 6, fy, sx + sw, fy + 20)) { m.setEnabled(!m.enabled()); return true; }
        return false;
    }

    private void drag(double mx) {
        ModuleSettings s = selected.settings();
        float f = Mth.clamp((float) ((mx - sideX()) / (double) sideW()), 0f, 1f);
        if ("scale".equals(dragging)) s.scale = Math.round((0.5f + f * 1.5f) * 20f) / 20f;
        else if ("opacity".equals(dragging)) s.opacity = Math.round(f * 20f) / 20f;
    }

    @Override
    public boolean mouseDragged(MouseButtonEvent event, double dx, double dy) {
        if (dragging != null) { drag(event.x()); return true; }
        return super.mouseDragged(event, dx, dy);
    }

    @Override
    public boolean mouseReleased(MouseButtonEvent event) {
        if (dragging != null) { dragging = null; PetalConfig.save(); return true; }
        return super.mouseReleased(event);
    }

    @Override
    public boolean mouseScrolled(double mx, double my, double sx, double sy) {
        if (Draw.inside(mx, my, mainX1(), gridTop(), mainX2() + 8, gridBottom())) {
            scroll = Mth.clamp(scroll - sy * 24, 0, maxScroll());
            return true;
        }
        return super.mouseScrolled(mx, my, sx, sy);
    }

    @Override
    public boolean keyPressed(KeyEvent event) {
        if (!search.isFocused() && PetalClient.menuKey.matches(event)) {
            onClose();
            return true;
        }
        return super.keyPressed(event);
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    @Override
    public void onClose() {
        PetalConfig.save();
        super.onClose();
    }
}
