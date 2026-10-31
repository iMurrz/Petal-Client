package dev.petal.client.mixin;

import dev.petal.client.screen.PetalFrame;
import dev.petal.client.ui.PetalUi;
import net.minecraft.client.gui.GuiGraphics;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;

@Mixin(GuiGraphics.class)
abstract class GuiGraphicsMixin {
    /**
     * Scissor areas are stored in window space, but widgets test the mouse in their screen's own space.
     * While a framed screen draws shifted right, move the point by the same amount so list rows still
     * light up under the cursor.
     */
    @ModifyVariable(method = "containsPointInScissor", at = @At("HEAD"), ordinal = 0, argsOnly = true)
    private int petal$framedX(int x) {
        return PetalFrame.rendering ? x + PetalFrame.SIDE : x;
    }

    /** Container titles ("Inventory", "Chest", "Furnace") in a colour that reads on Petal UI's dark panels. */
    @ModifyVariable(method = "drawString(Lnet/minecraft/client/gui/Font;Lnet/minecraft/util/FormattedCharSequence;IIIZ)V", at = @At("HEAD"), ordinal = 2, argsOnly = true)
    private int petal$labelSequence(int color) {
        return PetalUi.label(color);
    }

    @ModifyVariable(method = "drawString(Lnet/minecraft/client/gui/Font;Ljava/lang/String;IIIZ)V", at = @At("HEAD"), ordinal = 2, argsOnly = true)
    private int petal$labelString(int color) {
        return PetalUi.label(color);
    }
}
