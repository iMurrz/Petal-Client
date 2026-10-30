package dev.petal.client.cosmetic;

import com.mojang.blaze3d.platform.NativeImage;
import dev.petal.client.ui.Theme;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.texture.DynamicTexture;
import net.minecraft.core.ClientAsset;
import net.minecraft.resources.Identifier;

import java.util.HashMap;
import java.util.Map;

/** Cloak, wing and halo textures, painted in code at startup so the mod ships no image files. */
public final class CosmeticTextures {
    private static final Map<String, Identifier> IDS = new HashMap<>();

    private CosmeticTextures() {}

    public static Identifier cape(String id) { return IDS.get("cape_" + id); }
    public static Identifier wing(String id) { return IDS.get("wing_" + id); }
    public static Identifier halo(String id) { return IDS.get("halo_" + id); }

    public static ClientAsset.ResourceTexture capeAsset(String id) {
        Identifier tex = cape(id);
        return tex == null ? null : new ClientAsset.ResourceTexture(tex, tex);
    }

    public static void register(Minecraft mc) {
        for (String c : Cosmetics.CLOAKS) put(mc, "cape_" + c, paintCape(c));
        for (String w : Cosmetics.WINGS) put(mc, "wing_" + w, paintWing(w));
        for (String h : Cosmetics.HALOS) put(mc, "halo_" + h, paintHalo(h));
    }

    private static void put(Minecraft mc, String name, NativeImage image) {
        Identifier id = Identifier.fromNamespaceAndPath("petal", "cosmetic/" + name);
        DynamicTexture texture = new DynamicTexture(() -> "petal " + name, image); // uploads on creation
        mc.getTextureManager().register(id, texture);
        IDS.put(name, id);
    }

    // ----- cloaks (standard 64×32 cape layout; every face gets the pattern) -----

    private static NativeImage paintCape(String id) {
        NativeImage img = new NativeImage(64, 32, true);
        for (int x = 0; x < 64; x++) {
            for (int y = 0; y < 32; y++) {
                img.setPixel(x, y, capePixel(id, x, y));
            }
        }
        if (id.equals("voidrose")) {
            frame(img, 1, 1, 10, 16);
            frame(img, 12, 1, 10, 16);
        }
        return img;
    }

    private static int capePixel(String id, int x, int y) {
        return switch (id) {
            case "sakura" -> (x + y) % 9 < 7 ? Theme.PINK : Theme.BLUSH;
            case "midnight" -> (x % 6 == 2 && y % 6 == 2) || (x % 6 == 5 && y % 6 == 5 && (x + y) % 4 == 0) ? Theme.PINK : 0xFF2A0F2E;
            case "mint" -> y % 6 < 4 ? Theme.MINT : 0xFF5AD3AA;
            case "static" -> ((x / 2) + (y / 2)) % 2 == 0 ? Theme.BLUSH : Theme.MILK;
            case "thorn" -> x % 5 == 0 ? Theme.PINK : 0xFF3B1A3F;
            default -> 0xFF120A10; // voidrose base
        };
    }

    private static void frame(NativeImage img, int x, int y, int w, int h) {
        for (int i = x; i < x + w; i++) {
            img.setPixel(i, y, Theme.PINK);
            img.setPixel(i, y + h - 1, Theme.PINK);
        }
        for (int j = y; j < y + h; j++) {
            img.setPixel(x, j, Theme.PINK);
            img.setPixel(x + w - 1, j, Theme.PINK);
        }
    }

    // ----- wings: one 32×32 wing, root on the right edge, tip on the left -----

    private static final float[][] WING = {{1f, 0.08f}, {0f, 0f}, {0.22f, 0.45f}, {0.04f, 1f}, {1f, 0.72f}};

    private static NativeImage paintWing(String id) {
        NativeImage img = new NativeImage(32, 32, true);
        for (int x = 0; x < 32; x++) {
            for (int y = 0; y < 32; y++) {
                float u = (x + 0.5f) / 32f, v = (y + 0.5f) / 32f;
                int color = 0;
                if (insidePolygon(u, v)) {
                    boolean vein = (x + y * 2) % 11 == 0 && x > 6;
                    boolean edge = !insidePolygon(u - 0.07f, v) || !insidePolygon(u, v - 0.07f) || !insidePolygon(u, v + 0.07f);
                    color = switch (id) {
                        case "paper" -> edge ? 0xFFC9779E : vein ? 0xFFFBEFF5 : Theme.BLUSH;
                        case "glass" -> edge ? 0xD0FBEFF5 : vein ? 0x90FFB8D9 : 0x66FBEFF5;
                        default -> edge ? Theme.DEEP : vein ? Theme.BLUSH : Theme.PINK; // ember
                    };
                }
                img.setPixel(x, y, color);
            }
        }
        return img;
    }

    private static boolean insidePolygon(float x, float y) {
        boolean in = false;
        for (int i = 0, j = WING.length - 1; i < WING.length; j = i++) {
            float xi = WING[i][0], yi = WING[i][1], xj = WING[j][0], yj = WING[j][1];
            if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) in = !in;
        }
        return in;
    }

    // ----- halos: 32×32 ring seen from above -----

    private static NativeImage paintHalo(String id) {
        NativeImage img = new NativeImage(32, 32, true);
        for (int x = 0; x < 32; x++) {
            for (int y = 0; y < 32; y++) {
                float dx = x + 0.5f - 16f, dy = y + 0.5f - 16f;
                int color = 0;
                if (id.equals("pixel")) {
                    float d = Math.max(Math.abs(dx), Math.abs(dy));
                    if (d >= 11 && d <= 15) color = Theme.MILK;
                } else {
                    double d = Math.sqrt(dx * dx + dy * dy);
                    if (d >= 11 && d <= 15) {
                        if (id.equals("thorn")) {
                            double angle = Math.atan2(dy, dx) + Math.PI;
                            color = ((int) (angle / (Math.PI / 8))) % 2 == 0 ? Theme.MINT : 0;
                        } else {
                            color = d > 14 || d < 12 ? Theme.DEEP : Theme.PINK;
                        }
                    }
                }
                img.setPixel(x, y, color);
            }
        }
        return img;
    }
}
