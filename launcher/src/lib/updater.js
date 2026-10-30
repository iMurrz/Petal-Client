// Launcher self-update from the public GitHub releases repository named in package.json (build.publish).
// The installer is only run after its size and SHA-512 match the latest.yml that electron-builder
// publishes in the same release.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { getJson, getText, download } = require('./http');

const pkg = require('../../package.json');
const SOURCE = (Array.isArray(pkg.build?.publish) ? pkg.build.publish[0] : pkg.build?.publish) || {};
// GitHub serves release assets from these hosts after redirecting from github.com.
const ASSET_HOSTS = ['objects.githubusercontent.com', 'release-assets.githubusercontent.com', 'github-releases.githubusercontent.com'];

function parseVersion(text) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(text || '').trim());
  return m ? { parts: [+m[1], +m[2], +m[3]], pre: m[4] || '' } : null;
}

/** >0 when a is newer than b. A release without a pre-release tag beats the same version with one. */
function compareVersions(a, b) {
  const va = parseVersion(a), vb = parseVersion(b);
  if (!va || !vb) return 0;
  for (let i = 0; i < 3; i++) if (va.parts[i] !== vb.parts[i]) return va.parts[i] - vb.parts[i];
  if (va.pre === vb.pre) return 0;
  if (!va.pre) return 1;
  if (!vb.pre) return -1;
  return va.pre < vb.pre ? -1 : 1;
}

/** The few top-level and files[] keys we need from electron-builder's latest.yml. */
function parseLatestYml(text) {
  const out = { files: [] };
  let file = null;
  for (const raw of text.split(/\r?\n/)) {
    const item = /^\s*-\s+url:\s*(.+)$/.exec(raw);
    if (item) { file = { url: unquote(item[1]) }; out.files.push(file); continue; }
    const nested = /^\s{4,}(sha512|size):\s*(.+)$/.exec(raw);
    if (nested && file) { file[nested[1]] = nested[1] === 'size' ? Number(nested[2]) : unquote(nested[2]); continue; }
    const top = /^(version|path|sha512):\s*(.+)$/.exec(raw);
    if (top) { out[top[1]] = unquote(top[2]); file = null; }
  }
  return out;
}

function unquote(v) {
  return v.trim().replace(/^['"]|['"]$/g, '');
}

function base64ToHex(b64) {
  const buf = Buffer.from(b64, 'base64');
  if (buf.length !== 64) throw new Error('The update has an invalid checksum.');
  return buf.toString('hex');
}

class Updater {
  constructor({ app, log, dir }) {
    this.app = app;
    this.log = log;
    this.dir = dir;
    this.latest = null;
    this.ready = null; // { version, file }
    this.busy = null;
  }

  configured() {
    return Boolean(SOURCE.provider === 'github' && SOURCE.owner && SOURCE.repo);
  }

  /** Installing needs the packaged Windows build: a dev checkout has no installer to replace. */
  canInstall() {
    return this.app.isPackaged && process.platform === 'win32';
  }

  status() {
    const current = this.app.getVersion();
    const latest = this.latest;
    return {
      current,
      configured: this.configured(),
      source: this.configured() ? `${SOURCE.owner}/${SOURCE.repo}` : null,
      canInstall: this.canInstall(),
      checkedAt: latest?.checkedAt || null,
      available: Boolean(latest && compareVersions(latest.version, current) > 0),
      version: latest?.version || null,
      notes: latest?.notes || '',
      page: latest?.page || null,
      downloading: this.busy === 'download',
      downloaded: Boolean(this.ready && this.ready.version === latest?.version),
      error: latest?.error || null
    };
  }

  async check() {
    if (!this.configured()) return this.status();
    try {
      const release = await getJson(`https://api.github.com/repos/${SOURCE.owner}/${SOURCE.repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' }, retries: 1, timeout: 15000
      });
      const yml = (release.assets || []).find(a => a.name === 'latest.yml');
      this.latest = {
        version: String(release.tag_name || '').replace(/^v/, ''),
        notes: String(release.body || '').slice(0, 2000),
        page: /^https:\/\/github\.com\//.test(release.html_url || '') ? release.html_url : null,
        ymlUrl: yml?.browser_download_url || null,
        assets: release.assets || [],
        checkedAt: new Date().toISOString(),
        error: yml ? null : 'This release has no latest.yml, so it cannot be verified.'
      };
    } catch (err) {
      // 404 means the repository has no published release yet.
      const none = err.status === 404;
      this.latest = { version: null, checkedAt: new Date().toISOString(), error: none ? null : `Could not check for updates: ${err.message}` };
    }
    return this.status();
  }

  async downloadLatest(onProgress) {
    const latest = this.latest;
    if (!latest?.ymlUrl || compareVersions(latest.version, this.app.getVersion()) <= 0) throw new Error('There is no newer version to download.');
    if (this.ready?.version === latest.version) return this.status();
    if (this.busy) throw new Error('An update is already downloading.');
    this.busy = 'download';
    try {
      const meta = parseLatestYml(await getText(latest.ymlUrl, { timeout: 20000 }));
      if (compareVersions(meta.version, latest.version) !== 0) throw new Error('The release files do not match its version.');
      const name = meta.path;
      if (!name || !/^[\w.-]+\.exe$/.test(name)) throw new Error('The release has no Windows installer.');
      const entry = meta.files.find(f => f.url === name) || {};
      const sha512 = base64ToHex(entry.sha512 || meta.sha512 || '');
      const asset = latest.assets.find(a => a.name === name);
      if (!asset?.browser_download_url) throw new Error(`The release is missing ${name}.`);
      const size = Number.isSafeInteger(entry.size) ? entry.size : asset.size;

      await fsp.mkdir(this.dir, { recursive: true });
      const file = path.join(this.dir, name);
      let received = 0;
      await download(asset.browser_download_url, file, {
        sha512, size, redirectHosts: ASSET_HOSTS,
        onBytes: n => { received += n; onProgress?.({ stage: 'update', label: `Downloading Petal ${latest.version}`, bytes: received, totalBytes: size }); }
      });
      this.ready = { version: latest.version, file };
      this.log(`Update ${latest.version} downloaded and verified (${size} bytes)`);
      return this.status();
    } finally {
      this.busy = null;
    }
  }

  /** Starts the verified installer silently, then quits so it can replace the app and relaunch it. */
  install() {
    if (!this.canInstall()) throw new Error('Updates install from the Windows installer build of Petal.');
    if (!this.ready || !fs.existsSync(this.ready.file)) throw new Error('Download the update first.');
    this.log(`Installing update ${this.ready.version}`);
    // electron-builder NSIS: /S runs silently, --updated marks an update, --force-run reopens Petal afterwards.
    const child = spawn(this.ready.file, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    setTimeout(() => this.app.quit(), 300);
    return true;
  }

  /** Removes installers left over from earlier updates. */
  async cleanup() {
    try {
      for (const f of await fsp.readdir(this.dir)) if (/\.(exe|part)$/i.test(f)) await fsp.rm(path.join(this.dir, f), { force: true });
    } catch { /* nothing to clean */ }
  }
}

module.exports = { Updater, compareVersions, parseLatestYml };
