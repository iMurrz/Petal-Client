const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { openZip } = require('./zip');
const { safeJoin } = require('./game/paths');
const { officialUrl, modern } = require('./game/versions');
const { download, hashFile, runPool, fileMatches } = require('./http');
const catalog = require('./catalog');
const ROOTS = new Set(['mods', 'config', 'defaultconfigs', 'resourcepacks', 'shaderpacks', 'kubejs', 'scripts', 'options.txt', 'servers.dat', 'datapacks']);
const HOSTS = ['cdn.modrinth.com', 'github.com', 'raw.githubusercontent.com', 'gitlab.com'];
const REDIRECTS = [...HOSTS, 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'];
function safePath(name) {
  if (typeof name !== 'string' || name.includes('\\') || name.includes('//') || name.length > 240 || !ROOTS.has(name.split('/')[0]) || /\.(exe|dll|bat|cmd|ps1|com|scr|msi)$/i.test(name)) throw Error('Unsupported pack file path.');
  safeJoin(path.resolve('pack-validation'), name);
  return name;
}
async function inspect(file) {
  const zip = await openZip(file);
  try {
    const indexes = zip.entries.filter(e => e.name === 'modrinth.index.json');
    if (indexes.length === 0 && zip.entries.some(e => e.name === 'manifest.json')) {
      const entry = zip.entries.find(e => e.name === 'manifest.json');
      if (entry.uncompressedSize > 1024 ** 2) throw Error('Manifest is too large.');
      const manifest = JSON.parse((await zip.read(entry)).toString('utf8'));
      return { name: String(manifest.name || 'CurseForge pack').slice(0, 100), gameVersion: String(manifest.minecraft?.version || ''), loader: String(manifest.minecraft?.modLoaders?.[0]?.id || 'unknown'), supported: false,
        reason: 'This is a CurseForge manifest ZIP. It lists file IDs rather than verified download URLs. Direct CurseForge resolution needs an API key; NeoForge launch support is not included in this Modrinth/Fabric release. The ZIP has been inspected, not installed.' };
    }
    if (indexes.length !== 1 || indexes[0].uncompressedSize > 1024 ** 2) throw Error('Choose a .mrpack with one modrinth.index.json manifest.');
    const index = JSON.parse((await zip.read(indexes[0])).toString('utf8'));
    if (index.formatVersion !== 1 || index.game !== 'minecraft' || typeof index.name !== 'string' || !Array.isArray(index.files) || index.files.length > 3000) throw Error('Unsupported Modrinth pack manifest.');
    const deps = index.dependencies || {};
    const loader = deps['fabric-loader'] ? 'fabric' : Object.keys(deps).length === 1 ? 'vanilla' : 'unsupported';
    const supported = modern(deps.minecraft || '') && ['fabric', 'vanilla'].includes(loader) && Object.keys(deps).every(k => ['minecraft', 'fabric-loader'].includes(k)) && (loader !== 'fabric' || /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(deps['fabric-loader']));
    const seen = new Set();
    let totalBytes = 0;
    const files = index.files.map(file => {
      const name = safePath(file.path), key = name.toLowerCase();
      if (seen.has(key)) throw Error('Duplicate pack download path.');
      seen.add(key);
      if (!/^[a-f0-9]{128}$/i.test(file.hashes?.sha512 || '') || !Number.isSafeInteger(file.fileSize) || file.fileSize < 0 || file.fileSize > 512 * 1024 ** 2 || !Array.isArray(file.downloads) || !file.downloads.length || file.downloads.length > 8) throw Error('Invalid or unverified pack file.');
      const environment = file.env?.client || 'required';
      if (!['required', 'optional', 'unsupported'].includes(environment)) throw Error('Invalid pack client environment.');
      totalBytes += file.fileSize;
      return { path: name, sha512: file.hashes.sha512, size: file.fileSize, urls: file.downloads.map(url => officialUrl(url, HOSTS)), client: environment };
    });
    const overrides = [];
    for (const prefix of ['overrides/', 'client-overrides/']) {
      const layer = new Set();
      for (const entry of zip.entries.filter(e => !e.directory && e.name.startsWith(prefix))) {
        const name = safePath(entry.name.slice(prefix.length));
        if (layer.has(name.toLowerCase()) || entry.uncompressedSize > 64 * 1024 ** 2) throw Error('Duplicate or oversized pack override.');
        layer.add(name.toLowerCase()); totalBytes += entry.uncompressedSize;
        overrides.push({ entry: entry.name, path: name });
      }
    }
    if (totalBytes > 8 * 1024 ** 3 || overrides.length > 30000) throw Error('This pack exceeds the installation size limit.');
    return { name: index.name.trim().slice(0, 100), version: String(index.versionId || '').slice(0, 80), gameVersion: deps.minecraft, loader, loaderVersion: deps['fabric-loader'] || '', supported,
      reason: supported ? 'Installs into a separate instance with the pack’s own mods and settings.' : 'This pack needs an unsupported loader or legacy Minecraft release. Fabric and Vanilla packs for 1.20 or newer are supported.',
      files, overrides, totalBytes, optional: files.filter(f => f.client === 'optional').length };
  } finally { await zip.close(); }
}
async function createStage(root) {
  const requested = path.resolve(root, 'pack-staging');
  await fs.mkdir(requested, { recursive: true });
  if ((await fs.lstat(requested)).isSymbolicLink()) throw Error('Linked pack staging folders are unsupported.');
  // Windows packaged hosts may virtualize AppData without creating a symbolic link.
  const base = await fs.realpath(requested);
  const stage = path.join(base, crypto.randomUUID());
  await fs.mkdir(stage);
  return stage;
}
async function cleanup(root, stage) {
  const target = path.resolve(stage), base = await fs.realpath(path.resolve(root, 'pack-staging'));
  if (path.dirname(target) !== base || !/^[a-f0-9-]{36}$/.test(path.basename(target))) throw Error('Invalid staging cleanup target.');
  if ((await fs.realpath(target)).toLowerCase() !== target.toLowerCase()) throw Error('Linked staging target.');
  await fs.rm(target, { recursive: true, force: true });
}
async function review(root, { versionId, file }, signal) {
  const stage = await createStage(root);
  const archive = path.join(stage, 'pack.mrpack');
  try {
    if (versionId) {
      const build = await catalog.version(versionId, signal);
      const info = await catalog.project(build.project_id, signal);
      if (info.project_type !== 'modpack') throw Error('Choose a Modrinth modpack.');
      const artifact = catalog.artifact(build.files.find(f => f.primary) || build.files[0], '.mrpack');
      await download(artifact.url, archive, { sha512: artifact.hashes.sha512, size: artifact.size, signal });
    } else {
      const stat = await fs.stat(file);
      if (!stat.isFile() || stat.size > 512 * 1024 ** 2) throw Error('Pack archive is too large.');
      await fs.copyFile(file, archive);
    }
    return { token: crypto.randomUUID(), stage, archive, sha512: await hashFile(archive, 'sha512'), pack: await inspect(archive) };
  } catch (error) { await cleanup(root, stage); throw error; }
}
function publicReview(plan) {
  const { files, overrides, ...summary } = plan.pack;
  return { ...summary, token: plan.token, files: files?.filter(f => f.client !== 'unsupported').length || 0 };
}
async function install(plan, { root, instances, includeOptional = true, signal, progress = () => {}, resolve }) {
  if (!plan.pack.supported) throw Error(plan.pack.reason);
  if (await hashFile(plan.archive, 'sha512') !== plan.sha512) throw Error('The archive changed after review. Review it again.');
  const pack = await inspect(plan.archive);
  const metadata = await resolve(root, pack.gameVersion, pack.loader, pack.loaderVersion, signal);
  const data = path.join(plan.stage, 'data');
  await fs.mkdir(data, { recursive: true });
  const tasks = pack.files.filter(f => f.client !== 'unsupported' && (includeOptional || f.client !== 'optional'));
  let complete = 0;
  await runPool(tasks, 8, async file => {
    const dest = safeJoin(data, file.path);
    if (await fileMatches(dest, file, true)) { progress({ stage: 'pack', label: 'Verified pack files', done: ++complete, total: tasks.length }); return; }
    let error;
    for (const url of file.urls) {
      try { await download(url, dest, { sha512: file.sha512, size: file.size, signal, redirectHosts: REDIRECTS }); error = null; break; }
      catch (e) { error = e; if (signal?.aborted) throw e; }
    }
    if (error) throw error;
    progress({ stage: 'pack', label: 'Installing pack files', done: ++complete, total: tasks.length });
  }, signal);
  const zip = await openZip(plan.archive);
  try {
    for (const override of pack.overrides) {
      if (signal?.aborted) throw signal.reason;
      const dest = safeJoin(data, override.path);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, await zip.read(zip.entries.find(e => e.name === override.entry)));
    }
  } finally { await zip.close(); }
  if (signal?.aborted) throw signal.reason;
  const instanceId = instances.newId();
  const dest = instances.directory(instanceId);
  await fs.rename(data, dest);
  let entry;
  try { entry = instances.add({ name: pack.name, gameVersion: pack.gameVersion, loader: pack.loader, loaderVersion: metadata.fabric.loaderVersion, pack: { name: pack.name, version: pack.version } }, instanceId); }
  catch (error) { await fs.rename(dest, data); throw error; }
  await cleanup(root, plan.stage).catch(() => {});
  return entry;
}
module.exports = { inspect, review, install, cleanup, publicReview, safePath };
