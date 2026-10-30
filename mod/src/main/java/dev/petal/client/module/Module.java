package dev.petal.client.module;

import dev.petal.client.config.ModuleSettings;
import dev.petal.client.config.PetalConfig;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;

/** A feature in the mod menu. HUD modules override {@link #hasHud()} and {@link #draw}. */
public abstract class Module {
    public final String id;
    public final String name;
    public final String description;
    public final Category category;
    private final boolean enabledByDefault;
    private final float defaultX;
    private final float defaultY;

    /** Size drawn last frame, in unscaled GUI pixels (for layout and the HUD editor). */
    public int lastWidth = 60;
    public int lastHeight = 14;

    protected Module(String id, String name, String description, Category category, boolean enabledByDefault, float defaultX, float defaultY) {
        this.id = id;
        this.name = name;
        this.description = description;
        this.category = category;
        this.enabledByDefault = enabledByDefault;
        this.defaultX = defaultX;
        this.defaultY = defaultY;
    }

    protected Module(String id, String name, String description, Category category, boolean enabledByDefault) {
        this(id, name, description, category, enabledByDefault, 0f, 0f);
    }

    public ModuleSettings settings() {
        return PetalConfig.get().module(id, enabledByDefault, defaultX, defaultY);
    }

    public boolean enabled() {
        return settings().enabled;
    }

    public void setEnabled(boolean value) {
        settings().enabled = value;
        PetalConfig.save();
    }

    public void resetLook() {
        ModuleSettings s = settings();
        s.scale = 1f;
        s.opacity = 0.6f;
        s.accent = dev.petal.client.ui.Theme.PINK;
        s.x = defaultX;
        s.y = defaultY;
        PetalConfig.save();
    }

    public void resetPosition() {
        settings().x = defaultX;
        settings().y = defaultY;
    }

    public boolean hasHud() {
        return false;
    }

    /** Called every client tick, enabled or not (modules decide). */
    public void tick(Minecraft mc) {}

    /**
     * Draws the module with its top-left at (0, 0). `preview` is true in the menu and HUD editor, where
     * modules show sample content instead of hiding when there is nothing to show.
     * Returns {width, height}; {0, 0} means nothing was drawn.
     */
    public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
        return new int[]{0, 0};
    }

    public String initials() {
        String[] words = name.split(" ");
        StringBuilder out = new StringBuilder();
        for (String w : words) if (!w.isEmpty() && out.length() < 2) out.append(Character.toUpperCase(w.charAt(0)));
        return out.toString();
    }
}
