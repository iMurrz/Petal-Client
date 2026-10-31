const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { hashFile } = require('../http');
const lock = require('./mods-lock.json');

const MANAGED_FILE = '.petal-managed.json';
const SAFE = /^[A-Za-z0-9 _.+()'!\[\]-]+\.zip$/;
// Bundled packs that start switched on, top of the stack last. Petal Textures ships too but starts off:
// it is the alternative to Faithful, and whichever sits higher wins.
const ON_BY_DEFAULT = ['Petal-UI-64x.zip'];

async function readManaged(dir) {
  try {
    const data = JSON.parse(await fsp.readFile(path.join(dir, MANAGED_FILE), 'utf8'));
    const text = v => typeof v === 'string';
    return {
      files: Array.isArray(data.files) ? data.files.filter(f => text(f) && SAFE.test(f)) : [],
      // Which file each pack used last time, so a new Faithful build replaces the old one in options.txt.
      slugs: data.slugs && typeof data.slugs === 'object' ? data.slugs : {},
      // Packs Petal has already switched on once. Petal never switches them on again after that.
      offered: Array.isArray(data.offered) ? data.offered.filter(text) : []
    };
  } catch {
    return { files: [], slugs: {}, offered: [] };
  }
}

/** options.txt keeps lists as JSON arrays: resourcePacks:["vanilla","file/x.zip"]. */
function readList(lines, key) {
  const line = lines.find(l => l.startsWith(`${key}:`));
  if (!line) return null;
  try { const value = JSON.parse(line.slice(key.length + 1)); return Array.isArray(value) ? value.filter(v => typeof v === 'string') : null; } catch { return null; }
}
function writeList(lines, key, list) {
  const out = lines.filter(l => !l.startsWith(`${key}:`));
  out.push(`${key}:${JSON.stringify(list)}`);
  return out;
}

/**
 * The resource pack order, bottom first as options.txt stores it. Packs in `add` are switched on in their
 * place in `stack` (Faithful under Petal UI). Everything else is the player's order: Petal only swaps a
 * pack's old file for its new one when a pinned build changes.
 */
function orderPacks(current, { renamed = new Map(), add = [], stack = [] }) {
  const list = [...new Set((current || ['vanilla']).map(id => renamed.get(id) || id))];
  if (!list.includes('vanilla')) list.unshift('vanilla');
  for (const id of add) {
    if (list.includes(id)) continue;
    const above = list.findIndex(other => stack.indexOf(other) > stack.indexOf(id));
    if (above === -1) list.push(id); else list.splice(above, 0, id);
  }
  return list;
}

/**
 * Plans the instance's resourcepacks folder: pinned packs from mods-lock.json (hash-checked Modrinth downloads)
 * and the Petal packs shipped with the launcher. Like mods, only files Petal placed itself are ever removed.
 */
async function planResourcePacks(instanceDir, bundled = []) {
  const dir = path.join(instanceDir, 'resourcepacks');
  const keep = new Set();
  const tasks = [];
  const slugs = {};
  for (const pack of lock.resourcepacks || []) {
    const { url, filename, sha512, size } = pack.file;
    if (!SAFE.test(filename)) throw new Error(`Unsafe resource pack name in lock: ${filename}`);
    keep.add(filename);
    slugs[pack.slug] = filename;
    tasks.push({ url, dest: path.join(dir, filename), sha512, size, group: 'resourcepack' });
  }
  const copies = bundled.map(source => {
    const name = path.basename(source);
    if (!SAFE.test(name)) throw new Error(`Unsafe bundled resource pack name: ${name}`);
    keep.add(name);
    slugs[`bundled:${name}`] = name;
    return { source, dest: path.join(dir, name) };
  });
  return {
    tasks,
    async finalize() {
      await fsp.mkdir(dir, { recursive: true });
      for (const { source, dest } of copies) {
        const same = fs.existsSync(dest) && (await hashFile(source, 'sha256')) === (await hashFile(dest, 'sha256'));
        if (!same) await fsp.copyFile(source, dest);
      }
      const previous = await readManaged(dir);
      for (const name of previous.files) if (!keep.has(name)) await fsp.rm(path.join(dir, name), { force: true });

      const renamed = new Map();
      for (const [slug, name] of Object.entries(previous.slugs)) {
        if (typeof name === 'string' && slugs[slug] && slugs[slug] !== name) renamed.set(`file/${name}`, `file/${slugs[slug]}`);
      }
      // Bottom to top: pinned packs (Faithful), then Petal UI.
      const stack = [
        ...(lock.resourcepacks || []).filter(p => p.defaultEnabled !== false).map(p => p.slug),
        ...ON_BY_DEFAULT.map(name => `bundled:${name}`)
      ].filter(slug => slugs[slug]);
      const add = stack.filter(slug => !previous.offered.includes(slug));
      if (add.length || renamed.size) {
        const id = slug => `file/${slugs[slug]}`;
        await applyOrder(instanceDir, { renamed, add: add.map(id), stack: stack.map(id) });
      }
      await fsp.writeFile(path.join(dir, MANAGED_FILE), JSON.stringify({
        note: 'Resource packs managed by Petal Client. Your own packs are left alone.',
        files: [...keep], slugs, offered: [...new Set([...previous.offered, ...stack])]
      }, null, 2));
    }
  };
}

async function applyOrder(instanceDir, options) {
  const file = path.join(instanceDir, 'options.txt');
  let text = '';
  try { text = await fsp.readFile(file, 'utf8'); } catch { /* written below */ }
  let lines = text.split(/\r?\n/).filter(Boolean);
  const order = orderPacks(readList(lines, 'resourcePacks'), options);
  lines = writeList(lines, 'resourcePacks', order);
  // Minecraft drops a selected pack that declares an older format unless it is also listed here, so a
  // Faithful build made for 1.21.10 still loads on 1.21.11.
  const incompatible = (readList(lines, 'incompatibleResourcePacks') || []).map(id => options.renamed.get(id) || id);
  for (const id of options.add) if (!incompatible.includes(id)) incompatible.push(id);
  lines = writeList(lines, 'incompatibleResourcePacks', [...new Set(incompatible)].filter(id => order.includes(id)));
  await fsp.writeFile(file, `${lines.join('\n')}\n`);
}

module.exports = { planResourcePacks, orderPacks, readList };
