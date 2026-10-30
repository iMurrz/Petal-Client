# Changelog

## Unreleased (2.0 in-game screens)

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


