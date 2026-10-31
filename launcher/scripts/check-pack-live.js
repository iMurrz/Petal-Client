#!/usr/bin/env node
// Downloads every jar pinned in mods-lock.json into a temporary folder, verifies its sha512, and reads
// fabric.mod.json to catch problems before a player launches: missing dependencies, two jars with the same
// mod id, and declared "breaks" between mods that are on together. It checks the default selection and the
// everything-on selection. Needs access to cdn.modrinth.com. Run: node scripts/check-pack-live.js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { download } = require('../src/lib/http');
const { readZipEntry, openZip } = require('../src/lib/zip');
const pack = require('../src/lib/pack');
const lock = require('../src/lib/game/mods-lock.json');

// Provided by the game, the loader or Java rather than by a jar in the pack.
const PLATFORM = new Set(['minecraft', 'fabricloader', 'fabric-loader', 'java']);

function parseModJson(buf) {
  return JSON.parse(buf.toString('utf8').replace(/[\r\n\t]+/g, ' '));
}

/** Top-level mod plus nested jar-in-jar mods (META-INF/jars), which also provide ids. */
async function describe(file) {
  const out = [];
  const visit = async (source, nested) => {
    const raw = Buffer.isBuffer(source) ? await (async () => { const z = await openZip(source); try { const e = z.entries.find(x => x.name === 'fabric.mod.json'); return e ? z.read(e) : null; } finally { await z.close(); } })() : await readZipEntry(source, 'fabric.mod.json');
    if (!raw) return;
    const json = parseModJson(raw);
    out.push({ id: json.id, provides: json.provides || [], depends: json.depends || {}, breaks: json.breaks || {}, nested });
    for (const jar of json.jars || []) {
      try {
        const zip = await openZip(source);
        try {
          const entry = zip.entries.find(e => e.name === jar.file);
          if (entry) await visit(await zip.read(entry), true);
        } finally { await zip.close(); }
      } catch { /* unreadable nested jar: skip */ }
    }
  };
  await visit(file, false);
  return out;
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'petal-pack-live-'));
  const info = new Map();
  try {
    for (const mod of lock.mods) {
      const file = path.join(dir, mod.file.filename);
      await download(mod.file.url, file, { sha512: mod.file.sha512, size: mod.file.size });
      info.set(mod.slug, await describe(file));
      process.stdout.write('.');
    }
    console.log(`\nDownloaded and verified ${lock.mods.length} jars.`);
    let problems = 0;
    const selections = {
      default: pack.resolve({}, lock).install,
      'everything on': pack.resolve(Object.fromEntries(lock.mods.map(m => [m.slug, true])), lock).install
    };
    for (const [label, install] of Object.entries(selections)) {
      const mods = [...install].flatMap(slug => (info.get(slug) || []).map(d => ({ ...d, slug })));
      const ids = new Set(mods.flatMap(m => [m.id, ...m.provides]));
      const top = mods.filter(m => !m.nested);
      const seen = new Map();
      for (const m of top) {
        if (seen.has(m.id)) { problems++; console.log(`[${label}] duplicate mod id ${m.id}: ${seen.get(m.id)} and ${m.slug}`); }
        seen.set(m.id, m.slug);
      }
      for (const m of top) {
        for (const dep of Object.keys(m.depends)) {
          if (PLATFORM.has(dep) || ids.has(dep)) continue;
          if (dep === 'petal' || dep === 'petal-client') continue;
          problems++; console.log(`[${label}] ${m.slug} (${m.id}) needs "${dep}", which nothing in the pack provides`);
        }
        for (const other of Object.keys(m.breaks)) {
          if (ids.has(other)) { problems++; console.log(`[${label}] ${m.slug} (${m.id}) declares it breaks "${other}"`); }
        }
        const mc = m.depends.minecraft;
        const ranges = [].concat(mc || []).join(' ');
        if (mc && !/1\.21\.11|\*|>=?\s*1\.21(\.\d+)?(?!\.)|~1\.21/.test(ranges)) console.log(`[${label}] note: ${m.slug} declares minecraft ${ranges}`);
      }
      console.log(`[${label}] ${top.length} mods checked.`);
    }
    console.log(problems ? `${problems} problem(s) found.` : 'No missing dependencies, duplicate ids or declared breaks.');
    process.exitCode = problems ? 1 : 0;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
