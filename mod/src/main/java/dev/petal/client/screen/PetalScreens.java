package dev.petal.client.screen;

import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.PauseScreen;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.client.gui.screens.TitleScreen;

/** Swaps the vanilla title and pause screens for Petal's. Called from MinecraftMixin on every setScreen. */
public final class PetalScreens {
    private static boolean vanillaPauseOnce;

    private PetalScreens() {}

    /** Lets the next pause screen through unchanged, for "More options". */
    public static void allowVanillaPause() {
        vanillaPauseOnce = true;
    }

    public static Screen replace(Screen screen) {
        if (screen == null) return null;
        // Exact classes only, so subclasses and other mods' screens are left alone.
        if (screen.getClass() == TitleScreen.class && !Minecraft.getInstance().isDemo()) return new PetalTitleScreen();
        if (screen.getClass() == PauseScreen.class && ((PauseScreen) screen).showsPauseMenu()) {
            if (vanillaPauseOnce) {
                vanillaPauseOnce = false;
                return screen;
            }
            return new PetalPauseScreen();
        }
        return screen;
    }
}
