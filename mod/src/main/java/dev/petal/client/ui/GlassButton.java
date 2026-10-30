package dev.petal.client.ui;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.AbstractButton;
import net.minecraft.client.gui.narration.NarrationElementOutput;
import net.minecraft.client.input.InputWithModifiers;
import net.minecraft.network.chat.Component;

/**
 * A real vanilla button (focus, keyboard and narration all work) drawn in the Petal 2.0 glass look.
 * Styles: glass panel, bloom gradient for the main action, or a rose-tinted warning.
 */
public final class GlassButton extends AbstractButton {
    public enum Style { GLASS, BLOOM, WARN }

    private final Style style;
    private final Runnable action;
    private String[] icon;
    private String subtitle;
    private boolean chevron;
    private boolean iconOnly;

    public GlassButton(int x, int y, int w, int h, Component label, Style style, Runnable action) {
        super(x, y, w, h, label);
        this.style = style;
        this.action = action;
    }

    public GlassButton icon(String[] glyph) { this.icon = glyph; return this; }
    public GlassButton subtitle(String text) { this.subtitle = text; return this; }
    public GlassButton chevron() { this.chevron = true; return this; }
    /** Square icon button; the label is still used for narration. */
    public GlassButton iconOnly(String[] glyph) { this.icon = glyph; this.iconOnly = true; return this; }

    @Override
    public void onPress(InputWithModifiers input) {
        action.run();
    }

    @Override
    protected void renderContents(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        Font font = Minecraft.getInstance().font;
        int x1 = getX(), y1 = getY(), x2 = getRight(), y2 = getBottom();
        int r = Math.min(8, height / 3);
        boolean lit = isHoveredOrFocused() && active;
        boolean bloom = style == Style.BLOOM || (lit && style == Style.GLASS && subtitle != null);

        if (bloom) {
            Draw.bloom(g, x1, y1, x2, y2, r);
            if (lit && style == Style.BLOOM) Draw.round(g, x1, y1, x2, y2, r, 0x22FFFFFF);
        } else if (style == Style.WARN) {
            Draw.round(g, x1, y1, x2, y2, r, lit ? 0x33E8248B : 0x1FE8248B);
            Draw.roundOutline(g, x1, y1, x2, y2, r, 0x73FF8ABF);
        } else {
            Draw.round(g, x1, y1, x2, y2, r, lit ? 0xB0221233 : 0x8C10081A);
            Draw.roundOutline(g, x1, y1, x2, y2, r, lit ? 0x60FFFFFF : Theme.GLASS_LINE);
        }

        int text = !active ? Theme.DIM : style == Style.WARN ? 0xFFFFC2E0 : 0xFFFFFFFF;
        if (iconOnly) {
            Glyphs.draw(g, icon, x1 + (width - 8) / 2, y1 + (height - 8) / 2, 1, text);
            return;
        }

        int tx = x1 + 8;
        if (icon != null) {
            if (subtitle != null) {
                int box = height - 8;
                Draw.round(g, x1 + 4, y1 + 4, x1 + 4 + box, y1 + 4 + box, Math.max(3, box / 3), bloom ? 0x2EFFFFFF : 0x1FD69BFF);
                Glyphs.draw(g, icon, x1 + 4 + (box - 8) / 2, y1 + 4 + (box - 8) / 2, 1, text);
                tx = x1 + 4 + box + 7;
            } else {
                Glyphs.draw(g, icon, x1 + 8, y1 + (height - 8) / 2, 1, style == Style.GLASS ? 0xFFFF9ACF : text);
                tx = x1 + 22;
            }
        }

        if (subtitle != null) {
            g.drawString(font, getMessage(), tx, y1 + height / 2 - 9, text, false);
            Draw.small(g, font, subtitle, tx, y1 + height / 2 + 2, bloom ? 0xD9FFFFFF : Theme.LILAC, 0.75f);
        } else if (icon == null) {
            g.drawCenteredString(font, getMessage(), x1 + width / 2, y1 + (height - 8) / 2, text);
        } else {
            g.drawString(font, getMessage(), tx, y1 + (height - 8) / 2, text, false);
        }
        if (chevron) Glyphs.draw(g, Glyphs.CHEVRON, x2 - 14, y1 + (height - 8) / 2, 1, 0xB3FFFFFF);
    }

    @Override
    protected void updateWidgetNarration(NarrationElementOutput output) {
        defaultButtonNarrationText(output);
    }
}
