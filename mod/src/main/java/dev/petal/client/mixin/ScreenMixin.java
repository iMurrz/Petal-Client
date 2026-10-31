package dev.petal.client.mixin;

import dev.petal.client.screen.PetalFrame;
import dev.petal.client.ui.GlassButton;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.events.GuiEventListener;
import net.minecraft.client.gui.screens.Screen;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.Unique;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

import java.util.List;

/** Frames vanilla menus in Petal's side menu. See PetalFrame for how the shift works. */
@Mixin(Screen.class)
abstract class ScreenMixin implements PetalFrame.Framed {
    @Shadow public int height;

    @Shadow protected abstract <T extends GuiEventListener & net.minecraft.client.gui.components.Renderable & net.minecraft.client.gui.narration.NarratableEntry> T addRenderableWidget(T widget);
    @Shadow protected abstract void removeWidget(GuiEventListener widget);

    @Unique private boolean petal$framed;
    @Unique private List<GlassButton> petal$side = List.of();

    @Override
    public boolean petal$framed() {
        return petal$framed;
    }

    @Unique
    private int petal$frame(int fullWidth) {
        petal$framed = PetalFrame.wants((Screen) (Object) this, fullWidth);
        return petal$framed ? fullWidth - PetalFrame.SIDE : fullWidth;
    }

    @ModifyVariable(method = "init(II)V", at = @At("HEAD"), ordinal = 0, argsOnly = true)
    private int petal$initWidth(int width) {
        return petal$frame(width);
    }

    @ModifyVariable(method = "resize(II)V", at = @At("HEAD"), ordinal = 0, argsOnly = true)
    private int petal$resizeWidth(int width) {
        return petal$frame(width);
    }

    @Inject(method = "init(II)V", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/gui/screens/Screen;init()V", shift = At.Shift.AFTER))
    private void petal$addSideAfterInit(int width, int height, CallbackInfo ci) {
        petal$addSide();
    }

    @Inject(method = "rebuildWidgets()V", at = @At(value = "INVOKE", target = "Lnet/minecraft/client/gui/screens/Screen;init()V", shift = At.Shift.AFTER))
    private void petal$addSideAfterRebuild(CallbackInfo ci) {
        petal$addSide();
    }

    /** A resize can turn the frame on or off (GUI scale changes), and always changes the height. */
    @Inject(method = "resize(II)V", at = @At("TAIL"))
    private void petal$resizeSide(int width, int height, CallbackInfo ci) {
        if (!petal$framed) {
            for (GlassButton b : petal$side) removeWidget(b);
            petal$side = List.of();
        } else if (petal$side.isEmpty()) {
            petal$addSide();
        } else {
            PetalFrame.layout(petal$side, this.height);
        }
    }

    @Unique
    private void petal$addSide() {
        if (!petal$framed) { petal$side = List.of(); return; }
        // rebuildWidgets cleared the old buttons; add a fresh set.
        petal$side = PetalFrame.buttons((Screen) (Object) this);
        for (GlassButton b : petal$side) addRenderableWidget(b);
    }

    @Inject(method = "renderWithTooltipAndSubtitles", at = @At("HEAD"))
    private void petal$shift(GuiGraphics g, int mouseX, int mouseY, float partialTick, CallbackInfo ci) {
        if (!petal$framed) return;
        PetalFrame.rendering = true;
        g.pose().pushMatrix();
        g.pose().translate(PetalFrame.SIDE, 0);
    }

    @Inject(method = "renderWithTooltipAndSubtitles", at = @At("RETURN"))
    private void petal$unshift(GuiGraphics g, int mouseX, int mouseY, float partialTick, CallbackInfo ci) {
        if (!petal$framed) return;
        g.pose().popMatrix();
        PetalFrame.rendering = false;
    }

    /** Framed screens get Petal's backdrop instead of the panorama, blur and menu texture. */
    @Inject(method = "renderBackground", at = @At("HEAD"), cancellable = true)
    private void petal$backdrop(GuiGraphics g, int mouseX, int mouseY, float partialTick, CallbackInfo ci) {
        if (!petal$framed) return;
        PetalFrame.backdrop(g, (Screen) (Object) this);
        ci.cancel();
    }

    /** The dim behind inventories and other in-game screens, in Petal plum instead of grey. */
    @Inject(method = "renderTransparentBackground", at = @At("HEAD"), cancellable = true)
    private void petal$plumDim(GuiGraphics g, CallbackInfo ci) {
        Screen self = (Screen) (Object) this;
        g.fillGradient(0, 0, self.width, self.height, 0xB80E0716, 0xD0140A1E);
        ci.cancel();
    }
}
