package dev.petal.client.module;

import dev.petal.client.PetalClient;
import dev.petal.client.config.ModuleSettings;
import net.minecraft.ChatFormatting;
import net.minecraft.client.CameraType;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;

import java.time.LocalTime;

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

        @Override
        public String menuNote() {
            return "Hold " + PetalClient.zoomKey.getTranslatedKeyMessage().getString() + " to zoom. Change the key in Controls.";
        }
    }

    /** Orbits the camera around you while the key is held; your character keeps facing the same way. */
    public static final class Freelook extends Module {
        private boolean active;
        private float yaw;
        private float pitch;
        private CameraType previous;

        public Freelook() { super("freelook", "Freelook", "Hold Left Alt to look around without turning your character.", Category.VISUAL, true); }

        public boolean active() {
            return active;
        }

        public float yaw() {
            return yaw;
        }

        public float pitch() {
            return pitch;
        }

        @Override
        public void tick(Minecraft mc) {
            boolean want = enabled() && mc.player != null && mc.screen == null
                    && PetalClient.freelookKey != null && PetalClient.freelookKey.isDown();
            if (want && !active) {
                yaw = mc.player.getYRot();
                pitch = mc.player.getXRot();
                previous = mc.options.getCameraType();
                mc.options.setCameraType(CameraType.THIRD_PERSON_BACK);
                active = true;
            } else if (!want && active) {
                // Leave the view alone if F5 was pressed during freelook.
                if (mc.options.getCameraType() == CameraType.THIRD_PERSON_BACK && previous != null) mc.options.setCameraType(previous);
                active = false;
            }
        }

        /** Takes mouse movement for the camera instead of the player. Same 0.15 scale as Entity.turn. */
        public boolean turn(double dx, double dy) {
            if (!active) return false;
            yaw += (float) dx * 0.15f;
            pitch = Mth.clamp(pitch + (float) dy * 0.15f, -90f, 90f);
            return true;
        }

        @Override
        public String menuNote() {
            return "Hold " + PetalClient.freelookKey.getTranslatedKeyMessage().getString()
                    + " to look around while you keep walking the same way. Change the key in Controls.";
        }
    }

    public static final class ChatTimestamps extends Module {
        public ChatTimestamps() { super("chattime", "Chat Timestamps", "Adds the time to each new chat message.", Category.UTILITY, false); }

        public Component stamp(Component message) {
            if (!enabled()) return message;
            LocalTime t = LocalTime.now();
            return Component.empty()
                    .append(Component.literal(String.format("%02d:%02d ", t.getHour(), t.getMinute())).withStyle(ChatFormatting.DARK_GRAY))
                    .append(message);
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
