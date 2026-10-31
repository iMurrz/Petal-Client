# Changelog

## 2.2.0 (unreleased)

- In game, Settings and every settings page, Singleplayer, Multiplayer, resource packs, statistics and advancements open inside a Petal side menu (Home or Resume, each section, Petal mods) over the dusk backdrop. On very large GUI scales, where there isn't room, they open full width as before.
- Faithful 64x (from Modrinth, hash-checked) is installed and switched on by default, with Petal UI 64x on top for menus, inventories and the HUD. Petal only sets the order once; after that your in-game order wins. Petal Textures 64x is installed but left off.
- Inventory and container titles switch to a light lilac on Petal UI's dark panels, and in-game screens dim in plum.
- Petal's title screen, pause menu, mod menu and HUD editor keep every label inside its box at every GUI scale: long text is trimmed or wrapped, and the title and pause menus tighten on short windows.
- The launcher's Downloads page is now a Modrinth browser: mods, resource packs, shaders and modpacks, with icons, sorting, category filters and one-click install. Results show Installed or In Petal Pack.
- Fix mod search on Modrinth, which rejected every Minecraft version.
- Content › Resource packs shows each pack's description and where it sits in the in-game order.

## 2.1.0 (unreleased)

- Add a Content page for each instance: every mod, resource pack and shader pack with name, version and source (Petal, Modrinth or added by you). Switch mods on and off, add files, open folders. Petal's own mods are protected.
- Add crash help: when Minecraft crashes, Petal reads this session's crash report and output, explains known causes (out of memory, missing or incompatible mods, mixin failures, wrong Java, graphics drivers, native crashes, damaged files) and offers the fix, Copy details, Open crash report and Launch again.
- Add a live Console page: streamed game output with warning and error filters, search, follow, copy, open log file and Force stop.
- Add Ctrl K search for pages, instances, servers and actions, plus Ctrl Enter to launch and Ctrl 1–9 for pages.
- Instances: play time, session count and last played; per-instance memory; rename; remove (folder goes to the Recycle Bin); open folder.
- Quick join shows server icons, coloured MOTD, version and player counts, refreshing every minute.
- Settings: validated extra Java flags (-X, -XX:, -D only), update check at startup toggle, Reduce motion; keyboard shortcut list.
- Remember window size, position and maximized state; add a maximize button and double-click title bar.
- Stacked, dismissible notices; an offline indicator; "Welcome to 2.x" release notes after an update.

## 2.0.0 (2026-10-30)

- Rebuild the Right Shift mod menu in the 2.0 glass look: category pills, mod tiles with Options and Enabled buttons, rounded settings panel.
- Add a Petal title screen with a dusk backdrop, the main menu, quick join for saved servers and the signed-in account.
- Add a Petal pause menu with a session card (time, blocks broken, position, day). "More options" opens the vanilla pause menu for feedback, reporting and server links.
- Restyle the launcher in the 2.0 glass look: rounded panels, bloom gradients, a dusk hero with a glass launch card, and "What's new in 2.0".
- Add launcher self-update: checks the latest GitHub release of iMurrz/Petal-Client on start, shows an update banner, and "Restart and update" downloads the installer, verifies its size and SHA-512 against latest.yml, installs silently and reopens Petal. Settings › About has "Check for updates".
- Add a tag-triggered release workflow (release.yml) that publishes the installer and latest.yml as a GitHub release.
- Keep the survival module catalog; no PvP or prison modules return.

## 1.1.0 — 2026-10-30

- Convert Petal to SMP Survival, building and farming.
- Remove combat and prison modules, attack/click tracking, automatic sprinting and fullbright.
- Add Crop Care, Local Light, Tools & Supplies and Building Target.
- Add portal coordinate conversions and survival-focused launcher guidance.
- Migrate legacy preferences while preserving accounts, worlds, layouts and personal servers.
## 1.0.1 — 2026-10-29

- Apply launcher module toggles while Minecraft runs, with changes deferred during active drags.
- Preserve the last working config when an external update is incomplete or invalid.
- Preserve launcher toggles made during a HUD layout edit when that edit saves.
- Add HUD editor controls for resetting positions, toggling HUD visibility and returning to the menu.
- Move a selected HUD with arrow keys; hold Shift for ten-pixel movement.
- Snap dragged HUDs to screen edges as well as centre lines.
- Refresh launcher module switches when returning from the game.

## 1.0.0 — 2026-10-29

- Build and install the first Windows launcher and Fabric mod.
- Add game file verification and repair, saved game window sizes and a screenshot gallery.
- Use the same game data location for development and installed builds.


