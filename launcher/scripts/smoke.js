// Run with: node_modules/.bin/electron scripts/smoke.js
// Uses a temporary profile; never signs in or touches the player's game data.
const { app, nativeImage } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const gameVersions = require('../src/lib/game/versions');
gameVersions.resolveVersion = async (_root, gameVersion, loader) => ({ gameVersion, loader, fabric: { loaderVersion: loader === 'fabric' ? '0.19.5' : '' } });
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'petal-smoke-'));
app.setPath('appData', temporary);
const failures = [];
const timeout = setTimeout(() => { console.error('Smoke check timed out'); app.exit(1); }, 45000);
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (_event, details) => {
    if (details.level === 'error') failures.push(details.message);
  });
  contents.once('did-finish-load', async () => {
    try {
      const result = await contents.executeJavaScript(`(async () => {
        const boot = await window.petal.bootstrap();
        if (!boot.modules.length) throw new Error('Missing module catalog');
        const originalFps = boot.modules.find(module => module.id === 'fps').enabled;
        await window.petal.setModule('fps', !originalFps);
        const refreshed = await window.petal.getModules();
        if (refreshed.find(module => module.id === 'fps').enabled === originalFps) throw new Error('Module refresh did not read saved state');
        await window.petal.setModule('fps', originalFps);
        const created = await window.petal.createInstance({name:'Smoke world',gameVersion:'1.21.1',loader:'fabric'});
        const selected = await window.petal.bootstrap();
        if (selected.instance.id !== created.id || selected.modules.length !== 0) throw new Error('Instance isolation failed');
        let blocked = false;
        try { await window.petal.setModule('fps',false); } catch { blocked = true; }
        if (!blocked) throw new Error('Petal HUD was writable in a standalone instance');
        await window.petal.selectInstance('petal');
        const updated = await window.petal.setSettings({resolution:{width:1920,height:1080}});
        if (updated.resolution.width !== 1920) throw new Error('Resolution did not save');
        await window.petal.setSettings({resolution:null});
        const shots = await window.petal.screenshots({});
        if (shots.total !== 0) throw new Error('Temporary gallery should be empty');
        for (const page of ['home','mods','instances','downloads','locker','settings','screenshots']) {
          document.querySelector('[data-page="'+page+'"]').click();
          if (!document.querySelector('#page').textContent.trim()) throw new Error('Empty page: '+page);
        }
        return { pages: 7, modules: boot.modules.length, instanceSwitching:'isolated' };
      })()`);
      const root = path.join(temporary, 'Petal Client', 'game', 'instances', 'petal');
      const folder = path.join(root, 'screenshots');
      fs.mkdirSync(folder, { recursive: true });
      const pixel = nativeImage.createFromBitmap(Buffer.from([163, 79, 255, 255]), { width: 1, height: 1 }).toPNG();
      for (let i = 0; i < 26; i++) fs.writeFileSync(path.join(folder, `capture-${String(i).padStart(2, '0')}.png`), pixel);
      const shots = require('../src/lib/screenshots');
      const first = await shots.screenshotPage(root, nativeImage, { sort: 'name' });
      assert.equal(first.total, 26);
      assert.equal(first.items.length, 24);
      assert.ok(first.items[0].thumb?.startsWith('data:image/png'));
      const second = await shots.screenshotPage(root, nativeImage, { offset: 24, sort: 'name' });
      assert.equal(second.items.length, 2);
      const filtered = await shots.screenshotPage(root, nativeImage, { query: 'capture-25' });
      assert.equal(filtered.total, 1);
      assert.throws(() => shots.screenshotPath(root, '../outside.png'));
      assert.throws(() => shots.screenshotPath(root, 'missing.png'));
      assert.equal(shots.screenshotPath(root, 'capture-00.png'), path.join(folder, 'capture-00.png'));
      assert.deepEqual(failures, [], 'Renderer reported errors');
      console.log(JSON.stringify({ ...result, gallery: 'preview, search, pagination, path checks passed', rendererErrors: failures }));
      clearTimeout(timeout);
      app.exit(0);
    } catch (error) {
      console.error(error);
      clearTimeout(timeout);
      app.exit(1);
    }
  });
});
require('../src/main');
