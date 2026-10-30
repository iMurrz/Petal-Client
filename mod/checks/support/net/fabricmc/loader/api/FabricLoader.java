package net.fabricmc.loader.api;

import java.nio.file.Path;

/** Test-only loader stand-in for exercising config I/O without starting Minecraft. Never packaged. */
public final class FabricLoader {
    private static final FabricLoader INSTANCE = new FabricLoader();
    public static FabricLoader getInstance() { return INSTANCE; }
    public Path getConfigDir() { return Path.of(System.getProperty("petal.check.config")); }
}
