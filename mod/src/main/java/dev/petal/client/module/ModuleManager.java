package dev.petal.client.module;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class ModuleManager {
    private static final List<Module> ALL = new ArrayList<>();

    public static final HudModules.Fps FPS = add(new HudModules.Fps());
    public static final HudModules.Ping PING = add(new HudModules.Ping());
    public static final HudModules.Armor ARMOR = add(new HudModules.Armor());
    public static final HudModules.Potions POTIONS = add(new HudModules.Potions());
    public static final HudModules.Coordinates COORDS = add(new HudModules.Coordinates());
    public static final HudModules.Clock CLOCK = add(new HudModules.Clock());
    public static final HudModules.BlockCounter BLOCKS = add(new HudModules.BlockCounter());
    public static final FeatureModules.PetalCrosshair CROSSHAIR = add(new FeatureModules.PetalCrosshair());
    public static final FeatureModules.Zoom ZOOM = add(new FeatureModules.Zoom());
    public static final HudModules.SessionTimer SESSION = add(new HudModules.SessionTimer());
    public static final HudModules.ServerAddress SERVER = add(new HudModules.ServerAddress());

    public static final SurvivalModules.CropCare CROP_CARE = add(new SurvivalModules.CropCare());
    public static final SurvivalModules.LocalLight LIGHT = add(new SurvivalModules.LocalLight());
    public static final SurvivalModules.BuildSupplies SUPPLIES = add(new SurvivalModules.BuildSupplies());
    public static final SurvivalModules.TargetBlock TARGET = add(new SurvivalModules.TargetBlock());

    private ModuleManager() {}

    private static <T extends Module> T add(T module) {
        ALL.add(module);
        return module;
    }

    public static List<Module> all() {
        return Collections.unmodifiableList(ALL);
    }

    public static Module byId(String id) {
        for (Module m : ALL) if (m.id.equals(id)) return m;
        return null;
    }
}
