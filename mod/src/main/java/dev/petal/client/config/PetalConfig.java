package dev.petal.client.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonParseException;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Everything the player changes in the mod menu and HUD editor, saved to config/petal/petal.json.
 * The launcher's Mods page reads and writes the same file, so toggles stay in sync both ways.
 */
public final class PetalConfig {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static PetalConfig instance;
    private static String lastContent;
    private static int ticks;
    private static final Map<String, Boolean> lastEnabled = new LinkedHashMap<>();
    private static final java.util.Set<String> RETIRED = java.util.Set.of(
        "keystrokes", "reach", "combo", "togglesprint", "mineradar", "petalfx", "fullbright");

    private static void rememberEnabled() {
        lastEnabled.clear();
        instance.modules.forEach((id, settings) -> lastEnabled.put(id, settings.enabled));
    }

    private static void migrateLayout(PetalConfig loaded) {
        if (loaded.version < 2) {
            ModuleSettings ping = loaded.modules.get("ping");
            if (ping != null && Math.abs(ping.x - 0.08f) < 0.0001f && Math.abs(ping.y - 0.01f) < 0.0001f) ping.x = 0.24f;
            loaded.version = 2;
        }
    }

    public int version = 1;
    public Map<String, ModuleSettings> modules = new LinkedHashMap<>();

    public static Path dir() {
        return FabricLoader.getInstance().getConfigDir().resolve("petal");
    }

    private static Path file() {
        return dir().resolve("petal.json");
    }

    public static PetalConfig get() {
        if (instance == null) load();
        return instance;
    }

    public static void load() {
        PetalConfig loaded = null;
        Path file = file();
        if (Files.isRegularFile(file)) {
            try {
                lastContent = Files.readString(file, StandardCharsets.UTF_8);
                loaded = GSON.fromJson(lastContent, PetalConfig.class);
            } catch (IOException | JsonParseException e) {
                try {
                    Files.move(file, file.resolveSibling("petal.json.broken-" + System.currentTimeMillis()), StandardCopyOption.REPLACE_EXISTING);
                } catch (IOException ignored) {
                    // keep going with defaults
                }
            }
        }
        if (loaded == null) loaded = new PetalConfig();
        if (loaded.modules == null) loaded.modules = new LinkedHashMap<>();
        loaded.modules.values().removeIf(s -> s == null);
        loaded.modules.keySet().removeAll(RETIRED);
        loaded.modules.values().forEach(ModuleSettings::sanitize);
        migrateLayout(loaded);
        instance = loaded;
        rememberEnabled();
    }

    /** Keep launcher toggles live. Invalid or partially written files never replace working settings. */
    public static void tick(boolean editing) {
        if (++ticks >= 40) {
            ticks = 0;
            if (!editing) reloadIfChanged();
        }
    }

    public static boolean reloadIfChanged() {
        try {
            if (!Files.isRegularFile(file()) || Files.size(file()) > 1024 * 1024) return false;
            String content = Files.readString(file(), StandardCharsets.UTF_8);
            if (content.equals(lastContent)) return false;
            PetalConfig loaded = GSON.fromJson(content, PetalConfig.class);
            if (loaded == null || loaded.modules == null) return false;
            loaded.modules.values().removeIf(s -> s == null);
            loaded.modules.keySet().removeAll(RETIRED);
            loaded.modules.values().forEach(ModuleSettings::sanitize);
            migrateLayout(loaded);
            instance = loaded;
            lastContent = content;
            rememberEnabled();
            return true;
        } catch (IOException | JsonParseException | IllegalStateException ignored) {
            return false;
        }
    }

    public static void save() {
        if (instance == null) return;
        try {
            Files.createDirectories(dir());
            // The launcher may toggle a module during a HUD drag. Keep its change unless
            // this in-game edit also changed that toggle; layout edits must not erase it.
            if (Files.isRegularFile(file()) && Files.size(file()) <= 1024 * 1024) {
                try {
                    String externalContent = Files.readString(file(), StandardCharsets.UTF_8);
                    if (!externalContent.equals(lastContent)) {
                        PetalConfig external = GSON.fromJson(externalContent, PetalConfig.class);
                        if (external != null && external.modules != null) {
                            external.modules.forEach((id, incoming) -> {
                                if (incoming == null) return;
                                ModuleSettings local = instance.modules.get(id);
                                if (local == null) { incoming.sanitize(); instance.modules.put(id, incoming); }
                                else if (lastEnabled.containsKey(id) && local.enabled == lastEnabled.get(id)) local.enabled = incoming.enabled;
                            });
                        }
                    }
                } catch (JsonParseException | IllegalStateException ignored) {
                    // A local save can still write valid settings over an incomplete update.
                }
            }
            Path tmp = file().resolveSibling("petal.json.tmp");
            instance.modules.keySet().removeAll(RETIRED);
            String content = GSON.toJson(instance);
            Files.writeString(tmp, content, StandardCharsets.UTF_8);
            Files.move(tmp, file(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            lastContent = content;
            rememberEnabled();
        } catch (IOException ignored) {
            // A failed save keeps the in-memory settings; the next save tries again.
        }
    }

    public ModuleSettings module(String id, boolean enabledByDefault, float x, float y) {
        ModuleSettings settings = modules.computeIfAbsent(id, k -> ModuleSettings.defaults(enabledByDefault, x, y));
        lastEnabled.putIfAbsent(id, settings.enabled);
        return settings;
    }
}
