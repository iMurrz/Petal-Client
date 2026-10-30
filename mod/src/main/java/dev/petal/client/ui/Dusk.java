package dev.petal.client.ui;

import net.minecraft.client.gui.GuiGraphics;

/** The Petal 2.0 title backdrop: a dusk sky, blocky hills, cherry trees and falling petals, all drawn with fills. */
public final class Dusk {
    private static final int[] SKY = {0xFF1C0A33, 0xFF48186E, 0xFF9B2F8E, 0xFFEE6AA6, 0xFFFFB3CF};
    private static final float[] STOPS = {0f, 0.34f, 0.62f, 0.86f, 1f};

    private Dusk() {}

    public static void render(GuiGraphics g, int width, int height) {
        long now = System.currentTimeMillis();

        for (int i = 0; i < SKY.length - 1; i++) {
            g.fillGradient(0, Math.round(height * STOPS[i]), width, Math.round(height * STOPS[i + 1]), SKY[i], SKY[i + 1]);
        }

        // Drifting clouds.
        for (int i = 0; i < 5; i++) {
            double t = (now / 1000.0) / (18 + i * 4);
            int drift = (int) Math.round(Math.sin(t * Math.PI) * 24);
            int cx = width * (8 + i * 21) / 100 + drift, cy = 24 + (i % 3) * 28;
            int cw = 48 + (i % 2) * 32, ch = 8 + (i % 2) * 4;
            g.fill(cx, cy, cx + cw, cy + ch, 0x38FFD6EB);
            g.fill(cx + 12, cy - 6, cx + cw + 12, cy + ch - 6, 0x2EFFD6EB);
        }

        int block = Math.max(4, height / 56);
        int cols = 50, colW = (width + cols - 1) / cols;
        // Far hills.
        for (int i = 0; i < cols; i++) {
            int fh = (int) ((height * 0.18) + (Math.sin(i * 0.35) * 0.5 + 0.5) * height * 0.18 + (i % 3) * block);
            fh = fh / block * block;
            g.fill(i * colW, height - fh, (i + 1) * colW, height, 0xFF3E1556);
        }
        // Cherry trees standing on the far hills.
        int[][] trees = {{34, 23}, {44, 28}, {55, 21}, {67, 26}, {79, 23}, {90, 27}};
        for (int i = 0; i < trees.length; i++) {
            int size = Math.max(24, height / 9) + (i % 3) * block * 2;
            int x = width * trees[i][0] / 100, base = height - height * trees[i][1] / 100;
            int canopyH = size * 2 / 3;
            g.fill(x + size / 2 - block / 2 - 1, base - 3 * block, x + size / 2 + block / 2 + 1, base, 0xFF3B1630);
            g.fill(x, base - 3 * block - canopyH, x + size, base - 3 * block, 0xFFFF8EC6);
            g.fill(x, base - 3 * block - block, x + size, base - 3 * block, 0xFFE0559E);
            g.fill(x + size / 5, base - 3 * block - canopyH - block, x + size * 4 / 5, base - 3 * block - canopyH, 0xFFFFB3D9);
        }
        // Near hills.
        for (int i = 0; i < cols; i++) {
            int nh = (int) ((height * 0.07) + (Math.sin(i * 0.6 + 1.4) * 0.5 + 0.5) * height * 0.10 + (i % 2) * block);
            nh = nh / block * block;
            g.fill(i * colW, height - nh, (i + 1) * colW, height, 0xFF1A0B26);
        }
        // Falling petals.
        for (int i = 0; i < 14; i++) {
            double period = 9 + (i % 5) * 2;
            double phase = ((now / 1000.0) + i * 0.9) % period / period;
            int px = (i * 113) % Math.max(1, width - 8) + 4 + (int) Math.round(Math.sin(phase * Math.PI * 4) * 6);
            int py = (int) Math.round(-8 + phase * (height + 16));
            int alpha = phase < 0.1 ? (int) (phase * 10 * 255) : 255;
            g.fill(px, py, px + 3, py + 3, (alpha << 24) | ((i % 2 == 0 ? 0xFF8EC6 : 0xFFB3D9) & 0xFFFFFF));
        }
        // Darken the left side so the menu reads.
        int fade = width * 7 / 10, step = 4;
        for (int x = 0; x < fade; x += step) {
            float t = x / (float) fade;
            float a = t < 0.64f ? 0.78f - (0.53f * t / 0.64f) : 0.25f * (1 - (t - 0.64f) / 0.36f);
            g.fill(x, 0, Math.min(fade, x + step), height, Theme.withAlpha(0xFF0B0612, a));
        }
    }
}
