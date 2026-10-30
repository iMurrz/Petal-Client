package dev.petal.client.hud;

import dev.petal.client.config.ModuleSettings;
import dev.petal.client.module.Module;
import dev.petal.client.module.ModuleManager;
import dev.petal.client.screen.HudEditorScreen;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

/** Draws every enabled HUD module at its saved spot. */
public final class HudRenderer {
    private HudRenderer() {}

    public static void render(GuiGraphics g, DeltaTracker delta) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.options.hideGui || mc.player == null || mc.screen instanceof HudEditorScreen) return;
        for (Module m : ModuleManager.all()) {
            if (m.hasHud() && m.enabled()) drawPlaced(g, mc, m, false);
        }
    }

    /** Draws a module at its saved position; returns its on-screen box {x, y, w, h}. */
    public static int[] drawPlaced(GuiGraphics g, Minecraft mc, Module m, boolean preview) {
        ModuleSettings s = m.settings();
        int[] pos = position(m, s, g.guiWidth(), g.guiHeight());
        g.pose().pushMatrix();
        g.pose().translate(pos[0], pos[1]);
        g.pose().scale(s.scale, s.scale);
        int[] size = m.draw(g, mc, s, preview);
        g.pose().popMatrix();
        if (size[0] > 0) {
            m.lastWidth = size[0];
            m.lastHeight = size[1];
        }
        return new int[]{pos[0], pos[1], Math.round(m.lastWidth * s.scale), Math.round(m.lastHeight * s.scale)};
    }

    /** Fractions map onto the space left once the module's own size is subtracted, so it never leaves the screen. */
    public static int[] position(Module m, ModuleSettings s, int screenW, int screenH) {
        int w = Math.round(m.lastWidth * s.scale);
        int h = Math.round(m.lastHeight * s.scale);
        int x = Math.round(s.x * Math.max(0, screenW - w));
        int y = Math.round(s.y * Math.max(0, screenH - h));
        return new int[]{x, y};
    }
}
