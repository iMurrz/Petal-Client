const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PROFILES = ['Builder', 'Balanced', 'Cinematic'];
const ADDRESS = /^[A-Za-z0-9.-]{1,253}(?::\d{1,5})?$/;
// Extra JVM flags are limited to -X, -XX: and -D options. Memory comes from the memory setting, and
// nothing here can add an agent, change the classpath or point Java at another file.
const JVM_ARG = /^-(?:XX:[+-]?[A-Za-z0-9]+(?:=[A-Za-z0-9.,%_:-]{1,64})?|X(?!m[sx])[a-z][A-Za-z0-9:.%_-]{0,40}|D[A-Za-z0-9_.-]{1,64}(?:=[A-Za-z0-9 _.,:%+-]{0,128})?)$/;

/** Splits and validates a JVM argument string. Throws with the first bad flag. */
function parseJvmArgs(text) {
  const args = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (args.length > 24) throw new Error('Use at most 24 extra Java flags.');
  for (const arg of args) {
    if (/^-Xm[sx]/i.test(arg)) throw new Error('Set memory with the memory slider, not -Xmx or -Xms.');
    if (/^-XX:On(?:Error|OutOfMemoryError)/i.test(arg)) throw new Error('Flags that run commands on a crash are not allowed.');
    if (!JVM_ARG.test(arg)) throw new Error(`Petal only accepts -X, -XX: and -D flags. "${arg.slice(0, 40)}" is not allowed.`);
  }
  return args;
}

/** Launcher preferences in userData/settings.json. Every field is validated on load and on change. */
class Settings {
  constructor(file, totalMemoryMb) {
    this.file = file;
    this.maxMemoryMb = Math.max(2048, Math.floor((totalMemoryMb * 0.75) / 512) * 512);
    this.value = {
      memoryMb: Math.min(4096, this.maxMemoryMb),
      profile: 'Balanced',
      fullscreen: false,
      hideWhilePlaying: true,
      resolution: null,
      survivalSetup: 1,
      servers: [],
      jvmArgs: '',
      autoCheckUpdates: true,
      reduceMotion: false,
      lastSeenVersion: null,
      window: null,
      // Anonymous per-install id the game reports as its launcher client id (not used for sign-in).
      clientId: crypto.randomBytes(16).toString('base64')
    };
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (saved.survivalSetup !== 1 && Array.isArray(saved.servers)) {
        saved.servers = saved.servers.filter(server => !(server?.name === 'Ashen Classic' && server?.address === 'ashenprison.server.live'));
      }
      this.merge(saved, true);
      if (saved.survivalSetup !== 1) this.save();
    } catch { /* first run or unreadable: defaults */ }
  }

  get() {
    return { ...this.value, servers: this.value.servers.map(s => ({ ...s })), maxMemoryMb: this.maxMemoryMb };
  }

  merge(patch, loading = false) {
    const v = this.value;
    if (Number.isInteger(patch.memoryMb)) v.memoryMb = Math.min(this.maxMemoryMb, Math.max(1024, Math.round(patch.memoryMb / 512) * 512));
    if (patch.profile === 'Competitive') patch = { ...patch, profile: 'Builder' };
    if (PROFILES.includes(patch.profile)) v.profile = patch.profile;
    if (typeof patch.fullscreen === 'boolean') v.fullscreen = patch.fullscreen;
    if (typeof patch.hideWhilePlaying === 'boolean') v.hideWhilePlaying = patch.hideWhilePlaying;
    if (typeof patch.autoCheckUpdates === 'boolean') v.autoCheckUpdates = patch.autoCheckUpdates;
    if (typeof patch.reduceMotion === 'boolean') v.reduceMotion = patch.reduceMotion;
    if (typeof patch.jvmArgs === 'string') {
      try { v.jvmArgs = parseJvmArgs(patch.jvmArgs).join(' '); }
      catch (error) { if (!loading) throw error; }
    }
    if (typeof patch.lastSeenVersion === 'string' && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(patch.lastSeenVersion)) v.lastSeenVersion = patch.lastSeenVersion;
    if (patch.window && [patch.window.width, patch.window.height].every(n => Number.isInteger(n) && n >= 600 && n <= 10000)
      && [patch.window.x, patch.window.y].every(n => n === undefined || (Number.isInteger(n) && Math.abs(n) <= 30000))) {
      const { x, y, width, height } = patch.window;
      v.window = { x, y, width, height, maximized: Boolean(patch.window.maximized) };
    }
    if (patch.resolution === null) v.resolution = null;
    else if (patch.resolution && Number.isInteger(patch.resolution.width) && Number.isInteger(patch.resolution.height)
      && patch.resolution.width >= 640 && patch.resolution.width <= 7680
      && patch.resolution.height >= 480 && patch.resolution.height <= 4320) {
      v.resolution = { width: patch.resolution.width, height: patch.resolution.height };
    }
    if (Array.isArray(patch.servers)) {
      v.servers = patch.servers
        .filter(s => s && typeof s.address === 'string' && ADDRESS.test(s.address.trim()))
        .slice(0, 12)
        .map(s => ({ name: String(s.name || s.address).trim().slice(0, 32) || s.address, address: s.address.trim().toLowerCase() }));
    }
    if (loading && typeof patch.clientId === 'string' && /^[A-Za-z0-9+/=]{16,64}$/.test(patch.clientId)) v.clientId = patch.clientId;
    if (!loading) this.save();
    return this.get();
  }

  addServer(name, address) {
    address = String(address || '').trim().toLowerCase();
    if (!ADDRESS.test(address)) throw new Error('That server address does not look right.');
    const servers = this.value.servers.filter(s => s.address !== address);
    servers.unshift({ name: String(name || '').trim() || address, address });
    return this.merge({ servers });
  }

  removeServer(address) {
    return this.merge({ servers: this.value.servers.filter(s => s.address !== address) });
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.value, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Settings, PROFILES, ADDRESS, parseJvmArgs };
