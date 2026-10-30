# Petal SMP Survival — Handoff

Workspace: C:\Users\JordanPC\Desktop\Petal-Client
Version: 1.1.0. Minecraft 1.21.11, Fabric Loader 0.19.5, Fabric API 0.141.6+1.21.11, Java 21, official Mojang mappings.

## Direction

The user explicitly requested removal of PvP and conversion to SMP Survival: homes, bases, tunnels and crops. Combat HUDs, attack particles, automatic sprinting, prison scoreboard scanning, fullbright and click/attack tracking are removed. Do not reintroduce them.

The 15-module catalog is shared by ModuleManager.java and launcher/src/lib/petal-config.js. Categories: Survival, Building, Farming, HUD, Visual and Utility. New panels: Crop Care, Local Light, Tools & Supplies, Building Target. Coordinates includes portal X/Z conversions. Crop Care reads vanilla CropBlock ages and farmland moisture; no automatic watering or harvesting. Default servers are empty. User accounts and personal servers are preserved; the former built-in preset is removed once. Old Competitive profile preferences migrate to Builder.

## Structure

- launcher/src/main.js and preload.js: sandboxed Electron bridge, official authentication and launching.
- launcher/src/lib/petal-config.js: module catalog, module/cosmetic JSON, performance profiles.
- launcher/src/lib/updater.js: self-update from the GitHub repo in package.json build.publish (iMurrz/Petal-Client, public). Verifies installer size + SHA-512 from latest.yml via http.download, runs NSIS with /S --updated --force-run, then quits. Only installs when packaged on Windows.
- Releasing: bump launcher/package.json version, push tag vX.Y.Z; .github/workflows/release.yml builds and publishes with the built-in GITHUB_TOKEN. dist:win passes --publish never.
- launcher/src/lib/settings.js: validated preferences and migration.
- launcher/src/lib/screenshots.js: safe local previews, adapted from supplied Sloth source.
- mod/.../module/SurvivalModules.java: farming/building panels.
- HudModules.java: coordinates, durability, effects and session panels.
- FeatureModules.java: zoom and builder crosshair only.
- PetalConfig.java: live reload and merging launcher toggles made during HUD drags.
- screen/: menu and HUD editing, PetalTitleScreen, PetalPauseScreen and PetalScreens (swaps vanilla title/pause; "More options" reaches vanilla pause), keyboard nudging, reset positions and visibility controls.
- cosmetic/: local-player cosmetics.
- ui/: Theme (2.0 bloom palette), Draw (rounded, ring and gradient fills), GlassButton (vanilla AbstractButton in glass style), Glyphs (8x8 icons), Dusk (title backdrop).
- 2.0 design canvas: https://claude.ai/artifact/P7KeikKEcpsrHJLMRNjkhr (its PvP/prison content is superseded by the survival direction).

## Checks

From launcher: npm run check; node scripts/check-survival.js; npm run build:mod; npm run dist:win.
Survival checks verify Java/launcher catalog parity and migration in temporary data. scripts/smoke.js checks the five Electron pages, module writes, resolution and gallery with a temporary profile. scripts/check-installed.js checks a locally debug-enabled installed app; reopen normally afterward.
mod/checks/run.ps1 checks config behavior using a test-only loader stand-in outside shipped sources.

## Boundaries

Preserve official Microsoft authentication, hash-pinned downloads and stdin token delivery. The source is public on GitHub (iMurrz/Petal-Client); keep .devlibs (Mojang jars), .ref and worlds out of it. Keep Petal's pink/plum identity and renderer CSP. No automatic farming or hidden world scanning. Test worlds belong under mod/run; do not use the player's worlds as fixtures.

1.1.0 full build, isolated Electron pages, config checks and survival catalog/migration checks pass. Local Light and portal coordinates have rendered in a separate development world. Record remaining runtime results below; do not claim every GUI scale or multiplayer flow is verified without testing it.

## Runtime evidence — 2026-10-30

- In a separate mod/run development world, Crop Care displayed mature wheat and actual farmland moisture (6/7 after a controlled 7/7 setup dried naturally).
- Tools & Supplies displayed 192 oak planks as 3 stacks, and a diamond pickaxe with 100 damage as 1461/1561 remaining durability.
- Local Light and Overworld-to-Nether coordinates rendered; negative coordinate conversion -158 -> -20 was observed.
- The survival menu and Farming category rendered. Small-window inspection found and corrected inherited panel overlap and menu spacing; the narrow grid now uses one column and the preview shrinks to keep controls apart. The final header avoids drawing beneath the search field at narrow widths.
- A test-only R key binding was used because desktop automation did not trigger a standalone right Shift. Production code and player options retain Right Shift; restore the dev binding afterward.
- The production jar audit found no retired combat/prison module classes or fullbright mixin. The mod had three mixins at 1.1.0; the 2.0 screens add MinecraftMixin (setScreen swap for title and pause), so four.
- Multiplayer/server acceptance, every crop type, every GUI scale and cosmetic positioning have not all been exercised.

## Installed result

Petal SMP Survival 1.1.0 installed locally with installer exit 0. Installed-app checks passed: correct version and survival catalog, absence of retired modules, module refresh, repair, concurrent-repair blocking, gallery listing and saved resolution. Built, installed-resource and prepared-instance mod jars have matching SHA-256 hashes. The installed app was reopened without a debugging port. The development menu binding was restored to Right Shift. No source or builds were published externally.
