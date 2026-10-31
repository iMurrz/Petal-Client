#!/usr/bin/env node
// Checks the 2.1 launcher libraries with temporary folders: crash diagnosis, content management,
// instance tools and settings validation. Never touches the player's data. Run: node scripts/check-launcher.js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');

const crash = require('../src/lib/crash');
const content = require('../src/lib/content');
const { Instances } = require('../src/lib/instances');
const { Settings, parseJvmArgs } = require('../src/lib/settings');
const { buildLaunchArgs } = require('../src/lib/game/launch');
const pack = require('../src/lib/pack');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'petal-check-'));
const results = [];
const check = async (name, fn) => { await fn(); results.push(name); };

/** One-entry stored zip, enough for a fabric.mod.json inside a test jar. */
function zipWith(name, text) {
  const data = Buffer.from(text);
  const nameBuf = Buffer.from(name);
  const crc = zlib.crc32(data);
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(crc, 16); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(nameBuf.length, 28);
  const localPart = Buffer.concat([local, nameBuf, data]);
  const centralPart = Buffer.concat([central, nameBuf]);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(centralPart.length, 12); end.writeUInt32LE(localPart.length, 16);
  return Buffer.concat([localPart, centralPart, end]);
}

(async () => {
  await check('crash: known causes', () => {
    assert.equal(crash.diagnoseText('Exception in thread "main" java.lang.OutOfMemoryError: Java heap space').id, 'out-of-memory');
    assert.equal(crash.diagnoseText('Error occurred during initialization of VM\nCould not reserve enough space for 8388608KB object heap').id, 'heap-too-large');
    const deps = crash.diagnoseText('net.fabricmc.loader.impl.FormattedException: Mod resolution encountered an incompatible mod set!\nA potential solution has been determined:\n\t - Install fabric-api, any version.\nUnmet dependency listing:\n\t - Mod \'Sodium Extra\' (sodium-extra) requires any version of sodium, which is missing!');
    assert.equal(deps.id, 'mod-dependencies');
    assert.match(deps.detail, /sodium/);
    assert.equal(crash.diagnoseText('Mixin apply for mod coolmod failed coolmod.mixins.json:FooMixin').detail, 'Mod: coolmod');
    assert.equal(crash.diagnoseText('GLFW error 65542: WGL: The driver does not appear to support OpenGL').id, 'graphics-driver');
    assert.equal(crash.diagnoseText('# EXCEPTION_ACCESS_VIOLATION (0xc0000005) at pc=0x00007ff').id, 'native-crash');
    assert.equal(crash.diagnoseText('[Render thread/INFO]: Stopping!'), null);
  });

  await check('crash: reads this session\'s report only', async () => {
    const gameDir = path.join(temp, 'game');
    const reports = path.join(gameDir, 'crash-reports');
    fs.mkdirSync(reports, { recursive: true });
    const old = path.join(reports, 'crash-2020-01-01_00.00.00-client.txt');
    fs.writeFileSync(old, 'Description: Old crash\n\njava.lang.Error: old');
    fs.utimesSync(old, new Date(2020, 0, 1), new Date(2020, 0, 1));
    const since = Date.now() - 1000;
    fs.writeFileSync(path.join(reports, 'crash-2026-10-30_12.00.00-client.txt'), '---- Minecraft Crash Report ----\nDescription: Rendering overlay\n\njava.lang.NullPointerException: boom\n\tat net.minecraft.client.Foo.bar(Foo.java:1)\n');
    const result = await crash.diagnose({ gameDir, lines: ['[Render thread/ERROR]: oh no'], since, exitCode: -1 });
    assert.equal(result.report, 'crash-2026-10-30_12.00.00-client.txt');
    assert.equal(result.title, 'Minecraft crashed: Rendering overlay');
    assert.match(result.excerpt, /NullPointerException/);
    assert.equal(crash.reportPath(gameDir, result.report), path.join(reports, result.report));
    assert.throws(() => crash.reportPath(gameDir, '../../secrets.txt'));
    const none = await crash.diagnose({ gameDir: path.join(temp, 'empty'), lines: ['x', '[main/ERROR]: Failed'], since, exitCode: 1 });
    assert.equal(none.report, null);
    assert.match(none.excerpt, /Failed/);
  });

  await check('content: list, toggle, protect Petal files, add', async () => {
    const dir = path.join(temp, 'instance');
    const mods = path.join(dir, 'mods');
    fs.mkdirSync(mods, { recursive: true });
    fs.writeFileSync(path.join(mods, 'sodium-0.6.jar'), zipWith('fabric.mod.json', JSON.stringify({ id: 'sodium', name: 'Sodium', version: '0.6.0', description: 'Fast\nrendering' })));
    fs.writeFileSync(path.join(mods, 'petal-client-2.1.0.jar'), 'x');
    fs.writeFileSync(path.join(mods, 'old.jar.disabled'), 'x');
    fs.writeFileSync(path.join(mods, 'notes.txt'), 'ignored');
    fs.writeFileSync(path.join(mods, '.petal-managed.json'), JSON.stringify({ files: ['petal-client-2.1.0.jar'] }));
    let listed = await content.list(dir, 'mods');
    assert.deepEqual(listed.items.map(i => i.file), ['petal-client-2.1.0.jar', 'old.jar.disabled', 'sodium-0.6.jar']);
    const sodium = listed.items.find(i => i.file === 'sodium-0.6.jar');
    assert.equal(sodium.name, 'Sodium');
    assert.equal(sodium.version, '0.6.0');
    assert.equal(listed.items[0].managed, true);
    assert.equal(listed.items[1].enabled, false);
    listed = await content.setEnabled(dir, 'sodium-0.6.jar', false);
    assert.ok(fs.existsSync(path.join(mods, 'sodium-0.6.jar.disabled')));
    listed = await content.setEnabled(dir, 'sodium-0.6.jar.disabled', true);
    assert.ok(fs.existsSync(path.join(mods, 'sodium-0.6.jar')));
    await assert.rejects(content.setEnabled(dir, 'petal-client-2.1.0.jar', false), /Petal installs this mod/);
    await assert.rejects(content.setEnabled(dir, '../escape.jar', false));
    fs.writeFileSync(path.join(temp, 'pack.zip'), 'zip');
    fs.writeFileSync(path.join(temp, 'evil.exe'), 'no');
    const added = await content.addFiles(dir, 'resourcepacks', [path.join(temp, 'pack.zip'), path.join(temp, 'evil.exe'), path.join(temp, 'pack.zip')]);
    assert.deepEqual(added.added, ['pack.zip']);
    assert.equal(added.skipped.length, 2);
    fs.mkdirSync(path.join(dir, 'resourcepacks', 'Folder Pack'));
    assert.equal((await content.list(dir, 'resourcepacks')).items.length, 2);
    await assert.rejects(content.list(dir, 'saves'));
  });

  await check('instances: play time, memory, rename, remove', () => {
    const root = path.join(temp, 'root');
    const instances = new Instances(root);
    const world = instances.add({ name: 'Test world', gameVersion: '1.21.1', loader: 'fabric', loaderVersion: '0.19.5' });
    instances.recordSession(world.id, Date.now() - 90 * 60000);
    instances.setMeta(world.id, { memoryMb: 6144 });
    instances.rename(world.id, '  Renamed world  ');
    const reloaded = new Instances(root);
    const item = reloaded.list().find(i => i.id === world.id);
    assert.equal(item.name, 'Renamed world');
    assert.equal(item.launches, 1);
    assert.ok(item.playMs >= 89 * 60000 && item.playMs <= 91 * 60000);
    assert.equal(item.memoryMb, 6144);
    assert.throws(() => reloaded.rename('petal', 'Nope'));
    assert.throws(() => reloaded.remove('petal'));
    reloaded.select(world.id);
    reloaded.remove(world.id);
    const after = new Instances(root);
    assert.equal(after.list().length, 1);
    assert.equal(after.get().id, 'petal');
  });

  await check('settings: Java flags and window bounds', () => {
    assert.deepEqual(parseJvmArgs(' -XX:+UseZGC  -Dfoo=bar '), ['-XX:+UseZGC', '-Dfoo=bar']);
    for (const bad of ['-Xmx8G', '-javaagent:evil.jar', '-cp x', '-XX:OnError=calc', '-XX:OnOutOfMemoryError=calc', '--add-opens', 'notaflag']) assert.throws(() => parseJvmArgs(bad), undefined, bad);
    const file = path.join(temp, 'settings.json');
    const settings = new Settings(file, 16384);
    assert.throws(() => settings.merge({ jvmArgs: '-javaagent:x.jar' }));
    settings.merge({ jvmArgs: '-XX:+UseZGC', window: { x: 10, y: 20, width: 1400, height: 900, maximized: true }, reduceMotion: true, autoCheckUpdates: false, lastSeenVersion: '2.1.0' });
    const fresh = new Settings(file, 16384).get();
    assert.equal(fresh.jvmArgs, '-XX:+UseZGC');
    assert.deepEqual(fresh.window, { x: 10, y: 20, width: 1400, height: 900, maximized: true });
    assert.equal(fresh.reduceMotion, true);
    assert.equal(fresh.autoCheckUpdates, false);
    assert.equal(fresh.lastSeenVersion, '2.1.0');
    // A hand-edited bad flag in settings.json is dropped on load rather than breaking the launcher.
    fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), jvmArgs: '-javaagent:x.jar' }));
    assert.equal(new Settings(file, 16384).get().jvmArgs, '');
  });

  await check('launch: extra flags sit with the other JVM flags', () => {
    const plan = { profileId: 'p', gameDir: '/g', assetsDir: '/a', assetIndex: '1', versionType: 'release', nativesDir: '/n', classpath: ['a.jar'], librariesDir: '/l', jvmArgs: ['-cp', '${classpath}'], gameArgs: ['--username', '${auth_player_name}'], mainClass: 'Main' };
    const args = buildLaunchArgs(plan, { session: { name: 'Steve', uuid: 'u', accessToken: 't' }, memoryMb: 4096, extraJvmArgs: ['-XX:+UseZGC'], clientId: 'c' });
    assert.ok(args.indexOf('-XX:+UseZGC') > args.indexOf('-Xmx4096M'));
    assert.ok(args.indexOf('-XX:+UseZGC') < args.indexOf('Main'));
  });

  await check('pack: choices, defaults and libraries', async () => {
    const file = size => ({ url: 'https://cdn.modrinth.com/x.jar', filename: 'x.jar', sha512: 'a'.repeat(128), size });
    const lock = { gameVersion: '1.21.11', mods: [
      { slug: 'fabric-api', name: 'Fabric API', category: 'required', defaultEnabled: true, file: file(1), dependencies: [] },
      { slug: 'sodium', name: 'Sodium', category: 'Performance', defaultEnabled: true, file: file(10), dependencies: [] },
      { slug: 'iris', name: 'Iris', category: 'Performance', defaultEnabled: true, file: file(20), dependencies: ['sodium'] },
      { slug: 'tweakeroo', name: 'Tweakeroo', category: 'Building', defaultEnabled: false, file: file(30), dependencies: ['malilib'] },
      { slug: 'malilib', name: 'MaLiLib', category: 'library', defaultEnabled: false, file: file(40), dependencies: [] }
    ] };
    const dir = path.join(temp, 'pack-instance');
    let view = pack.list(dir, lock);
    assert.deepEqual(view.mods.filter(m => m.enabled).map(m => m.slug), ['sodium', 'iris']);
    assert.equal(view.downloadBytes, 31);
    view = await pack.set(dir, 'sodium', false, lock);
    const sodium = view.mods.find(m => m.slug === 'sodium');
    assert.equal(sodium.enabled, true, 'Iris keeps Sodium installed');
    assert.deepEqual(sodium.neededBy, ['Iris']);
    view = await pack.set(dir, 'iris', false, lock);
    assert.equal(view.mods.find(m => m.slug === 'sodium').enabled, false);
    view = await pack.set(dir, 'tweakeroo', true, lock);
    assert.deepEqual(view.libraries, ['MaLiLib']);
    assert.ok(pack.resolve(pack.readChoices(dir), lock).install.has('malilib'));
    await assert.rejects(pack.set(dir, 'malilib', true, lock));
    await assert.rejects(pack.set(dir, 'fabric-api', false, lock));
    view = await pack.reset(dir, lock);
    assert.equal(view.customized, false);
    assert.deepEqual(pack.readChoices(dir), {});
  });

  await check('mods: a player\'s own copy wins over the pack copy', async () => {
    const { planMods } = require('../src/lib/game/mods');
    const lock = require('../src/lib/game/mods-lock.json');
    const sodium = lock.mods.find(m => m.slug === 'sodium');
    assert.ok(sodium, 'Sodium is pinned in the pack');
    const dir = path.join(temp, 'dupe-instance');
    const mods = path.join(dir, 'mods');
    fs.mkdirSync(mods, { recursive: true });
    let plan = await planMods(dir);
    assert.ok(plan.tasks.some(t => path.basename(t.dest) === sodium.file.filename));
    // Stand-ins for the downloaded pack file and a copy the player added themselves.
    fs.writeFileSync(path.join(mods, sodium.file.filename), zipWith('fabric.mod.json', JSON.stringify({ id: 'sodium' })));
    fs.writeFileSync(path.join(mods, 'my-sodium.jar'), zipWith('fabric.mod.json', JSON.stringify({ id: 'sodium' })));
    const result = await plan.finalize();
    assert.deepEqual(result.shadowed.map(s => s.by), ['my-sodium.jar']);
    assert.ok(!fs.existsSync(path.join(mods, sodium.file.filename)), 'Petal removed its own copy');
    assert.ok(fs.existsSync(path.join(mods, 'my-sodium.jar')), 'The player\'s copy is kept');
    plan = await planMods(dir);
    assert.ok(!plan.tasks.some(t => path.basename(t.dest) === sodium.file.filename), 'No re-download while the player\'s copy is there');
    assert.equal(pack.list(dir).mods.find(m => m.slug === 'sodium').ownCopy, 'my-sodium.jar');
    fs.rmSync(path.join(mods, 'my-sodium.jar'));
    plan = await planMods(dir);
    assert.ok(plan.tasks.some(t => path.basename(t.dest) === sodium.file.filename), 'Pack copy returns once theirs is gone');
  });

  await check('resource packs: Faithful under Petal UI once, then the player\'s order', async () => {
    const { planResourcePacks, orderPacks } = require('../src/lib/game/resourcepacks');
    const lock = require('../src/lib/game/mods-lock.json');
    const faithful = lock.resourcepacks.find(p => p.slug === 'faithful-64x');
    assert.ok(faithful, 'Faithful is pinned');
    const dir = path.join(temp, 'packs-instance');
    const bundledDir = path.join(temp, 'bundled-packs');
    fs.mkdirSync(bundledDir, { recursive: true });
    const bundled = ['Petal-UI-64x.zip', 'Petal-Textures-64x.zip'].map(name => {
      const file = path.join(bundledDir, name);
      fs.writeFileSync(file, zipWith('pack.mcmeta', '{}'));
      return file;
    });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'options.txt'), 'maxFps:260\nresourcePacks:["vanilla","fabric","file/Mine.zip"]\n');
    const read = key => JSON.parse(fs.readFileSync(path.join(dir, 'options.txt'), 'utf8').split('\n').find(l => l.startsWith(`${key}:`)).slice(key.length + 1));
    let plan = await planResourcePacks(dir, bundled);
    assert.ok(plan.tasks.some(t => t.sha512 === faithful.file.sha512 && t.group === 'resourcepack'));
    await plan.finalize();
    const f = `file/${faithful.file.filename}`;
    assert.deepEqual(read('resourcePacks'), ['vanilla', 'fabric', 'file/Mine.zip', f, 'file/Petal-UI-64x.zip']);
    assert.ok(fs.existsSync(path.join(dir, 'resourcepacks', 'Petal-Textures-64x.zip')), 'Petal Textures is installed but left off');
    assert.match(fs.readFileSync(path.join(dir, 'options.txt'), 'utf8'), /^maxFps:260$/m);
    // The player turns Faithful off: the next launch leaves it off.
    fs.writeFileSync(path.join(dir, 'options.txt'), 'resourcePacks:["vanilla","file/Petal-UI-64x.zip"]\n');
    plan = await planResourcePacks(dir, bundled);
    await plan.finalize();
    assert.deepEqual(read('resourcePacks'), ['vanilla', 'file/Petal-UI-64x.zip']);
    // A new Faithful build replaces the old file in place.
    assert.deepEqual(orderPacks(['vanilla', 'file/Old.zip', 'file/Petal-UI-64x.zip'], { renamed: new Map([['file/Old.zip', 'file/New.zip']]) }), ['vanilla', 'file/New.zip', 'file/Petal-UI-64x.zip']);
    // A pack added later slots in under the packs above it in Petal's stack.
    assert.deepEqual(orderPacks(['vanilla', 'file/P.zip'], { add: ['file/F.zip'], stack: ['file/F.zip', 'file/P.zip'] }), ['vanilla', 'file/F.zip', 'file/P.zip']);
    // The bundled zips match the pack sources and declare the 1.21.9+ format range.
    const { readZipEntry } = require('../src/lib/zip');
    for (const name of ['Petal-UI-64x', 'Petal-Textures-64x']) {
      const meta = JSON.parse(await readZipEntry(path.join(__dirname, '..', '..', 'resourcepacks-ready', `${name}.zip`), 'pack.mcmeta'));
      assert.deepEqual(meta, JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'pack', name, 'pack.mcmeta'), 'utf8')), `${name}.zip is out of date: rebuild it from pack/${name}`);
      assert.ok(meta.pack.min_format <= 75 && meta.pack.max_format >= 75);
    }
  });

  await check('pack check: Fabric version ranges', () => {
    const { satisfies } = require('./check-pack-live');
    assert.equal(satisfies('1.10.8+mc1.21.11', '<=1.10.7'), false);
    assert.equal(satisfies('1.6.0-beta.1', '<1.6.0-beta.2'), true);
    assert.equal(satisfies('1.21.11', '1.21.x'), true);
    assert.equal(satisfies('1.20.4', ['>=1.21', '1.20.x']), true);
    assert.equal(satisfies('1.3.0', '~1.2'), false);
    assert.equal(satisfies('not-a-version', '<1'), null);
  });

  fs.rmSync(temp, { recursive: true, force: true });
  console.log(`Launcher checks passed: ${results.join('; ')}`);
})().catch(error => {
  console.error(error);
  fs.rmSync(temp, { recursive: true, force: true });
  process.exit(1);
});
