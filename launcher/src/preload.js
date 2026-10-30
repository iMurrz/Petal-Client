const { contextBridge, ipcRenderer } = require('electron');

async function call(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (result?.ok) return result.value;
  const err = new Error(result?.error?.message || 'Something went wrong');
  err.code = result?.error?.code;
  throw err;
}

function subscribe(channel) {
  return callback => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld('petal', {
  bootstrap: () => call('bootstrap'),
  gameVersions: () => call('instances:versions'),
  selectInstance: id => call('instances:select', id),
  createInstance: request => call('instances:create', request),
  searchCatalog: request => call('catalog:search', request),
  catalogVersions: request => call('catalog:versions', request),
  installedMods: () => call('catalog:installed'),
  installMod: versionId => call('catalog:install', versionId),
  disableMod: projectId => call('catalog:disable', projectId),
  reviewPack: versionId => call('packs:review', versionId),
  importPack: () => call('packs:import'),
  installPack: request => call('packs:install', request),
  openFeatured: key => call('catalog:open-featured', key),
  signIn: () => call('auth:sign-in'),
  cancelSignIn: () => call('auth:cancel'),
  openSignInPage: () => call('auth:open-page'),
  copyCode: code => call('auth:copy-code', code),
  selectAccount: uuid => call('auth:select', uuid),
  signOut: uuid => call('auth:sign-out', uuid),
  setSettings: patch => call('settings:set', patch),
  addServer: server => call('servers:add', server),
  removeServer: address => call('servers:remove', address),
  pingServer: address => call('servers:ping', address),
  setModule: (id, enabled) => call('mods:set', { id, enabled }),
  getModules: () => call('mods:get'),
  equip: (slot, id) => call('cosmetics:equip', { slot, id }),
  launch: options => call('game:launch', options),
  stopGame: () => call('game:stop'),
  gameLog: () => call('game:log'),
  copyLog: lines => call('game:copy-log', lines),
  lastCrash: () => call('crash:last'),
  openCrashReport: name => call('crash:open-report', name),
  copyCrash: () => call('crash:copy'),
  listContent: type => call('content:list', type),
  toggleContent: (file, enabled) => call('content:toggle', { file, enabled }),
  addContent: type => call('content:add', type),
  openContentFolder: type => call('content:open-folder', type),
  renameInstance: (id, name) => call('instances:rename', { id, name }),
  setInstanceMemory: (id, memoryMb) => call('instances:memory', { id, memoryMb }),
  removeInstance: id => call('instances:remove', id),
  openInstanceFolder: id => call('instances:open-folder', id),
  cancelLaunch: () => call('game:cancel'),
  repair: () => call('game:repair'),
  screenshots: request => call('screenshots:list', request),
  showScreenshot: name => call('screenshots:show', name),
  openScreenshots: () => call('screenshots:folder'),
  openGameFolder: () => call('game:open-folder'),
  openLog: () => call('game:open-log'),
  updateStatus: () => call('update:status'),
  checkUpdate: () => call('update:check'),
  downloadUpdate: () => call('update:download'),
  installUpdate: () => call('update:install'),
  openRelease: () => call('update:open-page'),
  onUpdate: subscribe('update:status'),
  onUpdateProgress: subscribe('update:progress'),
  minimize: () => call('window:minimize'),
  maximize: () => call('window:maximize'),
  onMaximized: subscribe('window:maximized'),
  onGameLog: subscribe('game:log'),
  onGameLogReset: subscribe('game:log-reset'),
  close: () => call('window:close'),
  onSignInPrompt: subscribe('auth:prompt'),
  onProgress: subscribe('game:progress'),
  onGameState: subscribe('game:state'),
  onAccounts: subscribe('accounts')
});
