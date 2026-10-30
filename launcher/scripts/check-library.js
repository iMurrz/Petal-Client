const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const hash = (data, algorithm = 'sha512') => crypto.createHash(algorithm).update(data).digest('hex');
function zip(files) {
  const local = [], central = []; let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name), bytes = Buffer.from(content);
    const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
    header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(nameBytes.length, 26);
    local.push(header, nameBytes, bytes);
    const entry = Buffer.alloc(46); entry.writeUInt32LE(0x02014b50); entry.writeUInt16LE(20, 4); entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(bytes.length, 20); entry.writeUInt32LE(bytes.length, 24); entry.writeUInt16LE(nameBytes.length, 28); entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBytes); offset += header.length + nameBytes.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'petal-library-check-'));
  const routes = new Map();
  const originalFetch = global.fetch;
  global.fetch = async url => {
    const value = routes.get(String(url));
    if (value === undefined) throw Error(`Unexpected test request: ${url}`);
    return new Response(typeof value === 'object' && !Buffer.isBuffer(value) ? JSON.stringify(value) : value, { status: 200 });
  };
  const http = require('../src/lib/http');
  const originalDownload = http.download;
  http.download = (url, dest, options) => originalDownload(url, dest, { ...options, retries: 0 });
  const { Instances } = require('../src/lib/instances');
  const packs = require('../src/lib/packs');
  const catalog = require('../src/lib/catalog');
  const versions = require('../src/lib/game/versions');
  const instances = new Instances(root);
  assert.equal(instances.get().id, 'petal');
  const other = instances.add({ name: 'Test build', gameVersion: '1.21.1', loader: 'fabric', loaderVersion: '0.16.14' });
  instances.select(other.id);
  assert.equal(new Instances(root).get().gameVersion, '1.21.1');
  assert.notEqual(instances.directory(), instances.directory('petal'));
  assert.throws(() => instances.directory('../outside'));
  assert.throws(() => instances.select('missing'));
  assert.throws(() => versions.officialUrl('https://evil.example/metadata', ['piston-meta.mojang.com']));
  assert.equal(versions.modern('1.12.2'), false);
  assert.equal(versions.modern('26.3'), true);
  for (const name of ['../mods/a.jar', 'mods/../a.jar', 'mods/C:bad.jar', 'mods/con.jar', 'overrides/a.jar', 'config/test.ps1']) assert.throws(() => packs.safePath(name));
  const api = 'https://api.modrinth.com/v2';
  const a = Buffer.from('mod A test bytes'), b = Buffer.from('dependency B test bytes');
  const file = (name, bytes) => ({ filename: name, size: bytes.length, url: `https://cdn.modrinth.com/test/${name}`, primary: true, hashes: { sha512: hash(bytes) } });
  const buildA = { id: 'versiona', project_id: 'projecta', game_versions: ['1.21.1'], loaders: ['fabric'], files: [file('test-a.jar', a)], dependencies: [{ dependency_type: 'required', version_id: 'versionb' }] };
  const buildB = { id: 'versionb', project_id: 'projectb', game_versions: ['1.21.1'], loaders: ['fabric'], files: [file('test-b.jar', b)], dependencies: [] };
  routes.set(`${api}/version/versiona`, buildA); routes.set(`${api}/version/versionb`, buildB);
  routes.set(`${api}/project/projecta`, { title: 'Test A', slug: 'test-a', project_type: 'mod', client_side: 'required' });
  routes.set(`${api}/project/projectb`, { title: 'Test B', slug: 'test-b', project_type: 'mod', client_side: 'required' });
  routes.set(buildA.files[0].url, a); routes.set(buildB.files[0].url, b);
  const directory = instances.directory();
  const added = await catalog.installMod(directory, instances.get(), 'versiona');
  assert.equal(added.length, 2);
  assert.equal(await http.hashFile(path.join(directory, 'mods/test-a.jar'), 'sha512'), hash(a));
  await assert.rejects(catalog.disableMod(directory, 'projectb'), /requires/);
  await catalog.disableMod(directory, 'projecta');
  await catalog.disableMod(directory, 'projectb');
  assert.equal((await catalog.installed(directory)).length, 0);
  assert.ok((await fs.readdir(path.join(directory, 'mods'))).some(name => name.includes('.disabled-')));
  const protectedFile = path.join(directory, 'mods/test-a.jar');
  await fs.writeFile(protectedFile, 'player file');
  await assert.rejects(catalog.installMod(directory, instances.get(), 'versiona'), /already exists/);
  assert.equal(await fs.readFile(protectedFile, 'utf8'), 'player file');
  await fs.unlink(protectedFile);
  routes.set(buildA.files[0].url, Buffer.from('corrupt bytes'));
  await assert.rejects(catalog.installMod(directory, instances.get(), 'versiona'), /mismatch/);
  assert.equal((await catalog.installed(directory)).length, 0);
  routes.set(buildA.files[0].url, a);

  const packBytes = Buffer.from('pack mod bytes');
  const packUrl = 'https://cdn.modrinth.com/test/pack-mod.jar';
  routes.set(packUrl, packBytes);
  const index = { formatVersion: 1, game: 'minecraft', name: 'Fixture pack', versionId: '1', dependencies: { minecraft: '1.21.1', 'fabric-loader': '0.16.14' }, files: [
    { path: 'mods/pack-mod.jar', hashes: { sha512: hash(packBytes) }, fileSize: packBytes.length, downloads: [packUrl] },
    { path: 'mods/server-only.jar', env: { client: 'unsupported' }, hashes: { sha512: hash(packBytes) }, fileSize: packBytes.length, downloads: [packUrl] }
  ] };
  const archive = path.join(root, 'fixture.mrpack');
  await fs.writeFile(archive, zip({ 'modrinth.index.json': JSON.stringify(index), 'overrides/config/example.txt': 'base', 'client-overrides/config/example.txt': 'client' }));
  const plan = await packs.review(root, { file: archive });
  assert.equal(packs.publicReview(plan).files, 1);
  const before = instances.list().length;
  const entry = await packs.install(plan, { root, instances, resolve: async () => ({ fabric: { loaderVersion: '0.16.14' } }) });
  assert.equal(instances.list().length, before + 1);
  assert.equal(await fs.readFile(path.join(instances.directory(entry.id), 'config/example.txt'), 'utf8'), 'client');
  await assert.rejects(fs.access(path.join(instances.directory(entry.id), 'mods/server-only.jar')));
  assert.equal(await http.hashFile(path.join(instances.directory(entry.id), 'mods/pack-mod.jar'), 'sha512'), hash(packBytes));
  const changed = await packs.review(root, { file: archive });
  await fs.appendFile(changed.archive, 'changed');
  await assert.rejects(packs.install(changed, { root, instances }), /changed/);
  await packs.cleanup(root, changed.stage);
  await fs.writeFile(archive, zip({ 'modrinth.index.json': JSON.stringify(index), 'overrides/../outside.txt': 'escape' }));
  await assert.rejects(packs.inspect(archive), /path/);
  await fs.writeFile(archive, zip({ 'manifest.json': JSON.stringify({ name: 'Create fixture', minecraft: { version: '1.21.1', modLoaders: [{ id: 'neoforge-21.1.0' }] } }) }));
  const curse = await packs.inspect(archive);
  assert.equal(curse.supported, false); assert.match(curse.reason, /API key/);

  const vanilla = { id: '1.21.1', mainClass: 'net.minecraft.client.main.Main', javaVersion: { component: 'java-runtime-delta', majorVersion: 21 }, arguments: { game: [], jvm: [] } };
  const vanillaText = JSON.stringify(vanilla), metaUrl = 'https://piston-meta.mojang.com/test/1.21.1.json';
  routes.set('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', { latest: { release: '1.21.1' }, versions: [{ id: '1.21.1', type: 'release', url: metaUrl, sha1: hash(vanillaText, 'sha1') }, { id: '1.12.2', type: 'release' }] });
  routes.set(metaUrl, vanillaText);
  routes.set('https://meta.fabricmc.net/v2/versions/loader/1.21.1/0.16.14/profile/json', { id: 'fabric-loader-0.16.14-1.21.1', mainClass: 'net.fabricmc.loader.impl.launch.knot.KnotClient', libraries: [], arguments: { game: [], jvm: [] } });
  assert.equal((await versions.listVersions()).length, 1);
  const resolved = await versions.resolveVersion(root, '1.21.1', 'fabric', '0.16.14');
  assert.equal(resolved.fabric.loaderVersion, '0.16.14');
  assert.equal((await versions.resolveVersion(root, '1.21.1', 'vanilla')).fabric.profile.mainClass, vanilla.mainClass);
  await assert.rejects(versions.resolveVersion(root, '../1.21.1', 'fabric'), /Choose/);
  global.fetch = originalFetch;
  console.log('Library checks passed: isolated instances, dependency downloads, checksum failures, file preservation, dependency-safe disabling, pack overrides, client-only filtering, archive changes, traversal rejection, CurseForge reporting and official version resolution.');
})().catch(error => { console.error(error); process.exitCode = 1; });
