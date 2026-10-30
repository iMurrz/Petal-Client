package dev.petal.client.mixin;

import dev.petal.client.cosmetic.CosmeticTextures;
import dev.petal.client.cosmetic.Cosmetics;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.AbstractClientPlayer;
import net.minecraft.core.ClientAsset;
import net.minecraft.world.entity.player.PlayerSkin;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

import java.util.Optional;

/** Swaps in your equipped Petal cloak (on your own player only). */
@Mixin(AbstractClientPlayer.class)
abstract class AbstractClientPlayerMixin {
    @Inject(method = "getSkin", at = @At("RETURN"), cancellable = true)
    private void petal$cloak(CallbackInfoReturnable<PlayerSkin> cir) {
        if ((Object) this != Minecraft.getInstance().player || "none".equals(Cosmetics.cloak)) return;
        ClientAsset.ResourceTexture cape = CosmeticTextures.capeAsset(Cosmetics.cloak);
        if (cape == null) return;
        cir.setReturnValue(cir.getReturnValue().with(new PlayerSkin.Patch(Optional.empty(), Optional.of(cape), Optional.empty(), Optional.empty())));
    }
}
