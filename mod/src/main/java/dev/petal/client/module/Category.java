package dev.petal.client.module;
import dev.petal.client.ui.Theme;
public enum Category {
    SURVIVAL("Survival", Theme.BLUSH), BUILDING("Building", Theme.PINK),
    FARMING("Farming", Theme.MINT), HUD("HUD", Theme.BLUSH),
    VISUAL("Visual", Theme.ROSE), UTILITY("Utility", Theme.SOFT);
    public final String label;
    public final int color;
    Category(String label, int color) { this.label = label; this.color = color; }
}
