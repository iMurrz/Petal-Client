package dev.petal.client;

import com.mojang.blaze3d.platform.InputConstants;
import dev.petal.client.config.PetalConfig;
import dev.petal.client.cosmetic.CosmeticLayer;
import dev.petal.client.cosmetic.CosmeticTextures;
import dev.petal.client.cosmetic.Cosmetics;
import dev.petal.client.hud.HudRenderer;
import dev.petal.client.module.Module;
import dev.petal.client.module.ModuleManager;
import dev.petal.client.module.Tracker;
import dev.petal.client.screen.PetalMenuScreen;
import dev.petal.client.screen.HudEditorScreen;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientLifecycleEvents;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.LivingEntityFeatureRendererRegistrationCallback;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElement;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.fabricmc.fabric.api.event.client.player.ClientPlayerBlockBreakEvents;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.model.player.PlayerModel;
import net.minecraft.client.renderer.entity.RenderLayerParent;
import net.minecraft.client.renderer.entity.player.AvatarRenderer;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import net.minecraft.resources.Identifier;
import org.lwjgl.glfw.GLFW;

public final class PetalClient implements ClientModInitializer {
    public static final String MOD_ID = "petal";
    public static KeyMapping menuKey;
    public static KeyMapping zoomKey;
    public static KeyMapping freelookKey;
    public static KeyMapping measureKey;

    @Override
    public void onInitializeClient() {
        PetalConfig.load();

        KeyMapping.Category category = KeyMapping.Category.register(Identifier.fromNamespaceAndPath(MOD_ID, "petal"));
        menuKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.petal.menu", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_RIGHT_SHIFT, category));
        zoomKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.petal.zoom", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_C, category));
        freelookKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.petal.freelook", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_LEFT_ALT, category));
        measureKey = KeyBindingHelper.registerKeyBinding(new KeyMapping("key.petal.measure", InputConstants.Type.KEYSYM, GLFW.GLFW_KEY_B, category));

        HudElementRegistry.addLast(Identifier.fromNamespaceAndPath(MOD_ID, "hud"), HudRenderer::render);
        HudElementRegistry.replaceElement(VanillaHudElements.CROSSHAIR, vanilla -> (HudElement) (g, delta) -> {
            Minecraft mc = Minecraft.getInstance();
            if (ModuleManager.CROSSHAIR.enabled() && mc.options.getCameraType().isFirstPerson()) {
                ModuleManager.CROSSHAIR.render(g, ModuleManager.CROSSHAIR.settings());
            } else {
                vanilla.render(g, delta);
            }
        });

        ClientTickEvents.END_CLIENT_TICK.register(mc -> {
            boolean editing = mc.screen instanceof HudEditorScreen hud && hud.isEditing()
                || mc.screen instanceof PetalMenuScreen menu && menu.isEditing();
            PetalConfig.tick(editing);
            Tracker.tick(mc);
            Cosmetics.tick();
            for (Module m : ModuleManager.all()) m.tick(mc);
            while (menuKey.consumeClick()) {
                if (mc.screen == null) mc.setScreen(new PetalMenuScreen());
            }
        });

        ClientPlayerBlockBreakEvents.AFTER.register((level, player, pos, state) -> Tracker.onBlockBroken());

        ClientLifecycleEvents.CLIENT_STARTED.register(mc -> {
            CosmeticTextures.register(mc);
            Cosmetics.reloadIfChanged();
        });

        LivingEntityFeatureRendererRegistrationCallback.EVENT.register((type, renderer, helper, context) -> {
            if (renderer instanceof AvatarRenderer<?> avatar) {
                @SuppressWarnings("unchecked")
                RenderLayerParent<AvatarRenderState, PlayerModel> parent = (RenderLayerParent<AvatarRenderState, PlayerModel>) (Object) avatar;
                helper.register(new CosmeticLayer(parent));
            }
        });
    }
}
