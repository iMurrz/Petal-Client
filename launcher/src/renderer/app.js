'use strict';

// ---------- tiny DOM helpers (all dynamic text goes through textContent) ----------
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}
const $ = id => document.getElementById(id);
const ICON_PLAY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>';
const ICON_PLUS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const ICON_X = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
function icon(markup) { const s = h('span', { style: { display: 'inline-flex' } }); s.innerHTML = markup; return s; } // static, trusted markup only

// ---------- catalogs ----------
const CATEGORY_COLOR = { Survival: '#FFB8D9', Building: '#FF4FA3', Farming: '#7CF2C8', HUD: '#FFB8D9', Visual: '#FF8CC4', Utility: '#D9C2CF' };
const PROFILE_NOTES = {
  Builder: 'High frame cap and fewer effects for large builds, long tunnels and busy farms.',
  Balanced: '144 FPS cap, fewer particles and fast clouds. The everyday default.',
  Cinematic: 'Every particle, shadows, fancy clouds and V-Sync. Made for recording.'
};
const LOCKER = {
  cloak: { title: 'Cloaks', items: [
    { id: 'none', name: 'No cloak', rarity: 'Default', blurb: 'Keep your own cape, or none.' },
    { id: 'sakura', name: 'Sakura Drift', rarity: 'Mythic', blurb: 'Hot pink with blush diagonal stripes.' },
    { id: 'midnight', name: 'Midnight Bloom', rarity: 'Rare', blurb: 'Deep plum with a scatter of pink stars.' },
    { id: 'mint', name: 'Mint Condition', rarity: 'Common', blurb: 'Clean mint banding. Pairs with anything.' },
    { id: 'static', name: 'Petal Static', rarity: 'Rare', blurb: 'Blush and milk pixel checker.' },
    { id: 'voidrose', name: 'Void Rose', rarity: 'Mythic', blurb: 'Near-black cloak with a hot pink frame.' },
    { id: 'thorn', name: 'Neon Thorn', rarity: 'Common', blurb: 'Thin neon lines on dark plum.' }
  ] },
  wings: { title: 'Wings', items: [
    { id: 'none', name: 'No wings', rarity: 'Default', blurb: 'Keep it clean.' },
    { id: 'paper', name: 'Paper Petals', rarity: 'Mythic', blurb: 'Folded blush wings that flutter as you move.' },
    { id: 'glass', name: 'Glass Moth', rarity: 'Rare', blurb: 'Translucent wings that catch the light.' },
    { id: 'ember', name: 'Ember Lily', rarity: 'Rare', blurb: 'Hot pink wings with a hard silhouette.' }
  ] },
  halo: { title: 'Halos', items: [
    { id: 'none', name: 'No halo', rarity: 'Default', blurb: 'Nothing above your head.' },
    { id: 'bloom', name: 'Bloom Ring', rarity: 'Rare', blurb: 'A pink ring that slowly spins and bobs.' },
    { id: 'thorn', name: 'Thorn Crown', rarity: 'Mythic', blurb: 'Dashed mint ring for the sweatiest players.' },
    { id: 'pixel', name: 'Pixel Glow', rarity: 'Common', blurb: 'Square-cut milk white halo.' }
  ] }
};
const RARITY_COLOR = { Mythic: '#FF4FA3', Rare: '#7CF2C8', Common: '#D9C2CF', Default: '#B79AAB' };
const CLOAK_STYLE = {
  sakura: { background: 'repeating-linear-gradient(135deg,#FF4FA3 0 14px,#FFB8D9 14px 18px)' },
  midnight: { background: 'radial-gradient(#FF4FA3 2px,transparent 2.6px) 0 0/16px 16px, #2A0F2E' },
  mint: { background: 'repeating-linear-gradient(0deg,#7CF2C8 0 18px,#5AD3AA 18px 24px)' },
  static: { background: 'conic-gradient(#FFB8D9 25%,#FBEFF5 0 50%,#FFB8D9 0 75%,#FBEFF5 0) 0 0/16px 16px' },
  voidrose: { background: '#120A10', boxShadow: 'inset 0 0 0 6px #FF4FA3, inset 0 0 0 10px #120A10, inset 0 0 0 12px #B8326F' },
  thorn: { background: 'repeating-linear-gradient(90deg,#3B1A3F 0 10px,#FF4FA3 10px 12px)' }
};
const WING_COLOR = { paper: '#FFB8D9', glass: 'rgba(251,239,245,0.5)', ember: '#FF4FA3' };
const HALO_STYLE = {
  bloom: { borderRadius: '50%', border: '5px solid #FF4FA3' },
  thorn: { borderRadius: '50%', border: '5px dashed #7CF2C8' },
  pixel: { borderRadius: '0', border: '5px solid #FBEFF5' }
};

// ---------- state ----------
const state = {
  page: 'home',
  boot: null,
  accounts: [],
  settings: {},
  modules: [],
  cosmetics: { cloak: 'none', wings: 'none', halo: 'none' },
  game: { running: false, preparing: false },
  progress: null,
  modCat: 'All',
  modQuery: '',
  lockerTab: 'cloak',
  lockerSel: {},
  serverStatus: {},
  addingServer: false,
  update: null,
  updateProgress: null
};
const TITLES = { home: 'Play', mods: 'Petal modules', instances: 'Instances', downloads: 'Downloads', locker: 'Locker', screenshots: 'Screenshots', settings: 'Settings' };
const library = { releases: [], name: 'My survival world', version: '1.21.11', loader: 'fabric', loading: false, notice: '' };
const discover = { query: '', type: 'modpack', hits: [], total: 0, offset: 0, project: null, versions: [], versionId: '', loading: false, review: null, optional: true, installed: [], notice: '', created: null };

function applyBootstrap(boot) {
  state.boot = boot;
  state.accounts = boot.accounts;
  state.settings = boot.settings;
  state.modules = boot.modules;
  state.cosmetics = boot.cosmetics;
  state.game = boot.game;
  $('brand-version').textContent = `SURVIVAL ${boot.version}`;
}
async function selectInstance(id) {
  const boot = await attempt(() => window.petal.selectInstance(id));
  if (boot) {
    applyBootstrap(boot);
    discover.hits = []; discover.project = null; discover.versions = []; discover.installed = [];
    render();
  }
}
function coreOnlyPage(noun) {
  return h('section', { class: 'card' }, h('h2', { text: `${noun} belong to Petal SMP Survival` }),
    h('p', { class: 'note', text: 'Other instances use their own mods and settings. Petal’s bundled HUD and cosmetics are kept in its original instance so packs can run as their authors intended.' }),
    h('button', { class: 'btn btn-pink', text: 'Select Petal SMP Survival', disabled: state.game.running || state.game.preparing, onClick: () => selectInstance('petal') }),
    h('button', { class: 'btn btn-line', text: 'Browse downloads', onClick: () => go('downloads') }));
}
async function searchCatalog(offset = 0) {
  discover.loading = true; discover.notice = ''; render();
  try {
    const result = await window.petal.searchCatalog({ query: discover.query, type: discover.type, offset });
    discover.hits = result.hits; discover.total = result.total; discover.offset = result.offset;
  } catch (error) { discover.notice = error.message; }
  finally { discover.loading = false; if (state.page === 'downloads') render(); }
}
async function chooseProject(project) {
  discover.project = project; discover.versions = []; discover.versionId = ''; discover.review = null; discover.notice = ''; discover.loading = true; render();
  try {
    const builds = await window.petal.catalogVersions({ projectId: project.id, type: project.type });
    if (discover.project !== project) return;
    discover.versions = builds;
    discover.versionId = (builds.find(v => v.channel === 'release') || builds[0])?.id || '';
    if (!builds.length) discover.notice = 'No compatible versions were found.';
  } catch (error) { discover.notice = error.message; }
  finally { discover.loading = false; if (state.page === 'downloads') render(); }
}
async function reviewPack() {
  const result = await attempt(() => window.petal.reviewPack(discover.versionId));
  if (result) { discover.review = result; discover.optional = true; render(); }
}
async function refreshInstalled() {
  const records = await attempt(() => window.petal.installedMods());
  if (records) { discover.installed = records; if (state.page === 'downloads') render(); }
}
function downloadsPage() {
  const instance = state.boot.instance;
  const busy = discover.loading || state.game.preparing || state.game.running;
  const featured = h('div', { class: 'grid2' },
    h('section', { class: 'card' }, h('span', { class: 'label', text: 'Featured · Modrinth' }), h('h2', { text: 'SMP / ReichSMP' }),
      h('p', { class: 'note', text: 'A Fabric pack with performance and quality-of-life mods. Choose a published version, review it, and install it as a separate instance.' }),
      h('button', { class: 'btn btn-pink', text: 'Choose pack version', disabled: busy, onClick: () => chooseProject({ id: 'RSnh65gP', title: 'SMP / ReichSMP', type: 'modpack' }) })),
    h('section', { class: 'card' }, h('span', { class: 'label', text: 'Featured · CurseForge' }), h('h2', { text: 'Just Create SMP 2' }),
      h('p', { class: 'note', text: 'Minecraft 1.21.1 · NeoForge. This release integrates Modrinth and Fabric/Vanilla instances. This CurseForge pack cannot be installed directly here yet; its official files page is available below.' }),
      h('button', { class: 'btn btn-line', text: 'Open official files', onClick: () => attempt(() => window.petal.openFeatured('create')) })));
  const toolbar = h('form', { class: 'catalog-toolbar', onSubmit: event => { event.preventDefault(); searchCatalog(); } },
    h('select', { 'aria-label': 'Download type', onChange: event => { discover.type = event.target.value; discover.hits = []; discover.project = null; render(); } },
      ['modpack', 'mod'].map(type => h('option', { value: type, selected: discover.type === type, text: type === 'modpack' ? 'Modpacks' : 'Mods for this instance' }))),
    h('input', { type: 'search', placeholder: 'Search Modrinth', value: discover.query, 'aria-label': 'Search Modrinth', onInput: event => { discover.query = event.target.value; } }),
    h('button', { class: 'btn btn-pink', type: 'submit', text: 'Search', disabled: busy || (discover.type === 'mod' && instance.loader !== 'fabric') }),
    h('button', { class: 'btn btn-line', type: 'button', text: 'Import local pack', disabled: busy, onClick: () => attempt(async () => { const result = await window.petal.importPack(); if (result) { discover.review = result; render(); } }) }));
  const selection = discover.project ? h('section', { class: 'card catalog-selection' }, h('h2', { text: discover.project.title }),
    h('label', { class: 'field' }, h('span', { text: 'Published version' }),
      h('select', { 'aria-label': 'Published project version', onChange: event => { discover.versionId = event.target.value; } },
        discover.versions.map(build => h('option', { value: build.id, selected: build.id === discover.versionId, text: `${build.name} · ${build.games.slice(0, 3).join(', ')} · ${build.loaders.join(', ')}` })))),
    h('button', { class: 'btn btn-pink', text: discover.project.type === 'modpack' ? 'Review pack' : 'Install mod and required dependencies', disabled: busy || !discover.versionId, onClick: () => discover.project.type === 'modpack' ? reviewPack() : attempt(async () => {
      const records = await window.petal.installMod(discover.versionId);
      discover.notice = records.length ? `${records.length} mod files installed into ${instance.name}.` : 'This build is already installed.';
      await refreshInstalled();
    }) })) : null;
  const review = discover.review;
  const reviewCard = review ? h('section', { class: 'card pack-review' }, h('span', { class: 'label', text: 'Pack review' }), h('h2', { text: review.name }),
    h('p', { class: 'mono', text: `${review.gameVersion} · ${review.loader}${review.loaderVersion ? ` ${review.loaderVersion}` : ''} · ${review.files} client files` }),
    h('p', { class: 'note', text: review.reason }),
    review.supported ? h('label', { class: 'catalog-check' }, h('input', { type: 'checkbox', checked: discover.optional, onChange: event => { discover.optional = event.target.checked; } }), `Include ${review.optional || 0} optional client files`) : null,
    h('button', { class: 'btn btn-pink', text: 'Install as a new instance', disabled: busy || !review.supported, onClick: () => attempt(async () => {
      const entry = await window.petal.installPack({ token: review.token, includeOptional: discover.optional });
      discover.created = entry; discover.review = null;
      applyBootstrap(await window.petal.bootstrap());
      discover.notice = `${entry.name} installed. Your active instance is unchanged.`; render();
    }) })) : null;
  return h('div', { class: 'catalog-page' }, featured,
    h('section', { class: 'card' }, h('h2', { text: 'Discover on Modrinth' }),
      h('p', { class: 'note', text: `Mod downloads target ${instance.name} · Minecraft ${instance.gameVersion} · ${instance.loader}. Packs create separate instances and do not add the Petal HUD automatically.` }), toolbar,
      instance.loader !== 'fabric' && discover.type === 'mod' ? h('p', { class: 'note', text: 'Select or create a Fabric instance to install mods.' }) : null,
      h('p', { class: 'note', role: 'status', text: discover.notice || (discover.loading ? 'Loading Modrinth…' : state.game.preparing ? state.progress?.label || 'Preparing download…' : 'Search mods or packs, then choose an exact published build.') }),
      discover.created ? h('button', { class: 'btn btn-mint', text: `Select ${discover.created.name}`, disabled: busy, onClick: () => attempt(async () => { await selectInstance(discover.created.id); go('home'); }) }) : null,
      state.game.preparing ? h('button', { class: 'btn btn-line', text: 'Cancel operation', onClick: () => attempt(() => window.petal.cancelLaunch()) }) : null),
    selection, reviewCard,
    h('div', { class: 'catalog-results' }, discover.hits.map(hit => h('article', { class: 'card catalog-result' },
      h('div', {}, h('h3', { text: hit.title }), h('p', { class: 'note', text: hit.description }), h('span', { class: 'mono', text: `${Number(hit.downloads).toLocaleString()} downloads` })),
      h('button', { class: 'btn btn-line', text: 'Choose version', disabled: busy, onClick: () => chooseProject(hit) })))),
    discover.total > 12 ? h('div', { class: 'gallery-toolbar' },
      h('button', { class: 'btn btn-dark', text: 'Previous', disabled: busy || discover.offset === 0, onClick: () => searchCatalog(Math.max(0, discover.offset - 12)) }),
      h('span', { class: 'note', text: `${discover.offset + 1}–${Math.min(discover.offset + 12, discover.total)} of ${discover.total}` }),
      h('button', { class: 'btn btn-dark', text: 'Next', disabled: busy || discover.offset + 12 >= discover.total, onClick: () => searchCatalog(discover.offset + 12) })) : null,
    h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { text: 'Mods downloaded here' }), h('button', { class: 'btn btn-line', text: 'Refresh', onClick: refreshInstalled })),
      h('p', { class: 'note', text: 'Required dependencies are included. Disabling a downloaded mod keeps a disabled copy; files you added yourself are left alone.' }),
      discover.installed.map(mod => h('div', { class: 'row' }, h('span', { text: mod.name }), h('button', { class: 'btn btn-line', text: 'Disable', disabled: busy, onClick: () => attempt(async () => { await window.petal.disableMod(mod.projectId); await refreshInstalled(); }) })))));
}
function instancesPage() {
  const busy = state.game.running || state.game.preparing || library.loading;
  const releases = library.releases.length ? library.releases : [{ id: '1.21.11' }];
  return h('div', { class: 'catalog-page' },
    h('section', { class: 'card' }, h('h2', { text: 'Your worlds, kept apart' }),
      h('p', { class: 'note', text: 'Each instance has its own worlds, mods, configs and screenshots. Select an instance to switch version for the next launch. Existing worlds are never converted in place.' }),
      state.boot.instances.map(instance => h('div', { class: 'instance-row' }, h('div', {}, h('h3', { text: instance.name }),
        h('p', { class: 'note', text: `${instance.gameVersion} · ${instance.loader}${instance.pack ? ` · ${instance.pack.version}` : instance.petal ? ' · Petal HUD included' : ' · separate game folder'}` })),
        h('button', { class: instance.active ? 'btn btn-pink' : 'btn btn-line', text: instance.active ? 'Selected' : 'Select', disabled: busy || instance.active, onClick: () => selectInstance(instance.id) })))),
    h('section', { class: 'card' }, h('h2', { text: 'Create a version instance' }),
      h('p', { class: 'note', text: 'Modern Minecraft releases (1.20 and newer) with Vanilla or Fabric. The matching Mojang Java runtime is installed automatically. Older legacy releases and other loaders are not available in this release.' }),
      h('form', { class: 'instance-form', onSubmit: event => { event.preventDefault(); attempt(async () => {
        const entry = await window.petal.createInstance({ name: library.name, gameVersion: library.version, loader: library.loader });
        applyBootstrap(await window.petal.bootstrap()); library.notice = `${entry.name} created and selected.`; render();
      }); } },
        h('label', { class: 'field' }, h('span', { text: 'Name' }), h('input', { value: library.name, maxLength: 80, required: true, minLength: 2, onInput: event => { library.name = event.target.value; } })),
        h('label', { class: 'field' }, h('span', { text: 'Minecraft release' }), h('select', { onChange: event => { library.version = event.target.value; } }, releases.map(release => h('option', { value: release.id, selected: release.id === library.version, text: release.id + (release.latest ? ' · latest release' : '') })))),
        h('label', { class: 'field' }, h('span', { text: 'Loader' }), h('select', { onChange: event => { library.loader = event.target.value; } }, ['fabric', 'vanilla'].map(loader => h('option', { value: loader, selected: library.loader === loader, text: loader === 'fabric' ? 'Fabric · supports mods' : 'Vanilla' })))),
        h('div', { class: 'gallery-toolbar' }, h('button', { type: 'button', class: 'btn btn-line', text: library.loading ? 'Loading releases…' : 'Refresh Minecraft releases', disabled: busy, onClick: () => attempt(async () => {
          library.loading = true; render();
          try { library.releases = await window.petal.gameVersions(); }
          finally { library.loading = false; render(); }
        }) }), h('button', { class: 'btn btn-pink', type: 'submit', text: 'Create instance', disabled: busy }))),
      h('p', { class: 'note', role: 'status', text: library.notice })),
    h('button', { class: 'btn btn-line', text: 'Browse or import a modpack', onClick: () => go('downloads') }));
}
const gallery = { items: [], total: 0, offset: 0, limit: 24, query: '', sort: 'newest', loading: false, loaded: false, error: '' };
let galleryRequest = 0;

async function loadScreenshots(offset = 0) {
  const request = ++galleryRequest;
  gallery.loading = true;
  gallery.error = '';
  if (state.page === 'screenshots') render();
  try {
    const result = await window.petal.screenshots({ offset, limit: gallery.limit, query: gallery.query, sort: gallery.sort });
    if (request !== galleryRequest) return;
    Object.assign(gallery, result, { loaded: true });
  } catch (error) {
    if (request !== galleryRequest) return;
    gallery.error = error.message;
  } finally {
    if (request === galleryRequest) {
      gallery.loading = false;
      if (state.page === 'screenshots') render();
    }
  }
}

function screenshotsPage() {
  const search = h('input', { type: 'search', placeholder: 'Search filenames', value: gallery.query, 'aria-label': 'Search screenshots' });
  const sort = h('select', { 'aria-label': 'Sort screenshots' }, ['newest', 'oldest', 'name'].map(value =>
    h('option', { value, selected: gallery.sort === value, text: { newest: 'Newest first', oldest: 'Oldest first', name: 'Filename' }[value] })));
  return h('div', { class: 'settings' },
    h('section', { class: 'card' }, h('h2', { text: 'Your captures' }),
      h('p', { class: 'note', text: 'Press F2 in Minecraft to take a screenshot. Refresh here to see new captures.' }),
      h('form', { class: 'gallery-toolbar', onSubmit: event => { event.preventDefault(); gallery.query = search.value; gallery.sort = sort.value; loadScreenshots(); } },
        search, sort, h('button', { class: 'btn btn-pink', type: 'submit', text: 'Search', disabled: gallery.loading }),
        h('button', { class: 'btn btn-dark', type: 'button', text: 'Refresh', disabled: gallery.loading, onClick: () => loadScreenshots(gallery.offset) }),
        h('button', { class: 'btn btn-line', type: 'button', text: 'Open folder', onClick: () => attempt(() => window.petal.openScreenshots()) })),
      h('p', { class: 'note', role: 'status', text: gallery.error || (gallery.loading ? 'Loading screenshots…' : gallery.total ? `${gallery.total} screenshots` : 'No screenshots yet. Take your first one in game with F2.') })),
    h('div', { class: 'gallery-grid' }, gallery.items.map(shot =>
      h('article', { class: 'card gallery-shot' },
        shot.thumb ? h('img', { src: shot.thumb, alt: shot.name, loading: 'lazy' }) : h('p', { class: 'note', text: 'Preview unavailable' }),
        h('p', { class: 'mono', text: shot.name }),
        h('p', { class: 'note', text: new Date(shot.taken).toLocaleString() }),
        h('button', { class: 'btn btn-line', text: 'Show in folder', onClick: () => attempt(() => window.petal.showScreenshot(shot.name)) })))),
    gallery.total > gallery.limit ? h('div', { class: 'gallery-toolbar' },
      h('button', { class: 'btn btn-dark', text: 'Previous', disabled: gallery.loading || gallery.offset === 0, onClick: () => loadScreenshots(Math.max(0, gallery.offset - gallery.limit)) }),
      h('span', { class: 'note', text: `Page ${Math.floor(gallery.offset / gallery.limit) + 1} of ${Math.ceil(gallery.total / gallery.limit)}` }),
      h('button', { class: 'btn btn-dark', text: 'Next', disabled: gallery.loading || gallery.offset + gallery.limit >= gallery.total, onClick: () => loadScreenshots(gallery.offset + gallery.limit) })) : null);
}

function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 6000);
}

async function attempt(fn) {
  try { return await fn(); } catch (err) { if (err.code !== 'cancelled') toast(err.message); return undefined; }
}

const activeAccount = () => state.accounts.find(a => a.active) || null;

// ---------- skin head ----------
function head(account, size = 40) {
  const c = h('canvas', { width: 8, height: 8, class: 'avatar', 'aria-hidden': 'true', style: { width: `${size}px`, height: `${size}px` } });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3A2533';
  ctx.fillRect(0, 0, 8, 8);
  if (account?.skin && account.skin.startsWith('data:image/png')) {
    const img = new Image();
    img.onload = () => {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 8, 8, 8, 8, 0, 0, 8, 8);
      ctx.drawImage(img, 40, 8, 8, 8, 0, 0, 8, 8);
    };
    img.src = account.skin;
  } else {
    ctx.fillStyle = '#FF4FA3';
    ctx.fillRect(0, 6, 8, 2);
  }
  return c;
}

// ---------- shell ----------
function renderShell() {
  document.querySelectorAll('.nav button').forEach(b => {
    if (b.dataset.page === state.page) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('page-title').textContent = TITLES[state.page];
  const me = $('me');
  me.replaceChildren();
  const acc = activeAccount();
  me.append(head(acc), h('div', {},
    h('div', { class: 'me-name', text: acc ? acc.name : 'Not signed in' }),
    h('div', { class: `me-status${acc && !state.game.running ? '' : ' off'}`, text: acc ? (state.game.running ? 'In game' : acc.needsReauth ? 'Sign in again' : 'Ready') : 'Sign in to play' })));
}

function render() {
  renderShell();
  const page = $('page');
  const scroll = page.scrollTop;
  page.replaceChildren(({ home: homePage, mods: modsPage, instances: instancesPage, downloads: downloadsPage, locker: lockerPage, screenshots: screenshotsPage, settings: settingsPage })[state.page]());
  page.scrollTop = scroll;
}

// ---------- home ----------
function launchLabel() {
  if (!activeAccount()) return 'Sign in to play';
  if (state.game.running) return 'Playing';
  if (state.game.preparing) return 'Preparing…';
  return `Launch ${state.boot.gameVersion}`;
}

function progressInfo() {
  const p = state.progress;
  if (!p || !(state.game.preparing || state.game.running)) return { text: '', fraction: null };
  if (p.stage === 'download' && p.totalBytes) {
    const f = p.bytes / p.totalBytes;
    return { text: `${p.label} · ${Math.round(f * 100)}% · ${(p.bytes / 1e6).toFixed(0)} of ${(p.totalBytes / 1e6).toFixed(0)} MB`, fraction: f };
  }
  if (p.total) return { text: `${p.label} · ${p.done} of ${p.total}`, fraction: p.done / p.total };
  return { text: p.label || '', fraction: null };
}

async function doLaunch(quickPlay) {
  if (!activeAccount()) return startSignIn();
  if (state.game.running || state.game.preparing) return;
  state.progress = { label: 'Getting ready' };
  await attempt(() => window.petal.launch(quickPlay ? { quickPlay } : {}));
}

// Dusk scene behind the hero: twinkling stars, a pixel sun and two rows of blocky hills.
function heroScene() {
  const stars = Array.from({ length: 24 }, (_, i) => h('span', { class: 'star', style: {
    left: `${(i * 37) % 100}%`, top: `${12 + ((i * 53) % 46)}%`, animationDelay: `${(i % 6) * 0.5}s` } }));
  const sun = h('div', { class: 'sun' }, Array.from({ length: 36 }, (_, i) => {
    const x = i % 6, y = Math.floor(i / 6), d = Math.hypot(x - 2.5, y - 2.5);
    return h('span', { style: { background: d < 2.2 ? (d < 1.3 ? '#FFE3F1' : '#FFB3D9') : d < 3 ? 'rgba(255,179,217,0.35)' : 'transparent' } });
  }));
  const hills = (count, base, amp, freq, offset, color) => h('div', { class: 'hills' }, Array.from({ length: count }, (_, i) =>
    h('span', { style: { height: `${Math.round((base + (Math.sin(i * freq + offset) * 0.5 + 0.5) * amp + (i % 3) * 8) / 16) * 16}px`, background: color } })));
  return h('div', { class: 'hero-scene', 'aria-hidden': 'true' }, stars, sun,
    hills(40, 110, 110, 0.4, 0, '#3E1556'), hills(40, 40, 80, 0.7, 1.4, '#1A0B26'), h('div', { class: 'shade' }));
}

function homePage() {
  const s = state.settings;
  const instance = state.boot.instance;
  const info = progressInfo();
  const busy = state.game.preparing;
  const fill = h('span', { class: `fill${busy && info.fraction === null ? ' indeterminate' : ''}` });
  if (busy && info.fraction !== null) fill.style.width = `${Math.round(info.fraction * 100)}%`;
  const launchBtn = h('button', { class: `launch${busy ? ' busy' : ''}`, disabled: state.game.running || undefined, onClick: () => doLaunch() }, fill, icon(ICON_PLAY), h('span', { text: launchLabel() }));

  const memOptions = [2048, 4096, 6144, 8192].filter(m => m <= s.maxMemoryMb);
  const instancePicker = h('select', { 'aria-label': 'Selected instance and Minecraft version', disabled: busy || state.game.running,
    onChange: event => selectInstance(event.target.value) }, state.boot.instances.map(item => h('option', { value: item.id, selected: item.id === instance.id, text: `${item.name} · ${item.gameVersion} · ${item.loader}` })));
  const equipped = LOCKER.cloak.items.find(i => i.id === state.cosmetics.cloak);
  const link = (text, page) => h('a', { href: '#', text, onClick: e => { e.preventDefault(); go(page); } });

  const launchCard = h('div', { class: 'launch-card' },
    h('div', { class: 'card-top' }, h('span', { class: 'label', text: 'Instance' }),
      h('span', { class: 'note', style: { fontSize: '13px' }, text: `${instance.loader}${instance.petal ? ' · Petal 64x' : ''}` })),
    instancePicker,
    h('div', { class: 'launch-row' }, launchBtn,
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' } },
        h('span', { class: 'label', text: 'Memory' }),
        h('div', { class: 'seg mono', role: 'group', 'aria-label': 'Memory' }, memOptions.map(m =>
          h('button', { 'aria-pressed': String(s.memoryMb === m), text: `${m / 1024} GB`, onClick: () => saveSettings({ memoryMb: m }) }))))),
    busy ? h('button', { class: 'btn btn-line', text: 'Cancel', onClick: () => attempt(() => window.petal.cancelLaunch()) }) : null,
    h('div', { class: 'progress-text', text: info.text || (state.boot.modJarFound ? `Managed Java runtime · ${instance.loader} ${instance.loaderVersion || ''}${instance.pack ? ' · pack settings preserved' : ` · ${s.profile} profile`}` : 'Petal mod jar not built yet: run "npm run build:mod"') }),
    h('div', { class: 'launch-links' },
      instance.petal ? link(`Cloak: ${equipped?.name || 'No cloak'}`, 'locker') : link('Browse downloads', 'downloads'),
      link('Manage versions & packs', 'instances')));

  const hero = h('section', { class: 'hero', 'aria-labelledby': 'hero-title' }, heroScene(),
    h('div', { class: 'hero-copy' },
      h('span', { class: 'hero-badge', text: `PETAL ${state.boot.version} · SMP SURVIVAL` }),
      h('h2', { id: 'hero-title' }, 'Make room', h('br'), h('span', { text: 'to grow.' })),
      h('p', { text: instance.petal ? 'A calmer home for your next survival world. Plan a base, light a tunnel, check your crops and keep your building supplies close. Play solo or join your own SMP.' : `Ready for ${instance.name}. This instance keeps its own worlds, mods and settings, using Minecraft ${instance.gameVersion} with ${instance.loader}.` })),
    launchCard);

  const news = h('section', { 'aria-labelledby': 'new-h' },
    h('div', { class: 'section-head' }, h('h2', { id: 'new-h', text: "What's new in 2.0" })),
    h('div', { class: 'news' }, [
      ['TEXTURE PACK', '#FF9ACF', 'Petal 64x', 'Every container, button, heart and hotbar redrawn at 64x, plus the ores, tools and armour you use most.'],
      ['IN-GAME', '#D69BFF', 'Glass mod menu', 'Right Shift opens a rounded menu with live previews and one-tap HUD editing.'],
      ['MENUS', '#8FF5D2', 'New title and pause screens', 'A dusk title screen with your saved servers, and a pause menu that shows this session at a glance.']
    ].map(([tag, color, title, text]) => h('article', {}, h('span', { class: 'tag', style: { color }, text: tag }), h('span', { class: 'title', text: title }), h('p', { text })))));

  const guides = h('section', { class: 'card survival-guide' }, h('h2', { text: 'A little help for your next world' }),
    h('div', { class: 'grid3' }, [
      ['Building', 'Build a home', 'Keep track of materials, tool wear and the block you are placing against.'],
      ['Farming', 'Grow your garden', 'Look at wheat, carrots, potatoes, beetroot or farmland to check growth and moisture.'],
      ['Survival', 'Make a path home', 'Keep your bearings with coordinates, facing and portal coordinate conversions.']
    ].map(([category, title, description]) => h('div', {}, h('h3', { text: title }), h('p', { class: 'note', text: description }),
      h('button', { class: 'btn btn-line', text: `Open ${category}`, onClick: () => { state.modCat = category; go('mods'); } })))));
  return h('div', {}, updateBanner(), hero, h('div', { class: 'grid3' }, quickJoinCard(), accountCard(), performanceCard()), instance.petal ? guides : null, news);
}

function quickJoinCard() {
  const servers = state.settings.servers || [];
  const card = h('section', { class: 'card', 'aria-labelledby': 'qj' },
    h('div', { class: 'card-head' }, h('h2', { id: 'qj', text: 'Quick join' }), h('span', { class: 'label', text: `${servers.length} saved` })));
  for (const sv of servers) {
    const st = state.serverStatus[sv.address];
    if (!st) pingServer(sv.address);
    const initials = sv.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    card.append(h('div', { class: 'server' },
      h('div', { class: 'tile', 'aria-hidden': 'true', text: initials }),
      h('div', { class: 'info' },
        h('span', { class: 'name', text: sv.name }),
        h('span', { class: 'addr', text: sv.address }),
        h('span', { class: `status${st?.online ? '' : ' off'}`, text: !st || st.pending ? 'Checking…' : st.online ? `${st.players ?? '?'} online${st.latency != null ? ` · ${st.latency} ms` : ''}` : 'Offline' })),
      h('div', { class: 'server-actions' },
        h('button', { class: 'btn btn-pink', text: 'Join', disabled: state.game.running || state.game.preparing || undefined, onClick: () => doLaunch(sv.address) }),
        h('button', { class: 'x', 'aria-label': `Remove ${sv.name}`, title: 'Remove', onClick: () => attempt(async () => { state.settings = await window.petal.removeServer(sv.address); render(); }) }, icon(ICON_X)))));
  }
  if (state.addingServer) {
    const name = h('input', { placeholder: 'Name (optional)', 'aria-label': 'Server name', maxlength: 32 });
    const addr = h('input', { placeholder: 'play.example.net', 'aria-label': 'Server address', maxlength: 260 });
    const save = async () => {
      const result = await attempt(() => window.petal.addServer({ name: name.value, address: addr.value }));
      if (result) { state.settings = result; state.addingServer = false; render(); }
    };
    addr.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    card.append(h('div', { class: 'add-server' },
      h('label', { class: 'field' }, name), h('label', { class: 'field' }, addr),
      h('div', { style: { display: 'flex', gap: '8px' } },
        h('button', { class: 'btn btn-pink', text: 'Save server', onClick: save }),
        h('button', { class: 'btn btn-line', text: 'Cancel', onClick: () => { state.addingServer = false; render(); } }))));
    setTimeout(() => addr.focus(), 0);
  } else {
    card.append(h('button', { class: 'add-dashed', onClick: () => { state.addingServer = true; render(); } }, icon(ICON_PLUS), 'Add a server'));
  }
  return card;
}

async function pingServer(address) {
  state.serverStatus[address] = { pending: true };
  const st = await window.petal.pingServer(address).catch(() => ({ online: false }));
  state.serverStatus[address] = st;
  if (state.page === 'home') render();
}

function accountCard() {
  const card = h('section', { class: 'card', 'aria-labelledby': 'acct' },
    h('div', { class: 'card-head' }, h('h2', { id: 'acct', text: 'Account' }),
      state.accounts.length ? h('span', { class: 'label', text: `${state.accounts.length} signed in` }) : null));
  if (!state.accounts.length) {
    card.append(h('p', { class: 'note', text: 'Sign in with the Microsoft account that owns Minecraft: Java Edition. You type a short code at microsoft.com/link; Petal never sees your password.' }),
      h('button', { class: 'btn btn-pink', text: 'Sign in with Microsoft', onClick: startSignIn }));
    if (!state.boot.canPersistAccounts) card.append(h('p', { class: 'note', text: 'Secure storage is unavailable here, so you will sign in again each time the launcher opens.' }));
    return card;
  }
  for (const a of state.accounts) {
    card.append(h('div', { class: 'account-row' }, head(a, 36),
      h('div', { class: 'grow' }, h('span', { style: { fontWeight: 600 }, text: a.name }),
        h('span', { class: 'note', style: { fontSize: '13px', color: a.needsReauth ? '#FFB8D9' : a.active ? '#7CF2C8' : undefined }, text: a.needsReauth ? 'Session expired' : a.active ? 'Active' : 'Signed in' })),
      a.active ? null : h('button', { class: 'btn btn-dark', text: 'Use', onClick: () => attempt(async () => { state.accounts = await window.petal.selectAccount(a.uuid); render(); }) }),
      h('button', { class: 'btn btn-line', text: 'Sign out', onClick: () => attempt(async () => { state.accounts = await window.petal.signOut(a.uuid); render(); }) })));
  }
  card.append(h('button', { class: 'add-dashed', onClick: startSignIn }, icon(ICON_PLUS), 'Add another account'));
  return card;
}

function performanceCard() {
  const s = state.settings;
  const toggles = [
    { key: 'fullscreen', label: 'Start in fullscreen' },
    { key: 'hideWhilePlaying', label: 'Hide launcher while playing' }
  ];
  return h('section', { class: 'card', 'aria-labelledby': 'pf' },
    h('h2', { id: 'pf', text: 'Performance' }),
    h('div', { class: 'seg profiles', role: 'group', 'aria-label': 'Profile', style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))' } },
      ['Builder', 'Balanced', 'Cinematic'].map(p => h('button', { 'aria-pressed': String(s.profile === p), text: p, onClick: () => saveSettings({ profile: p }) }))),
    h('p', { class: 'note', text: PROFILE_NOTES[s.profile] }),
    h('div', {}, toggles.map(t => h('div', { class: 'row' }, h('span', { text: t.label }),
      h('button', { class: 'switch', 'aria-pressed': String(Boolean(s[t.key])), 'aria-label': t.label, onClick: () => saveSettings({ [t.key]: !s[t.key] }) })))),
    h('p', { class: 'note', style: { fontSize: '13px' }, text: 'Profiles adjust frame cap, particles, shadows and clouds in the game options when you launch.' }));
}

async function saveSettings(patch) {
  const next = await attempt(() => window.petal.setSettings(patch));
  if (next) { state.settings = next; render(); }
}

// ---------- mods ----------
function modsPage() {
  if (!state.boot.instance.petal) return coreOnlyPage('Petal modules');
  const cats = ['All', 'Survival', 'Building', 'Farming', 'HUD', 'Visual', 'Utility'];
  const enabled = state.modules.filter(m => m.enabled).length;
  const grid = h('div', { class: 'mod-grid' });
  const fillGrid = () => {
    grid.replaceChildren();
    const q = state.modQuery.trim().toLowerCase();
    const list = state.modules.filter(m => (state.modCat === 'All' || m.category === state.modCat) && (!q || `${m.name} ${m.description}`.toLowerCase().includes(q)));
    for (const m of list) {
      const initials = m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      grid.append(h('div', { class: 'mod' },
        h('div', { class: 'mod-top' },
          h('span', { class: 'tile', 'aria-hidden': 'true', text: initials, style: { color: m.enabled ? CATEGORY_COLOR[m.category] : '#9C7E90' } }),
          h('div', {}, h('div', { class: 'name', text: m.name }), h('div', { class: 'desc', text: m.description }))),
        h('div', { class: 'mod-foot' },
          h('span', { class: 'label', text: m.category, style: { fontSize: '11px' } }),
          h('button', { class: 'switch', 'aria-pressed': String(m.enabled), 'aria-label': `${m.name} ${m.enabled ? 'on' : 'off'}`, onClick: () => toggleModule(m) }))));
    }
    if (!list.length) grid.append(h('p', { class: 'note', text: 'No mods match that search.' }));
  };
  fillGrid();
  const search = h('input', { type: 'search', placeholder: 'Search mods', 'aria-label': 'Search mods', value: state.modQuery });
  search.addEventListener('input', () => { state.modQuery = search.value; fillGrid(); });

  return h('div', {},
    h('div', { class: 'callout', style: { marginBottom: '20px' } },
      h('span', { text: 'These switches update the Petal mod\'s settings. In game, press' }), h('span', { class: 'kbd', text: 'Right Shift' }),
      h('span', { text: 'for the full menu, sliders, colours and the HUD editor. Changes sync to the running game within two seconds; active drags finish first.' })),
    h('div', { class: 'mods-layout' },
      h('nav', { class: 'cats', 'aria-label': 'Mod categories' }, cats.map(c => h('button', {
        'aria-pressed': String(state.modCat === c), onClick: () => { state.modCat = c; render(); }
      }, h('span', { text: c }), h('span', { class: 'mono', style: { fontSize: '12px', opacity: 0.75 }, text: String(c === 'All' ? state.modules.length : state.modules.filter(m => m.category === c).length) })))),
      h('div', { class: 'mods-main' },
        h('div', { class: 'card-head' },
          h('div', {}, h('div', { class: 'display', style: { fontWeight: 700, fontSize: '22px' }, text: state.modCat === 'All' ? 'All mods' : `${state.modCat} mods` }),
            h('div', { class: 'mono', style: { fontSize: '13px', color: '#B79AAB' }, text: `${enabled} of ${state.modules.length} enabled` })),
          h('label', { class: 'field', style: { width: '280px' } }, h('span', { class: 'sr-only', text: 'Search' }), search)),
        grid)));
}

async function toggleModule(m) {
  const list = await attempt(() => window.petal.setModule(m.id, !m.enabled));
  if (list) { state.modules = list; render(); }
}

// ---------- locker ----------
function playerPreview(show) {
  const p = h('div', { class: 'player', role: 'img', 'aria-label': 'Player preview' });
  const part = (style) => h('div', { style });
  const wing = show.wings !== 'none' ? WING_COLOR[show.wings] : null;
  if (wing) {
    p.append(part({ left: '24px', top: '116px', width: '124px', height: '164px', background: wing, clipPath: 'polygon(100% 8%,0 0,22% 45%,4% 100%,100% 72%)' }),
      part({ left: '212px', top: '116px', width: '124px', height: '164px', background: wing, clipPath: 'polygon(0 8%,100% 0,78% 45%,96% 100%,0 72%)' }));
  }
  p.append(
    part({ left: '140px', top: '236px', width: '40px', height: '120px', background: '#2A1A24', boxShadow: 'inset 0 -18px 0 #120A10' }),
    part({ left: '180px', top: '236px', width: '40px', height: '120px', background: '#251720', boxShadow: 'inset 0 -18px 0 #120A10' }),
    part({ left: '100px', top: '116px', width: '40px', height: '120px', background: '#4A2F40', boxShadow: 'inset 0 -18px 0 #E8B9A0' }),
    part({ left: '220px', top: '116px', width: '40px', height: '120px', background: '#44293A', boxShadow: 'inset 0 -18px 0 #DDAE95' }),
    part({ left: '140px', top: '116px', width: '80px', height: '120px', background: '#3B2433' }),
    part({ left: '140px', top: '36px', width: '80px', height: '80px', background: '#3A1E2E', boxShadow: 'inset 0 -10px 0 #2A1522' }));
  if (show.cloak !== 'none') p.append(part({ left: '136px', top: '114px', width: '88px', height: '176px', transform: 'rotate(3deg)', transformOrigin: '50% 0', ...CLOAK_STYLE[show.cloak] }));
  if (show.halo !== 'none') p.append(part({ left: '128px', top: '4px', width: '104px', height: '24px', boxSizing: 'border-box', ...HALO_STYLE[show.halo] }));
  p.append(part({ left: '50px', top: '356px', width: '260px', height: '20px', background: '#24171F', boxShadow: 'inset 0 3px 0 #FF4FA3' }));
  return p;
}

function swatch(slot, id) {
  if (id === 'none') return h('span', { style: { width: '56px', height: '56px', border: '2px dashed #4A2F40' } });
  if (slot === 'cloak') return h('span', { style: { width: '56px', height: '80px', ...CLOAK_STYLE[id] } });
  if (slot === 'wings') return h('span', { style: { width: '72px', height: '72px', background: WING_COLOR[id], clipPath: 'polygon(100% 8%,0 0,22% 45%,4% 100%,100% 72%)' } });
  return h('span', { style: { width: '72px', height: '22px', boxSizing: 'border-box', ...HALO_STYLE[id] } });
}

function lockerPage() {
  if (!state.boot.instance.petal) return coreOnlyPage('Petal cosmetics');
  const tab = state.lockerTab;
  const sel = state.lockerSel[tab] ?? state.cosmetics[tab];
  const cur = LOCKER[tab].items.find(i => i.id === sel) || LOCKER[tab].items[0];
  const show = { ...state.cosmetics, [tab]: cur.id };
  const equipped = state.cosmetics[tab] === cur.id;

  return h('div', {},
    h('div', { class: 'callout', style: { marginBottom: '20px' }, text: 'Equipped cosmetics reach the game within a couple of seconds. They are drawn on your own player, so for now only you can see them: press F5 in game to look.' }),
    h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Cosmetic slot' }, Object.entries(LOCKER).map(([slot, def]) =>
      h('button', { role: 'tab', 'aria-selected': String(slot === tab), text: def.title, onClick: () => { state.lockerTab = slot; render(); } }))),
    h('div', { class: 'locker' },
      h('section', { class: 'stage', 'aria-label': 'Preview' },
        h('div', { class: 'stage-view' }, h('span', { class: 'label', text: 'Back view' }), playerPreview(show)),
        h('div', { class: 'stage-foot' },
          h('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 } },
            h('span', { class: 'mono', style: { fontSize: '12px', letterSpacing: '0.2em', fontWeight: 600, color: RARITY_COLOR[cur.rarity] }, text: cur.rarity.toUpperCase() }),
            h('span', { class: 'display', style: { fontWeight: 700, fontSize: '22px' }, text: cur.name }),
            h('span', { style: { fontSize: '14px', color: '#D9C2CF' }, text: cur.blurb })),
          h('button', { class: `btn ${equipped ? 'btn-dark' : 'btn-pink'}`, style: { minHeight: '52px', padding: '0 26px', fontSize: '15px' }, disabled: equipped || undefined, text: equipped ? 'Equipped' : 'Equip',
            onClick: () => attempt(async () => { state.cosmetics = await window.petal.equip(tab, cur.id); render(); }) }))),
      h('section', { class: 'items', 'aria-label': LOCKER[tab].title },
        h('div', { class: 'item-grid' }, LOCKER[tab].items.map(it => h('button', {
          class: 'item', 'aria-pressed': String(it.id === cur.id), onClick: () => { state.lockerSel[tab] = it.id; render(); }
        },
          h('span', { class: 'swatch-box' }, swatch(tab, it.id)),
          h('span', { style: { fontWeight: 600 }, text: it.name }),
          h('span', { class: 'meta' }, h('span', { style: { color: RARITY_COLOR[it.rarity] }, text: it.rarity }), h('span', { style: { color: '#D9C2CF' }, text: state.cosmetics[tab] === it.id ? 'Equipped' : '' }))))),
        h('div', { class: 'card', style: { marginTop: 'auto' } },
          h('span', { class: 'label', text: 'Equipped loadout' }),
          h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '12px' } },
            Object.entries(LOCKER).map(([slot, def]) => h('div', {},
              h('div', { style: { fontSize: '12px', color: '#B79AAB' }, text: def.title.slice(0, -1) }),
              h('div', { style: { fontWeight: 600, fontSize: '14px' }, text: def.items.find(i => i.id === state.cosmetics[slot])?.name || 'None' }))))))));
}

// ---------- settings ----------
// ---------- updates ----------
function updateLabel(u) {
  if (u.downloading) {
    const p = state.updateProgress;
    return p?.totalBytes ? `Downloading… ${Math.round((p.bytes / p.totalBytes) * 100)}%` : 'Downloading…';
  }
  return 'Restart and update';
}

/** Downloads (if needed) and verifies the newest release, then restarts Petal into its installer. */
async function restartAndUpdate() {
  if (state.game.running || state.game.preparing) return toast('Close Minecraft first, then update.');
  state.update = { ...state.update, downloading: true };
  render();
  const st = await attempt(() => window.petal.downloadUpdate());
  if (st) state.update = st;
  render();
  if (st?.downloaded) await attempt(() => window.petal.installUpdate());
}

async function checkForUpdates() {
  const st = await attempt(() => window.petal.checkUpdate());
  if (!st) return;
  state.update = st;
  render();
  if (!st.configured) toast('Updates are not set up for this build.');
  else if (st.error) toast(st.error);
  else if (!st.available) toast(`You're on the newest version (${st.current}).`);
}

function updateBanner() {
  const u = state.update;
  if (!u?.available) return null;
  return h('section', { class: 'update-banner', role: 'status', 'aria-live': 'polite' },
    h('div', { class: 'grow' },
      h('span', { class: 'eyebrow', text: 'Update ready' }),
      h('span', { class: 'title', text: `Petal ${u.version} is out` }),
      h('span', { class: 'note', text: u.canInstall ? `You have ${u.current}. Petal will close, update itself and open again.` : `You have ${u.current}. Install it from the release page; this build cannot update itself.` })),
    u.page ? h('button', { class: 'btn btn-line', text: "What's new", onClick: () => attempt(() => window.petal.openRelease()) }) : null,
    u.canInstall ? h('button', { class: 'btn btn-pink', disabled: u.downloading || state.game.running || state.game.preparing || undefined, text: updateLabel(u), onClick: restartAndUpdate }) : null);
}

function settingsPage() {
  const s = state.settings;
  const resolution = h('select', { 'aria-label': 'Game window size', onChange: event => {
    const size = event.target.value;
    saveSettings({ resolution: size ? { width: Number(size.split('x')[0]), height: Number(size.split('x')[1]) } : null });
  } }, ['', '1280x720', '1600x900', '1920x1080', '2560x1440'].map(size =>
    h('option', { value: size, text: size ? size.replace('x', ' × ') : 'Minecraft default',
      selected: size === (s.resolution ? `${s.resolution.width}x${s.resolution.height}` : '') })));
  const memLabel = h('span', { class: 'mono', text: `${(s.memoryMb / 1024).toFixed(1)} GB` });
  const range = h('input', { type: 'range', min: 1024, max: s.maxMemoryMb, step: 512, value: s.memoryMb, 'aria-label': 'Memory' });
  range.addEventListener('input', () => { memLabel.textContent = `${(range.value / 1024).toFixed(1)} GB`; });
  range.addEventListener('change', () => saveSettings({ memoryMb: Number(range.value) }));
  return h('div', { class: 'settings' },
    h('section', { class: 'card' }, h('h2', { text: 'Game window' }),
      h('p', { class: 'note', text: 'Choose the window size for your next launch. Fullscreen uses your display settings.' }), resolution),
    h('section', { class: 'card' }, h('h2', { text: 'Game memory' }),
      h('div', { class: 'card-head' }, h('span', { class: 'note', text: '4 GB suits most players. More rarely helps unless you use big resource packs.' }), memLabel), range),
    h('section', { class: 'card' }, h('h2', { text: 'Files' }),
      h('p', { class: 'note', text: 'Petal keeps its own Minecraft folder, separate from the official launcher. Drop extra Fabric mods for 1.21.11 into its mods folder.' }),
      h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        h('button', { class: 'btn btn-dark', text: 'Open game folder', onClick: () => attempt(() => window.petal.openGameFolder()) }),
        h('button', { class: 'btn btn-line', text: 'Open last game log', onClick: () => attempt(() => window.petal.openLog()) }))),
    h('section', { class: 'card' }, h('h2', { text: 'Repair game files' }),
      h('p', { class: 'note', text: 'Verify Minecraft, Java, Fabric and assets, then download missing or damaged files. Your worlds, screenshots and extra mods are kept.' }),
      h('button', { class: 'btn btn-pink', disabled: state.game.running || state.game.preparing, text: state.game.preparing ? (state.progress?.label || 'Checking files…') : 'Verify and repair', onClick: () => attempt(async () => {
        const result = await window.petal.repair(); toast(`Repair complete. ${result.files} files downloaded.`);
      }) }),
      state.game.preparing ? h('button', { class: 'btn btn-line', text: 'Cancel', onClick: () => attempt(() => window.petal.cancelLaunch()) }) : null),
    accountCard(),
    h('section', { class: 'card' }, h('h2', { text: 'About' }),
      h('div', { class: 'row' }, h('span', { text: 'Launcher' }), h('span', { class: 'mono', text: state.boot.version })),
      h('div', { class: 'row' },
        h('span', { text: state.update?.available ? `Update ${state.update.version} available` : state.update?.checkedAt ? 'Up to date' : 'Updates' }),
        state.update?.available && state.update.canInstall
          ? h('button', { class: 'btn btn-pink', disabled: state.update.downloading || state.game.running || state.game.preparing || undefined, text: updateLabel(state.update), onClick: restartAndUpdate })
          : h('button', { class: 'btn btn-line', text: 'Check for updates', onClick: checkForUpdates })),
      h('div', { class: 'row' }, h('span', { text: 'Minecraft' }), h('span', { class: 'mono', text: state.boot.gameVersion })),
      h('div', { class: 'row' }, h('span', { text: 'Fabric Loader' }), h('span', { class: 'mono', text: state.boot.loaderVersion })),
      h('p', { class: 'note', style: { fontSize: '13px' }, text: 'Petal Client is not an official Minecraft product and is not approved by or associated with Mojang or Microsoft.' })));
}

// ---------- sign-in ----------
async function startSignIn() {
  const accounts = await attempt(() => window.petal.signIn());
  if (accounts) { state.accounts = accounts; toast(`Signed in as ${activeAccount()?.name}`); render(); }
}

window.petal.onSignInPrompt(prompt => {
  const modal = $('signin');
  if (!prompt) { modal.classList.add('hidden'); return; }
  modal.classList.remove('hidden');
  $('signin-code').textContent = prompt.userCode || '…';
  $('signin-copy').onclick = () => attempt(() => window.petal.copyCode(prompt.userCode)).then(() => toast('Code copied'));
});
$('signin-open').addEventListener('click', () => attempt(() => window.petal.openSignInPage()));
$('signin-cancel').addEventListener('click', () => attempt(() => window.petal.cancelSignIn()));

// ---------- events & boot ----------
async function refreshModules() {
  if (state.page !== 'mods') return;
  const list = await attempt(() => window.petal.getModules());
  if (list && state.page === 'mods' && JSON.stringify(list) !== JSON.stringify(state.modules)) {
    state.modules = list;
    render();
  }
}
window.addEventListener('focus', refreshModules);
function go(page) { state.page = page; render(); $('page').scrollTop = 0; if (page === 'screenshots') loadScreenshots(); if (page === 'mods') refreshModules(); if (page === 'downloads') refreshInstalled(); }
document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
$('me').addEventListener('click', () => (activeAccount() ? go('settings') : startSignIn()));
$('win-min').addEventListener('click', () => window.petal.minimize());
$('win-close').addEventListener('click', () => window.petal.close());

let progressFrame = 0;
window.petal.onProgress(p => {
  state.progress = p;
  if (!['home', 'settings', 'downloads', 'instances'].includes(state.page) || progressFrame) return;
  progressFrame = requestAnimationFrame(() => { progressFrame = 0; render(); });
});
window.petal.onGameState(g => {
  const wasRunning = state.game.running;
  state.game = g;
  if (!g.preparing && !g.running) state.progress = null;
  if (wasRunning && !g.running && g.crashed) toast(`Minecraft closed unexpectedly${g.exitCode != null ? ` (code ${g.exitCode})` : ''}. Open Settings › Open last game log for details.`);
  render();
});
window.petal.onAccounts(list => { state.accounts = list; renderShell(); });
window.petal.onUpdate(st => { state.update = st; if (['home', 'settings'].includes(state.page)) render(); });
let updateFrame = 0;
window.petal.onUpdateProgress(p => {
  state.updateProgress = p;
  if (updateFrame || !['home', 'settings'].includes(state.page)) return;
  updateFrame = requestAnimationFrame(() => { updateFrame = 0; render(); });
});

(async () => {
  const boot = await window.petal.bootstrap();
  applyBootstrap(boot);
  render();
})().catch(err => toast(`Petal could not start: ${err.message}`));
