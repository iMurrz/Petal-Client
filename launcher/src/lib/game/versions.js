const fs = require('node:fs/promises');
const path = require('node:path');
const { getJson, getText, runPool } = require('../http');
const { pinnedJson } = require('./meta');
const { mavenPath } = require('./paths');
const core = require('./game-lock.json');

const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const RUNTIMES = 'https://piston-meta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json';
const ID = /^[A-Za-z0-9_.+-]{1,80}$/;
const LOADER = /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/;
let manifest;
let manifestAt = 0;
function officialUrl(value, hosts) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !hosts.includes(url.hostname)) throw Error('Unexpected game metadata host.');
  return url.toString();
}
function modern(id) {
  if (!/^\d+\.\d+(?:\.\d+)?$/.test(id)) return false;
  const [major, minor] = id.split('.').map(Number);
  return major >= 26 || (major === 1 && minor >= 20);
}
async function versionManifest(signal) {
  if (!manifest || Date.now() - manifestAt > 600000) {
    manifest = await getJson(MANIFEST, { signal });
    if (!Array.isArray(manifest.versions)) throw Error('Invalid Mojang version manifest.');
    manifestAt = Date.now();
  }
  return manifest;
}
async function listVersions(signal) {
  const data = await versionManifest(signal);
  return data.versions.filter(v => v.type === 'release' && modern(v.id)).map(v => ({ id: v.id, latest: v.id === data.latest.release }));
}
async function resolveVersion(root, gameVersion, loader = 'fabric', requestedLoader, signal) {
  if (!ID.test(gameVersion) || !modern(gameVersion) || !['fabric', 'vanilla'].includes(loader)) throw Error('Choose a modern release (1.20 or newer) with Fabric or Vanilla.');
  if (requestedLoader && (requestedLoader.length > 60 || !LOADER.test(requestedLoader))) throw Error('Invalid Fabric Loader version.');
  if (gameVersion === core.gameVersion && loader === 'fabric' && requestedLoader === core.fabric.loaderVersion) return core;
  const cache = path.join(root, 'profiles', `${gameVersion}-${loader}-${requestedLoader || 'stable'}.json`);
  try {
    const saved = JSON.parse(await fs.readFile(cache, 'utf8'));
    if (saved.gameVersion === gameVersion && saved.loader === loader && /^[a-f0-9]{40}$/.test(saved.versionJson.sha1)
      && ID.test(saved.fabric.profile.id) && /^[a-z0-9-]+$/.test(saved.java.component) && ['net.minecraft.client.main.Main', 'net.fabricmc.loader.impl.launch.knot.KnotClient'].includes(saved.fabric.profile.mainClass)) {
      officialUrl(saved.versionJson.url, ['piston-meta.mojang.com', 'launchermeta.mojang.com']);
      for (const runtime of Object.values(saved.java.manifests)) officialUrl(runtime.url, ['piston-meta.mojang.com', 'launchermeta.mojang.com']);
      return saved;
    }
  } catch { /* resolve from the official metadata services */ }
  const entry = (await versionManifest(signal)).versions.find(v => v.id === gameVersion && v.type === 'release');
  if (!entry || !/^[a-f0-9]{40}$/.test(entry.sha1 || '')) throw Error('Minecraft release was not found in Mojang metadata.');
  officialUrl(entry.url, ['piston-meta.mojang.com', 'launchermeta.mojang.com']);
  const vanilla = await pinnedJson(entry.url, path.join(root, 'versions', gameVersion, `${gameVersion}.json`), entry.sha1, signal);
  if (!vanilla.arguments?.jvm || !vanilla.arguments?.game || vanilla.minecraftArguments) throw Error('This release needs a legacy launch path which is not supported yet.');
  let java = core.java;
  if (vanilla.javaVersion?.component && vanilla.javaVersion.component !== core.java.component) {
    const components = await getJson(RUNTIMES, { signal });
    java = { component: vanilla.javaVersion.component, manifests: {} };
    for (const [platform, data] of Object.entries(components)) {
      const runtime = data[java.component]?.[0];
      if (!runtime) continue;
      officialUrl(runtime.manifest.url, ['piston-meta.mojang.com', 'launchermeta.mojang.com']);
      java.manifests[platform] = { url: runtime.manifest.url, sha1: runtime.manifest.sha1, version: runtime.version.name };
    }
  }
  let profile = { id: gameVersion, mainClass: vanilla.mainClass, libraries: [], arguments: { game: [], jvm: [] } };
  let loaderVersion = '';
  if (loader === 'fabric') {
    loaderVersion = requestedLoader;
    if (!loaderVersion) {
      const loaders = await getJson(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(gameVersion)}`, { signal });
      loaderVersion = loaders.find(v => v.loader?.stable)?.loader.version;
    }
    if (!LOADER.test(loaderVersion || '')) throw Error('No supported Fabric Loader is available for this release.');
    profile = await getJson(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}/${loaderVersion}/profile/json`, { signal });
    if (profile.mainClass !== 'net.fabricmc.loader.impl.launch.knot.KnotClient' || !ID.test(profile.id) || !Array.isArray(profile.libraries)) throw Error('Unexpected Fabric launch profile.');
    await runPool(profile.libraries, 6, async library => {
      const artifact = library.downloads?.artifact;
      if (!artifact && !library.url) library.url = 'https://maven.fabricmc.net/';
      const url = artifact?.url || `${(library.url || 'https://maven.fabricmc.net/').replace(/\/?$/, '/')}${mavenPath(library.name)}`;
      officialUrl(url, ['maven.fabricmc.net', 'libraries.minecraft.net', 'repo.maven.apache.org']);
      if (!/^[a-f0-9]{40}$/.test(artifact?.sha1 || library.sha1 || '')) {
        library.sha1 = (await getText(`${url}.sha1`, { signal })).trim().split(/\s/)[0];
        if (!/^[a-f0-9]{40}$/.test(library.sha1)) throw Error('Fabric library is missing its official checksum.');
        if (artifact) artifact.sha1 = library.sha1;
      }
    }, signal);
  }
  const resolved = { gameVersion, loader, javaMajor: vanilla.javaVersion?.majorVersion, versionJson: { url: entry.url, sha1: entry.sha1 }, java, fabric: { loaderVersion, profile } };
  await fs.mkdir(path.dirname(cache), { recursive: true });
  await fs.writeFile(`${cache}.tmp`, JSON.stringify(resolved, null, 2));
  await fs.rename(`${cache}.tmp`, cache);
  return resolved;
}
module.exports = { listVersions, resolveVersion, officialUrl, modern };
