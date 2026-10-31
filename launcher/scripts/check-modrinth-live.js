#!/usr/bin/env node
// Exercises the Downloads page's Modrinth browser against the real API: a search for each type (with a
// sort and a category), version lists, icons, and one resource pack and one shader installed into a
// temporary instance. Needs api.modrinth.com and cdn.modrinth.com. Run: node scripts/check-modrinth-live.js
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const catalog = require('../src/lib/catalog');

const GAME = '1.21.11';
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'petal-modrinth-live-'));
  try {
    const instance = { loader: 'fabric', gameVersion: GAME };
    for (const [type, category] of [['mod', 'optimization'], ['resourcepack', '64x'], ['shader', 'vanilla-like'], ['modpack', 'lightweight']]) {
      const result = await catalog.search({ type, gameVersion: GAME, loader: 'fabric', sort: 'downloads', category });
      assert.ok(result.hits.length > 0, `no ${type} results`);
      const hit = result.hits[0];
      const builds = await catalog.versions(hit.id, { type, gameVersion: GAME });
      const icons = await catalog.icons(result.hits.map(h => h.icon).filter(Boolean).slice(0, 5));
      const shown = Object.values(icons).filter(Boolean).length;
      console.log(`${type}: ${result.total} results; top "${hit.title}" with ${builds.length} builds (${builds.filter(b => b.matches).length} for ${GAME}); ${shown}/${Object.keys(icons).length} icons loaded`);
      if (type === 'resourcepack' || type === 'shader') {
        const pick = result.hits.find(h => h.id) && builds.find(b => b.matches) ? { hit, build: builds.find(b => b.matches) } : null;
        if (!pick) { console.log(`  skipped install: no ${GAME} build on the top ${type}`); continue; }
        const { record } = await catalog.installPack(dir, instance, pick.build.id);
        const folder = type === 'shader' ? 'shaderpacks' : 'resourcepacks';
        assert.ok(fs.existsSync(path.join(dir, folder, record.filename)));
        console.log(`  installed ${record.filename} into ${folder} (hash checked)`);
      }
    }
    console.log('Modrinth browser live check passed.');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
