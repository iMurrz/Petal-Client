package dev.petal.client.cosmetic;

import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.VertexConsumer;
import com.mojang.math.Axis;
import net.minecraft.client.Minecraft;
import net.minecraft.client.model.player.PlayerModel;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.RenderLayerParent;
import net.minecraft.client.renderer.entity.layers.RenderLayer;
import net.minecraft.client.renderer.entity.state.AvatarRenderState;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.resources.Identifier;

/** Draws your wings and halo. Cosmetics are client-side: you see them on yourself (third person, inventory). */
public final class CosmeticLayer extends RenderLayer<AvatarRenderState, PlayerModel> {

    public CosmeticLayer(RenderLayerParent<AvatarRenderState, PlayerModel> parent) {
        super(parent);
    }

    @Override
    public void submit(PoseStack pose, SubmitNodeCollector collector, int light, AvatarRenderState state, float yRot, float xRot) {
        Minecraft mc = Minecraft.getInstance();
        if (mc.player == null || state.id != mc.player.getId() || state.isInvisible) return;

        Identifier wing = "none".equals(Cosmetics.wings) ? null : CosmeticTextures.wing(Cosmetics.wings);
        if (wing != null) {
            float flap = (float) Math.sin(state.ageInTicks * 0.15f) * 8f;
            pose.pushPose();
            getParentModel().body.translateAndRotate(pose);
            pose.translate(0f, 0.12f, 0.15f);
            for (int side = -1; side <= 1; side += 2) {
                pose.pushPose();
                pose.mulPose(Axis.YP.rotationDegrees(-side * (28f + flap)));
                final int s = side;
                collector.submitCustomGeometry(pose, RenderTypes.entityTranslucent(wing), (p, vc) -> wingQuad(p, vc, s, light));
                pose.popPose();
            }
            pose.popPose();
        }

        Identifier halo = "none".equals(Cosmetics.halo) ? null : CosmeticTextures.halo(Cosmetics.halo);
        if (halo != null) {
            float bob = (float) Math.sin(state.ageInTicks * 0.08f) * 0.03f;
            pose.pushPose();
            getParentModel().head.translateAndRotate(pose);
            pose.translate(0f, -0.68f + bob, 0f);
            pose.mulPose(Axis.YP.rotationDegrees(state.ageInTicks * 1.5f));
            collector.submitCustomGeometry(pose, RenderTypes.entityCutoutNoCull(halo), (p, vc) -> haloQuad(p, vc, light));
            pose.popPose();
        }
    }

    /** One wing, drawn on both faces so it shows from every angle. Root at x = 0, tip at x = side × width. */
    private static void wingQuad(PoseStack.Pose p, VertexConsumer vc, int side, int light) {
        float w = 0.8f * side, top = -0.42f, bottom = 0.5f;
        float uRoot = 1f, uTip = 0f;
        vertex(vc, p, 0f, top, 0f, uRoot, 0f, light);
        vertex(vc, p, w, top, 0f, uTip, 0f, light);
        vertex(vc, p, w, bottom, 0f, uTip, 1f, light);
        vertex(vc, p, 0f, bottom, 0f, uRoot, 1f, light);

        vertex(vc, p, 0f, bottom, 0f, uRoot, 1f, light);
        vertex(vc, p, w, bottom, 0f, uTip, 1f, light);
        vertex(vc, p, w, top, 0f, uTip, 0f, light);
        vertex(vc, p, 0f, top, 0f, uRoot, 0f, light);
    }

    private static void haloQuad(PoseStack.Pose p, VertexConsumer vc, int light) {
        float r = 0.3f;
        vertex(vc, p, -r, 0f, -r, 0f, 0f, light);
        vertex(vc, p, r, 0f, -r, 1f, 0f, light);
        vertex(vc, p, r, 0f, r, 1f, 1f, light);
        vertex(vc, p, -r, 0f, r, 0f, 1f, light);
    }

    private static void vertex(VertexConsumer vc, PoseStack.Pose p, float x, float y, float z, float u, float v, int light) {
        vc.addVertex(p, x, y, z).setColor(-1).setUv(u, v).setOverlay(OverlayTexture.NO_OVERLAY).setLight(light).setNormal(p, 0f, 1f, 0f);
    }
}
