package dev.petal.client.screen;

import dev.petal.client.module.Tracker;
import dev.petal.client.ui.Draw;
import dev.petal.client.ui.GlassButton;
import dev.petal.client.ui.Glyphs;
import dev.petal.client.ui.Theme;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.ShareToLanScreen;
import net.minecraft.client.gui.screens.achievement.StatsScreen;
import net.minecraft.client.gui.screens.advancements.AdvancementsScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.network.chat.CommonComponents;
import net.minecraft.network.chat.Component;

import java.util.Locale;

/**
 * Petal 2.0 pause menu. Covers the everyday actions; "More options" opens the vanilla pause menu for
 * everything else (feedback, player reporting, server links and server-provided dialogs).
 */
public final class PetalPauseScreen extends Screen {
    private static final int PANEL_W = 236;
    private static final int SIDE_W = 132;

    private int px, py, ph;
    /** Tighter rows on short windows (large GUI scales) so the panel never runs off the screen. */
    private boolean compact;

    public PetalPauseScreen() {
        super(Component.translatable("menu.game"));
    }

    @Override
    protected void init() {
        compact = height < 212;
        int row = compact ? 20 : 22, step = row + (compact ? 3 : 4);
        ph = compact ? 166 : 196;
        px = (width - PANEL_W) / 2;
        py = Math.max(4, (height - ph) / 2);
        int x = px + 14, w = PANEL_W - 28, half = (w - 6) / 2;
        int y = py + (compact ? 38 : 44);

        addRenderableWidget(new GlassButton(x, y, w, row + 2, Component.translatable("menu.returnToGame"), GlassButton.Style.BLOOM, this::onClose));
        y += row + (compact ? 6 : 8);

        GlassButton[] grid = {
            new GlassButton(0, 0, half, 22, Component.literal("Petal mods"), GlassButton.Style.GLASS, () -> minecraft.setScreen(new PetalMenuScreen())).icon(Glyphs.GRID),
            new GlassButton(0, 0, half, 22, Component.translatable("menu.options"), GlassButton.Style.GLASS, () -> minecraft.setScreen(new OptionsScreen(this, minecraft.options))).icon(Glyphs.SLIDERS),
            new GlassButton(0, 0, half, 22, Component.translatable("gui.advancements"), GlassButton.Style.GLASS, this::openAdvancements).icon(Glyphs.TROPHY),
            new GlassButton(0, 0, half, 22, Component.translatable("gui.stats"), GlassButton.Style.GLASS, this::openStats).icon(Glyphs.CHART),
            lanButton(half),
            new GlassButton(0, 0, half, 22, Component.literal("Edit HUD"), GlassButton.Style.GLASS, () -> minecraft.setScreen(new HudEditorScreen(this))).icon(Glyphs.FRAME)
        };
        for (int i = 0; i < grid.length; i++) {
            grid[i].setRectangle(half, row, x + (i % 2) * (half + 6), y + (i / 2) * step);
            addRenderableWidget(grid[i]);
        }
        y += 3 * step + 4;

        addRenderableWidget(new GlassButton(x, y, half, row, Component.literal("More options"), GlassButton.Style.GLASS, () -> {
            PetalScreens.allowVanillaPause();
            minecraft.setScreen(new PauseScreen(true));
        }).icon(Glyphs.MORE));
        addRenderableWidget(new GlassButton(x + half + 6, y, half, row, CommonComponents.disconnectButtonLabel(minecraft.isLocalServer()),
            GlassButton.Style.WARN, this::disconnect).icon(Glyphs.DOOR));
    }

    private GlassButton lanButton(int w) {
        GlassButton b = new GlassButton(0, 0, w, 22, Component.translatable("menu.shareToLan"), GlassButton.Style.GLASS,
            () -> minecraft.setScreen(new ShareToLanScreen(this))).icon(Glyphs.LAN);
        b.active = minecraft.hasSingleplayerServer() && !minecraft.getSingleplayerServer().isPublished();
        return b;
    }

    private void openAdvancements() {
        if (minecraft.player != null) minecraft.setScreen(new AdvancementsScreen(minecraft.player.connection.getAdvancements(), this));
    }

    private void openStats() {
        if (minecraft.player != null) minecraft.setScreen(new StatsScreen(this, minecraft.player.getStats()));
    }

    private void disconnect() {
        minecraft.getReportingContext().draftReportHandled(minecraft, this, () -> minecraft.disconnectFromWorld(ClientLevel.DEFAULT_QUIT_MESSAGE), true);
    }

    private String place() {
        if (minecraft.getCurrentServer() != null) return minecraft.getCurrentServer().name;
        if (minecraft.hasSingleplayerServer()) return minecraft.getSingleplayerServer().getWorldData().getLevelName();
        return "Paused";
    }

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        super.renderBackground(g, mouseX, mouseY, partialTick);
        g.fill(0, 0, width, height, 0x590B0612);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        Draw.round(g, px, py, px + PANEL_W, py + ph, 12, 0xB812091E);
        Draw.roundOutline(g, px, py, px + PANEL_W, py + ph, 12, Theme.GLASS_LINE);

        String where = font.plainSubstrByWidth(place().toUpperCase(Locale.ROOT), (int) ((PANEL_W - 80) / 0.75f));
        int head = compact ? -3 : 0;
        Draw.small(g, font, where, px + 14, py + 12 + head, 0xFFFF9ACF, 0.75f);
        g.pose().pushMatrix();
        g.pose().translate(px + 14, py + 22 + head);
        g.pose().scale(compact ? 1.25f : 1.5f, compact ? 1.25f : 1.5f);
        g.drawString(font, Component.translatable("menu.paused"), 0, 0, Theme.FROST, false);
        g.pose().popMatrix();

        int ping = ping();
        if (ping >= 0) {
            String chip = ping + " ms";
            int cw = Math.round(font.width(chip) * 0.75f) + 14, cx = px + PANEL_W - 14 - cw;
            Draw.round(g, cx, py + 14, cx + cw, py + 28, 7, 0x1F8FF5D2);
            Draw.small(g, font, chip, cx + 7, py + 18, Theme.SEAFOAM, 0.75f);
        }

        renderSession(g);
        super.render(g, mouseX, mouseY, partialTick);
    }

    private int ping() {
        if (minecraft.getCurrentServer() == null || minecraft.player == null || minecraft.getConnection() == null) return -1;
        PlayerInfo info = minecraft.getConnection().getPlayerInfo(minecraft.player.getUUID());
        return info == null ? -1 : info.getLatency();
    }

    /** "This session" card, only when there is room beside the menu. */
    private void renderSession(GuiGraphics g) {
        int sx = px + PANEL_W + 14;
        if (sx + SIDE_W > width - 8 || minecraft.player == null || minecraft.level == null) return;
        int sy = py, sh = 88;
        Draw.round(g, sx, sy, sx + SIDE_W, sy + sh, 10, 0xA812091E);
        Draw.roundOutline(g, sx, sy, sx + SIDE_W, sy + sh, 10, Theme.GLASS_LINE);
        Draw.small(g, font, "THIS SESSION", sx + 10, sy + 10, 0xFFD69BFF, 0.75f);
        var p = minecraft.player;
        String[][] rows = {
            {"Time played", Tracker.duration(Tracker.sessionMillis())},
            {"Blocks broken", String.format(Locale.ROOT, "%,d", Tracker.blocksBroken)},
            {"Position", p.getBlockX() + " " + p.getBlockY() + " " + p.getBlockZ()},
            {"Day", String.valueOf(minecraft.level.getDayTime() / 24000L + 1)}
        };
        int y = sy + 24;
        for (String[] row : rows) {
            Draw.small(g, font, row[0], sx + 10, y, Theme.LILAC, 0.75f);
            int vw = Math.round(font.width(row[1]) * 0.75f);
            Draw.small(g, font, row[1], sx + SIDE_W - 10 - vw, y, Theme.FROST, 0.75f);
            y += 15;
        }
    }

    @Override
    public boolean isPauseScreen() {
        return true;
    }
}
