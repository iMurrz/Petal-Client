package dev.petal.client.cosmetic;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import dev.petal.client.config.PetalConfig;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * The equipped loadout, written by the launcher's Locker to config/petal/cosmetics.json and re-read
 * whenever the file changes, so a change in the launcher shows up in game within a couple of seconds.
 */
public final class Cosmetics {
    public static final List<String> CLOAKS = List.of("sakura", "midnight", "mint", "static", "voidrose", "thorn");
    public static final List<String> WINGS = List.of("paper", "glass", "ember");
    public static final List<String> HALOS = List.of("bloom", "thorn", "pixel");

    public static String cloak = "none";
    public static String wings = "none";
    public static String halo = "none";

    private static long lastModified = -1;
    private static int ticks;

    private Cosmetics() {}

    private static Path file() {
        return PetalConfig.dir().resolve("cosmetics.json");
    }

    public static void tick() {
        if (++ticks % 40 == 0) reloadIfChanged();
    }

    public static void reloadIfChanged() {
        Path file = file();
        try {
            long modified = Files.isRegularFile(file) ? Files.getLastModifiedTime(file).toMillis() : 0;
            if (modified == lastModified) return;
            lastModified = modified;
            if (modified == 0) {
                cloak = wings = halo = "none";
                return;
            }
            JsonObject json = new Gson().fromJson(Files.readString(file, StandardCharsets.UTF_8), JsonObject.class);
            cloak = pick(json, "cloak", CLOAKS);
            wings = pick(json, "wings", WINGS);
            halo = pick(json, "halo", HALOS);
        } catch (Exception ignored) {
            // A half-written file is retried on the next check.
            lastModified = -1;
        }
    }

    private static String pick(JsonObject json, String key, List<String> allowed) {
        if (json == null || !json.has(key) || !json.get(key).isJsonPrimitive()) return "none";
        String value = json.get(key).getAsString();
        return allowed.contains(value) ? value : "none";
    }
}
