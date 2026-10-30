import dev.petal.client.config.PetalConfig;
import java.nio.file.Files;
import java.nio.file.Path;

public final class PetalConfigCheck {
    public static void main(String[] args) throws Exception {
        Path root = Files.createTempDirectory("petal-config-check-");
        System.setProperty("petal.check.config", root.toString());
        PetalConfig.load();
        PetalConfig.get().module("fps", true, 0.1f, 0.2f);
        PetalConfig.save();
        Path file = root.resolve("petal/petal.json");
        assert !PetalConfig.reloadIfChanged() : "Own saves must not trigger reloads";
        Files.writeString(file, "{\"modules\":{\"fps\":{\"enabled\":false,\"x\":0.6,\"y\":0.4,\"scale\":1.2}}}");
        assert PetalConfig.reloadIfChanged() : "Launcher toggle was not loaded";
        assert !PetalConfig.get().modules.get("fps").enabled;
        assert PetalConfig.get().modules.get("fps").x == 0.6f;
        assert !PetalConfig.reloadIfChanged() : "Unchanged data was reloaded";
        for (String invalid : new String[]{"{\"modules\":", "null", "{\"modules\":null}", "[]"}) {
            Files.writeString(file, invalid);
            assert !PetalConfig.reloadIfChanged() : "Invalid input replaced config: " + invalid;
            assert PetalConfig.get().modules.get("fps").x == 0.6f;
        }
        Files.writeString(file, "{\"modules\":{\"fps\":{\"enabled\":true,\"x\":4,\"scale\":0.1},\"bad\":null}}");
        for (int i = 0; i < 40; i++) PetalConfig.tick(true);
        assert !PetalConfig.get().modules.get("fps").enabled : "Reload interrupted an edit";
        for (int i = 0; i < 40; i++) PetalConfig.tick(false);
        assert PetalConfig.get().modules.get("fps").enabled : "Deferred change was not applied";
        assert PetalConfig.get().modules.get("fps").x == 1f;
        assert PetalConfig.get().modules.get("fps").scale == 0.5f;
        assert !PetalConfig.get().modules.containsKey("bad");
        PetalConfig.get().modules.get("fps").x = 0.25f;
        Files.writeString(file, "{\"modules\":{\"fps\":{\"enabled\":false,\"x\":1}}}");
        PetalConfig.save();
        assert !PetalConfig.get().modules.get("fps").enabled : "Drag save erased a launcher toggle";
        assert PetalConfig.get().modules.get("fps").x == 0.25f : "Launcher toggle erased layout edit";
        PetalConfig.get().modules.get("fps").enabled = true;
        Files.writeString(file, "{\"modules\":{\"fps\":{\"enabled\":false}}}");
        PetalConfig.save();
        assert PetalConfig.get().modules.get("fps").enabled : "Local toggle lost to stale disk state";
        Files.delete(file);
        assert !PetalConfig.reloadIfChanged();
        assert PetalConfig.get().modules.get("fps").enabled : "Missing file erased working settings";
        Files.writeString(file, "{\"version\":1,\"modules\":{\"reach\":{\"enabled\":true},\"ping\":{\"enabled\":true,\"x\":0.08,\"y\":0.01}}}");
        PetalConfig.load();
        assert !PetalConfig.get().modules.containsKey("reach") : "Retired feature survived migration";
        assert PetalConfig.get().modules.get("ping").x == 0.24f : "Legacy overlapping default was not migrated";
        assert PetalConfig.get().version == 2;
        System.out.println("Config checks passed: reload, own saves, malformed input, deferred edits, sanitization, concurrent toggle/layout saves, missing files.");
    }
}
