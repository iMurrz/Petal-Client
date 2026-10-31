package dev.petal.client.screen;

import dev.petal.client.ui.Draw;
import dev.petal.client.ui.Dusk;
import dev.petal.client.ui.GlassButton;
import dev.petal.client.ui.Glyphs;
import dev.petal.client.ui.Theme;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.CreditsAndAttributionScreen;
import net.minecraft.client.gui.screens.DirectJoinServerScreen;
import net.minecraft.client.gui.screens.ManageServerScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.ShareToLanScreen;
import net.minecraft.client.gui.screens.achievement.StatsScreen;
import net.minecraft.client.gui.screens.advancements.AdvancementsScreen;
import net.minecraft.client.gui.screens.multiplayer.JoinMultiplayerScreen;
import net.minecraft.client.gui.screens.multiplayer.SafetyScreen;
import net.minecraft.client.gui.screens.options.OptionsScreen;
import net.minecraft.client.gui.screens.options.UnsupportedGraphicsWarningScreen;
import net.minecraft.client.gui.screens.packs.PackSelectionScreen;
import net.minecraft.client.gui.screens.worldselection.CreateWorldScreen;
import net.minecraft.client.gui.screens.worldselection.EditGameRulesScreen;
import net.minecraft.client.gui.screens.worldselection.EditWorldScreen;
import net.minecraft.client.gui.screens.worldselection.ExperimentsScreen;
import net.minecraft.client.gui.screens.worldselection.SelectWorldScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.contents.TranslatableContents;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

/**
 * Puts Minecraft's own menus (Settings and every settings page, Singleplayer, Multiplayer, resource packs,
 * statistics and advancements) inside Petal's side menu. The vanilla screen is laid out SIDE pixels
 * narrower and drawn shifted right; the side menu's buttons sit at negative x in the screen's own
 * coordinates, so focus, keyboard navigation and narration keep working. ScreenMixin and
 * MouseHandlerMixin apply the shift. Other mods' screens are never framed.
 */
public final class PetalFrame {
    /** Width of the side menu in GUI pixels. */
    public static final int SIDE = 124;
    /** Below this much room for the vanilla screen, the side menu steps aside (large GUI scales). */
    private static final int MIN_CONTENT = 320;
    private static final int PAD = 8;
    private static final int HEADER = 40;
    private static final int FOOTER = 22;

    /** True while a framed screen is drawing, so scissor hit tests can follow the shift. */
    public static boolean rendering;

    /** Added to Screen by ScreenMixin. */
    public interface Framed {
        boolean petal$framed();
    }

    public enum Section { HOME, SINGLEPLAYER, MULTIPLAYER, SETTINGS, PACKS, ADVANCEMENTS, STATS, OTHER }

    private PetalFrame() {}

    /** Which part of the menu a vanilla screen belongs to, or null when it should not be framed. */
    public static Section section(Screen screen) {
        Class<?> c = screen.getClass();
        String name = c.getName();
        if (c == UnsupportedGraphicsWarningScreen.class) return null;
        if (name.startsWith("net.minecraft.client.gui.screens.options.") || c == CreditsAndAttributionScreen.class) return Section.SETTINGS;
        if (c == JoinMultiplayerScreen.class || c == SafetyScreen.class || c == ManageServerScreen.class || c == DirectJoinServerScreen.class) return Section.MULTIPLAYER;
        if (c == SelectWorldScreen.class || c == CreateWorldScreen.class || c == EditWorldScreen.class || c == EditGameRulesScreen.class || c == ExperimentsScreen.class) return Section.SINGLEPLAYER;
        if (c == PackSelectionScreen.class) {
            // The same screen picks data packs during world creation; only the resource pack one is "Packs".
            return screen.getTitle().getContents() instanceof TranslatableContents t && "resourcePack.title".equals(t.getKey()) ? Section.PACKS : Section.OTHER;
        }
        if (c == StatsScreen.class) return Section.STATS;
        if (c == AdvancementsScreen.class) return Section.ADVANCEMENTS;
        if (c == ShareToLanScreen.class) return Section.OTHER;
        return null;
    }

    public static boolean wants(Screen screen, int fullWidth) {
        return fullWidth - SIDE >= MIN_CONTENT && section(screen) != null;
    }

    /** How far the current screen is shifted right: SIDE while a framed screen is open, otherwise 0. */
    public static int offset() {
        return Minecraft.getInstance().screen instanceof Framed f && f.petal$framed() ? SIDE : 0;
    }

    private record Item(Section section, String label, String[] icon, Runnable open) {}

    private static List<Item> items(Minecraft mc) {
        List<Item> out = new ArrayList<>();
        boolean inGame = mc.level != null;
        if (inGame) {
            out.add(new Item(null, "Resume", Glyphs.PLAY, () -> mc.setScreen(null)));
            out.add(new Item(Section.HOME, "Game menu", Glyphs.HOME, () -> mc.setScreen(new PetalPauseScreen())));
        } else {
            out.add(new Item(Section.HOME, "Home", Glyphs.HOME, () -> mc.setScreen(new PetalTitleScreen())));
            out.add(new Item(Section.SINGLEPLAYER, "Singleplayer", Glyphs.CUBE, () -> mc.setScreen(new SelectWorldScreen(home(mc)))));
            if (mc.allowsMultiplayer()) out.add(new Item(Section.MULTIPLAYER, "Multiplayer", Glyphs.SERVERS, () -> {
                Screen home = home(mc);
                mc.setScreen(mc.options.skipMultiplayerWarning ? new JoinMultiplayerScreen(home) : new SafetyScreen(home));
            }));
        }
        out.add(new Item(Section.SETTINGS, "Settings", Glyphs.SLIDERS, () -> mc.setScreen(new OptionsScreen(home(mc), mc.options))));
        out.add(new Item(Section.PACKS, "Resource packs", Glyphs.PACKS, () -> mc.setScreen(packs(mc))));
        if (inGame && mc.player != null) {
            out.add(new Item(Section.ADVANCEMENTS, "Advancements", Glyphs.TROPHY, () -> mc.setScreen(new AdvancementsScreen(mc.player.connection.getAdvancements(), home(mc)))));
            out.add(new Item(Section.STATS, "Statistics", Glyphs.CHART, () -> mc.setScreen(new StatsScreen(home(mc), mc.player.getStats()))));
        }
        out.add(new Item(null, "Petal mods", Glyphs.GRID, () -> mc.setScreen(new PetalMenuScreen())));
        return out;
    }

    /** Where Back leads from a page opened in the side menu. */
    private static Screen home(Minecraft mc) {
        return mc.level == null ? new PetalTitleScreen() : new PetalPauseScreen();
    }

    private static Screen packs(Minecraft mc) {
        Supplier<Screen> back = () -> home(mc);
        return new PackSelectionScreen(mc.getResourcePackRepository(), repository -> {
            mc.options.updateResourcePacks(repository);
            mc.setScreen(back.get());
        }, mc.getResourcePackDirectory(), Component.translatable("resourcePack.title"));
    }

    /** The side menu's buttons for `screen`, laid out for its height. */
    public static List<GlassButton> buttons(Screen screen) {
        Minecraft mc = Minecraft.getInstance();
        Section current = section(screen);
        List<GlassButton> out = new ArrayList<>();
        for (Item item : items(mc)) {
            boolean here = item.section != null && item.section == current;
            GlassButton b = new GlassButton(0, 0, SIDE - PAD * 2, 20, Component.literal(item.label),
                here ? GlassButton.Style.BLOOM : GlassButton.Style.GLASS, item.open).icon(item.icon);
            out.add(b);
        }
        layout(out, screen.height);
        return out;
    }

    /** Stacks the buttons under the header, shrinking them on short screens so they never overlap the footer. */
    public static void layout(List<GlassButton> buttons, int height) {
        if (buttons.isEmpty()) return;
        int room = height - HEADER - FOOTER;
        int h = Math.max(14, Math.min(20, room / buttons.size() - 3));
        int gap = Math.max(2, Math.min(4, room / buttons.size() - h));
        int y = HEADER;
        for (GlassButton b : buttons) {
            b.setRectangle(SIDE - PAD * 2, h, -SIDE + PAD, y);
            y += h + gap;
        }
    }

    /**
     * Backdrop for a framed screen, drawn in the screen's shifted coordinates: the dusk sky (or the dimmed
     * world while playing) across the whole window, then the side menu's panel and header.
     */
    public static void backdrop(GuiGraphics g, Screen screen) {
        Minecraft mc = Minecraft.getInstance();
        int w = screen.width, h = screen.height;
        if (mc.level == null) {
            g.pose().pushMatrix();
            g.pose().translate(-SIDE, 0);
            Dusk.render(g, w + SIDE, h);
            g.pose().popMatrix();
            g.fill(0, 0, w, h, 0x9E0B0612);
        } else {
            g.fill(-SIDE, 0, w, h, 0xB30B0612);
        }

        g.fill(-SIDE, 0, 0, h, 0xE612091E);
        g.fill(-1, 0, 0, h, Theme.GLASS_LINE);
        int x = -SIDE + PAD;
        Draw.logo(g, x + 2, 13, 2, Theme.BLOOM);
        g.drawString(mc.font, "Petal", x + 22, 13, Theme.FROST, false);
        Draw.small(g, mc.font, mc.level == null ? "MAIN MENU" : "PAUSED", x + 22, 24, 0xFFFF9ACF, 0.75f);

        String version = FabricLoader.getInstance().getModContainer("petal").map(c -> c.getMetadata().getVersion().getFriendlyString()).orElse("");
        String footer = mc.font.plainSubstrByWidth("ESC  BACK  ·  " + version, (int) ((SIDE - PAD * 2) / 0.75f));
        Draw.small(g, mc.font, footer, x, h - 13, Theme.HAZE, 0.75f);
    }
}
