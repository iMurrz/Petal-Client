package dev.petal.client.screen;

import dev.petal.client.module.Module;
import dev.petal.client.module.ModuleManager;
import dev.petal.client.ui.Theme;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

/** Re-enable hidden HUD modules without leaving the layout editor. */
public final class HudModulesScreen extends Screen {
    private final Screen parent;

    public HudModulesScreen(Screen parent) {
        super(Component.literal("HUD modules"));
        this.parent = parent;
    }

    private static Component label(Module module) {
        return Component.literal((module.enabled() ? "On: " : "Off: ") + module.name);
    }

    @Override
    protected void init() {
        var modules = ModuleManager.all().stream().filter(Module::hasHud).toList();
        int bw = Math.min(156, (width - 28) / 2);
        int left = (width - bw * 2 - 6) / 2;
        int rows = (modules.size() + 1) / 2;
        int top = Math.max(30, (height - rows * 23 - 36) / 2);
        for (int i = 0; i < modules.size(); i++) {
            Module module = modules.get(i);
            addRenderableWidget(Button.builder(label(module), button -> {
                module.setEnabled(!module.enabled());
                button.setMessage(label(module));
            }).bounds(left + (i % 2) * (bw + 6), top + (i / 2) * 23, bw, 20).build());
        }
        addRenderableWidget(Button.builder(Component.literal("Back to editor"), button -> onClose())
            .bounds((width - 132) / 2, top + rows * 23 + 8, 132, 20).build());
    }

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        g.fill(0, 0, width, height, Theme.PANEL);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        g.drawCenteredString(font, title, width / 2, 12, Theme.PINK);
        super.render(g, mouseX, mouseY, partialTick);
    }

    @Override
    public boolean isPauseScreen() { return false; }

    @Override
    public void onClose() { minecraft.setScreen(parent); }
}
