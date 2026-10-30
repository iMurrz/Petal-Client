package dev.petal.client.screen;

import com.mojang.realmsclient.RealmsMainScreen;
import dev.petal.client.ui.Draw;
import dev.petal.client.ui.Dusk;
import dev.petal.client.ui.GlassButton;
import dev.petal.client.ui.Glyphs;
import dev.petal.client.ui.Theme;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.ConnectScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.multiplayer.SafetyScreen;
import net.minecraft.client.gui.screens.options.AccessibilityOptionsScreen;
import net.minecraft.client.gui.screens.options.LanguageSelectScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.client.multiplayer.ServerData;
import net.minecraft.client.multiplayer.ServerList;
import net.minecraft.client.multiplayer.resolver.ServerAddress;
import net.minecraft.network.chat.Component;
import net.minecraft.util.Util;

import java.io.File;
import java.util.function.Supplier;

/** Petal 2.0 title screen: dusk backdrop, main menu on the left, quick join for saved servers on the right. */
public final class PetalTitleScreen extends Screen {
    private static final int MARGIN = 28;
    private static final int NAV_W = 152;
    private static final int NAV_H = 26;
    private static final int QUICK_W = 170;
    private static final int MAX_SERVERS = 3;

    private int quickY, quickH, servers;

    public PetalTitleScreen() {
        super(Component.translatable("narrator.screen.title"));
    }

    private static String version(String mod) {
        return FabricLoader.getInstance().getModContainer(mod).map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("");
    }

    private int navTop() {
        return Math.max(MARGIN + 44, Math.min(92, height / 2 - 75));
    }

    @Override
    protected void init() {
        int y = navTop();
        nav(y, "Singleplayer", "Your worlds", Glyphs.HOME, () -> new SelectWorldScreen(this), true);
        nav(y += NAV_H + 4, "Multiplayer", "Servers and LAN", Glyphs.SERVERS,
            () -> minecraft.options.skipMultiplayerWarning ? new JoinMultiplayerScreen(this) : new SafetyScreen(this), minecraft.allowsMultiplayer());
        nav(y += NAV_H + 4, "Realms", "Your Realms", Glyphs.CLOUD, () -> new RealmsMainScreen(this), minecraft.allowsRealms());
        nav(y += NAV_H + 4, "Settings", "Video, controls, sound", Glyphs.SLIDERS, () -> new OptionsScreen(this, minecraft.options), true);
        addRenderableWidget(new GlassButton(MARGIN, y + NAV_H + 4, NAV_W, NAV_H, Component.literal("Screenshots"), GlassButton.Style.GLASS, this::openScreenshots)
            .icon(Glyphs.CAMERA).subtitle("Open the folder").chevron());

        int by = height - MARGIN - 20;
        addRenderableWidget(new GlassButton(MARGIN, by, 20, 20, Component.translatable("options.language"), GlassButton.Style.GLASS,
            () -> minecraft.setScreen(new LanguageSelectScreen(this, minecraft.options, minecraft.getLanguageManager()))).iconOnly(Glyphs.GLOBE));
        addRenderableWidget(new GlassButton(MARGIN + 24, by, 20, 20, Component.translatable("options.accessibility"), GlassButton.Style.GLASS,
            () -> minecraft.setScreen(new AccessibilityOptionsScreen(this, minecraft.options))).iconOnly(Glyphs.PERSON));
        addRenderableWidget(new GlassButton(MARGIN + 48, by, 64, 20, Component.translatable("menu.quit"), GlassButton.Style.GLASS, minecraft::stop));

        // Quick join: the first few saved servers.
        ServerList list = new ServerList(minecraft);
        list.load();
        servers = Math.min(MAX_SERVERS, list.size());
        int qx = width - MARGIN - QUICK_W;
        quickY = MARGIN;
        int ry = quickY + 26;
        for (int i = 0; i < servers; i++) {
            ServerData data = list.get(i);
            GlassButton row = new GlassButton(qx + 8, ry, QUICK_W - 16, 26, Component.literal(font.plainSubstrByWidth(data.name, QUICK_W - 60)),
                GlassButton.Style.GLASS, () -> join(data)).icon(Glyphs.SERVERS).subtitle(font.plainSubstrByWidth(data.ip, (int) ((QUICK_W - 60) / 0.75f))).chevron();
            row.active = minecraft.allowsMultiplayer();
            addRenderableWidget(row);
            ry += 30;
        }
        if (servers == 0) ry += 20;
        addRenderableWidget(new GlassButton(qx + 8, ry + 2, QUICK_W - 16, 18, Component.literal("All servers"), GlassButton.Style.BLOOM,
            () -> minecraft.setScreen(minecraft.options.skipMultiplayerWarning ? new JoinMultiplayerScreen(this) : new SafetyScreen(this))))
            .active = minecraft.allowsMultiplayer();
        quickH = ry + 28 - quickY;
    }

    private void nav(int y, String label, String sub, String[] icon, Supplier<Screen> next, boolean enabled) {
        GlassButton b = new GlassButton(MARGIN, y, NAV_W, NAV_H, Component.literal(label), GlassButton.Style.GLASS, () -> minecraft.setScreen(next.get()))
            .icon(icon).subtitle(sub).chevron();
        b.active = enabled;
        addRenderableWidget(b);
    }

    private void join(ServerData data) {
        ConnectScreen.startConnecting(this, minecraft, ServerAddress.parseString(data.ip), data, false, null);
    }

    private void openScreenshots() {
        File dir = new File(minecraft.gameDirectory, "screenshots");
        dir.mkdirs();
        Util.getPlatform().openPath(dir.toPath());
    }

    @Override
    public void renderBackground(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        Dusk.render(g, width, height);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float partialTick) {
        // Brand.
        Draw.logo(g, MARGIN, MARGIN + 2, 3, Theme.BLOOM);
        g.pose().pushMatrix();
        g.pose().translate(MARGIN + 28, MARGIN);
        g.pose().scale(2.5f, 2.5f);
        g.drawString(font, "Petal", 0, 0, Theme.FROST, true);
        g.pose().popMatrix();
        Draw.small(g, font, "MINECRAFT " + version("minecraft"), MARGIN + 29, MARGIN + 23, 0xFFE9D3F7, 0.75f);

        // Quick join panel.
        int qx = width - MARGIN - QUICK_W;
        Draw.round(g, qx, quickY, qx + QUICK_W, quickY + quickH, 10, 0xAD10081A);
        Draw.roundOutline(g, qx, quickY, qx + QUICK_W, quickY + quickH, 10, Theme.GLASS_LINE);
        g.drawString(font, "Quick join", qx + 10, quickY + 10, Theme.FROST, false);
        String tag = "SAVED";
        Draw.small(g, font, tag, qx + QUICK_W - 10 - Math.round(font.width(tag) * 0.75f), quickY + 11, 0xFFE9D3F7, 0.75f);
        if (servers == 0) Draw.small(g, font, "Servers you add in Multiplayer show up here.", qx + 10, quickY + 30, Theme.LILAC, 0.75f);

        // Account chip.
        String name = minecraft.getUser().getName();
        int cw = Math.max(90, font.width(name) + 36), cx = width - MARGIN - cw, cy = height - MARGIN - 24;
        Draw.round(g, cx, cy, cx + cw, cy + 24, 8, 0x9E10081A);
        Draw.roundOutline(g, cx, cy, cx + cw, cy + 24, 8, Theme.GLASS_LINE);
        Draw.round(g, cx + 4, cy + 4, cx + 20, cy + 20, 4, 0xFFC13BD8);
        g.fill(cx + 4, cy + 4, cx + 20, cy + 10, 0xFFE8B9A0);
        g.drawString(font, name, cx + 26, cy + 4, Theme.FROST, false);
        Draw.small(g, font, "Signed in", cx + 26, cy + 14, Theme.SEAFOAM, 0.75f);

        String footer = "Petal Client " + version("petal") + "  ·  Not an official Minecraft product  ·  Copyright Mojang AB";
        int fw = Math.round(font.width(footer) * 0.75f);
        Draw.small(g, font, footer, (width - fw) / 2, height - 10, 0xBFFFF0F8, 0.75f);

        super.render(g, mouseX, mouseY, partialTick);
    }

    @Override
    public boolean shouldCloseOnEsc() {
        return false;
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
