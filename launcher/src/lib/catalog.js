const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { getJson, request, download, hashFile } = require('./http');
const API = 'https://api.modrinth.com/v2';
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const FILE = /^[A-Za-z0-9 _.+()'!\[\]-]+\.(jar|mrpack|zip)$/;
const q = value => encodeURIComponent(JSON.stringify(value));
function id(value) { if (typeof value !== 'string' || !ID.test(value)) throw Error('Invalid Modrinth ID.'); return value; }
function artifact(file, extension) {
  if (!file || !FILE.test(file.filename) || !file.filename.endsWith(extension) || !/^[a-f0-9]{128}$/i.test(file.hashes?.sha512 || '') || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > 512 * 1024 ** 2) throw Error('Invalid or unverified Modrinth file.');
  const url = new URL(file.url);
  if (url.protocol !== 'https:' || url.hostname !== 'cdn.modrinth.com' || url.username || url.password || url.port) throw Error('Unexpected Modrinth download host.');
  return file;
}
async function project(value, signal) { return getJson(`${API}/project/${id(value)}`, { signal }); }
async function version(value, signal) { return getJson(`${API}/version/${id(value)}`, { signal }); }
// What the Downloads page browses. Mods install into the selected Fabric instance with their required
// dependencies; resource packs and shaders are single files; modpacks become their own instance.
const TYPES = {
  mod: { label: 'mods' },
  modpack: { label: 'modpacks' },
  resourcepack: { label: 'resource packs', folder: 'resourcepacks', loaders: ['minecraft'] },
  shader: { label: 'shaders', folder: 'shaderpacks', loaders: ['iris', 'optifine'] }
};
const SORTS = new Set(['relevance', 'downloads', 'follows', 'newest', 'updated']);
const CATEGORY = /^[a-z0-9-]{1,40}$/;
const GAME = /^\d+\.\d+(?:\.\d+)?$/; // a Minecraft release such as 1.21.11
const PAGE = 20;
function type(value) { if (!TYPES[value]) throw Error('Choose mods, resource packs, shaders or modpacks.'); return value; }
/** Project icons come from Modrinth's CDN only; anything else is dropped rather than shown. */
function iconUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'cdn.modrinth.com' && !url.username && !url.port ? url.href : null; }
  catch { return null; }
}
async function search({ query = '', type: kind = 'mod', gameVersion, loader, offset = 0, sort = 'relevance', category } = {}, signal) {
  type(kind);
  const facets = [[`project_type:${kind}`]];
  if (kind === 'mod') {
    if (!GAME.test(gameVersion || '') || loader !== 'fabric') throw Error('Select a Fabric instance to browse compatible mods.');
    facets.push([`versions:${gameVersion}`], ['categories:fabric']);
  } else if (kind !== 'modpack' && GAME.test(gameVersion || '')) {
    facets.push([`versions:${gameVersion}`]);
  }
  if (kind === 'shader') facets.push(['categories:iris', 'categories:optifine']);
  if (category) {
    if (!CATEGORY.test(category)) throw Error('Unknown category.');
    facets.push([`categories:${category}`]);
  }
  const index = SORTS.has(sort) ? sort : 'relevance';
  const start = Math.max(0, Math.min(10000, Number(offset) | 0));
  const result = await getJson(`${API}/search?query=${encodeURIComponent(String(query).slice(0, 100))}&facets=${q(facets)}&index=${index}&limit=${PAGE}&offset=${start}`, { signal });
  return {
    total: result.total_hits, offset: result.offset, limit: PAGE,
    hits: result.hits.map(hit => ({
      id: hit.project_id, slug: hit.slug, title: String(hit.title || '').slice(0, 100), description: String(hit.description || '').slice(0, 300),
      author: String(hit.author || '').slice(0, 60), downloads: hit.downloads, follows: hit.follows, type: hit.project_type,
      icon: iconUrl(hit.icon_url), categories: (hit.display_categories || hit.categories || []).filter(c => CATEGORY.test(c)).slice(0, 4),
      updated: hit.date_modified || null
    }))
  };
}
async function versions(projectId, { type: kind = 'mod', gameVersion } = {}, signal) {
  type(kind);
  let filter = '';
  if (kind === 'mod') filter = `?loaders=${q(['fabric'])}&game_versions=${q([gameVersion])}`;
  else if (TYPES[kind].loaders) filter = `?loaders=${q(TYPES[kind].loaders)}`;
  const data = (await getJson(`${API}/project/${id(projectId)}/version${filter}`, { signal })).filter(v => !v.status || v.status === 'listed');
  const builds = data.slice(0, 100).map(v => {
    const file = v.files.find(f => f.primary) || v.files[0];
    return { id: v.id, projectId: v.project_id, name: v.name, number: v.version_number, games: v.game_versions, loaders: v.loaders, channel: v.version_type,
      matches: kind === 'modpack' || v.game_versions.includes(gameVersion), size: file?.size ?? null };
  });
  // Packs often skip a minor game version in their metadata; builds for this version come first.
  return kind === 'mod' || kind === 'modpack' ? builds : builds.filter(b => b.matches).concat(builds.filter(b => !b.matches));
}

/** A project icon as a data: URL (the renderer's content policy only allows data: images). Cached. */
const iconCache = new Map();
async function icon(value, signal) {
  const url = iconUrl(value);
  if (!url) return null;
  if (iconCache.has(url)) return iconCache.get(url);
  let data = null;
  try {
    const res = await request(url, { signal, retries: 1, timeout: 15000 });
    const mime = (res.headers.get('content-type') || '').split(';')[0].trim();
    const body = Buffer.from(await res.arrayBuffer());
    if (/^image\/(png|jpeg|webp|gif)$/.test(mime) && body.length <= 512 * 1024) data = `data:${mime};base64,${body.toString('base64')}`;
  } catch { /* no icon: the card shows initials */ }
  if (iconCache.size > 400) iconCache.clear();
  iconCache.set(url, data);
  return data;
}
async function icons(urls, signal) {
  const list = [...new Set((Array.isArray(urls) ? urls : []).slice(0, 40))];
  const out = {};
  await Promise.all(list.map(async url => { out[url] = await icon(url, signal); }));
  return out;
}
async function readIndex(directory) {
  try { return JSON.parse(await fs.readFile(path.join(directory, '.petal-catalog.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return {}; throw error; }
}
async function installed(directory) {
  const saved = await readIndex(directory);
  if (saved.mods === undefined) return [];
  if (!Array.isArray(saved.mods) || saved.mods.some(m => !ID.test(m.projectId || '') || !FILE.test(m.filename || '') || !m.filename.endsWith('.jar') || !/^[a-f0-9]{128}$/i.test(m.sha512 || '') || !Array.isArray(m.dependencies))) throw Error('Invalid catalog index.');
  return saved.mods;
}
/** Resource packs and shaders Petal downloaded into this instance. Unreadable entries are skipped. */
async function installedPacks(directory) {
  const saved = await readIndex(directory).catch(() => ({}));
  return (Array.isArray(saved.packs) ? saved.packs : []).filter(p => ID.test(p.projectId || '') && TYPES[p.type]?.folder && FILE.test(p.filename || '') && p.filename.endsWith('.zip'));
}
async function writeIndex(directory, changes) {
  const file = path.join(directory, '.petal-catalog.json');
  const current = await readIndex(directory).catch(() => ({}));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(`${file}.tmp`, JSON.stringify({ ...current, ...changes }, null, 2));
  await fs.rename(`${file}.tmp`, file);
}
async function saveInstalled(directory, mods) {
  await writeIndex(directory, { mods });
}
async function installMod(directory, instance, versionId, { signal, progress = () => {} } = {}) {
  if (instance.loader !== 'fabric') throw Error('Create or select a Fabric instance before adding mods.');
  const existing = await installed(directory);
  const planned = new Map();
  const visiting = new Set();
  async function collect(build) {
    if (visiting.has(build.id)) return;
    visiting.add(build.id);
    if (visiting.size > 128) throw Error('Dependency graph exceeds the supported limit.');
    if (!build.game_versions.includes(instance.gameVersion) || !build.loaders.includes('fabric')) throw Error(`A required mod is incompatible with ${instance.gameVersion} / Fabric.`);
    const info = await project(build.project_id, signal);
    if (info.project_type !== 'mod' || info.client_side === 'unsupported') throw Error('This project is not a client-compatible mod.');
    if (instance.petal && info.slug === 'fabric-api') {
      if (versionId === build.id) throw Error('Petal manages its own Fabric API. Use a separate Fabric instance to choose another build.');
      return;
    }
    const old = existing.find(m => m.projectId === build.project_id);
    if (old) { if (old.versionId !== build.id) throw Error(`${info.title} is already installed with another build. Disable it first before changing versions.`); return; }
    const other = planned.get(build.project_id);
    if (other) { if (other.versionId !== build.id) throw Error('Required dependencies select conflicting builds.'); return; }
    const file = artifact(build.files.find(f => f.primary) || build.files[0], '.jar');
    const record = { projectId: build.project_id, versionId: build.id, name: String(info.title).slice(0, 100), filename: file.filename, sha512: file.hashes.sha512, dependencies: [] };
    planned.set(build.project_id, { ...record, file });
    for (const dependency of build.dependencies || []) {
      if (dependency.dependency_type === 'incompatible') {
        if (existing.some(m => m.projectId === dependency.project_id)) throw Error(`${info.title} conflicts with an installed mod.`);
        continue;
      }
      if (dependency.dependency_type !== 'required') continue;
      let required;
      if (dependency.version_id) required = await version(dependency.version_id, signal);
      else if (dependency.project_id) {
        const already = existing.find(m => m.projectId === dependency.project_id);
        if (already) { record.dependencies.push(dependency.project_id); continue; }
        const builds = await versions(dependency.project_id, { gameVersion: instance.gameVersion }, signal);
        const choice = builds.find(v => v.channel === 'release') || builds[0];
        if (!choice) throw Error(`A required dependency of ${info.title} has no compatible build.`);
        required = await version(choice.id, signal);
      } else throw Error(`${info.title} has a required dependency without a downloadable project.`);
      record.dependencies.push(required.project_id);
      await collect(required);
    }
    planned.get(build.project_id).dependencies = record.dependencies;
  }
  await collect(await version(versionId, signal));
  const stage = path.join(directory, `.petal-download-${crypto.randomUUID()}`);
  await fs.mkdir(stage, { recursive: true });
  const added = [];
  try {
    await fs.mkdir(path.join(directory, 'mods'), { recursive: true });
    for (const record of planned.values()) {
      const destination = path.join(directory, 'mods', record.filename);
      try { await fs.access(destination); throw Error(`A file named ${record.filename} already exists. Your own mods are kept; choose another instance or remove the conflict yourself.`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      progress({ stage: 'mod', label: `Downloading ${record.name}` });
      await download(record.file.url, path.join(stage, record.filename), { sha512: record.sha512, size: record.file.size, signal });
    }
    for (const record of planned.values()) {
      if (signal?.aborted) throw signal.reason;
      const destination = path.join(directory, 'mods', record.filename);
      await fs.copyFile(path.join(stage, record.filename), destination, require('node:fs').constants.COPYFILE_EXCL);
      added.push(destination);
    }
    const records = [...planned.values()].map(({ file, ...record }) => record);
    await saveInstalled(directory, existing.concat(records));
    return records;
  } catch (error) {
    for (const file of added) await fs.unlink(file).catch(() => {});
    throw error;
  } finally {
    for (const name of await fs.readdir(stage).catch(() => [])) await fs.unlink(path.join(stage, name)).catch(() => {});
    await fs.rmdir(stage).catch(() => {});
  }
}
/** Downloads one resource pack or shader build (hash-checked) into the instance's folder for it. Never overwrites. */
async function installPack(directory, instance, versionId, { signal, progress = () => {} } = {}) {
  const build = await version(versionId, signal);
  const info = await project(build.project_id, signal);
  const kind = type(info.project_type);
  const folder = TYPES[kind].folder;
  if (!folder) throw Error('Use the mod or modpack installer for this project.');
  if (kind === 'shader') {
    if (instance.loader !== 'fabric') throw Error('Shaders need Iris, which runs on Fabric. Select a Fabric instance first.');
    if (!build.loaders.some(l => TYPES.shader.loaders.includes(l))) throw Error('This shader build is not made for Iris.');
  }
  const file = artifact(build.files.find(f => f.primary) || build.files[0], '.zip');
  const records = await installedPacks(directory);
  if (records.some(r => r.projectId === build.project_id && r.versionId === build.id)) return { record: records.find(r => r.versionId === build.id), already: true };
  const dir = path.join(directory, folder);
  const destination = path.join(dir, file.filename);
  await fs.mkdir(dir, { recursive: true });
  try { await fs.access(destination); throw Error(`${file.filename} is already in your ${TYPES[kind].label} folder.`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const stage = path.join(directory, `.petal-download-${crypto.randomUUID()}`);
  await fs.mkdir(stage, { recursive: true });
  try {
    progress({ stage: 'pack', label: `Downloading ${info.title}` });
    await download(file.url, path.join(stage, file.filename), { sha512: file.hashes.sha512, size: file.size, signal });
    await fs.copyFile(path.join(stage, file.filename), destination, require('node:fs').constants.COPYFILE_EXCL);
  } finally {
    await fs.rm(stage, { recursive: true, force: true }).catch(() => {});
  }
  const record = { projectId: build.project_id, versionId: build.id, type: kind, name: String(info.title).slice(0, 100), filename: file.filename, sha512: file.hashes.sha512 };
  await writeIndex(directory, { packs: records.filter(r => r.projectId !== build.project_id).concat(record) });
  return { record, already: false };
}
async function disableMod(directory, projectId) {
  const records = await installed(directory);
  const record = records.find(m => m.projectId === id(projectId));
  if (!record) throw Error('This mod was not installed by Petal.');
  if (records.some(m => m.dependencies.includes(projectId))) throw Error('Another downloaded mod requires this one. Disable that mod first.');
  const file = path.join(directory, 'mods', record.filename);
  if (await hashFile(file, 'sha512') !== record.sha512) throw Error('This mod file has changed. Petal has kept it untouched.');
  const disabled = `${file}.disabled-${crypto.randomUUID()}`;
  await fs.rename(file, disabled);
  try { await saveInstalled(directory, records.filter(m => m !== record)); }
  catch (error) { await fs.rename(disabled, file); throw error; }
  return installed(directory);
}
module.exports = { TYPES, search, versions, version, project, artifact, icons, installed, installedPacks, installMod, installPack, disableMod };
