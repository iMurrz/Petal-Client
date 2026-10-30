const { app, BrowserWindow, ipcMain, shell, safeStorage, clipboard, nativeImage, dialog } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { setUserAgent } = require('./lib/http');
const { AccountStore } = require('./lib/auth/accounts');
const { SessionManager } = require('./lib/auth/session');
const { prepareGame } = require('./lib/game/installer');
const { buildLaunchArgs, redactArgs, spawnGame } = require('./lib/game/launch');
const gameLock = require('./lib/game/game-lock.json');
const { serverStatus } = require('./lib/server-ping');
const { Settings } = require('./lib/settings');
const petal = require('./lib/petal-config');
const screenshots = require('./lib/screenshots');
const { Instances } = require('./lib/instances');
const versions = require('./lib/game/versions');
const catalog = require('./lib/catalog');
const packs = require('./lib/packs');
const { Updater } = require('./lib/updater');
const crash = require('./lib/crash');
const content = require('./lib/content');
const { parseJvmArgs } = require('./lib/settings');

// Microsoft sign-in uses the community-standard client id with the device-code flow (microsoft.com/link).
const AUTH = { mode: 'live', clientId: '00000000402b5328' };

app.setName('Petal Client');
// Development and installed builds must share the same game and account folder.
app.setPath('userData', path.join(app.getPath('appData'), 'Petal Client'));
if (!app.requestSingleInstanceLock()) app.quit();

let win = null;
let accounts, sessions, settings, instances, gameRoot, logFile;
let packPlan;
let updater;
const game = { child: null, controller: null, lines: [], startedAt: null, instanceId: null, lastCrash: null, pending: [], flush: null };
const signIn = { controller: null, pageUrl: null };

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try { fs.appendFileSync(logFile, line); } catch { /* logging must never break the launcher */ }
}

function send(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

/** Every IPC reply is {ok, value} or {ok: false, error}, so the renderer never sees raw exceptions. */
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!win || event.sender !== win.webContents) return { ok: false, error: { message: 'Unknown sender' } };
    try {
      return { ok: true, value: await fn(...args) };
    } catch (err) {
      return { ok: false, error: { message: err?.message || 'Something went wrong', code: err?.code } };
    }
  });
}

const instanceDir = () => instances.directory();

function requireIdle() {
  if (game.child || game.controller) throw new Error('Close Minecraft and wait for the current operation before changing instances or downloads.');
}

async function libraryTask(fn) {
  requireIdle();
  game.controller = new AbortController();
  send('game:state', gameState());
  try { return await fn(game.controller.signal, progress => send('game:progress', progress)); }
  finally { game.controller = null; send('game:state', gameState()); }
}

async function prepareInstance(instance, { signal, onProgress, deep = false }) {
  const metadata = instance.petal ? gameLock : await versions.resolveVersion(gameRoot, instance.gameVersion, instance.loader, instance.loaderVersion || undefined, signal);
  return prepareGame({ root: gameRoot, instanceId: instance.id, gameVersion: instance.gameVersion,
    loaderVersion: metadata.fabric.loaderVersion, gameMetadata: metadata,
    bundledMods: instance.petal ? bundledMods() : [], standalone: !instance.petal, signal, onProgress, deep });
}

async function bootstrap() {
  const instance = { ...instances.get(), ...instances.meta(instances.get().id) };
  return { version: app.getVersion(), gameVersion: instance.gameVersion, loaderVersion: instance.loaderVersion || instance.loader,
    instance, instances: instances.list(), accounts: accounts.list(), canPersistAccounts: accounts.canPersist,
    settings: settings.get(), modules: instance.petal ? await petal.readModules(instanceDir()) : [],
    cosmetics: await petal.readCosmetics(instanceDir()), game: gameState(), modJarFound: !instance.petal || bundledMods().length > 0 };
}

function bundledMods() {
  const dir = app.isPackaged ? path.join(process.resourcesPath, 'mods') : path.join(__dirname, '..', '..', 'mod', 'build', 'libs');
  try {
    return fs.readdirSync(dir).filter(f => /^petal-client-.*\.jar$/.test(f) && !/-(sources|dev)\.jar$/.test(f)).map(f => path.join(dir, f));
  } catch {
    return [];
  }
}

function launchWrapperJar() {
  const jar = app.isPackaged
    ? path.join(process.resourcesPath, 'launchwrapper', 'petal-launchwrapper.jar')
    : path.join(__dirname, '..', 'launchwrapper', 'build', 'petal-launchwrapper.jar');
  return fs.existsSync(jar) ? jar : undefined;
}

function gameState(extra = {}) {
  return { running: Boolean(game.child), preparing: Boolean(game.controller && !game.child), startedAt: game.startedAt, instanceId: game.instanceId, ...extra };
}

/** Game output reaches the Console page in small batches so a chatty modpack can't flood the renderer. */
function queueLine(line) {
  game.pending.push(line);
  if (game.flush) return;
  game.flush = setTimeout(() => {
    game.flush = null;
    const batch = game.pending.splice(0);
    if (batch.length) send('game:log', batch);
  }, 200);
}

/** Memory for this launch: the instance's own setting when it has one, otherwise the launcher-wide one. */
function memoryFor(instance, current) {
  const own = instances.meta(instance.id).memoryMb;
  return own ? Math.min(own, current.maxMemoryMb) : current.memoryMb;
}

async function launch({ quickPlay } = {}) {
  if (game.child || game.controller) throw new Error('Minecraft is already starting or running.');
  const account = accounts.active();
  if (!account) throw Object.assign(new Error('Sign in with Microsoft first.'), { code: 'signin' });
  const instance = instances.get();
  if (instance.petal && !bundledMods().length) throw new Error('The Petal mod jar is missing. Run "npm run build:mod" first.');
  const wrapper = launchWrapperJar();
  if (!wrapper) throw new Error('The secure launch wrapper is missing. Reinstall Petal Client.');
  if (quickPlay && !/^[A-Za-z0-9.-]{1,253}(?::\d{1,5})?$/.test(quickPlay)) throw new Error('That server address does not look right.');

  const current = settings.get();
  game.controller = new AbortController();
  send('game:state', gameState());
  try {
    send('game:progress', { stage: 'auth', label: `Signing in as ${account.name}` });
    const session = await sessions.launchSession(account.uuid);
    send('accounts', accounts.list());

    const plan = await prepareInstance(instance, {
      signal: game.controller.signal,
      onProgress: progress => send('game:progress', progress)
    });
    if (plan.downloaded.files) log(`Downloaded ${plan.downloaded.files} files (${(plan.downloaded.bytes / 1e6).toFixed(1)} MB)`);
    if (!instance.pack) await petal.applyOptions(plan.gameDir, current);

    let extraJvmArgs = [];
    try { extraJvmArgs = parseJvmArgs(current.jvmArgs); } catch (err) { log(`Ignoring saved Java flags: ${err.message}`); }
    const args = buildLaunchArgs(plan, {
      session,
      memoryMb: memoryFor(instance, current),
      extraJvmArgs,
      resolution: current.resolution,
      quickPlay: quickPlay || undefined,
      wrapperJar: wrapper,
      launcherName: 'petal-client',
      launcherVersion: app.getVersion(),
      clientId: current.clientId
    });
    log(`Launching ${plan.profileId} as ${session.name} with mods: ${plan.enabledMods.join(', ')}`);
    log(`Command: ${plan.javaPath} ${redactArgs(args).filter(a => !a.includes(path.delimiter)).join(' ')}`);
    send('game:progress', { stage: 'launch', label: 'Starting Minecraft' });

    game.lines = [];
    game.lastCrash = null;
    send('game:log-reset', null);
    const sessionStart = Date.now();
    const child = spawnGame(plan, args, {
      capture: true,
      stdinSecret: session.accessToken,
      onLine: line => {
        game.lines.push(line);
        if (game.lines.length > 5000) game.lines.shift();
        queueLine(line);
      },
      onExit: async ({ code, signal, error }) => {
        if (game.child !== child) return;
        const stopped = game.stopping;
        game.child = null;
        game.startedAt = null;
        game.instanceId = null;
        game.stopping = false;
        const crashed = !stopped && (Boolean(error) || (code !== 0 && code !== null));
        log(`Game exited: ${error ? error.message : `code ${code}${signal ? ` (${signal})` : ''}`}${stopped ? ' (stopped from the launcher)' : ''}`);
        try { instances.recordSession(instance.id, sessionStart); } catch (err) { log(`Could not save play time: ${err.message}`); }
        fs.promises.writeFile(path.join(gameRoot, 'last-game-output.log'), game.lines.join('\n')).catch(() => {});
        if (crashed) {
          try {
            game.lastCrash = { ...(await crash.diagnose({ gameDir: plan.gameDir, lines: game.lines, since: sessionStart - 5000, exitCode: code })), instanceId: instance.id, at: new Date().toISOString() };
            if (error) game.lastCrash.excerpt = `${error.message}\n${game.lastCrash.excerpt}`.trim();
            log(`Crash diagnosis: ${game.lastCrash.cause}${game.lastCrash.report ? ` (${game.lastCrash.report})` : ''}`);
          } catch (err) { log(`Crash diagnosis failed: ${err.message}`); }
        }
        send('game:state', gameState({ exitCode: code, crashed, error: error?.message, crash: crashed ? game.lastCrash : null }));
        if (win && !win.isDestroyed()) {
          if (!win.isVisible()) win.show();
          if (win.isMinimized()) win.restore();
          if (crashed) win.focus();
        }
      }
    });
    game.child = child;
    game.instanceId = instance.id;
    game.startedAt = new Date().toISOString();
    send('game:state', gameState());
    if (current.hideWhilePlaying) setTimeout(() => { if (game.child === child && win && !win.isDestroyed()) win.hide(); }, 4000);
    return { launched: true };
  } catch (err) {
    log(`Launch failed: ${err.message}`);
    throw err;
  } finally {
    game.controller = null;
    send('game:state', gameState());
  }
}

function registerIpc() {
  handle('instances:versions', () => versions.listVersions());
  handle('instances:select', id => { requireIdle(); instances.select(id); return bootstrap(); });
  handle('instances:create', request => libraryTask(async signal => {
    if (!request || typeof request.name !== 'string' || request.name.trim().length < 2) throw Error('Give the instance a name.');
    const metadata = await versions.resolveVersion(gameRoot, request.gameVersion, request.loader, undefined, signal);
    const entry = instances.add({ name: request.name, gameVersion: request.gameVersion, loader: request.loader, loaderVersion: metadata.fabric.loaderVersion });
    instances.select(entry.id);
    return entry;
  }));
  handle('catalog:search', request => catalog.search({ ...request, gameVersion: instances.get().gameVersion, loader: instances.get().loader }));
  handle('catalog:versions', request => catalog.versions(request.projectId, { type: request.type, gameVersion: instances.get().gameVersion }));
  handle('catalog:installed', () => catalog.installed(instanceDir()));
  handle('catalog:install', versionId => libraryTask((signal, progress) => catalog.installMod(instanceDir(), instances.get(), versionId, { signal, progress })));
  handle('catalog:disable', projectId => libraryTask(() => catalog.disableMod(instanceDir(), projectId)));
  handle('packs:review', versionId => libraryTask(async signal => {
    if (packPlan) { await packs.cleanup(gameRoot, packPlan.stage); packPlan = null; }
    packPlan = await packs.review(gameRoot, { versionId }, signal);
    return packs.publicReview(packPlan);
  }));
  handle('packs:import', async () => {
    requireIdle();
    const chosen = await dialog.showOpenDialog(win, { title: 'Import a modpack', properties: ['openFile'], filters: [{ name: 'Modpack archives', extensions: ['mrpack', 'zip'] }] });
    if (chosen.canceled) return null;
    return libraryTask(async signal => {
      if (packPlan) { await packs.cleanup(gameRoot, packPlan.stage); packPlan = null; }
      packPlan = await packs.review(gameRoot, { file: chosen.filePaths[0] }, signal);
      return packs.publicReview(packPlan);
    });
  });
  handle('packs:install', request => libraryTask(async (signal, progress) => {
    if (!packPlan || request?.token !== packPlan.token) throw Error('Review this pack again before installing.');
    const entry = await packs.install(packPlan, { root: gameRoot, instances, includeOptional: request.includeOptional !== false, signal, progress, resolve: versions.resolveVersion });
    packPlan = null;
    return entry;
  }));
  handle('catalog:open-featured', key => {
    const urls = { reichsmp: 'https://modrinth.com/modpack/reichsmp', create: 'https://www.curseforge.com/minecraft/modpacks/just-create-smp-2/files/all' };
    if (!urls[key]) throw Error('Unknown featured project.');
    return shell.openExternal(urls[key]);
  });
  handle('mods:get', () => instances.get().petal ? petal.readModules(instanceDir()) : []);
  handle('screenshots:list', request => screenshots.screenshotPage(instanceDir(), nativeImage, request || {}));
  handle('screenshots:show', name => {
    shell.showItemInFolder(screenshots.screenshotPath(instanceDir(), name));
    return true;
  });
  handle('screenshots:folder', async () => {
    const dir = path.join(instanceDir(), 'screenshots');
    fs.mkdirSync(dir, { recursive: true });
    const error = await shell.openPath(dir);
    if (error) throw new Error(error);
    return true;
  });
  handle('game:repair', async () => {
    if (game.child || game.controller) throw new Error('Close Minecraft and wait for the current operation before repairing.');
    const mods = instances.get().petal ? bundledMods() : ['standalone'];
    if (!mods.length) throw new Error('The bundled Petal mod is missing. Reinstall Petal Client.');
    game.controller = new AbortController();
    send('game:state', gameState());
    try {
      const plan = await prepareInstance(instances.get(), { deep: true, signal: game.controller.signal,
        onProgress: progress => send('game:progress', progress) });
      log(`Repair completed: downloaded ${plan.downloaded.files} files`);
      return plan.downloaded;
    } finally {
      game.controller = null;
      send('game:state', gameState());
    }
  });
  handle('bootstrap', bootstrap);

  handle('auth:sign-in', async () => {
    if (signIn.controller) throw new Error('A sign-in is already in progress.');
    signIn.controller = new AbortController();
    try {
      await sessions.signIn(AUTH, {
        signal: signIn.controller.signal,
        onPrompt: prompt => {
          signIn.pageUrl = prompt.verificationUri || null;
          send('auth:prompt', prompt);
        }
      });
      return accounts.list();
    } catch (err) {
      if (err.code !== 'cancelled') log(`Sign-in failed: ${err.message}`);
      throw err;
    } finally {
      signIn.controller = null;
      signIn.pageUrl = null;
      send('auth:prompt', null);
    }
  });
  handle('auth:cancel', () => { signIn.controller?.abort(); return true; });
  handle('auth:open-page', async () => { if (signIn.pageUrl) await shell.openExternal(signIn.pageUrl); return true; });
  handle('auth:copy-code', code => { if (/^[A-Z0-9-]{4,16}$/i.test(code)) clipboard.writeText(code); return true; });
  handle('auth:select', uuid => { accounts.setActive(uuid); return accounts.list(); });
  handle('auth:sign-out', uuid => { accounts.remove(uuid); return accounts.list(); });

  handle('settings:set', patch => settings.merge(patch && typeof patch === 'object' ? patch : {}));
  handle('servers:add', ({ name, address }) => settings.addServer(name, address));
  handle('servers:remove', address => settings.removeServer(address));
  handle('servers:ping', async address => {
    const [host, portText] = String(address).split(':');
    const port = portText ? Number(portText) : 25565;
    if (!/^[A-Za-z0-9.-]{1,253}$/.test(host) || !(port > 0 && port < 65536)) throw new Error('Bad address');
    const status = await serverStatus(host, port);
    return status.online
      ? { online: true, players: status.players.online, max: status.players.max, latency: status.latency ?? null, version: status.version, motd: status.motd, favicon: status.favicon }
      : { online: false, detail: status.detail };
  });

  handle('mods:set', ({ id, enabled }) => { if (!instances.get().petal) throw Error('Select Petal SMP Survival to change its HUD.'); return petal.setModule(instanceDir(), id, enabled); });
  handle('cosmetics:equip', ({ slot, id }) => { if (!instances.get().petal) throw Error('Petal cosmetics belong to the Petal SMP Survival instance.'); return petal.equip(instanceDir(), slot, id); });

  handle('game:launch', options => launch(options || {}));
  handle('game:stop', () => {
    if (!game.child) throw new Error('Minecraft is not running.');
    game.stopping = true;
    game.child.kill();
    log('Force-stopped Minecraft from the launcher');
    return true;
  });
  handle('game:log', () => game.lines.slice(-5000));
  handle('game:copy-log', lines => {
    const text = Array.isArray(lines) ? lines.filter(l => typeof l === 'string').join('\n') : game.lines.join('\n');
    clipboard.writeText(text.slice(-2_000_000));
    return true;
  });
  handle('crash:last', () => game.lastCrash);
  handle('crash:open-report', async name => {
    const crashInstance = game.lastCrash?.instanceId || instances.get().id;
    const file = crash.reportPath(instances.directory(crashInstance), name);
    const error = await shell.openPath(file);
    if (error) throw new Error(error);
    return true;
  });
  handle('crash:copy', () => {
    const c = game.lastCrash;
    if (!c) throw new Error('There is no crash to copy.');
    const instance = instances.list().find(i => i.id === c.instanceId);
    clipboard.writeText([
      `Petal Client ${app.getVersion()} · ${instance ? `${instance.name} · ${instance.gameVersion} ${instance.loader}` : 'unknown instance'} · exit code ${c.exitCode ?? 'none'}`,
      c.title, c.detail || '', c.report ? `Crash report: ${c.report}` : '', '', c.excerpt
    ].filter((line, i, all) => line || all[i - 1]).join('\n'));
    return true;
  });

  handle('content:list', type => content.list(instanceDir(), type));
  handle('content:toggle', async ({ file, enabled }) => {
    if (game.child) throw new Error('Close Minecraft before switching mods on or off.');
    // Mods Petal downloaded from Modrinth go through the catalog, so its dependency checks still apply.
    const current = await content.list(instanceDir(), 'mods');
    const item = current.items.find(i => i.file === file);
    if (item?.projectId && !enabled) { await catalog.disableMod(instanceDir(), item.projectId); return content.list(instanceDir(), 'mods'); }
    return content.setEnabled(instanceDir(), file, Boolean(enabled));
  });
  handle('content:add', async type => {
    const k = content.KINDS[type];
    if (!k) throw new Error('Unknown content type.');
    const chosen = await dialog.showOpenDialog(win, { title: `Add ${type === 'mods' ? 'mods' : type === 'shaderpacks' ? 'shader packs' : 'resource packs'}`, properties: ['openFile', 'multiSelections'],
      filters: [{ name: type === 'mods' ? 'Fabric mods' : 'Packs', extensions: k.extensions.map(e => e.slice(1)) }] });
    if (chosen.canceled) return null;
    return content.addFiles(instanceDir(), type, chosen.filePaths);
  });
  handle('content:open-folder', async type => {
    const k = content.KINDS[type];
    if (!k) throw new Error('Unknown content type.');
    const dir = path.join(instanceDir(), k.folder);
    fs.mkdirSync(dir, { recursive: true });
    const error = await shell.openPath(dir);
    if (error) throw new Error(error);
    return true;
  });

  handle('instances:rename', ({ id, name }) => { instances.rename(id, name); return bootstrap(); });
  handle('instances:memory', ({ id, memoryMb }) => {
    if (memoryMb !== null && !Number.isInteger(memoryMb)) throw new Error('Choose a memory size.');
    instances.setMeta(id, { memoryMb: memoryMb === null ? null : Math.min(settings.get().maxMemoryMb, Math.max(1024, Math.round(memoryMb / 512) * 512)) });
    return bootstrap();
  });
  handle('instances:remove', async id => {
    requireIdle();
    const dir = instances.directory(id);
    instances.remove(id);
    // The folder goes to the Recycle Bin, so worlds can still be recovered.
    if (fs.existsSync(dir)) await shell.trashItem(dir).catch(err => log(`Could not move ${dir} to the Recycle Bin: ${err.message}`));
    log(`Removed instance ${id}`);
    return bootstrap();
  });
  handle('instances:open-folder', async id => {
    const dir = instances.directory(id || instances.get().id);
    fs.mkdirSync(dir, { recursive: true });
    const error = await shell.openPath(dir);
    if (error) throw new Error(error);
    return true;
  });
  handle('game:cancel', () => { game.controller?.abort(new Error('Launch cancelled.')); return true; });
  handle('game:open-folder', async () => { fs.mkdirSync(instanceDir(), { recursive: true }); await shell.openPath(instanceDir()); return true; });
  handle('game:open-log', async () => {
    const out = path.join(gameRoot, 'last-game-output.log');
    await shell.openPath(fs.existsSync(out) ? out : logFile);
    return true;
  });

  handle('update:status', () => updater.status());
  handle('update:check', async () => { const st = await updater.check(); send('update:status', st); return st; });
  handle('update:download', async () => {
    const st = await updater.downloadLatest(progress => send('update:progress', progress)).finally(() => send('update:status', updater.status()));
    return st;
  });
  handle('update:open-page', async () => { const page = updater.status().page; if (page) await shell.openExternal(page); return true; });
  handle('update:install', () => { requireIdle(); return updater.install(); });
  handle('window:minimize', () => { win?.minimize(); return true; });
  handle('window:maximize', () => { if (win) (win.isMaximized() ? win.unmaximize() : win.maximize()); return Boolean(win?.isMaximized()); });
  handle('window:close', () => { win?.close(); return true; });
}

/** Restores the last window size if it still fits on a connected display. */
function savedBounds() {
  const saved = settings.get().window;
  if (!saved) return { width: 1280, height: 820 };
  const { screen } = require('electron');
  const visible = Number.isInteger(saved.x) && screen.getAllDisplays().some(d => {
    const a = d.workArea;
    return saved.x + 100 > a.x && saved.x < a.x + a.width - 100 && saved.y >= a.y - 10 && saved.y < a.y + a.height - 80;
  });
  return visible ? { x: saved.x, y: saved.y, width: saved.width, height: saved.height } : { width: saved.width, height: saved.height };
}

function createWindow() {
  win = new BrowserWindow({
    ...savedBounds(),
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: '#0E0910',
    title: 'Petal · SMP Survival',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  win.once('ready-to-show', () => { if (settings.get().window?.maximized) win.maximize(); win.show(); });
  let boundsTimer = null;
  const rememberBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (!win || win.isDestroyed() || win.isMinimized()) return;
      const maximized = win.isMaximized();
      const b = win.getNormalBounds();
      try { settings.merge({ window: { x: b.x, y: b.y, width: b.width, height: b.height, maximized } }); } catch { /* not worth interrupting the player */ }
    }, 500);
  };
  for (const event of ['resize', 'move', 'maximize', 'unmaximize']) win.on(event, rememberBounds);
  win.on('maximize', () => send('window:maximized', true));
  win.on('unmaximize', () => send('window:maximized', false));
  // The UI is local; nothing may navigate the window or open new ones.
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.on('second-instance', () => {
  if (!win) return;
  if (!win.isVisible()) win.show();
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  setUserAgent(`PetalClient/${app.getVersion()} (unofficial community launcher)`);
  const data = app.getPath('userData');
  gameRoot = path.join(data, 'game');
  logFile = path.join(data, 'launcher.log');
  fs.mkdirSync(gameRoot, { recursive: true });
  accounts = new AccountStore(path.join(data, 'accounts.json'), safeStorage);
  sessions = new SessionManager(accounts, {
    openExternal: url => shell.openExternal(url),
    log
  });
  settings = new Settings(path.join(data, 'settings.json'), Math.floor(os.totalmem() / 1048576));
  instances = new Instances(gameRoot);
  log(`Petal Client ${app.getVersion()} started`);
  updater = new Updater({ app, log, dir: path.join(data, 'updates') });
  updater.cleanup();
  registerIpc();
  createWindow();
  // Check quietly once the window is up; the renderer shows a banner if a newer release exists.
  if (settings.get().autoCheckUpdates) {
    setTimeout(() => updater.check().then(st => { if (st.available) log(`Update ${st.version} is available`); send('update:status', st); }).catch(() => {}), 4000);
  }
});

app.on('window-all-closed', () => app.quit());
