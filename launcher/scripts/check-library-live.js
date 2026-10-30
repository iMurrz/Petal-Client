// Live official-metadata / Modrinth integration check. Installation requires the explicit flag below.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const versions = require('../src/lib/game/versions');
const catalog = require('../src/lib/catalog');
const packs = require('../src/lib/packs');
const { Instances } = require('../src/lib/instances');
(async () => {
  const install = process.argv.includes('--install-featured');
  const root = install ? path.join(process.env.APPDATA, 'Petal Client', 'game') : await fs.mkdtemp(path.join(os.tmpdir(), 'petal-library-live-'));
  const releases = await versions.listVersions();
  console.log('Official releases:', releases.length, 'Latest:', releases[0].id);
  for (const [game, loader] of [['1.21.1', 'fabric'], [releases[0].id, 'vanilla']]) {
    const metadata = await versions.resolveVersion(root, game, loader);
    console.log('Resolved:', game, loader, metadata.fabric.loaderVersion, metadata.java.component);
  }
  const builds = await catalog.versions('reichsmp', { type: 'modpack' });
  const choice = builds.find(v => v.channel === 'release' && v.loaders.includes('fabric'));
  if (!choice) throw Error('ReichSMP has no listed Fabric release.');
  const instances = new Instances(root);
  const existing = instances.list().find(i => i.pack?.name === 'SMP' && i.pack.version === choice.number);
  if (install && existing) { console.log('Featured pack already present:', existing.id); return; }
  const plan = await packs.review(root, { versionId: choice.id });
  console.log('Featured pack review:', JSON.stringify(packs.publicReview(plan)));
  if (!install) { await packs.cleanup(root, plan.stage); return; }
  let last = -1;
  const entry = await packs.install(plan, { root, instances, includeOptional: true, resolve: versions.resolveVersion, progress: progress => {
    const step = Math.floor(progress.done / progress.total * 10);
    if (step !== last) { last = step; console.log('Pack files:', progress.done, '/', progress.total); }
  } });
  console.log('Featured pack installed:', JSON.stringify(entry));
  console.log('Active instance preserved:', instances.get().id);
})().catch(error => { console.error(error); process.exitCode = 1; });
