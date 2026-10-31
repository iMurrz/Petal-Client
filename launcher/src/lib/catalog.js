const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { getJson, download, hashFile } = require('./http');
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
async function search({ query = '', type = 'mod', gameVersion, loader, offset = 0 } = {}, signal) {
  if (!['mod', 'modpack'].includes(type)) throw Error('Choose mods or modpacks.');
  const facets = [[`project_type:${type}`]];
  if (type === 'mod') {
    if (!ID.test(gameVersion || '') || loader !== 'fabric') throw Error('Select a Fabric instance to browse compatible mods.');
    facets.push([`versions:${gameVersion}`], ['categories:fabric']);
  }
  const result = await getJson(`${API}/search?query=${encodeURIComponent(String(query).slice(0, 100))}&facets=${q(facets)}&index=relevance&limit=12&offset=${Math.max(0, Math.min(10000, Number(offset) | 0))}`, { signal });
  return { total: result.total_hits, offset: result.offset, hits: result.hits.map(hit => ({ id: hit.project_id, slug: hit.slug, title: hit.title, description: hit.description, downloads: hit.downloads, type: hit.project_type })) };
}
async function versions(projectId, { type = 'mod', gameVersion } = {}, signal) {
  if (!['mod', 'modpack'].includes(type)) throw Error('Choose mods or modpacks.');
  const filter = type === 'mod' ? `?loaders=${q(['fabric'])}&game_versions=${q([gameVersion])}` : '';
  const data = await getJson(`${API}/project/${id(projectId)}/version${filter}`, { signal });
  return data.filter(v => !v.status || v.status === 'listed').slice(0, 100).map(v => ({ id: v.id, projectId: v.project_id, name: v.name, number: v.version_number, games: v.game_versions, loaders: v.loaders, channel: v.version_type }));
}
async function installed(directory) {
  try {
    const saved = JSON.parse(await fs.readFile(path.join(directory, '.petal-catalog.json'), 'utf8'));
    if (!Array.isArray(saved.mods) || saved.mods.some(m => !ID.test(m.projectId || '') || !FILE.test(m.filename || '') || !m.filename.endsWith('.jar') || !/^[a-f0-9]{128}$/i.test(m.sha512 || '') || !Array.isArray(m.dependencies))) throw Error('Invalid catalog index.');
    return saved.mods;
  } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function saveInstalled(directory, mods) {
  const file = path.join(directory, '.petal-catalog.json');
  await fs.writeFile(`${file}.tmp`, JSON.stringify({ mods }, null, 2));
  await fs.rename(`${file}.tmp`, file);
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
module.exports = { search, versions, version, project, artifact, installed, installMod, disableMod };
