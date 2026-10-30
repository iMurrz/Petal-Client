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
    this.value = { activeId: 'petal', instances: [core] };
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
  list() { return this.value.instances.map(item => ({ ...item, active: item.id === this.value.activeId })); }
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
module.exports = { Instances };
