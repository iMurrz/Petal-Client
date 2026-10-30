package dev.petal.client.module;
import net.minecraft.client.Minecraft;
/** Local excavation and session totals. No combat or click tracking. */
public final class Tracker {
    public static int blocksBroken;
    public static long sessionStart;
    private static Object level;
    private Tracker() {}
    public static void onBlockBroken() { blocksBroken++; }
    public static void tick(Minecraft mc) {
        if (mc.level != level) { level = mc.level; sessionStart = 0; blocksBroken = 0; }
        if (mc.level == null || mc.player == null) { sessionStart = 0; blocksBroken = 0; return; }
        if (sessionStart == 0) sessionStart = System.currentTimeMillis();
    }
    public static long sessionMillis() { return sessionStart == 0 ? 0 : System.currentTimeMillis() - sessionStart; }
    public static String duration(long millis) {
        long s = millis / 1000, h = s / 3600, m = (s % 3600) / 60, sec = s % 60;
        return h > 0 ? String.format("%d:%02d:%02d", h, m, sec) : String.format("%d:%02d", m, sec);
    }
}
