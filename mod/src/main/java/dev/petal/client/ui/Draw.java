package dev.petal.client.ui;

import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;

/** Drawing helpers for Petal's notched, flat look. */
public final class Draw {
    private Draw() {}

    /** Rectangle with the top-left and bottom-right corners cut at 45°, Petal's signature shape. */
    public static void chamfer(GuiGraphics g, int x1, int y1, int x2, int y2, int cut, int color) {
        cut = Math.max(0, Math.min(cut, Math.min((x2 - x1) / 2, (y2 - y1) / 2)));
        for (int i = 0; i < cut; i++) {
            g.fill(x1 + cut - i, y1 + i, x2, y1 + i + 1, color);
            g.fill(x1, y2 - 1 - i, x2 - cut + i, y2 - i, color);
        }
        g.fill(x1, y1 + cut, x2, y2 - cut, color);
    }

    public static void outline(GuiGraphics g, int x1, int y1, int x2, int y2, int color) {
        g.fill(x1, y1, x2, y1 + 1, color);
        g.fill(x1, y2 - 1, x2, y2, color);
        g.fill(x1, y1 + 1, x1 + 1, y2 - 1, color);
        g.fill(x2 - 1, y1 + 1, x2, y2 - 1, color);
    }

    /** On/off switch, 20×11. */
    public static void toggle(GuiGraphics g, int x, int y, boolean on) {
        g.fill(x, y, x + 20, y + 11, on ? Theme.PINK : Theme.TRACK);
        int knob = on ? x + 11 : x + 2;
        g.fill(knob, y + 2, knob + 7, y + 9, Theme.MILK);
    }

    public static void bar(GuiGraphics g, int x, int y, int w, int h, float fraction, int fill, int track) {
        g.fill(x, y, x + w, y + h, track);
        int filled = Math.round(w * Math.max(0f, Math.min(1f, fraction)));
        if (filled > 0) g.fill(x, y, x + filled, y + h, fill);
    }

    /** Draws text scaled down (e.g. 0.75 for small labels). */
    public static void small(GuiGraphics g, Font font, String text, int x, int y, int color, float scale) {
        g.pose().pushMatrix();
        g.pose().translate(x, y);
        g.pose().scale(scale, scale);
        g.drawString(font, text, 0, 0, color, false);
        g.pose().popMatrix();
    }

    /** The Petal mark: four pixel petals around a milk centre. `px` is the size of one pixel. */
    public static void logo(GuiGraphics g, int x, int y, int px, int color) {
        int[][] rects = {{1, 0, 2, 1}, {0, 1, 3, 2}, {4, 0, 2, 1}, {4, 1, 3, 2}, {0, 4, 3, 2}, {1, 6, 2, 1}, {4, 4, 3, 2}, {4, 6, 2, 1}};
        for (int[] r : rects) g.fill(x + r[0] * px, y + r[1] * px, x + (r[0] + r[2]) * px, y + (r[1] + r[3]) * px, color);
        g.fill(x + 3 * px, y + 3 * px, x + 4 * px, y + 4 * px, Theme.MILK);
    }

    /** How far a row (or column) `i` pixels into a corner of radius `r` is inset. */
    private static int inset(int i, int r) {
        if (i >= r) return 0;
        double d = r - i - 0.5;
        return (int) Math.round(r - Math.sqrt(Math.max(0, r * r - d * d)));
    }

    private static int radius(int x1, int y1, int x2, int y2, int r) {
        return Math.max(0, Math.min(r, Math.min((x2 - x1) / 2, (y2 - y1) / 2)));
    }

    /** Filled rectangle with rounded corners. */
    public static void round(GuiGraphics g, int x1, int y1, int x2, int y2, int r, int color) {
        r = radius(x1, y1, x2, y2, r);
        g.fill(x1, y1 + r, x2, y2 - r, color);
        for (int i = 0; i < r; i++) {
            int in = inset(i, r);
            g.fill(x1 + in, y1 + i, x2 - in, y1 + i + 1, color);
            g.fill(x1 + in, y2 - 1 - i, x2 - in, y2 - i, color);
        }
    }

    /** One-pixel rounded border, drawn as a ring so translucent fills inside it stay even. */
    public static void roundOutline(GuiGraphics g, int x1, int y1, int x2, int y2, int r, int color) {
        r = radius(x1, y1, x2, y2, r);
        int ri = Math.max(0, r - 1);
        for (int y = y1; y < y2; y++) {
            int row = Math.min(y - y1, y2 - 1 - y);
            int outer = inset(row, r);
            if (row == 0) {
                g.fill(x1 + outer, y, x2 - outer, y + 1, color);
                continue;
            }
            int inner = 1 + inset(row - 1, ri);
            if (inner <= outer) inner = outer + 1;
            g.fill(x1 + outer, y, x1 + inner, y + 1, color);
            g.fill(x2 - inner, y, x2 - outer, y + 1, color);
        }
    }

    /** Rounded rectangle filled with the left-to-right bloom gradient. */
    public static void bloom(GuiGraphics g, int x1, int y1, int x2, int y2, int r) {
        r = radius(x1, y1, x2, y2, r);
        int w = Math.max(1, x2 - x1 - 1);
        for (int x = x1; x < x2; x++) {
            int col = Math.min(x - x1, x2 - 1 - x);
            int in = inset(col, r);
            g.fill(x, y1 + in, x + 1, y2 - in, Theme.bloom((x - x1) / (float) w));
        }
    }

    /** Rounded rectangle with a top-to-bottom gradient. */
    public static void roundGradient(GuiGraphics g, int x1, int y1, int x2, int y2, int r, int top, int bottom) {
        r = radius(x1, y1, x2, y2, r);
        int h = Math.max(1, y2 - y1 - 1);
        for (int y = y1; y < y2; y++) {
            int row = Math.min(y - y1, y2 - 1 - y);
            int in = inset(row, r);
            g.fill(x1 + in, y, x2 - in, y + 1, Theme.lerp(top, bottom, (y - y1) / (float) h));
        }
    }

    public static boolean inside(double mx, double my, int x1, int y1, int x2, int y2) {
        return mx >= x1 && mx < x2 && my >= y1 && my < y2;
    }
}
