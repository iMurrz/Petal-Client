package dev.petal.client.mixin;

import dev.petal.client.module.ModuleManager;
import com.mojang.blaze3d.platform.Window;
import dev.petal.client.screen.PetalFrame;
import net.minecraft.client.MouseHandler;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(MouseHandler.class)
abstract class MouseHandlerMixin {
    @Shadow private double accumulatedDX;
    @Shadow private double accumulatedDY;

    /** Scroll changes the zoom level instead of the hotbar slot while zooming. */
    @Inject(method = "onScroll", at = @At("HEAD"), cancellable = true)
    private void petal$zoomScroll(long window, double xOffset, double yOffset, CallbackInfo ci) {
        if (ModuleManager.ZOOM.onScroll(yOffset)) ci.cancel();
    }

    /** Slower turning while zoomed for steadier surveying. */
    @Inject(method = "turnPlayer", at = @At("HEAD"))
    private void petal$zoomSensitivity(double movementTime, CallbackInfo ci) {
        float factor = ModuleManager.ZOOM.factor();
        if (factor > 1f) {
            accumulatedDX /= factor;
            accumulatedDY /= factor;
        }
    }

    /** A menu framed in Petal's side menu sits further right; give it the mouse in its own coordinates. */
    @Inject(method = "getScaledXPos(Lcom/mojang/blaze3d/platform/Window;)D", at = @At("RETURN"), cancellable = true)
    private void petal$framedMouse(Window window, CallbackInfoReturnable<Double> cir) {
        int offset = PetalFrame.offset();
        if (offset != 0) cir.setReturnValue(cir.getReturnValue() - offset);
    }
}
