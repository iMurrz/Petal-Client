const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { hashFile } = require('../http');
const lock = require('./mods-lock.json');
const pack = require('../pack');

const MANAGED_FILE = '.petal-managed.json';
const SAFE = /^[A-Za-z0-9 _.+()'!-]+\.jar$/;

async function readManaged(dir) {
  try {
    const data = JSON.parse(await fsp.readFile(path.join(dir, MANAGED_FILE), 'utf8'));
    return Array.isArray(data.files) ? data.files.filter(f => typeof f === 'string' && SAFE.test(f)) : [];
  } catch {
    return [];
  }
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
  // Required mods, the Petal Pack mods this player has on, and the libraries those need.
  const { install } = pack.resolve(pack.readChoices(instanceDir), lock);
  const chosen = lock.mods.filter(m => install.has(m.slug));
  for (const mod of chosen) {
    const { url, filename, sha512, size } = mod.file;
    if (!SAFE.test(filename)) throw new Error(`Unsafe file name in lock: ${filename}`);
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
      await fsp.writeFile(path.join(dir, MANAGED_FILE), JSON.stringify({ note: 'Files managed by Petal Client. Your own mods are left alone.', files: [...keep] }, null, 2));
    }
  };
}

module.exports = { planMods };
