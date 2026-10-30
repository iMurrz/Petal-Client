package dev.petal.client.screen;

import dev.petal.client.config.ModuleSettings;
import dev.petal.client.config.PetalConfig;
import dev.petal.client.hud.HudRenderer;
import dev.petal.client.module.Module;
import dev.petal.client.module.ModuleManager;
import dev.petal.client.ui.Draw;
import dev.petal.client.ui.Theme;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.input.KeyEvent;
import net.minecraft.client.input.MouseButtonEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Mth;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Drag HUD modules around, scroll to resize, right-click to hide. Snaps to screen centre lines. */
public final class HudEditorScreen extends Screen {
    private static final int SNAP = 4;
    private final Screen parent;
    private Module dragging;
    private Module selected;
    private double grabX, grabY;
    private boolean snapX, snapY;
    private int guideX, guideY;
    private final List<Module> order = new ArrayList<>();
    private final List<int[]> boxes = new ArrayList<>();

    public HudEditorScreen(Screen parent) {
        super(Component.literal("Petal HUD editor"));
        this.parent = parent;
    }

    public boolean isEditing() { return dragging != null; }

    @Override
    protected void init() {
        int bw = Math.min(106, (width - 24) / 3);
        int left = (width - bw * 3 - 8) / 2;
        int top = height - 26;
        addRenderableWidget(Button.builder(Component.literal("Reset positions"), button -> {
            for (Module module : ModuleManager.all()) if (module.hasHud()) module.resetPosition();
            selected = null;
            PetalConfig.save();
        }).bounds(left, top, bw, 20).build());
        addRenderableWidget(Button.builder(Component.literal("HUD modules"), button ->
            minecraft.setScreen(new HudModulesScreen(this))).bounds(left + bw + 4, top, bw, 20).build());
        addRenderableWidget(Button.builder(Component.literal("Done"), button -> onClose())
            .bounds(left + bw * 2 + 8, top, bw, 20).build());
    }

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        g.fill(0, 0, width, height, 0x55120A10);
        for (int x = 0; x < width; x += 16) g.fill(x, 0, x + 1, height, 0x14FBEFF5);
        for (int y = 0; y < height; y += 16) g.fill(0, y, width, y + 1, 0x14FBEFF5);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        if (snapX) g.fill(guideX, 0, guideX + 1, height, Theme.PINK);
        if (snapY) g.fill(0, guideY, width, guideY + 1, Theme.PINK);
        order.clear();
        boxes.clear();
        Module hovered = null;
        for (Module m : ModuleManager.all()) {
            if (!m.hasHud() || !m.enabled()) continue;
            int[] box = HudRenderer.drawPlaced(g, minecraft, m, true);
            order.add(m);
            boxes.add(box);
            if (Draw.inside(mouseX, mouseY, box[0], box[1], box[0] + box[2], box[1] + box[3])) hovered = m;
        }
        for (int i = 0; i < order.size(); i++) {
            int[] b = boxes.get(i);
            Module m = order.get(i);
            boolean active = m == dragging || m == selected || (dragging == null && m == hovered);
            Draw.outline(g, b[0] - 1, b[1] - 1, b[0] + b[2] + 1, b[1] + b[3] + 1, active ? Theme.PINK : 0x66FBEFF5);
            if (active) {
                String label = m.name + "  " + String.format(Locale.ROOT, "%.2f×", m.settings().scale);
                int ly = b[1] > 12 ? b[1] - 11 : b[1] + b[3] + 3;
                int lw = font.width(label) + 6;
                g.fill(b[0] - 1, ly - 1, b[0] - 1 + lw, ly + 9, Theme.PINK);
                g.drawString(font, label, b[0] + 2, ly, Theme.INK, false);
            }
        }

        String tip = selected == null ? "Drag · Scroll: size · Right-click: hide" : "Arrows: 1 px · Shift: 10 px · Esc: save";
        int tw = font.width(tip) + 16;
        int tx = (width - tw) / 2, ty = height - 48;
        Draw.chamfer(g, tx, ty, tx + tw, ty + 18, 5, Theme.PANEL);
        g.drawString(font, tip, tx + 8, ty + 5, Theme.SOFT, false);
        Draw.logo(g, tx - 20, ty + 2, 2, Theme.PINK);
        super.render(g, mouseX, mouseY, partialTick);
    }

    private int indexAt(double mx, double my) {
        for (int i = boxes.size() - 1; i >= 0; i--) {
            int[] b = boxes.get(i);
            if (Draw.inside(mx, my, b[0], b[1], b[0] + b[2], b[1] + b[3])) return i;
        }
        return -1;
    }

    @Override
    public boolean mouseClicked(MouseButtonEvent event, boolean doubleClick) {
        if (super.mouseClicked(event, doubleClick)) { selected = null; return true; }
        PetalConfig.reloadIfChanged();
        int i = indexAt(event.x(), event.y());
        if (i < 0) return super.mouseClicked(event, doubleClick);
        Module m = order.get(i);
        if (event.button() == 1) {
            m.setEnabled(false);
            if (selected == m) selected = null;
            return true;
        }
        if (event.button() == 0) {
            dragging = m;
            selected = m;
            setFocused(null);
            grabX = event.x() - boxes.get(i)[0];
            grabY = event.y() - boxes.get(i)[1];
            return true;
        }
        return false;
    }

    @Override
    public boolean mouseDragged(MouseButtonEvent event, double dx, double dy) {
        if (dragging == null) return super.mouseDragged(event, dx, dy);
        ModuleSettings s = dragging.settings();
        int w = Math.round(dragging.lastWidth * s.scale), h = Math.round(dragging.lastHeight * s.scale);
        double nx = event.x() - grabX, ny = event.y() - grabY;
        snapX = Math.abs(nx + w / 2.0 - width / 2.0) < SNAP;
        snapY = Math.abs(ny + h / 2.0 - height / 2.0) < SNAP;
        if (snapX) nx = width / 2.0 - w / 2.0;
        if (snapY) ny = height / 2.0 - h / 2.0;
        guideX = width / 2;
        guideY = height / 2;
        if (Math.abs(nx) < SNAP) { nx = 0; snapX = true; guideX = 0; }
        else if (Math.abs(nx + w - width) < SNAP) { nx = width - w; snapX = true; guideX = width - 1; }
        if (Math.abs(ny) < SNAP) { ny = 0; snapY = true; guideY = 0; }
        else if (Math.abs(ny + h - height) < SNAP) { ny = height - h; snapY = true; guideY = height - 1; }
        s.x = width > w ? Mth.clamp((float) (nx / (width - w)), 0f, 1f) : 0f;
        s.y = height > h ? Mth.clamp((float) (ny / (height - h)), 0f, 1f) : 0f;
        return true;
    }

    @Override
    public boolean mouseReleased(MouseButtonEvent event) {
        if (dragging != null) {
            dragging = null;
            snapX = snapY = false;
            PetalConfig.save();
            return true;
        }
        return super.mouseReleased(event);
    }

    @Override
    public boolean mouseScrolled(double mx, double my, double sx, double sy) {
        if (sy == 0) return false;
        int i = indexAt(mx, my);
        if (i < 0) return false;
        ModuleSettings s = order.get(i).settings();
        s.scale = Mth.clamp(Math.round((s.scale + (sy > 0 ? 0.05f : -0.05f)) * 20f) / 20f, 0.5f, 2f);
        PetalConfig.save();
        return true;
    }

    @Override
    public boolean keyPressed(KeyEvent event) {
        if (selected == null || !selected.enabled() || dragging != null) return super.keyPressed(event);
        int dx = event.key() == GLFW.GLFW_KEY_LEFT ? -1 : event.key() == GLFW.GLFW_KEY_RIGHT ? 1 : 0;
        int dy = event.key() == GLFW.GLFW_KEY_UP ? -1 : event.key() == GLFW.GLFW_KEY_DOWN ? 1 : 0;
        if (dx == 0 && dy == 0) return super.keyPressed(event);
        int step = (event.modifiers() & GLFW.GLFW_MOD_SHIFT) != 0 ? 10 : 1;
        ModuleSettings s = selected.settings();
        int freeX = width - Math.round(selected.lastWidth * s.scale);
        int freeY = height - Math.round(selected.lastHeight * s.scale);
        if (freeX > 0) s.x = Mth.clamp(s.x + dx * step / (float) freeX, 0f, 1f);
        if (freeY > 0) s.y = Mth.clamp(s.y + dy * step / (float) freeY, 0f, 1f);
        PetalConfig.save();
        return true;
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }

    @Override
    public void onClose() {
        PetalConfig.save();
        minecraft.setScreen(parent);
    }
}
