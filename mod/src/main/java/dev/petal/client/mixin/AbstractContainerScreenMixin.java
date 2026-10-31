package dev.petal.client.mixin;

import dev.petal.client.ui.PetalUi;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(AbstractContainerScreen.class)
abstract class AbstractContainerScreenMixin {
    @Inject(method = "render", at = @At("HEAD"))
    private void petal$lightLabels(GuiGraphics g, int mouseX, int mouseY, float partialTick, CallbackInfo ci) {
        PetalUi.containerLabels = PetalUi.packActive();
    }

    @Inject(method = "render", at = @At("RETURN"))
    private void petal$labelsDone(GuiGraphics g, int mouseX, int mouseY, float partialTick, CallbackInfo ci) {
        PetalUi.containerLabels = false;
    }
}
