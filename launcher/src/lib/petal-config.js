const fsp = require('node:fs/promises');
const path = require('node:path');

/**
 * The launcher's view of the Petal mod: the same module list the in-game menu shows, and the two files the
 * mod reads from the instance's config/petal folder (petal.json for modules, cosmetics.json for the Locker).
 * Keep this list in step with ModuleManager.java.
 */
const MODULES = [
  {
    "id": "fps",
    "name": "FPS",
    "description": "Frames per second.",
    "category": "HUD",
    "on": true,
    "x": 0.01,
    "y": 0.01
  },
  {
    "id": "ping",
    "name": "Ping",
    "description": "Live latency to the server.",
    "category": "HUD",
    "on": true,
    "x": 0.24,
    "y": 0.01
  },
  {
    "id": "armor",
    "name": "Armour Status",
    "description": "Durability for every worn piece.",
    "category": "Survival",
    "on": false,
    "x": 0.01,
    "y": 0.72
  },
  {
    "id": "potions",
    "name": "Potion Effects",
    "description": "Active effects with countdowns.",
    "category": "Survival",
    "on": false,
    "x": 0.01,
    "y": 0.1
  },
  {
    "id": "coords",
    "name": "Coordinates",
    "description": "Position, facing and matching portal coordinates.",
    "category": "Survival",
    "on": true,
    "x": 0.99,
    "y": 0.12
  },
  {
    "id": "clock",
    "name": "Clock",
    "description": "Real-world time.",
    "category": "HUD",
    "on": false,
    "x": 0.99,
    "y": 0.01
  },
  {
    "id": "blocks",
    "name": "Block Counter",
    "description": "Blocks broken this session, per minute.",
    "category": "Building",
    "on": true,
    "x": 0.99,
    "y": 0.98
  },
  {
    "id": "crosshair",
    "name": "Builder Crosshair",
    "description": "A clear centre marker for precise block placement.",
    "category": "Building",
    "on": true,
    "x": 0,
    "y": 0
  },
  {
    "id": "zoom",
    "name": "Zoom",
    "description": "Hold C to zoom. Scroll while zooming to adjust.",
    "category": "Visual",
    "on": true,
    "x": 0,
    "y": 0
  },
  {
    "id": "session",
    "name": "Session Timer",
    "description": "How long you've been on this server or world.",
    "category": "Utility",
    "on": false,
    "x": 0.99,
    "y": 0.06
  },
  {
    "id": "server",
    "name": "Server Address",
    "description": "The server you're connected to.",
    "category": "Utility",
    "on": false,
    "x": 0.5,
    "y": 0.01
  },
  {
    "id": "cropcare",
    "name": "Crop Care",
    "description": "Look at a crop or farmland for growth and moisture.",
    "category": "Farming",
    "on": true,
    "x": 0.99,
    "y": 0.45
  },
  {
    "id": "locallight",
    "name": "Local Light",
    "description": "Actual block and sky light at your feet for lighting builds and tunnels.",
    "category": "Building",
    "on": true,
    "x": 0.01,
    "y": 0.22
  },
  {
    "id": "supplies",
    "name": "Tools & Supplies",
    "description": "Held-item stock and tool durability while building or gathering.",
    "category": "Building",
    "on": true,
    "x": 0.01,
    "y": 0.84
  },
  {
    "id": "targetblock",
    "name": "Building Target",
    "description": "Name and coordinates of the visible block under your crosshair.",
    "category": "Building",
    "on": false,
    "x": 0.99,
    "y": 0.7
  }
];

const COSMETICS = {
  cloak: ['none', 'sakura', 'midnight', 'mint', 'static', 'voidrose', 'thorn'],
  wings: ['none', 'paper', 'glass', 'ember'],
  halo: ['none', 'bloom', 'thorn', 'pixel']
};

const PINK = (0xFFFF4FA3 | 0); // signed ARGB, as Java stores it

const configDir = instanceDir => path.join(instanceDir, 'config', 'petal');

async function readJson(file, fallback) {
  try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return fallback; }
}

async function writeJson(file, data) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2));
  await fsp.rename(tmp, file);
}

async function readModules(instanceDir) {
  const cfg = await readJson(path.join(configDir(instanceDir), 'petal.json'), {});
  const saved = cfg && typeof cfg.modules === 'object' && cfg.modules ? cfg.modules : {};
  return MODULES.map(m => ({ id: m.id, name: m.name, description: m.description, category: m.category, enabled: typeof saved[m.id]?.enabled === 'boolean' ? saved[m.id].enabled : m.on }));
}

async function setModule(instanceDir, id, enabled) {
  const def = MODULES.find(m => m.id === id);
  if (!def) throw new Error('Unknown module.');
  const file = path.join(configDir(instanceDir), 'petal.json');
  const cfg = await readJson(file, {});
  const out = { version: 1, ...(cfg && typeof cfg === 'object' ? cfg : {}) };
  out.modules = out.modules && typeof out.modules === 'object' ? out.modules : {};
  const current = out.modules[id] || { enabled: def.on, x: def.x || 0, y: def.y || 0, scale: 1, opacity: 0.6, accent: PINK };
  for (const retired of ['keystrokes', 'reach', 'combo', 'togglesprint', 'mineradar', 'petalfx', 'fullbright']) delete out.modules[retired];
  out.modules[id] = { ...current, enabled: Boolean(enabled) };
  await writeJson(file, out);
  return readModules(instanceDir);
}

async function readCosmetics(instanceDir) {
  const saved = await readJson(path.join(configDir(instanceDir), 'cosmetics.json'), {});
  const out = {};
  for (const [slot, ids] of Object.entries(COSMETICS)) out[slot] = ids.includes(saved?.[slot]) ? saved[slot] : 'none';
  return out;
}

async function equip(instanceDir, slot, id) {
  if (!COSMETICS[slot] || !COSMETICS[slot].includes(id)) throw new Error('Unknown cosmetic.');
  const current = await readCosmetics(instanceDir);
  current[slot] = id;
  await writeJson(path.join(configDir(instanceDir), 'cosmetics.json'), current);
  return current;
}

/** Performance profiles: a handful of stable options.txt keys. Everything else in options.txt is kept. */
const PROFILES = {
  Builder: { maxFps: '260', enableVsync: 'false', particles: '2', entityShadows: 'false', renderClouds: '"false"', biomeBlendRadius: '0', entityDistanceScaling: '0.75' },
  Balanced: { maxFps: '144', enableVsync: 'false', particles: '1', entityShadows: 'true', renderClouds: '"fast"', biomeBlendRadius: '2', entityDistanceScaling: '1.0' },
  Cinematic: { maxFps: '260', enableVsync: 'true', particles: '0', entityShadows: 'true', renderClouds: '"true"', biomeBlendRadius: '5', entityDistanceScaling: '1.25' }
};

async function applyOptions(instanceDir, { profile, fullscreen }) {
  const file = path.join(instanceDir, 'options.txt');
  let text = '';
  try { text = await fsp.readFile(file, 'utf8'); } catch { /* fresh install */ }
  const wanted = { ...(PROFILES[profile] || PROFILES.Balanced), fullscreen: fullscreen ? 'true' : 'false' };
  const seen = new Set();
  const lines = text.split(/\r?\n/).filter(Boolean).map(line => {
    const key = line.slice(0, line.indexOf(':'));
    if (key in wanted) { seen.add(key); return `${key}:${wanted[key]}`; }
    return line;
  });
  for (const [key, value] of Object.entries(wanted)) if (!seen.has(key)) lines.push(`${key}:${value}`);
  await fsp.mkdir(instanceDir, { recursive: true });
  await fsp.writeFile(file, lines.join('\n') + '\n');
}

module.exports = { MODULES, COSMETICS, PROFILES, readModules, setModule, readCosmetics, equip, applyOptions };
