package dev.petal.client.module;

import dev.petal.client.config.ModuleSettings;
import dev.petal.client.ui.Theme;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.core.BlockPos;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.LightLayer;
import net.minecraft.world.level.block.CropBlock;
import net.minecraft.world.level.block.FarmBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;

import java.util.List;

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
}
