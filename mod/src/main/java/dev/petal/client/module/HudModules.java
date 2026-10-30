package dev.petal.client.module;

import dev.petal.client.config.ModuleSettings;
import dev.petal.client.ui.Draw;
import dev.petal.client.ui.Theme;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.multiplayer.PlayerInfo;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/** Every module that draws on the HUD. */
public final class HudModules {
    private HudModules() {}

    abstract static class Hud extends Module {
        Hud(String id, String name, String description, Category category, boolean on, float x, float y) {
            super(id, name, description, category, on, x, y);
        }

        @Override
        public boolean hasHud() {
            return true;
        }

        /** A pill: accent value then a soft label. */
        static int[] chip(GuiGraphics g, Font f, String value, String label, ModuleSettings s) {
            int w = 6 + f.width(value) + (label.isEmpty() ? 0 : 4 + f.width(label)) + 6;
            g.fill(0, 0, w, 16, Theme.hudBackground(s.opacity));
            g.drawString(f, value, 6, 4, s.accent, false);
            if (!label.isEmpty()) g.drawString(f, label, 6 + f.width(value) + 4, 4, Theme.SOFT, false);
            return new int[]{w, 16};
        }
    }

    public static final class Fps extends Hud {
        public Fps() { super("fps", "FPS", "Frames per second.", Category.HUD, true, 0.01f, 0.01f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            return chip(g, mc.font, String.valueOf(mc.getFps()), "FPS", s);
        }
    }

    public static final class Ping extends Hud {
        public Ping() { super("ping", "Ping", "Live latency to the server.", Category.HUD, true, 0.24f, 0.01f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            int ms = -1;
            if (mc.getConnection() != null && mc.player != null) {
                PlayerInfo info = mc.getConnection().getPlayerInfo(mc.player.getUUID());
                if (info != null) ms = info.getLatency();
            }
            if (ms < 0 && !preview) return new int[]{0, 0};
            return chip(g, mc.font, ms < 0 ? "18" : String.valueOf(ms), "ms", s);
        }
    }

    public static final class Clock extends Hud {
        public Clock() { super("clock", "Clock", "Real-world time.", Category.HUD, false, 0.99f, 0.01f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            LocalTime t = LocalTime.now();
            return chip(g, mc.font, String.format("%02d:%02d", t.getHour(), t.getMinute()), "", s);
        }
    }

    public static final class Coordinates extends Hud {
        public Coordinates() { super("coords", "Coordinates", "Position, facing and matching portal coordinates.", Category.SURVIVAL, true, 0.99f, 0.12f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            String xyz = "128  64  -912";
            String facing = "North";
            if (mc.player != null) {
                xyz = mc.player.getBlockX() + "  " + mc.player.getBlockY() + "  " + mc.player.getBlockZ();
                String dir = mc.player.getDirection().getName();
                facing = Character.toUpperCase(dir.charAt(0)) + dir.substring(1);
            }
            Font f = mc.font;
            int w = Math.max(110, 12 + f.width("Facing") + 10 + Math.max(f.width(xyz), f.width(facing)));
            String portal = "Nether XZ: 16  -114";
            if (mc.player != null && mc.level != null) {
                portal = mc.level.dimension().equals(Level.OVERWORLD)
                    ? "Nether XZ: " + Math.floorDiv(mc.player.getBlockX(), 8) + "  " + Math.floorDiv(mc.player.getBlockZ(), 8)
                    : mc.level.dimension().equals(Level.NETHER)
                    ? "Overworld XZ: " + mc.player.getBlockX() * 8 + "  " + mc.player.getBlockZ() * 8
                    : "Portal coordinates: Overworld / Nether only";
            }
            w = Math.max(w, mc.font.width(portal) + 12);
            g.fill(0, 0, w, 40, Theme.hudBackground(s.opacity));
            g.drawString(f, "XYZ", 6, 5, Theme.SOFT, false);
            g.drawString(f, xyz, w - 6 - f.width(xyz), 5, Theme.TEXT, false);
            g.drawString(f, "Facing", 6, 16, Theme.SOFT, false);
            g.drawString(f, facing, w - 6 - f.width(facing), 16, s.accent, false);
            g.drawString(f, portal, 6, 28, Theme.MINT, false);
            return new int[]{w, 40};
        }
    }

    public static final class Armor extends Hud {
        private static final EquipmentSlot[] SLOTS = {EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET};

        public Armor() { super("armor", "Armour Status", "Durability for every worn piece.", Category.SURVIVAL, false, 0.01f, 0.72f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            List<ItemStack> worn = new ArrayList<>();
            if (mc.player != null) for (EquipmentSlot slot : SLOTS) {
                ItemStack stack = mc.player.getItemBySlot(slot);
                if (!stack.isEmpty()) worn.add(stack);
            }
            if (worn.isEmpty() && !preview) return new int[]{0, 0};
            int rows = worn.isEmpty() ? 4 : worn.size();
            int w = 104, h = rows * 20;
            for (int i = 0; i < rows; i++) {
                int y = i * 20;
                g.fill(0, y, w, y + 18, Theme.hudBackground(s.opacity));
                float frac = 0.9f;
                if (!worn.isEmpty()) {
                    ItemStack stack = worn.get(i);
                    g.renderItem(stack, 2, y + 1);
                    frac = stack.isDamageableItem() ? 1f - (float) stack.getDamageValue() / Math.max(1, stack.getMaxDamage()) : 1f;
                } else {
                    g.fill(4, y + 3, 16, y + 15, Theme.TRACK);
                }
                Draw.bar(g, 22, y + 7, 46, 4, frac, frac < 0.5f ? Theme.BLUSH : Theme.MINT, Theme.TRACK);
                String pct = Math.round(frac * 100) + "%";
                g.drawString(mc.font, pct, w - 5 - mc.font.width(pct), y + 5, Theme.SOFT, false);
            }
            return new int[]{w, h - 2};
        }
    }

    public static final class Potions extends Hud {
        public Potions() { super("potions", "Potion Effects", "Active effects with countdowns.", Category.SURVIVAL, false, 0.01f, 0.1f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            List<String[]> rows = new ArrayList<>();
            List<Integer> colors = new ArrayList<>();
            if (mc.player != null) {
                List<MobEffectInstance> effects = new ArrayList<>(mc.player.getActiveEffects());
                effects.sort(Comparator.comparingInt(MobEffectInstance::getDuration).reversed());
                for (MobEffectInstance e : effects) {
                    String name = e.getEffect().value().getDisplayName().getString();
                    if (e.getAmplifier() > 0) name += " " + roman(e.getAmplifier() + 1);
                    String time = e.isInfiniteDuration() ? "∞" : Tracker.duration(e.getDuration() * 50L);
                    rows.add(new String[]{name, time});
                    colors.add(e.getEffect().value().getColor() | 0xFF000000);
                }
            }
            if (rows.isEmpty()) {
                if (!preview) return new int[]{0, 0};
                rows.add(new String[]{"Speed II", "2:41"});
                colors.add(Theme.MINT);
                rows.add(new String[]{"Haste III", "4:10"});
                colors.add(Theme.BLUSH);
            }
            Font f = mc.font;
            int w = 90;
            for (String[] r : rows) w = Math.max(w, 18 + f.width(r[0]) + 10 + f.width(r[1]) + 6);
            for (int i = 0; i < rows.size(); i++) {
                int y = i * 18;
                g.fill(0, y, w, y + 16, Theme.hudBackground(s.opacity));
                g.fill(6, y + 5, 12, y + 11, colors.get(i));
                g.drawString(f, rows.get(i)[0], 18, y + 4, Theme.TEXT, false);
                g.drawString(f, rows.get(i)[1], w - 6 - f.width(rows.get(i)[1]), y + 4, Theme.SOFT, false);
            }
            return new int[]{w, rows.size() * 18 - 2};
        }

        private static String roman(int n) {
            String[] r = {"", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"};
            return n < r.length ? r[n] : String.valueOf(n);
        }
    }

    public static final class BlockCounter extends Hud {
        public BlockCounter() { super("blocks", "Block Counter", "Blocks broken this session, per minute.", Category.BUILDING, true, 0.99f, 0.98f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            int blocks = Tracker.blocksBroken;
            double minutes = Math.max(1, Tracker.sessionMillis()) / 60000.0;
            int perMin = Tracker.sessionMillis() < 10000 ? 0 : (int) Math.round(blocks / minutes);
            return chip(g, mc.font, String.format(Locale.ROOT, "%,d", blocks), "blocks · " + perMin + "/min", s);
        }
    }

    public static final class SessionTimer extends Hud {
        public SessionTimer() { super("session", "Session Timer", "How long you've been on this server or world.", Category.UTILITY, false, 0.99f, 0.06f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            return chip(g, mc.font, Tracker.duration(Tracker.sessionMillis()), "session", s);
        }
    }

    public static final class ServerAddress extends Hud {
        public ServerAddress() { super("server", "Server Address", "The server you're connected to.", Category.UTILITY, false, 0.5f, 0.01f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            String ip = mc.getCurrentServer() != null ? mc.getCurrentServer().ip : (mc.hasSingleplayerServer() ? "Singleplayer" : "Menu");
            return chip(g, mc.font, ip, "", s);
        }
    }

}
