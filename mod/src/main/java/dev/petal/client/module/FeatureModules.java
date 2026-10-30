package dev.petal.client.module;

import dev.petal.client.config.ModuleSettings;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

/** Modules that change how the game behaves or looks instead of drawing a HUD panel. */
public final class FeatureModules {
    private FeatureModules() {}

    public static final class Zoom extends Module {
        private float current = 1f;
        private float target = 4f;

        public Zoom() { super("zoom", "Zoom", "Hold C to zoom. Scroll while zooming to adjust.", Category.VISUAL, true); }

        public boolean active() {
            return enabled() && dev.petal.client.PetalClient.zoomKey != null && dev.petal.client.PetalClient.zoomKey.isDown()
                    && Minecraft.getInstance().screen == null;
        }

        /** Smoothed zoom factor for this frame (1 = no zoom). */
        public float update() {
            float want = active() ? target : 1f;
            current += (want - current) * 0.35f;
            if (Math.abs(current - want) < 0.01f) current = want;
            return current;
        }

        public float factor() {
            return current;
        }

        public boolean onScroll(double amount) {
            if (!active()) return false;
            target = Math.max(1.5f, Math.min(30f, target * (amount > 0 ? 1.15f : 1f / 1.15f)));
            return true;
        }
    }

    public static final class PetalCrosshair extends Module {
        public PetalCrosshair() { super("crosshair", "Builder Crosshair", "A clear centre marker for precise block placement.", Category.BUILDING, true); }

        public void render(GuiGraphics g, ModuleSettings s) {
            int cx = g.guiWidth() / 2, cy = g.guiHeight() / 2;
            int c = 0xFFFBEFF5;
            g.fill(cx - 1, cy - 6, cx + 1, cy - 2, c);
            g.fill(cx - 1, cy + 2, cx + 1, cy + 6, c);
            g.fill(cx - 6, cy - 1, cx - 2, cy + 1, c);
            g.fill(cx + 2, cy - 1, cx + 6, cy + 1, c);
            g.fill(cx - 1, cy - 1, cx + 1, cy + 1, s.accent);
        }
    }

}
