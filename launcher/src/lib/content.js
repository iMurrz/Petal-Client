// Per-instance content: mods, resource packs and shader packs. Players can see everything in those
// folders, switch mods on and off (by renaming to .disabled, the convention every launcher uses) and
// copy files in. Files Petal installs itself (.petal-managed.json) are shown but cannot be switched off.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { readZipEntry } = require('./zip');

const KINDS = {
  mods: { folder: 'mods', extensions: ['.jar'], toggle: true },
  resourcepacks: { folder: 'resourcepacks', extensions: ['.zip'], dirs: true },
  shaderpacks: { folder: 'shaderpacks', extensions: ['.zip'], dirs: true }
};
const NAME = /^[^\\/:*?"<>|\x00-\x1f]{1,200}$/;
const DISABLED = /^(.+\.jar)\.disabled(?:-[0-9a-f-]{36})?$/i;
const metaCache = new Map(); // file|mtime|size -> metadata, so the list stays fast on big modpacks

function kind(value) {
  const k = KINDS[value];
  if (!k) throw new Error('Unknown content type.');
  return k;
}

function safeName(name) {
  if (typeof name !== 'string' || !NAME.test(name) || name === '.' || name === '..' || /[. ]$/.test(name)) throw new Error('That file name is not allowed.');
  return name;
}

async function managedSet(dir) {
  try {
    const data = JSON.parse(await fsp.readFile(path.join(dir, '.petal-managed.json'), 'utf8'));
    return new Set(Array.isArray(data.files) ? data.files : []);
  } catch { return new Set(); }
}

async function catalogSet(instanceDir) {
  try {
    const data = JSON.parse(await fsp.readFile(path.join(instanceDir, '.petal-catalog.json'), 'utf8'));
    return new Map((data.mods || []).map(m => [m.filename, m.projectId]));
  } catch { return new Map(); }
}

/** fabric.mod.json name/version/description, cached by file identity. Never throws. */
async function modMeta(file, stat) {
  const key = `${file}|${stat.mtimeMs}|${stat.size}`;
  if (metaCache.has(key)) return metaCache.get(key);
  let meta = null;
  try {
    const raw = await readZipEntry(file, 'fabric.mod.json');
    if (raw) {
      // Some mods ship raw newlines inside strings; Fabric tolerates them, JSON.parse does not.
      const json = JSON.parse(raw.toString('utf8').replace(/[\r\n\t]+/g, ' '));
      const text = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);
      meta = { id: text(json.id, 64), name: text(json.name, 80), version: text(json.version, 40), description: text(json.description, 240) };
    }
  } catch { /* not a Fabric mod or unreadable: show the file name only */ }
  if (metaCache.size > 2000) metaCache.clear();
  metaCache.set(key, meta);
  return meta;
}

async function list(instanceDir, type) {
  const k = kind(type);
  const dir = path.join(instanceDir, k.folder);
  const entries = await fsp.readdir(dir, { withFileTypes: true }).catch(() => []);
  const managed = type === 'mods' ? await managedSet(dir) : new Set();
  const catalog = type === 'mods' ? await catalogSet(instanceDir) : new Map();
  const items = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const disabledMatch = k.toggle ? DISABLED.exec(entry.name) : null;
    const base = disabledMatch ? disabledMatch[1] : entry.name;
    const isFile = entry.isFile();
    if (isFile && !k.extensions.some(ext => base.toLowerCase().endsWith(ext))) continue;
    if (!isFile && !(k.dirs && entry.isDirectory())) continue;
    const full = path.join(dir, entry.name);
    const stat = await fsp.stat(full).catch(() => null);
    if (!stat) continue;
    const meta = type === 'mods' && isFile ? await modMeta(full, stat) : null;
    items.push({
      file: entry.name,
      name: meta?.name || base.replace(/\.(jar|zip)$/i, ''),
      version: meta?.version || null,
      description: meta?.description || null,
      folder: !isFile,
      size: isFile ? stat.size : null,
      modified: stat.mtimeMs,
      enabled: !disabledMatch,
      managed: managed.has(entry.name),
      source: managed.has(entry.name) ? 'Petal' : catalog.has(base) ? 'Modrinth' : 'Added by you',
      projectId: catalog.get(base) || null
    });
  }
  items.sort((a, b) => Number(b.managed) - Number(a.managed) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  return { type, folder: dir, items };
}

/** Switches one mod on or off by renaming it. Returns the refreshed list. */
async function setEnabled(instanceDir, file, enabled) {
  const dir = path.join(instanceDir, 'mods');
  safeName(file);
  if ((await managedSet(dir)).has(file)) throw new Error('Petal installs this mod. Switch Petal Pack mods on or off from the Petal Pack tab.');
  const from = path.join(dir, file);
  if (!fs.existsSync(from)) throw new Error('That mod is no longer in the folder.');
  const disabled = DISABLED.exec(file);
  let to;
  if (enabled) {
    if (!disabled) return list(instanceDir, 'mods');
    to = path.join(dir, disabled[1]);
  } else {
    if (disabled || !file.toLowerCase().endsWith('.jar')) return list(instanceDir, 'mods');
    to = path.join(dir, `${file}.disabled`);
  }
  if (fs.existsSync(to)) throw new Error(`${path.basename(to)} already exists. Remove one copy from the folder first.`);
  await fsp.rename(from, to);
  return list(instanceDir, 'mods');
}

/** Copies files the player picked into the right folder, never overwriting. */
async function addFiles(instanceDir, type, sources) {
  const k = kind(type);
  const dir = path.join(instanceDir, k.folder);
  await fsp.mkdir(dir, { recursive: true });
  const added = [];
  const skipped = [];
  for (const source of (sources || []).slice(0, 100)) {
    const name = path.basename(String(source));
    try {
      safeName(name);
      if (!k.extensions.some(ext => name.toLowerCase().endsWith(ext))) throw new Error(`Only ${k.extensions.join(', ')} files go here.`);
      const stat = await fsp.stat(source);
      if (!stat.isFile()) throw new Error('Not a file.');
      await fsp.copyFile(source, path.join(dir, name), fs.constants.COPYFILE_EXCL);
      added.push(name);
    } catch (error) {
      skipped.push({ name, reason: error.code === 'EEXIST' ? 'Already in the folder.' : error.message });
    }
  }
  return { added, skipped };
}

module.exports = { list, setEnabled, addFiles, KINDS };
