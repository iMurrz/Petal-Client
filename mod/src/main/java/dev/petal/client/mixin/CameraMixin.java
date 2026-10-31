package dev.petal.client.mixin;

import com.llamalad7.mixinextras.injector.wrapoperation.Operation;
import com.llamalad7.mixinextras.injector.wrapoperation.WrapOperation;
import dev.petal.client.module.ModuleManager;
import net.minecraft.client.Camera;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;

@Mixin(Camera.class)
abstract class CameraMixin {
    /** Freelook points the camera with its own angles instead of the player's. */
    @WrapOperation(method = "setup", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/Camera;setRotation(FF)V"))
    private void petal$freelook(Camera camera, float yRot, float xRot, Operation<Void> original) {
        if (ModuleManager.FREELOOK.active()) original.call(camera, ModuleManager.FREELOOK.yaw(), ModuleManager.FREELOOK.pitch());
        else original.call(camera, yRot, xRot);
    }
}
