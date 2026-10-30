package dev.petal.client.config;

import dev.petal.client.ui.Theme;

/** One module's saved state. Positions are fractions of the free screen space, so layouts survive resizes. */
public final class ModuleSettings {
    public boolean enabled;
    public float x;
    public float y;
    public float scale = 1f;
    public float opacity = 0.6f;
    public int accent = Theme.PINK;

    public static ModuleSettings defaults(boolean enabled, float x, float y) {
        ModuleSettings s = new ModuleSettings();
        s.enabled = enabled;
        s.x = x;
        s.y = y;
        return s;
    }

    void sanitize() {
        x = clamp(Float.isFinite(x) ? x : 0f, 0f, 1f);
        y = clamp(Float.isFinite(y) ? y : 0f, 0f, 1f);
        scale = clamp(Float.isFinite(scale) ? scale : 1f, 0.5f, 2f);
        opacity = clamp(Float.isFinite(opacity) ? opacity : 0.6f, 0f, 1f);
        accent |= 0xFF000000;
    }

    public static float clamp(float v, float min, float max) {
        return v < min ? min : Math.min(v, max);
    }
}
