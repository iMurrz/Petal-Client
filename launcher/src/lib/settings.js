const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PROFILES = ['Builder', 'Balanced', 'Cinematic'];
const ADDRESS = /^[A-Za-z0-9.-]{1,253}(?::\d{1,5})?$/;

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

module.exports = { Settings, PROFILES, ADDRESS };
