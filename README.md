# Petal Client

Everything for the Petal Client project, in one folder.

```
Petal-Client/
├─ launcher/              Electron launcher (Play, Mods, Locker, Settings)
├─ mod/                   Fabric mod for 1.21.11 (Right-Shift menu, HUD, cosmetics)
├─ pack/                  Texture packs, unzipped and editable
│   ├─ Petal-UI-64x/        dark pink interface, 489 textures
│   ├─ Petal-Textures-64x/  optional blocks and items, 120 textures
│   ├─ tools/               the generator scripts that paint both packs
│   └─ README.md            pack docs, install order, licensing
├─ resourcepacks-ready/   the same two packs as .zip — drag these into Minecraft
├─ README.md              this file
├─ HANDOFF.md             full project handoff (launcher + mod)
├─ CHANGELOG.md           what changed when
├─ .github/               CI that builds the mod jar and Windows installer
├─ .devlibs/              Minecraft 1.21.11 + Fabric jars, for compile checks only (local, not in git)
├─ .ref/                  Sloth Client source snapshot used as reference (local, not in git)
└─ _to_delete/            superseded files, safe to delete (local, not in git)
```

## Using the texture pack

The zips in `resourcepacks-ready/` are the ones to install.

1. Open `%APPDATA%\.minecraft\resourcepacks` (paste that into Explorer's address bar).
2. Drop in `Petal-UI-64x.zip`, plus **Faithful 64x** from <https://faithfulpack.net>.
3. In game: **Options → Resource Packs**, stack them top to bottom:

```
   Petal UI 64x Dark     <- your interface
   Faithful 64x          <- tools, blocks, ores
   Default
```

Skip `Petal-Textures-64x.zip` if you're using Faithful — it's only there if you'd rather not run
another pack underneath. Don't enable both; whichever sits higher wins.

Once the launcher is built, Petal Client keeps its own game folder instead:
`%APPDATA%\Petal Client\game\instances\petal\resourcepacks`

## Building the launcher and mod

Needs Node 22 and JDK 21.

```bat
cd %USERPROFILE%\Desktop\Petal-Client\launcher
npm install
npm run build:mod
npm start
```

`npm run dist:win` produces the Windows installer. No JDK? Push the folder to GitHub and the workflow
in `.github/` builds both for you.

## Rebuilding the texture packs

```bash
cd pack
python3 tools/gen_gui.py          # core GUI sprites
python3 tools/gen_gui_extra.py    # advancements, recipe book, lists, icons
python3 tools/gen_containers.py   # container windows
python3 tools/gen_slot_icons.py   # empty-slot icons
python3 tools/gen_blocks.py       # optional pack: blocks
python3 tools/gen_items.py        # optional pack: items
```

Needs Python with Pillow. Palettes live in `tools/petal_paint.py` — one edit recolours everything.
Re-zip the folders afterwards to update `resourcepacks-ready/`.

## Licensing

Every texture in both packs is original art. Faithful is **not** bundled — download it yourself.
Their licence permits using and modifying their work with clear credit, a link to
<https://faithfulpack.net>, and no paywalls or monetised download links. Each pack carries a
`CREDITS.txt` with the details.

Petal Client is not an official Minecraft product and is not approved by or associated with Mojang
or Microsoft.
