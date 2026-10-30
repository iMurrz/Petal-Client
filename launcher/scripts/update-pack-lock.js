#!/usr/bin/env node
// Pins the Petal Pack (src/lib/game/pack-manifest.json) to exact Modrinth builds in mods-lock.json.
// For every listed mod it picks the newest release build for the manifest's Minecraft version and
// loader (falling back to beta, then alpha), records its sha512 and size, and adds required
// dependencies as library entries. Mods without a compatible build are listed under "unavailable".
// Fabric API (category "required") is kept as it is. Run: node scripts/update-pack-lock.js [--dry-run]
const fs = require('node:fs');
const path = require('node:path');
const { getJson } = require('../src/lib/http');
const { artifact } = require('../src/lib/catalog');

const API = 'https://api.modrinth.com/v2';
const LOCK = path.join(__dirname, '..', 'src', 'lib', 'game', 'mods-lock.json');
const MANIFEST = path.join(__dirname, '..', 'src', 'lib', 'game', 'pack-manifest.json');
const q = value => encodeURIComponent(JSON.stringify(value));
const CHANNELS = ['release', 'beta', 'alpha'];

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
const { gameVersion, loader } = manifest;
const projects = new Map(); // id or slug -> project
const entries = new Map(); // project id -> lock entry
const unavailable = [];
const errors = []; // network or API failures: the lock is not written while any remain

async function project(idOrSlug) {
  if (projects.has(idOrSlug)) return projects.get(idOrSlug);
  const info = await getJson(`${API}/project/${encodeURIComponent(idOrSlug)}`, { retries: 2 });
  projects.set(info.id, info);
  projects.set(info.slug, info);
  projects.set(idOrSlug, info);
  return info;
}

/** Finds a project by slug, or by exact title when the slug guess is wrong. */
async function findProject(item) {
  try { return await project(item.slug); } catch (error) { if (error.status !== 404) throw error; }
  const result = await getJson(`${API}/search?query=${encodeURIComponent(item.name)}&facets=${q([['project_type:mod'], [`versions:${gameVersion}`], [`categories:${loader}`]])}&limit=10`);
  const hit = result.hits.find(h => h.title.toLowerCase() === item.name.toLowerCase()) || result.hits.find(h => h.title.toLowerCase().startsWith(item.name.toLowerCase()));
  return hit ? project(hit.project_id) : null;
}

async function bestBuild(projectId) {
  const builds = await getJson(`${API}/project/${projectId}/version?loaders=${q([loader])}&game_versions=${q([gameVersion])}`);
  const listed = builds.filter(b => !b.status || b.status === 'listed');
  for (const channel of CHANNELS) {
    const build = listed.find(b => b.version_type === channel);
    if (build) return build;
  }
  return null;
}

async function pin(info, build, fields) {
  const file = artifact(build.files.find(f => f.primary) || build.files[0], '.jar');
  const entry = {
    slug: info.slug,
    kind: 'mod',
    name: String(info.title).slice(0, 80),
    description: String(info.description || '').slice(0, 200),
    ...fields,
    projectId: info.id,
    version: build.version_number,
    versionId: build.id,
    channel: build.version_type,
    file: { url: file.url, filename: file.filename, sha512: file.hashes.sha512, size: file.size },
    dependencies: [],
    incompatible: []
  };
  entries.set(info.id, entry);
  for (const dep of build.dependencies || []) {
    if (!dep.project_id && !dep.version_id) continue;
    if (dep.dependency_type === 'incompatible') {
      const other = dep.project_id ? await project(dep.project_id).catch(() => null) : null;
      if (other) entry.incompatible.push(other.slug);
      continue;
    }
    if (dep.dependency_type !== 'required') continue;
    const depBuild = dep.version_id ? await getJson(`${API}/version/${dep.version_id}`) : await bestBuild(dep.project_id);
    const depInfo = await project(dep.project_id || depBuild?.project_id);
    if (depInfo.slug === 'fabric-api') { entry.dependencies.push('fabric-api'); continue; }
    if (!depBuild) throw new Error(`${info.title} needs ${depInfo.title}, which has no ${gameVersion} ${loader} build.`);
    entry.dependencies.push(depInfo.slug);
    if (!entries.has(depInfo.id)) await pin(depInfo, depBuild, { category: 'library', defaultEnabled: false });
  }
  return entry;
}

(async () => {
  for (const item of manifest.mods) {
    process.stdout.write(`${item.name}… `);
    try {
      const info = await findProject(item);
      if (!info) { unavailable.push({ slug: item.slug, name: item.name, reason: 'Not found on Modrinth.' }); console.log('not found'); continue; }
      if (info.project_type !== 'mod') { unavailable.push({ slug: info.slug, name: item.name, reason: `A ${info.project_type}, not a mod.` }); console.log(info.project_type); continue; }
      if (info.client_side === 'unsupported') { unavailable.push({ slug: info.slug, name: item.name, reason: 'Server-only mod.' }); console.log('server-only'); continue; }
      const build = await bestBuild(info.id);
      if (!build) { unavailable.push({ slug: info.slug, name: item.name, reason: `No ${gameVersion} ${loader} build yet.` }); console.log('no build'); continue; }
      const existing = entries.get(info.id);
      const fields = { category: item.category, defaultEnabled: !item.off, ...(item.note ? { note: item.note } : {}) };
      // A mod first pinned as someone's library is promoted to a listed pack mod.
      if (existing) Object.assign(existing, fields);
      else await pin(info, build, fields);
      console.log(`${build.version_number} (${build.version_type})`);
    } catch (error) {
      errors.push(`${item.name}: ${error.message}`);
      console.log(`failed: ${error.message}`);
    }
  }
  const required = lock.mods.filter(m => m.category === 'required');
  const pack = [...entries.values()].filter(e => !required.some(r => r.slug === e.slug));
  const clashes = [];
  for (const e of pack) for (const other of e.incompatible) if (pack.some(p => p.slug === other && p.defaultEnabled && e.defaultEnabled)) clashes.push(`${e.slug} vs ${other}`);
  const next = { gameVersion, loader, generatedAt: new Date().toISOString(), mods: [...required, ...pack], unavailable, skipped: manifest.skipped };
  console.log(`\n${pack.filter(e => e.category !== 'library').length} pack mods, ${pack.filter(e => e.category === 'library').length} libraries, ${unavailable.length} unavailable.`);
  for (const u of unavailable) console.log(`  unavailable: ${u.name}: ${u.reason}`);
  if (clashes.length) console.log(`  incompatible pairs both on by default: ${clashes.join(', ')}`);
  if (errors.length) { console.error(`\n${errors.length} lookups failed, so mods-lock.json was left unchanged. Check access to api.modrinth.com and cdn.modrinth.com.`); process.exit(1); }
  if (process.argv.includes('--dry-run')) return;
  fs.writeFileSync(LOCK, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Wrote ${path.relative(process.cwd(), LOCK)}`);
})().catch(error => { console.error(error); process.exit(1); });
