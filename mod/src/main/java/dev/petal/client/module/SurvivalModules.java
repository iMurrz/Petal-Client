package dev.petal.client.module;

import dev.petal.client.PetalClient;
import dev.petal.client.config.ModuleSettings;
import dev.petal.client.ui.Theme;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.core.BlockPos;
import net.minecraft.core.GlobalPos;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.util.Mth;
import net.minecraft.world.food.FoodData;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LightLayer;
import net.minecraft.world.level.block.CropBlock;
import net.minecraft.world.level.block.FarmBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Information from the visible world and the player's inventory; never performs actions for the player. */
public final class SurvivalModules {
    private SurvivalModules() {}

    private static int[] panel(GuiGraphics g, Minecraft mc, ModuleSettings settings, String title, List<String> lines) {
        int width = mc.font.width(title) + 12;
        for (String line : lines) width = Math.max(width, mc.font.width(line) + 12);
        width = Math.min(width, Math.max(80, Math.min(240, g.guiWidth() / 2)));
        int height = 18 + lines.size() * 12;
        g.fill(0, 0, width, height, Theme.hudBackground(settings.opacity));
        g.drawString(mc.font, title, 6, 5, settings.accent, false);
        for (int i = 0; i < lines.size(); i++) g.drawString(mc.font, mc.font.plainSubstrByWidth(lines.get(i), width - 12), 6, 18 + i * 12, Theme.TEXT, false);
        return new int[]{width, height};
    }

    public static final class CropCare extends HudModules.Hud {
        public CropCare() { super("cropcare", "Crop Care", "Look at a crop or farmland for growth and moisture.", Category.FARMING, true, 0.99f, 0.45f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            if (preview) return panel(g, mc, s, "CROP CARE", List.of("Wheat: ready to harvest", "Farmland moisture: 7 / 7"));
            if (mc.level == null || !(mc.hitResult instanceof BlockHitResult hit) || hit.getType() != HitResult.Type.BLOCK) return new int[]{0, 0};
            BlockPos pos = hit.getBlockPos();
            BlockState state = mc.level.getBlockState(pos);
            String growth;
            if (state.getBlock() instanceof CropBlock crop) {
                int age = crop.getAge(state), max = crop.getMaxAge();
                growth = state.getBlock().getName().getString() + ": " + (age == max ? "ready to harvest" : Math.round(age * 100f / max) + "% grown");
                state = mc.level.getBlockState(pos.below());
            } else if (state.getBlock() instanceof FarmBlock) {
                growth = "Farmland";
            } else return new int[]{0, 0};
            String moisture = state.hasProperty(FarmBlock.MOISTURE)
                ? "Moisture: " + state.getValue(FarmBlock.MOISTURE) + " / 7" : "No farmland below this crop";
            return panel(g, mc, s, "CROP CARE", List.of(growth, moisture));
        }
    }

    public static final class LocalLight extends HudModules.Hud {
        public LocalLight() { super("locallight", "Local Light", "Actual block and sky light at your feet for lighting builds and tunnels.", Category.BUILDING, true, 0.01f, 0.22f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            if (!preview && (mc.player == null || mc.level == null)) return new int[]{0, 0};
            int block = preview ? 12 : mc.level.getBrightness(LightLayer.BLOCK, mc.player.blockPosition());
            int sky = preview ? 15 : mc.level.getBrightness(LightLayer.SKY, mc.player.blockPosition());
            return panel(g, mc, s, "LOCAL LIGHT", List.of("Block: " + block + " / 15   Sky: " + sky + " / 15", "At your feet; spawn rules vary"));
        }
    }

    public static final class BuildSupplies extends HudModules.Hud {
        public BuildSupplies() { super("supplies", "Tools & Supplies", "Held-item stock and tool durability while building or gathering.", Category.BUILDING, true, 0.01f, 0.84f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            if (preview) return panel(g, mc, s, "TOOLS & SUPPLIES", List.of("Oak Planks: 192 in inventory", "3 stacks available"));
            if (mc.player == null) return new int[]{0, 0};
            ItemStack held = mc.player.getMainHandItem();
            if (held.isEmpty()) return new int[]{0, 0};
            int count = 0;
            for (int i = 0; i < mc.player.getInventory().getContainerSize(); i++) {
                ItemStack item = mc.player.getInventory().getItem(i);
                if (item.is(held.getItem())) count += item.getCount();
            }
            String status = held.isDamageableItem()
                ? "Durability: " + (held.getMaxDamage() - held.getDamageValue()) + " / " + held.getMaxDamage()
                : "Stacks: " + count / held.getMaxStackSize() + " + " + count % held.getMaxStackSize() + " items";
            return panel(g, mc, s, "TOOLS & SUPPLIES", List.of(held.getHoverName().getString() + ": " + count + " in inventory", status));
        }
    }

    public static final class TargetBlock extends HudModules.Hud {
        public TargetBlock() { super("targetblock", "Building Target", "Name and coordinates of the visible block under your crosshair.", Category.BUILDING, false, 0.99f, 0.7f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            if (preview) return panel(g, mc, s, "BUILDING TARGET", List.of("Stone Bricks", "128  64  -912"));
            if (mc.level == null || !(mc.hitResult instanceof BlockHitResult hit) || hit.getType() != HitResult.Type.BLOCK) return new int[]{0, 0};
            BlockPos pos = hit.getBlockPos();
            BlockState state = mc.level.getBlockState(pos);
            if (state.isAir()) return new int[]{0, 0};
            return panel(g, mc, s, "BUILDING TARGET", List.of(state.getBlock().getName().getString(), pos.getX() + "  " + pos.getY() + "  " + pos.getZ()));
        }
    }

    static String dimensionName(ResourceKey<Level> dimension) {
        if (dimension.equals(Level.OVERWORLD)) return "Overworld";
        if (dimension.equals(Level.NETHER)) return "Nether";
        if (dimension.equals(Level.END)) return "End";
        return "another dimension";
    }

    /** "ahead", "behind left" and so on, from the player's facing to a block. Yaw grows clockwise from south. */
    static String relativeDirection(Minecraft mc, BlockPos target) {
        double dx = target.getX() + 0.5 - mc.player.getX();
        double dz = target.getZ() + 0.5 - mc.player.getZ();
        float towards = (float) Math.toDegrees(Math.atan2(-dx, dz));
        float rel = Mth.wrapDegrees(towards - mc.player.getYRot());
        String[] names = {"ahead", "ahead right", "right", "behind right", "behind", "behind left", "left", "ahead left"};
        int sector = Math.floorMod(Math.round(rel / 45f), 8);
        return names[sector];
    }

    /** Where you last died (the server sends this to your client), until you walk back to it. */
    public static final class DeathPoint extends HudModules.Hud {
        private GlobalPos recovered;

        public DeathPoint() { super("deathpoint", "Death Point", "Distance and direction back to where you last died. Hides once you reach it.", Category.SURVIVAL, true, 0.99f, 0.3f); }

        @Override
        public void tick(Minecraft mc) {
            if (mc.player == null || mc.level == null) return;
            GlobalPos death = mc.player.getLastDeathLocation().orElse(null);
            if (death != null && death.dimension().equals(mc.level.dimension())
                    && death.pos().closerToCenterThan(mc.player.position(), 3.0)) recovered = death;
        }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            if (preview) return panel(g, mc, s, "DEATH POINT", List.of("-214  31  880  (Overworld)", "143 blocks, ahead left, 33 below"));
            if (mc.player == null || mc.level == null) return new int[]{0, 0};
            GlobalPos death = mc.player.getLastDeathLocation().orElse(null);
            if (death == null || death.equals(recovered)) return new int[]{0, 0};
            BlockPos pos = death.pos();
            String where = pos.getX() + "  " + pos.getY() + "  " + pos.getZ() + "  (" + dimensionName(death.dimension()) + ")";
            if (!death.dimension().equals(mc.level.dimension())) return panel(g, mc, s, "DEATH POINT", List.of(where, "You're in the " + dimensionName(mc.level.dimension())));
            double dx = pos.getX() + 0.5 - mc.player.getX(), dz = pos.getZ() + 0.5 - mc.player.getZ();
            int distance = (int) Math.round(Math.sqrt(dx * dx + dz * dz));
            int dy = pos.getY() - mc.player.getBlockY();
            String height = dy == 0 ? "" : ", " + Math.abs(dy) + (dy > 0 ? " above" : " below");
            return panel(g, mc, s, "DEATH POINT", List.of(where, distance + " blocks, " + relativeDirection(mc, pos) + height));
        }
    }

    /** In-game day, time and how long until you can sleep. */
    public static final class WorldClock extends HudModules.Hud {
        private static final int BED_TIME = 12542;
        private static final int WAKE_TIME = 23460;

        public WorldClock() { super("worldclock", "World Clock", "In-game day, time and how long until you can sleep.", Category.SURVIVAL, false, 0.01f, 0.32f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            if (preview) return panel(g, mc, s, "DAY 42  ·  16:30", List.of("Night in 3:12"));
            if (mc.level == null) return new int[]{0, 0};
            long dayTime = mc.level.getDayTime();
            int tod = (int) Math.floorMod(dayTime, 24000L);
            int shifted = (tod + 6000) % 24000;
            String title = "DAY " + (Math.floorDiv(dayTime, 24000L) + 1) + "  ·  " + String.format(Locale.ROOT, "%02d:%02d", shifted / 1000, shifted % 1000 * 60 / 1000);
            String status;
            if (!mc.level.dimension().equals(Level.OVERWORLD)) status = "No day and night here";
            else if (mc.level.isThundering()) status = "Thunderstorm: you can sleep";
            else if (tod < BED_TIME) status = "Night in " + Tracker.duration((BED_TIME - tod) * 50L);
            else if (tod < WAKE_TIME) status = "You can sleep  ·  morning in " + Tracker.duration((24000 - tod) * 50L);
            else status = "Sunrise";
            return panel(g, mc, s, title, List.of(status));
        }
    }

    public static final class Hunger extends HudModules.Hud {
        public Hunger() { super("hunger", "Hunger & Saturation", "Your food points plus the hidden saturation that stops hunger dropping.", Category.SURVIVAL, false, 0.01f, 0.6f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            int food = 18;
            float saturation = 5.2f;
            if (mc.player != null) {
                FoodData data = mc.player.getFoodData();
                food = data.getFoodLevel();
                saturation = data.getSaturationLevel();
            } else if (!preview) return new int[]{0, 0};
            return HudModules.Hud.chip(g, mc.font, food + "/20", String.format(Locale.ROOT, "food  ·  %.1f saturation", saturation), s);
        }
    }

    public static final class InventorySpace extends HudModules.Hud {
        private static final int MAIN_SLOTS = 36;

        public InventorySpace() { super("invspace", "Inventory Space", "Free inventory slots, so you head home before your pockets fill.", Category.SURVIVAL, false, 0.01f, 0.66f); }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            int free = 9;
            if (mc.player != null) {
                free = 0;
                for (int i = 0; i < MAIN_SLOTS; i++) if (mc.player.getInventory().getItem(i).isEmpty()) free++;
            } else if (!preview) return new int[]{0, 0};
            String label = free == 1 ? "free slot" : "free slots";
            if (free > 0) return HudModules.Hud.chip(g, mc.font, String.valueOf(free), label, s);
            int w = 6 + mc.font.width("Inventory full") + 6;
            g.fill(0, 0, w, 16, Theme.hudBackground(s.opacity));
            g.drawString(mc.font, "Inventory full", 6, 4, Theme.BLUSH, false);
            return new int[]{w, 16};
        }
    }

    /** Mark two corners with the measure key to see a build's size and block count. */
    public static final class BuilderMeasure extends HudModules.Hud {
        private BlockPos first;
        private BlockPos second;
        private Object level;

        public BuilderMeasure() { super("measure", "Builder Measure", "Press B on two corners to see the width, height, length and block count between them.", Category.BUILDING, true, 0.99f, 0.58f); }

        @Override
        public void tick(Minecraft mc) {
            if (mc.level != level) { level = mc.level; first = null; second = null; }
            if (PetalClient.measureKey == null) return;
            while (PetalClient.measureKey.consumeClick()) {
                if (!enabled() || mc.player == null || mc.level == null) continue;
                if (!(mc.hitResult instanceof BlockHitResult hit) || hit.getType() != HitResult.Type.BLOCK) {
                    first = null;
                    second = null;
                    mc.player.displayClientMessage(Component.literal("Measure cleared"), true);
                } else if (first == null || second != null) {
                    first = hit.getBlockPos();
                    second = null;
                    mc.player.displayClientMessage(Component.literal("First corner marked. Press " + key() + " on the second corner."), true);
                } else {
                    second = hit.getBlockPos();
                    mc.player.displayClientMessage(Component.literal("Second corner marked"), true);
                }
            }
        }

        private static String key() {
            return PetalClient.measureKey.getTranslatedKeyMessage().getString();
        }

        @Override
        public int[] draw(GuiGraphics g, Minecraft mc, ModuleSettings s, boolean preview) {
            if (preview) return panel(g, mc, s, "MEASURE", List.of("12 wide  ·  7 high  ·  20 long", "1,680 blocks  ·  240 per layer"));
            if (first == null || mc.level == null) return new int[]{0, 0};
            BlockPos end = second;
            boolean live = end == null;
            if (live) {
                if (!(mc.hitResult instanceof BlockHitResult hit) || hit.getType() != HitResult.Type.BLOCK) {
                    return panel(g, mc, s, "MEASURE", List.of("From " + first.getX() + "  " + first.getY() + "  " + first.getZ(), "Look at the second corner"));
                }
                end = hit.getBlockPos();
            }
            int w = Math.abs(end.getX() - first.getX()) + 1;
            int h = Math.abs(end.getY() - first.getY()) + 1;
            int l = Math.abs(end.getZ() - first.getZ()) + 1;
            List<String> lines = new ArrayList<>();
            lines.add(w + " wide  ·  " + h + " high  ·  " + l + " long");
            lines.add(String.format(Locale.ROOT, "%,d blocks  ·  %,d per layer", (long) w * h * l, (long) w * l));
            lines.add(live ? "Press " + key() + " to mark this corner" : "Press " + key() + " to start again");
            return panel(g, mc, s, live ? "MEASURE  ·  AIMING" : "MEASURE", lines);
        }
    }
}
