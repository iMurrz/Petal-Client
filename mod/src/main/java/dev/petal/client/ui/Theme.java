package dev.petal.client.ui;

/** Petal palette (ARGB). Text colours must keep a non-zero alpha or Minecraft skips drawing them. */
public final class Theme {
    public static final int PINK = 0xFFFF4FA3;
    public static final int BLUSH = 0xFFFFB8D9;
    public static final int MINT = 0xFF7CF2C8;
    public static final int MILK = 0xFFFBEFF5;
    public static final int ROSE = 0xFFFF8CC4;
    public static final int DEEP = 0xFFB8326F;

    public static final int TEXT = 0xFFFBEFF5;
    public static final int SOFT = 0xFFD9C2CF;
    public static final int MUTED = 0xFFB79AAB;
    public static final int DIM = 0xFF9C7E90;
    public static final int INK = 0xFF1A0610;

    public static final int PANEL = 0xFA160E15;
    public static final int NAV = 0xFF120B11;
    public static final int SIDE = 0xFF1B1119;
    public static final int CARD = 0xFF1F141D;
    public static final int CARD_HOVER = 0xFF261823;
    public static final int CARD_SELECTED = 0xFF2A1A26;
    public static final int LINE = 0xFF2A1A24;
    public static final int TRACK = 0xFF3A2533;
    public static final int FIELD = 0xFF24171F;

    // Petal 2.0 "pink into purple" glass look, used by the in-game menus.
    public static final int BLOOM = 0xFFE8248B;
    public static final int ORCHID = 0xFFB23BE6;
    public static final int VIOLET = 0xFF6D28D9;
    public static final int LILAC = 0xFFD9C6E8;
    public static final int HAZE = 0xFFC9B3DD;
    public static final int SEAFOAM = 0xFF8FF5D2;
    public static final int FROST = 0xFFF7EEFF;
    public static final int GLASS = 0xC812091E;
    public static final int GLASS_SIDE = 0x09FFFFFF;
    public static final int GLASS_LINE = 0x24FFFFFF;
    public static final int GLASS_CARD = 0x0CFFFFFF;
    public static final int GLASS_HOVER = 0x16FFFFFF;
    public static final int GLASS_FIELD = 0x48000000;
    public static final int DIVIDER = 0x14FFFFFF;
    public static final int SCRIM = 0x8C0B0612;
    public static final int PREVIEW_TOP = 0xFF4A1A63;
    public static final int PREVIEW_BOTTOM = 0xFF9B2F8E;

    public static final int[] ACCENTS = {PINK, BLUSH, MINT, MILK};
    public static final String[] ACCENT_NAMES = {"Petal pink", "Blush", "Mint", "Milk"};

    private Theme() {}

    /** HUD background: the base plum at the module's opacity. */
    public static int hudBackground(float opacity) {
        int a = Math.round(Math.max(0f, Math.min(1f, opacity)) * 255f);
        return (a << 24) | 0x0E0910;
    }

    /** Colour along the pink → orchid → violet bloom gradient, t in [0, 1]. */
    public static int bloom(float t) {
        t = Math.max(0f, Math.min(1f, t));
        return t < 0.55f ? lerp(BLOOM, ORCHID, t / 0.55f) : lerp(ORCHID, VIOLET, (t - 0.55f) / 0.45f);
    }

    public static int lerp(int a, int b, float t) {
        int r = 0;
        for (int shift = 0; shift <= 24; shift += 8) {
            int ca = (a >>> shift) & 0xFF, cb = (b >>> shift) & 0xFF;
            r |= (Math.round(ca + (cb - ca) * t) & 0xFF) << shift;
        }
        return r;
    }

    public static int withAlpha(int color, float alpha) {
        int a = Math.round(Math.max(0f, Math.min(1f, alpha)) * 255f);
        return (a << 24) | (color & 0xFFFFFF);
    }
}
