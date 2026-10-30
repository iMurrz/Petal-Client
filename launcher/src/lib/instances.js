const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const lock = require('./game/game-lock.json');
const { layout } = require('./game/paths');
const { modern } = require('./game/versions');
const ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
class Instances {
  constructor(root) {
    this.root = root;
    this.file = path.join(root, 'instances.json');
    const core = { id: 'petal', name: 'Petal SMP Survival', gameVersion: lock.gameVersion, loader: 'fabric', loaderVersion: lock.fabric.loaderVersion, petal: true };
    this.value = { activeId: 'petal', instances: [core], meta: {} };
    if (fs.existsSync(this.file)) {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (!Array.isArray(saved.instances)) throw Error('The instance index is damaged. The original file has been kept.');
      const seen = new Set(['petal']);
      for (const item of saved.instances) {
        if (item.id === 'petal') continue;
        if (!ID.test(item.id || '') || seen.has(item.id) || !modern(item.gameVersion) || !['vanilla', 'fabric'].includes(item.loader)) throw Error('Invalid saved instance. The index has been kept for recovery.');
        seen.add(item.id);
        this.value.instances.push({ id: item.id, name: String(item.name).slice(0, 80), gameVersion: item.gameVersion, loader: item.loader, loaderVersion: typeof item.loaderVersion === 'string' ? item.loaderVersion : '', petal: false, pack: item.pack ? { name: String(item.pack.name).slice(0, 100), version: String(item.pack.version).slice(0, 80) } : null });
      }
      if (seen.has(saved.activeId)) this.value.activeId = saved.activeId;
      // Play time and per-instance memory. Unknown or malformed entries are dropped, never fatal.
      for (const [id, m] of Object.entries(saved.meta && typeof saved.meta === 'object' ? saved.meta : {})) {
        if (!seen.has(id) || !m || typeof m !== 'object') continue;
        this.value.meta[id] = cleanMeta(m);
      }
    }
    fs.mkdirSync(path.join(root, 'instances'), { recursive: true });
  }
  save() {
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.value, null, 2));
    fs.renameSync(`${this.file}.tmp`, this.file);
  }
  get(id = this.value.activeId) {
    const item = this.value.instances.find(i => i.id === id);
    if (!item) throw Error('That instance does not exist.');
    return { ...item };
  }
  list() { return this.value.instances.map(item => ({ ...item, ...this.meta(item.id), active: item.id === this.value.activeId })); }
  meta(id) { return { playMs: 0, lastPlayed: null, launches: 0, memoryMb: null, ...this.value.meta[id] }; }
  /** Updates one instance's stats or memory override and saves. */
  setMeta(id, patch) {
    this.get(id);
    const previous = this.value.meta[id];
    this.value.meta[id] = cleanMeta({ ...this.meta(id), ...patch });
    try { this.save(); } catch (error) { this.value.meta[id] = previous; throw error; }
    return this.meta(id);
  }
  recordSession(id, startedAt, endedAt = Date.now()) {
    const m = this.meta(id);
    const played = Math.max(0, Math.min(endedAt - startedAt, 7 * 24 * 3600 * 1000));
    return this.setMeta(id, { playMs: m.playMs + played, lastPlayed: new Date(endedAt).toISOString(), launches: m.launches + 1 });
  }
  rename(id, name) {
    const item = this.value.instances.find(i => i.id === id);
    if (!item) throw Error('That instance does not exist.');
    if (item.petal) throw Error('Petal SMP Survival keeps its name.');
    const clean = String(name || '').trim().slice(0, 80);
    if (clean.length < 2) throw Error('Give the instance a name.');
    const previous = item.name;
    item.name = clean;
    try { this.save(); } catch (error) { item.name = previous; throw error; }
    return this.get(id);
  }
  /** Drops an instance from the index. The caller moves its folder to the Recycle Bin. */
  remove(id) {
    const index = this.value.instances.findIndex(i => i.id === id);
    if (index < 0) throw Error('That instance does not exist.');
    if (this.value.instances[index].petal) throw Error('Petal SMP Survival cannot be removed.');
    const snapshot = JSON.stringify(this.value);
    const [removed] = this.value.instances.splice(index, 1);
    delete this.value.meta[id];
    if (this.value.activeId === id) this.value.activeId = 'petal';
    try { this.save(); } catch (error) { this.value = JSON.parse(snapshot); throw error; }
    return removed;
  }
  directory(id = this.value.activeId) { return layout(this.root, id).instance; }
  select(id) {
    this.get(id);
    const previous = this.value.activeId;
    this.value.activeId = id;
    try { this.save(); } catch (error) { this.value.activeId = previous; throw error; }
    return this.get();
  }
  newId() {
    let id;
    do { id = `world-${crypto.randomUUID().slice(0, 20)}`; } while (this.value.instances.some(i => i.id === id) || fs.existsSync(this.directory(id)));
    return id;
  }
  add(item, id = this.newId()) {
    if (!ID.test(id) || this.value.instances.some(i => i.id === id)) throw Error('Invalid or duplicate instance.');
    if (!modern(item.gameVersion) || !['fabric', 'vanilla'].includes(item.loader)) throw Error('Unsupported instance version or loader.');
    const entry = { ...item, id, petal: false, name: String(item.name || 'My survival world').trim().slice(0, 80) };
    this.value.instances.push(entry);
    try { this.save(); } catch (error) { this.value.instances.pop(); throw error; }
    return this.get(id);
  }
}
function cleanMeta(m) {
  const out = {};
  if (Number.isFinite(m.playMs) && m.playMs >= 0) out.playMs = Math.floor(m.playMs);
  if (typeof m.lastPlayed === 'string' && !Number.isNaN(Date.parse(m.lastPlayed))) out.lastPlayed = new Date(m.lastPlayed).toISOString();
  if (Number.isInteger(m.launches) && m.launches >= 0) out.launches = m.launches;
  if (m.memoryMb === null || (Number.isInteger(m.memoryMb) && m.memoryMb >= 1024 && m.memoryMb <= 65536)) out.memoryMb = m.memoryMb ?? null;
  return out;
}
module.exports = { Instances };
