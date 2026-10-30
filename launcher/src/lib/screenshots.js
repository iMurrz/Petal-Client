// Local screenshot reader adapted from Sloth Client.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const SHOT = /^[A-Za-z0-9 _.()-]+\.(png|jpe?g)$/i;

function screenshotDir(instanceDir) { return path.join(instanceDir, 'screenshots'); }

async function screenshots(instanceDir, nativeImage, limit = 60) {
  return (await screenshotPage(instanceDir, nativeImage, { limit })).items;
}
async function screenshotPage(instanceDir, nativeImage, request = {}) {
  const dir = screenshotDir(instanceDir);
  for (const folder of [path.dirname(instanceDir), instanceDir, dir]) {
    const s = await fsp.lstat(folder).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if (s?.isSymbolicLink()) throw new Error('Linked screenshot folders are not supported.');
  }
  const names = (await fsp.readdir(dir).catch(e => { if (e.code === 'ENOENT') return []; throw e; })).filter(n => SHOT.test(n)).slice(0, 10000);
  const query = String(request.query || '').slice(0, 100).toLowerCase();
  const date = typeof request.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(request.date) ? request.date : '';
  const records = [];
  const albumNames = Array.isArray(request.albumNames) ? new Set(request.albumNames) : null;
  for (const name of names) {
    const s = await fsp.lstat(path.join(dir, name)).catch(() => null);
    if (!s?.isFile() || s.isSymbolicLink() || !name.toLowerCase().includes(query) || (albumNames && !albumNames.has(name))) continue;
    const taken = new Date(s.mtimeMs);
    const localDate = `${taken.getFullYear()}-${String(taken.getMonth() + 1).padStart(2, '0')}-${String(taken.getDate()).padStart(2, '0')}`;
    if (date && localDate !== date) continue;
    records.push({ name, taken: s.mtimeMs, bytes: s.size });
  }
  records.sort((a, b) => request.sort === 'oldest' ? a.taken - b.taken : request.sort === 'name' ? a.name.localeCompare(b.name) : b.taken - a.taken);
  const limit = Math.max(1, Math.min(60, Number(request.limit) || 24));
  const offset = Math.max(0, Math.min(records.length, Math.floor(Number(request.offset) || 0)));
  const items = [];
  for (const record of records.slice(offset, offset + limit)) {
    let thumb = null;
    if (record.bytes <= 32 * 1024 ** 2) {
      let allowed = true;
      if (/\.png$/i.test(record.name)) {
        const handle = await fsp.open(path.join(dir, record.name), 'r');
        try { const header = Buffer.alloc(24); const { bytesRead } = await handle.read(header); allowed = bytesRead === 24 && header.readUInt32BE(0) === 0x89504e47 && header.readUInt32BE(16) * header.readUInt32BE(20) <= 16 * 1024 ** 2; }
        finally { await handle.close(); }
      }
      if (allowed && /\.jpe?g$/i.test(record.name)) {
        const handle = await fsp.open(path.join(dir, record.name), 'r');
        try {
          const buffer = Buffer.alloc(Math.min(record.bytes, 1024 * 1024)); await handle.read(buffer);
          allowed = false;
          let i = 2;
          while (buffer.length >= 2 && buffer.readUInt16BE(0) === 0xffd8 && i + 8 < buffer.length) {
            if (buffer[i++] !== 0xff) break;
            while (buffer[i] === 0xff) i++;
            const marker = buffer[i++];
            if (marker === 0xda || marker === 0xd9 || i + 7 >= buffer.length) break;
            const size = buffer.readUInt16BE(i);
            if (size < 2 || i + size > buffer.length) break;
            if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
              allowed = buffer.readUInt16BE(i + 3) * buffer.readUInt16BE(i + 5) <= 16 * 1024 ** 2; break;
            }
            i += size;
          }
        } finally { await handle.close(); }
      }
      if (allowed) { const img = nativeImage.createFromPath(path.join(dir, record.name)); if (!img.isEmpty()) thumb = img.resize({ width: 320, quality: 'good' }).toDataURL(); }
    }
    items.push({ ...record, thumb });
  }
  return { items, total: records.length, offset, limit, scanned: names.length };
}

/** Resolves a screenshot name to its path, refusing anything that isn't a plain file name in the folder. */
function screenshotPath(instanceDir, name) {
  if (typeof name !== 'string' || !SHOT.test(name) || name.includes('..')) throw new Error('Invalid screenshot');
  const file = path.join(screenshotDir(instanceDir), name);
  if (!fs.existsSync(file)) throw new Error('Screenshot not found');
  for (const f of [path.dirname(instanceDir), instanceDir, screenshotDir(instanceDir), file]) if (fs.lstatSync(f).isSymbolicLink()) throw new Error('Linked screenshots are not supported.');
  if (!fs.lstatSync(file).isFile()) throw new Error('Screenshot is not a regular file.');
  return file;
}

module.exports = { screenshotPage, screenshotPath };

