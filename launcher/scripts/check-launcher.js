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
    await assert.rejects(content.setEnabled(dir, 'petal-client-2.1.0.jar', false), /Petal needs this mod/);
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

  fs.rmSync(temp, { recursive: true, force: true });
  console.log(`Launcher checks passed: ${results.join('; ')}`);
})().catch(error => {
  console.error(error);
  fs.rmSync(temp, { recursive: true, force: true });
  process.exit(1);
});
