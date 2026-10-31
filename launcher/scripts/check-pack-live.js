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

// Provided by the game, the loader or Java rather than by a jar in the pack (Fabric Loader has bundled
// MixinExtras since 0.15).
const PLATFORM = new Set(['minecraft', 'fabricloader', 'fabric-loader', 'java', 'mixinextras']);

/** Fabric-style version: numeric core compared part by part; a pre-release sorts before its release; build metadata ignored. */
function parse(v) {
  const m = /^v?(\d+(?:\.\d+)*)(?:-([^+]*))?(?:\+.*)?$/.exec(String(v).trim());
  return m ? { core: m[1].split('.').map(Number), pre: m[2] ?? null } : null;
}
function compare(a, b) {
  const len = Math.max(a.core.length, b.core.length);
  for (let i = 0; i < len; i++) { const d = (a.core[i] || 0) - (b.core[i] || 0); if (d) return d; }
  if (a.pre === b.pre) return 0;
  if (a.pre === null) return 1;
  if (b.pre === null) return -1;
  return a.pre.localeCompare(b.pre, undefined, { numeric: true });
}
/**
 * Does `version` satisfy a Fabric predicate? A string is space-separated terms that must all hold; an array
 * is any-of. Terms: *, =x, >x, >=x, <x, <=x, ~x (same minor), ^x (same major), x.y.x wildcards.
 * Returns null when a version can't be parsed, so the caller reports it instead of guessing.
 */
function satisfies(version, predicate) {
  if (Array.isArray(predicate)) return predicate.length === 0 || predicate.some(p => satisfies(version, p));
  const v = parse(version);
  if (!v) return null;
  for (const term of String(predicate).trim().split(/\s+/).filter(Boolean)) {
    if (term === '*') continue;
    const m = /^(>=|<=|>|<|=|~|\^)?(.+)$/.exec(term);
    const op = m[1] || '=';
    if (/[xX*]/.test(m[2])) {
      const prefix = m[2].split('.').filter(p => !/^[xX*]$/.test(p)).map(Number);
      if (prefix.some((n, i) => v.core[i] !== n)) return false;
      continue;
    }
    const t = parse(m[2]);
    if (!t) return null;
    const c = compare(v, t);
    const ok = op === '=' ? c === 0 : op === '>' ? c > 0 : op === '>=' ? c >= 0 : op === '<' ? c < 0 : op === '<=' ? c <= 0
      : op === '~' ? c >= 0 && v.core[0] === t.core[0] && (v.core[1] || 0) === (t.core[1] || 0)
      : c >= 0 && v.core[0] === t.core[0];
    if (!ok) return false;
  }
  return true;
}

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
    out.push({ id: json.id, version: String(json.version || ''), provides: json.provides || [], depends: json.depends || {}, breaks: json.breaks || {}, nested });
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

if (require.main === module) (async () => {
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
      const versions = new Map();
      for (const m of mods) for (const id of [m.id, ...m.provides]) if (!versions.has(id) || !m.nested) versions.set(id, m.version);
      const top = mods.filter(m => !m.nested);
      const seen = new Map();
      for (const m of top) {
        if (seen.has(m.id)) { problems++; console.log(`[${label}] duplicate mod id ${m.id}: ${seen.get(m.id)} and ${m.slug}`); }
        seen.set(m.id, m.slug);
      }
      for (const m of top) {
        for (const [dep, range] of Object.entries(m.depends)) {
          if (PLATFORM.has(dep)) continue;
          if (!ids.has(dep)) { problems++; console.log(`[${label}] ${m.slug} (${m.id}) needs "${dep}", which nothing in the pack provides`); continue; }
          const ok = satisfies(versions.get(dep), range);
          if (ok === false) { problems++; console.log(`[${label}] ${m.slug} (${m.id}) needs ${dep} ${JSON.stringify(range)}, pack has ${versions.get(dep)}`); }
          if (ok === null) console.log(`[${label}] check by hand: ${m.slug} needs ${dep} ${JSON.stringify(range)}, pack has ${versions.get(dep)}`);
        }
        for (const [other, range] of Object.entries(m.breaks)) {
          if (!ids.has(other)) continue;
          const hit = satisfies(versions.get(other), range);
          if (hit === true) { problems++; console.log(`[${label}] ${m.slug} (${m.id}) breaks ${other} ${JSON.stringify(range)}, and the pack has ${versions.get(other)}`); }
          if (hit === null) console.log(`[${label}] check by hand: ${m.slug} breaks ${other} ${JSON.stringify(range)}, pack has ${versions.get(other)}`);
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

module.exports = { satisfies };
