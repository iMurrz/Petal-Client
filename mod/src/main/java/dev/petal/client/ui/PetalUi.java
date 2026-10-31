package dev.petal.client.ui;

import net.minecraft.client.Minecraft;

/** Ties the mod to the Petal UI resource pack the launcher switches on by default. */
public final class PetalUi {
    /** The pack's id in Minecraft's pack list, as the launcher installs it. */
    public static final String PACK_ID = "file/Petal-UI-64x.zip";
    /** Inventory and container titles: vanilla's dark grey vanishes on Petal UI's near-black panels. */
    public static final int LABEL = 0xFFE9DDF5;

    /** True while an inventory or container screen draws with Petal UI on, so its labels get the light colour. */
    public static boolean containerLabels;

    private PetalUi() {}

    public static boolean packActive() {
        return Minecraft.getInstance().getResourcePackRepository().getSelectedIds().contains(PACK_ID);
    }

    /** Vanilla's container label grey becomes Petal's label colour, keeping the caller's alpha. */
    public static int label(int color) {
        if (!containerLabels || (color & 0xFFFFFF) != 0x404040) return color;
        int alpha = color >>> 24 == 0 ? 0xFF : color >>> 24;
        return alpha << 24 | LABEL & 0xFFFFFF;
    }
}
