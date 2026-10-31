const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { hashFile } = require('../http');
const lock = require('./mods-lock.json');
const pack = require('../pack');
const { readZipEntry } = require('../zip');

const MANAGED_FILE = '.petal-managed.json';
const SAFE = /^[A-Za-z0-9 _.+()'!-]+\.jar$/;

async function readManagedData(dir) {
  try {
    const data = JSON.parse(await fsp.readFile(path.join(dir, MANAGED_FILE), 'utf8'));
    return {
      files: Array.isArray(data.files) ? data.files.filter(f => typeof f === 'string' && SAFE.test(f)) : [],
      // Pack files skipped because the player has their own copy of the same mod: { file, by }.
      shadowed: Array.isArray(data.shadowed) ? data.shadowed.filter(s => SAFE.test(s?.file || '') && typeof s.by === 'string' && !/[\\/]/.test(s.by)) : []
    };
  } catch {
    return { files: [], shadowed: [] };
  }
}
async function readManaged(dir) { return (await readManagedData(dir)).files; }

/** The Fabric mod id inside a jar, or null. */
async function modId(file) {
  try {
    const raw = await readZipEntry(file, 'fabric.mod.json');
    const id = raw && JSON.parse(raw.toString('utf8').replace(/[\r\n\t]+/g, ' ')).id;
    return typeof id === 'string' ? id : null;
  } catch { return null; }
}

/**
 * Plans the instance's mods folder: Fabric API and the chosen Petal Pack mods (hash-pinned downloads) plus
 * the Petal mod shipped with the launcher. Pack mods that were switched off are removed like any other
 * managed file. Only files the launcher placed itself (listed in .petal-managed.json) are ever removed, so
 * any mods a player drops in are left alone.
 */
async function planMods(instanceDir, _settings, bundled = []) {
  const dir = path.join(instanceDir, 'mods');
  const keep = new Set();
  const tasks = [];
  const previous = await readManagedData(dir);
  // A pack file stays skipped while the player's own copy of that mod is still in the folder.
  const stillShadowed = previous.shadowed.filter(s => fs.existsSync(path.join(dir, s.by)));
  const skip = new Set(stillShadowed.map(s => s.file));
  // Required mods, the Petal Pack mods this player has on, and the libraries those need.
  const { install } = pack.resolve(pack.readChoices(instanceDir), lock);
  const chosen = lock.mods.filter(m => install.has(m.slug));
  for (const mod of chosen) {
    const { url, filename, sha512, size } = mod.file;
    if (!SAFE.test(filename)) throw new Error(`Unsafe file name in lock: ${filename}`);
    if (skip.has(filename)) continue;
    keep.add(filename);
    tasks.push({ url, dest: path.join(dir, filename), sha512, size, group: 'mod' });
  }
  const copies = bundled.map(source => {
    const name = path.basename(source);
    if (!SAFE.test(name)) throw new Error(`Unsafe bundled mod name: ${name}`);
    keep.add(name);
    return { source, dest: path.join(dir, name) };
  });
  return {
    tasks,
    enabled: chosen.map(m => m.slug).concat(copies.length ? ['petal'] : []),
    async finalize() {
      await fsp.mkdir(dir, { recursive: true });
      for (const { source, dest } of copies) {
        const same = fs.existsSync(dest) && (await hashFile(source, 'sha256')) === (await hashFile(dest, 'sha256'));
        if (!same) await fsp.copyFile(source, dest);
      }
      for (const name of await readManaged(dir)) {
        if (!keep.has(name)) await fsp.rm(path.join(dir, name), { force: true });
      }
      // Two copies of one mod stop Fabric from starting. When a player added their own copy of a mod
      // Petal also installs, Petal removes its copy (never theirs) and remembers why.
      const shadowed = [...stillShadowed];
      const own = new Map();
      for (const name of await fsp.readdir(dir).catch(() => [])) {
        if (!name.toLowerCase().endsWith('.jar') || keep.has(name)) continue;
        const id = await modId(path.join(dir, name));
        if (id) own.set(id, name);
      }
      const bundledNames = new Set(copies.map(c => path.basename(c.dest)));
      for (const name of [...keep]) {
        if (bundledNames.has(name) || !own.size) continue;
        const id = await modId(path.join(dir, name));
        if (id && own.has(id)) {
          await fsp.rm(path.join(dir, name), { force: true });
          keep.delete(name);
          shadowed.push({ file: name, by: own.get(id), id });
        }
      }
      await fsp.writeFile(path.join(dir, MANAGED_FILE), JSON.stringify({ note: 'Files managed by Petal Client. Your own mods are left alone.', files: [...keep], shadowed }, null, 2));
      return { shadowed };
    }
  };
}

module.exports = { planMods };
