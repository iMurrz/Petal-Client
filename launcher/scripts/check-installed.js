// Run against a local test instance started with --remote-debugging-port=9337.
// Exercises the real packaged preload/IPC bridge; does not sign in or launch a game.
const assert = require('node:assert/strict');
const expectedVersion = require('../package.json').version;
(async () => {
  const pages = await (await fetch('http://127.0.0.1:9337/json')).json();
  const page = pages.find(p => p.type === 'page' && p.url.endsWith('/renderer/index.html'));
  assert.ok(page, 'Installed launcher page was not found');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const response = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Installed app test timed out')), 90000);
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id !== 1) return;
      clearTimeout(timer);
      message.error ? reject(new Error(message.error.message)) : resolve(message.result);
    };
  });
  socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
    awaitPromise: true, returnByValue: true, expression: `(async () => {
      const boot = await window.petal.bootstrap();
      if (boot.version !== ${JSON.stringify(expectedVersion)}) throw new Error('Unexpected installed version');
      const modules = await window.petal.getModules();
      if (modules.length !== boot.modules.length) throw new Error('Module refresh failed');
      if (modules.some(module => ['keystrokes','reach','combo','togglesprint','mineradar','petalfx','fullbright'].includes(module.id))) throw new Error('Retired feature in installed catalog');
      if (!['cropcare','locallight','supplies','targetblock'].every(id => modules.some(module => module.id === id))) throw new Error('Survival tools missing');
      if (document.body.textContent.includes('Bloom into the fight')) throw new Error('Old combat branding remains');
      const original = boot.settings.resolution;
      try {
        await window.petal.setSettings({resolution:{width:1600,height:900}});
        const saved = await window.petal.bootstrap();
        if (saved.settings.resolution.width !== 1600) throw new Error('Resolution did not persist');
      } finally { await window.petal.setSettings({resolution:original}); }
      const repair = window.petal.repair();
      let busyBlocked = false;
      try { await window.petal.repair(); } catch { busyBlocked = true; }
      const repaired = await repair;
      if (!busyBlocked) throw new Error('Concurrent repair was not blocked');
      const screenshots = await window.petal.screenshots({limit:24});
      document.querySelector('[data-page="screenshots"]').click();
      await new Promise(resolve => setTimeout(resolve, 300));
      if (!document.querySelector('#page').textContent.includes('Your captures')) throw new Error('Gallery did not render');
      document.querySelector('[data-page="settings"]').click();
      if (!document.querySelector('#page').textContent.includes('Verify and repair')) throw new Error('Repair UI missing');
      document.querySelector('[data-page="home"]').click();
      return { version:boot.version, repair:repaired, concurrentRepairBlocked:busyBlocked, screenshots:screenshots.total, resolution:'saved and restored' };
    })()`
  } }));
  const result = await response;
  socket.close();
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails));
  console.log(JSON.stringify(result.result.value));
})().catch(error => { console.error(error); process.exit(1); });
