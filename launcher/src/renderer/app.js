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
  updateProgress: null,
  lastCrash: null,
  crashSeen: false,
  maximized: false
};
const PAGES = ['home', 'mods', 'content', 'instances', 'downloads', 'locker', 'screenshots', 'console', 'settings'];
const TITLES = { home: 'Play', mods: 'Petal modules', content: 'Content', instances: 'Instances', downloads: 'Downloads', locker: 'Locker', screenshots: 'Screenshots', console: 'Console', settings: 'Settings' };
const library = { releases: [], name: 'My survival world', version: '1.21.11', loader: 'fabric', loading: false, notice: '', renaming: null };
const discover = { query: '', type: 'mod', sort: 'relevance', category: '', icons: {}, busyId: '', searched: false, hits: [], total: 0, offset: 0, project: null, versions: [], versionId: '', loading: false, review: null, optional: true, installed: [], notice: '', created: null };

function applyBootstrap(boot) {
  state.boot = boot;
  state.accounts = boot.accounts;
  state.settings = boot.settings;
  state.modules = boot.modules;
  state.cosmetics = boot.cosmetics;
  state.game = boot.game;
  $('brand-version').textContent = `SURVIVAL ${boot.version}`;
  document.body.classList.toggle('reduce-motion', Boolean(boot.settings.reduceMotion));
}
async function selectInstance(id) {
  const boot = await attempt(() => window.petal.selectInstance(id));
  if (boot) {
    applyBootstrap(boot);
    discover.hits = []; discover.project = null; discover.versions = []; discover.installed = [];
    contentView.data = null;
    render();
    if (state.page === 'content') loadContent();
  }
}
function coreOnlyPage(noun) {
  return h('section', { class: 'card' }, h('h2', { text: `${noun} belong to Petal SMP Survival` }),
    h('p', { class: 'note', text: 'Other instances use their own mods and settings. Petal’s bundled HUD and cosmetics are kept in its original instance so packs can run as their authors intended.' }),
    h('button', { class: 'btn btn-pink', text: 'Select Petal SMP Survival', disabled: state.game.running || state.game.preparing, onClick: () => selectInstance('petal') }),
    h('button', { class: 'btn btn-line', text: 'Browse downloads', onClick: () => go('downloads') }));
}
const MODRINTH_TYPES = [['mod', 'Mods'], ['resourcepack', 'Resource packs'], ['shader', 'Shaders'], ['modpack', 'Modpacks']];
const MODRINTH_SORTS = [['relevance', 'Best match'], ['downloads', 'Most downloaded'], ['follows', 'Most followed'], ['updated', 'Recently updated'], ['newest', 'Newest']];
// Survival-friendly Modrinth categories for each type (no PvP or combat filters).
const MODRINTH_CATEGORIES = {
  mod: ['optimization', 'utility', 'decoration', 'storage', 'food', 'transportation', 'equipment', 'worldgen', 'management', 'social'],
  resourcepack: ['vanilla-like', '16x', '32x', '64x', 'simplistic', 'realistic', 'themed', 'gui', 'tweaks', 'audio'],
  shader: ['vanilla-like', 'semi-realistic', 'realistic', 'fantasy', 'cartoon', 'potato', 'low', 'medium', 'high'],
  modpack: ['optimization', 'lightweight', 'multiplayer', 'adventure', 'quests', 'technology', 'magic', 'kitchen-sink']
};
const categoryLabel = c => /^\d/.test(c) ? c : c.replace(/-/g, ' ').replace(/^./, x => x.toUpperCase());
function compactNumber(n) {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);
}
async function searchCatalog(offset = 0) {
  discover.loading = true; discover.notice = ''; render();
  try {
    const result = await window.petal.searchCatalog({ query: discover.query, type: discover.type, sort: discover.sort, category: discover.category || undefined, offset });
    discover.hits = result.hits; discover.total = result.total; discover.offset = result.offset; discover.searched = true;
    loadIcons(result.hits);
  } catch (error) { discover.notice = error.message; }
  finally { discover.loading = false; if (state.page === 'downloads') render(); }
}
/** Icons arrive after the results, as data: URLs fetched by the launcher. */
async function loadIcons(hits) {
  const wanted = hits.map(hit => hit.icon).filter(url => url && !(url in discover.icons));
  if (!wanted.length) return;
  try { Object.assign(discover.icons, await window.petal.catalogIcons(wanted)); } catch { return; }
  if (state.page === 'downloads') render();
}
/** One click: the newest release for this instance (any channel if there is no release), with dependencies for mods. */
async function quickInstall(hit) {
  if (hit.type === 'modpack') return chooseProject(hit);
  discover.busyId = hit.id; render();
  try {
    const builds = await window.petal.catalogVersions({ projectId: hit.id, type: hit.type });
    const usable = builds.filter(b => b.matches);
    const build = usable.find(b => b.channel === 'release') || usable[0];
    if (!build) {
      if (!builds.length) throw new Error(`${hit.title} has no build for this instance.`);
      // Packs that don't list this exact Minecraft version: let the player choose a build.
      discover.notice = `${hit.title} doesn't list Minecraft ${state.boot.instance.gameVersion}. Choose a build below; most packs still work.`;
      await chooseProject(hit);
      return;
    }
    if (hit.type === 'mod') {
      const records = await window.petal.installMod(build.id);
      await refreshInstalled();
      toast(records.length > 1 ? `${hit.title} and ${records.length - 1} required mod${records.length === 2 ? '' : 's'} installed.` : `${hit.title} installed. It loads next launch.`, 'success');
    } else {
      const result = await window.petal.installPackFile(build.id);
      toast(result.already ? `${hit.title} is already installed.` : hit.type === 'shader'
        ? `${hit.title} installed. Turn it on in game: Options, Video Settings, Shader Packs.`
        : `${hit.title} installed. Turn it on in game: Options, Resource Packs.`, 'success');
    }
    hit.installed = true;
  } catch (error) { toast(error.message, 'error'); }
  finally { discover.busyId = ''; if (state.page === 'downloads') render(); }
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
  const kind = discover.type;
  const needsFabric = (kind === 'mod' || kind === 'shader') && instance.loader !== 'fabric';
  const featured = kind === 'modpack' ? h('div', { class: 'grid2' },
    h('section', { class: 'card' }, h('span', { class: 'label', text: 'Featured · Modrinth' }), h('h2', { text: 'SMP / ReichSMP' }),
      h('p', { class: 'note', text: 'A Fabric pack with performance and quality-of-life mods. Choose a published version, review it, and install it as a separate instance.' }),
      h('button', { class: 'btn btn-pink', text: 'Choose pack version', disabled: busy, onClick: () => chooseProject({ id: 'RSnh65gP', title: 'SMP / ReichSMP', type: 'modpack' }) })),
    h('section', { class: 'card' }, h('span', { class: 'label', text: 'Featured · CurseForge' }), h('h2', { text: 'Just Create SMP 2' }),
      h('p', { class: 'note', text: 'Minecraft 1.21.1 · NeoForge. This CurseForge pack cannot be installed directly here yet; its official files page is available below.' }),
      h('button', { class: 'btn btn-line', text: 'Open official files', onClick: () => attempt(() => window.petal.openFeatured('create')) }))) : null;
  const setType = value => { discover.type = value; discover.category = ''; discover.hits = []; discover.total = 0; discover.project = null; discover.review = null; discover.notice = ''; searchCatalog(); };
  const tabs = h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'What to browse' }, MODRINTH_TYPES.map(([value, label]) =>
    h('button', { role: 'tab', 'aria-selected': String(kind === value), text: label, disabled: discover.loading || undefined, onClick: () => setType(value) })));
  const toolbar = h('form', { class: 'catalog-toolbar', onSubmit: event => { event.preventDefault(); searchCatalog(); } },
    h('input', { type: 'search', placeholder: `Search ${MODRINTH_TYPES.find(t => t[0] === kind)[1].toLowerCase()} on Modrinth`, value: discover.query, 'aria-label': 'Search Modrinth', onInput: event => { discover.query = event.target.value; } }),
    h('select', { class: 'compact', 'aria-label': 'Sort results', onChange: event => { discover.sort = event.target.value; searchCatalog(); } },
      MODRINTH_SORTS.map(([value, label]) => h('option', { value, selected: discover.sort === value, text: label }))),
    h('button', { class: 'btn btn-pink', type: 'submit', text: 'Search', disabled: busy || needsFabric }),
    kind === 'modpack' ? h('button', { class: 'btn btn-line', type: 'button', text: 'Import local pack', disabled: busy, onClick: () => attempt(async () => { const result = await window.petal.importPack(); if (result) { discover.review = result; render(); } }) }) : null);
  const chips = h('div', { class: 'chip-row', role: 'group', 'aria-label': 'Category' },
    ['', ...MODRINTH_CATEGORIES[kind]].map(c => h('button', { class: 'chip', 'aria-pressed': String(discover.category === c), text: c ? categoryLabel(c) : 'All', disabled: busy || needsFabric || undefined,
      onClick: () => { discover.category = c; searchCatalog(); } })));
  const selection = discover.project ? h('section', { class: 'card catalog-selection' }, h('h2', { text: discover.project.title }),
    h('label', { class: 'field' }, h('span', { text: 'Published version' }),
      h('select', { 'aria-label': 'Published project version', onChange: event => { discover.versionId = event.target.value; } },
        discover.versions.map(build => h('option', { value: build.id, selected: build.id === discover.versionId, text: `${build.name} · ${build.games.slice(-3).join(', ')} · ${build.loaders.join(', ')}${build.matches ? '' : ' · not listed for this version'}` })))),
    h('div', { class: 'gallery-toolbar' },
      h('button', { class: 'btn btn-pink', text: discover.project.type === 'modpack' ? 'Review pack' : discover.project.type === 'mod' ? 'Install mod and required dependencies' : 'Install this build', disabled: busy || !discover.versionId, onClick: () => discover.project.type === 'modpack' ? reviewPack() : attempt(async () => {
        if (discover.project.type === 'mod') {
          const records = await window.petal.installMod(discover.versionId);
          discover.notice = records.length ? `${records.length} mod files installed into ${instance.name}.` : 'This build is already installed.';
          await refreshInstalled();
        } else {
          const result = await window.petal.installPackFile(discover.versionId);
          discover.notice = result.already ? 'This build is already installed.' : `${result.record.name} installed into ${instance.name}.`;
        }
        const hit = discover.hits.find(x => x.id === discover.project.id);
        if (hit) hit.installed = true;
        render();
      }) }),
      h('button', { class: 'btn btn-line', text: 'Close', onClick: () => { discover.project = null; render(); } }))) : null;
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
  const results = discover.hits.map(hit => {
    const img = hit.icon && discover.icons[hit.icon];
    const working = discover.busyId === hit.id;
    const action = hit.petalPack ? h('span', { class: 'badge petal', title: 'Petal installs this for you. Switch it on or off in Content, Petal Pack.', text: 'In Petal Pack' })
      : hit.installed ? h('span', { class: 'badge modrinth', text: 'Installed' })
      : h('button', { class: 'btn btn-pink slim', text: working ? 'Installing…' : hit.type === 'modpack' ? 'Review' : 'Install', disabled: busy || needsFabric || Boolean(discover.busyId) || undefined, onClick: () => quickInstall(hit) });
    return h('article', { class: 'card mr-card' },
      img ? h('img', { class: 'mr-icon', src: img, alt: '' }) : h('div', { class: 'mr-icon', 'aria-hidden': 'true', text: hit.title.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?' }),
      h('div', { class: 'mr-body' },
        h('div', { class: 'mr-head' }, h('h3', { class: 'mr-title', title: hit.title, text: hit.title }), hit.author ? h('span', { class: 'mr-author', text: `by ${hit.author}` }) : null),
        h('p', { class: 'note small clamp', text: hit.description }),
        h('div', { class: 'mr-meta' },
          h('span', { class: 'mono', text: `${compactNumber(hit.downloads)} downloads` }),
          hit.updated ? h('span', { class: 'mono', text: `updated ${relativeTime(hit.updated)}` }) : null,
          hit.categories.slice(0, 3).map(c => h('span', { class: 'badge', text: categoryLabel(c) })))),
      h('div', { class: 'mr-actions' }, action,
        h('button', { class: 'btn btn-line slim', text: 'Versions', disabled: busy || needsFabric || undefined, onClick: () => chooseProject(hit) })));
  });
  const status = discover.notice || (discover.loading ? 'Searching Modrinth…' : state.game.preparing ? state.progress?.label || 'Working…'
    : needsFabric ? `${kind === 'mod' ? 'Mods' : 'Shaders'} need a Fabric instance. Select Petal SMP Survival or another Fabric instance.`
    : discover.searched && !discover.hits.length ? 'Nothing matches. Try another word or category.'
    : kind === 'mod' ? `Mods install into ${instance.name} with everything they need.` : kind === 'modpack' ? 'Packs install as their own instance; your worlds stay where they are.'
    : `${kind === 'shader' ? 'Shaders' : 'Resource packs'} download into ${instance.name}. Switch them on in game.`);
  const pages = discover.total > discover.hits.length ? h('div', { class: 'gallery-toolbar mr-pages' },
    h('button', { class: 'btn btn-dark', text: 'Previous', disabled: busy || discover.offset === 0, onClick: () => searchCatalog(Math.max(0, discover.offset - 20)) }),
    h('span', { class: 'note', text: `${discover.offset + 1}–${Math.min(discover.offset + discover.hits.length, discover.total)} of ${discover.total.toLocaleString()}` }),
    h('button', { class: 'btn btn-dark', text: 'Next', disabled: busy || discover.offset + 20 >= discover.total, onClick: () => searchCatalog(discover.offset + 20) })) : null;
  if (!discover.searched && !discover.loading && !discover.notice && !needsFabric) setTimeout(() => { if (state.page === 'downloads' && !discover.searched && !discover.loading) searchCatalog(); }, 0);
  return h('div', { class: 'catalog-page' },
    h('section', { class: 'card' },
      h('div', { class: 'card-head' }, h('div', {}, h('span', { class: 'label', text: 'Modrinth' }), h('h2', { text: 'Find mods, packs and shaders' })),
        h('span', { class: 'mono small muted', text: `${instance.name} · ${instance.gameVersion} · ${instance.loader}` })),
      tabs, toolbar, chips,
      h('p', { class: 'note', role: 'status', text: status }),
      discover.created ? h('button', { class: 'btn btn-mint', text: `Select ${discover.created.name}`, disabled: busy, onClick: () => attempt(async () => { await selectInstance(discover.created.id); go('home'); }) }) : null,
      state.game.preparing ? h('button', { class: 'btn btn-line', text: 'Cancel operation', onClick: () => attempt(() => window.petal.cancelLaunch()) }) : null),
    selection, reviewCard, featured,
    h('div', { class: 'mr-grid' }, results),
    pages,
    kind === 'mod' && discover.installed.length ? h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('h2', { text: 'Mods downloaded here' }), h('button', { class: 'btn btn-line', text: 'Refresh', onClick: refreshInstalled })),
      h('p', { class: 'note', text: 'Required dependencies are included. Disabling a downloaded mod keeps a disabled copy; files you added yourself are left alone.' }),
      discover.installed.map(mod => h('div', { class: 'row' }, h('span', { class: 'ellipsis', text: mod.name }), h('button', { class: 'btn btn-line slim', text: 'Disable', disabled: busy, onClick: () => attempt(async () => { await window.petal.disableMod(mod.projectId); await refreshInstalled(); }) })))) : null);
}
function instancesPage() {
  const busy = state.game.running || state.game.preparing || library.loading;
  const releases = library.releases.length ? library.releases : [{ id: '1.21.11' }];
  return h('div', { class: 'catalog-page' },
    h('section', { class: 'card' }, h('h2', { text: 'Your worlds, kept apart' }),
      h('p', { class: 'note', text: 'Each instance has its own worlds, mods, configs and screenshots. Select an instance to switch version for the next launch. Existing worlds are never converted in place.' }),
      state.boot.instances.map(instance => instanceRow(instance, busy))),
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
function instanceRow(instance, busy) {
  const s = state.settings;
  const renaming = library.renaming === instance.id;
  const nameInput = renaming ? h('input', { class: 'inline-input', value: instance.name, maxLength: 80, 'aria-label': 'Instance name' }) : null;
  const saveName = () => attempt(async () => { applyBootstrap(await window.petal.renameInstance(instance.id, nameInput.value)); library.renaming = null; render(); });
  if (nameInput) {
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { library.renaming = null; render(); } });
    setTimeout(() => { nameInput.focus(); nameInput.select(); }, 0);
  }
  const memChoices = [null, 2048, 3072, 4096, 6144, 8192, 12288].filter(m => m === null || m <= s.maxMemoryMb);
  const memory = h('select', { class: 'compact', 'aria-label': `Memory for ${instance.name}`, disabled: busy, onChange: event => attempt(async () => {
    applyBootstrap(await window.petal.setInstanceMemory(instance.id, event.target.value ? Number(event.target.value) : null)); render();
  }) }, memChoices.map(m => h('option', { value: m ?? '', selected: (instance.memoryMb ?? null) === m, text: m ? `${m / 1024} GB memory` : `Default memory (${(s.memoryMb / 1024).toFixed(1)} GB)` })));
  const remove = () => attempt(async () => {
    const ok = await confirmDialog({ title: `Remove ${instance.name}?`, body: 'Its folder, including worlds, mods and screenshots, moves to the Recycle Bin. You can restore it from there.', confirm: 'Move to Recycle Bin', danger: true });
    if (!ok) return;
    applyBootstrap(await window.petal.removeInstance(instance.id)); toast(`${instance.name} moved to the Recycle Bin.`, 'success'); render();
  });
  return h('div', { class: `instance-row${instance.active ? ' active' : ''}` },
    h('div', { class: 'instance-main' },
      renaming ? h('div', { class: 'rename-row' }, nameInput, h('button', { class: 'btn btn-pink', text: 'Save', onClick: saveName }), h('button', { class: 'btn btn-line', text: 'Cancel', onClick: () => { library.renaming = null; render(); } }))
        : h('h3', { text: instance.name }),
      h('p', { class: 'note', text: `${instance.gameVersion} · ${instance.loader}${instance.pack ? ` · ${instance.pack.version}` : instance.petal ? ' · Petal HUD included' : ' · separate game folder'}` }),
      h('p', { class: 'mono stats', text: instance.launches ? `${formatDuration(instance.playMs)} played · ${instance.launches} ${instance.launches === 1 ? 'session' : 'sessions'} · last played ${relativeTime(instance.lastPlayed)}` : 'Not played yet' }),
      h('div', { class: 'instance-tools' }, memory,
        h('button', { class: 'btn btn-line slim', text: 'Folder', onClick: () => attempt(() => window.petal.openInstanceFolder(instance.id)) }),
        instance.petal ? null : h('button', { class: 'btn btn-line slim', text: 'Rename', disabled: busy || renaming, onClick: () => { library.renaming = instance.id; render(); } }),
        instance.petal ? null : h('button', { class: 'btn btn-line slim danger', text: 'Remove', disabled: busy, onClick: remove }))),
    h('button', { class: instance.active ? 'btn btn-pink' : 'btn btn-line', text: instance.active ? 'Selected' : 'Select', disabled: busy || instance.active, onClick: () => selectInstance(instance.id) }));
}

function formatDuration(ms) {
  const minutes = Math.round((ms || 0) / 60000);
  if (minutes < 1) return 'Under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
}

function relativeTime(iso) {
  if (!iso) return 'never';
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.round(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)} h ago`;
  if (diff < 7 * 86400000) { const d = Math.round(diff / 86400000); return d === 1 ? 'yesterday' : `${d} days ago`; }
  return new Date(iso).toLocaleDateString();
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

/** Stacked notices. kind: info | success | error. Errors stay longer and are announced right away. */
function toast(message, kind = 'info') {
  const host = $('toasts');
  const el = h('div', { class: `toast ${kind}`, role: kind === 'error' ? 'alert' : 'status' },
    h('span', { class: 'toast-text', text: message }),
    h('button', { class: 'toast-x', 'aria-label': 'Dismiss', onClick: () => el.remove() }, icon(ICON_X)));
  host.append(el);
  while (host.children.length > 3) host.firstElementChild.remove();
  setTimeout(() => el.remove(), kind === 'error' ? 9000 : 5000);
}

async function attempt(fn) {
  try { return await fn(); } catch (err) { if (err.code !== 'cancelled') toast(err.message, 'error'); return undefined; }
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
  $('console-dot').classList.toggle('hidden', !state.game.running);
  $('offline').classList.toggle('hidden', navigator.onLine);
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
  page.replaceChildren(({ home: homePage, mods: modsPage, content: contentPage, instances: instancesPage, downloads: downloadsPage, locker: lockerPage, screenshots: screenshotsPage, console: consolePage, settings: settingsPage })[state.page]());
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
      h('span', { class: 'note', style: { fontSize: '13px' }, text: instance.launches ? `${formatDuration(instance.playMs)} played · ${relativeTime(instance.lastPlayed)}` : `${instance.loader}${instance.petal ? ' · Petal 64x' : ''}` })),
    instancePicker,
    h('div', { class: 'launch-row' }, launchBtn,
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' } },
        h('span', { class: 'label', text: 'Memory' }),
        h('div', { class: 'seg mono', role: 'group', 'aria-label': 'Memory' }, memOptions.map(m =>
          h('button', { 'aria-pressed': String(s.memoryMb === m), text: `${m / 1024} GB`, onClick: () => saveSettings({ memoryMb: m }) }))))),
    busy ? h('button', { class: 'btn btn-line', text: 'Cancel', onClick: () => attempt(() => window.petal.cancelLaunch()) }) : null,
    state.game.running ? h('div', { class: 'running-row' },
      h('span', { class: 'live-dot', 'aria-hidden': 'true' }), h('span', { class: 'note', text: `Playing for ${formatDuration(Date.now() - Date.parse(state.game.startedAt))}` }),
      h('button', { class: 'btn btn-line slim', text: 'Console', onClick: () => go('console') }),
      h('button', { class: 'btn btn-line slim danger', text: 'Force stop', onClick: stopGame })) : null,
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
    h('div', { class: 'section-head' }, h('h2', { id: 'new-h', text: "What's new in 2.1" })),
    h('div', { class: 'news' }, [
      ['CONTENT', '#FF9ACF', 'Mods and packs, per instance', 'See every mod, resource pack and shader pack, switch mods on and off, and add files without digging through folders.'],
      ['CRASH HELP', '#D69BFF', 'Know why it closed', 'When Minecraft crashes, Petal reads the crash report and tells you what went wrong and what to try next.'],
      ['CONSOLE', '#8FF5D2', 'Live game output', 'Watch the game log as you play, filter warnings and errors, and copy it when asking for help. Ctrl K jumps anywhere.']
    ].map(([tag, color, title, text]) => h('article', {}, h('span', { class: 'tag', style: { color }, text: tag }), h('span', { class: 'title', text: title }), h('p', { text })))));

  const guides = h('section', { class: 'card survival-guide' }, h('h2', { text: 'A little help for your next world' }),
    h('div', { class: 'grid3' }, [
      ['Building', 'Build a home', 'Keep track of materials, tool wear and the block you are placing against.'],
      ['Farming', 'Grow your garden', 'Look at wheat, carrots, potatoes, beetroot or farmland to check growth and moisture.'],
      ['Survival', 'Make a path home', 'Keep your bearings with coordinates, facing and portal coordinate conversions.']
    ].map(([category, title, description]) => h('div', {}, h('h3', { text: title }), h('p', { class: 'note', text: description }),
      h('button', { class: 'btn btn-line', text: `Open ${category}`, onClick: () => { state.modCat = category; go('mods'); } })))));
  return h('div', {}, updateBanner(), crashCallout(), hero, h('div', { class: 'grid3' }, quickJoinCard(), accountCard(), performanceCard()), instance.petal ? guides : null, news);
}

function quickJoinCard() {
  const servers = state.settings.servers || [];
  const card = h('section', { class: 'card', 'aria-labelledby': 'qj' },
    h('div', { class: 'card-head' }, h('h2', { id: 'qj', text: 'Quick join' }),
      servers.length ? h('button', { class: 'link-btn', text: 'Refresh', onClick: () => { state.serverStatus = {}; render(); } }) : h('span', { class: 'label', text: '0 saved' })));
  for (const sv of servers) {
    const st = state.serverStatus[sv.address];
    if (!st || (!st.pending && Date.now() - st.at > 60000)) pingServer(sv.address);
    const initials = sv.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const tile = st?.favicon ? h('img', { class: 'tile', src: st.favicon, alt: '' }) : h('div', { class: 'tile', 'aria-hidden': 'true', text: initials });
    card.append(h('div', { class: 'server' },
      tile,
      h('div', { class: 'info' },
        h('span', { class: 'name', text: sv.name }),
        st?.motd?.length ? motdLine(st.motd) : h('span', { class: 'addr', text: sv.address }),
        h('span', { class: `status${st?.online ? '' : ' off'}`, title: st?.detail || '', text: !st || st.pending ? 'Checking…' : st.online ? `${st.players ?? '?'}/${st.max ?? '?'} online${st.latency != null ? ` · ${st.latency} ms` : ''}${st.version ? ` · ${st.version}` : ''}` : (st.detail || 'Offline') })),
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
  state.serverStatus[address] = { pending: true, at: Date.now() };
  const st = await window.petal.pingServer(address).catch(() => ({ online: false }));
  state.serverStatus[address] = { ...st, at: Date.now() };
  if (state.page === 'home') render();
}

/** Server MOTD as coloured spans. Colours come from the main process as #rrggbb only; text stays textContent. */
function motdLine(segments) {
  return h('span', { class: 'motd' }, segments.slice(0, 40).map(seg => h('span', { text: seg.text.replace(/\n/g, ' '), style: {
    color: /^#[0-9a-f]{6}$/i.test(seg.color || '') ? seg.color : undefined, fontWeight: seg.bold ? '700' : undefined, fontStyle: seg.italic ? 'italic' : undefined } })));
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
  if (next) { state.settings = next; document.body.classList.toggle('reduce-motion', Boolean(next.reduceMotion)); render(); }
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
    javaFlagsCard(),
    h('section', { class: 'card' }, h('h2', { text: 'Launcher' }),
      [
        { key: 'hideWhilePlaying', label: 'Hide the launcher while Minecraft is open', note: 'It comes back when the game closes or crashes.' },
        { key: 'autoCheckUpdates', label: 'Check for Petal updates when the launcher opens', note: 'You can always check by hand below.' },
        { key: 'reduceMotion', label: 'Reduce motion', note: 'Stops twinkling stars, the shine on the Play button and other animations.' }
      ].map(t => h('div', { class: 'row tall' }, h('div', { class: 'grow' }, h('span', { text: t.label }), h('span', { class: 'note small', text: t.note })),
        h('button', { class: 'switch', 'aria-pressed': String(Boolean(s[t.key])), 'aria-label': t.label, onClick: () => saveSettings({ [t.key]: !s[t.key] }) })))),
    accountCard(),
    h('section', { class: 'card' }, h('h2', { text: 'Keyboard shortcuts' }),
      h('div', { class: 'shortcut-grid' }, [
        ['Ctrl K', 'Search pages, instances, servers and actions'], ['Ctrl Enter', 'Launch the selected instance'],
        ['Ctrl 1 – 9', 'Jump to a page in sidebar order'], ['Esc', 'Close a dialog']
      ].map(([keys, what]) => [h('span', { class: 'kbd', text: keys }), h('span', { class: 'note', text: what })]))),
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

function javaFlagsCard() {
  const input = h('input', { class: 'text-input mono', value: state.settings.jvmArgs || '', placeholder: '-XX:+UseZGC -Dsodium.checks.issue2561=false', spellcheck: 'false', 'aria-label': 'Extra Java flags' });
  const status = h('p', { class: 'note', role: 'status', text: 'Only -X, -XX: and -D flags are accepted. Memory comes from the memory slider above.' });
  const save = async () => {
    try {
      state.settings = await window.petal.setSettings({ jvmArgs: input.value });
      status.textContent = state.settings.jvmArgs ? 'Saved. These flags apply from the next launch.' : 'Cleared. Petal uses its default Java flags.';
      status.classList.remove('error');
    } catch (err) {
      status.textContent = err.message;
      status.classList.add('error');
    }
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  return h('section', { class: 'card' }, h('h2', { text: 'Java flags' }),
    h('p', { class: 'note', text: 'For advanced players. Petal already uses the official launcher’s tuned G1 flags; add more only if a modpack asks for them.' }),
    h('div', { class: 'gallery-toolbar' }, input, h('button', { class: 'btn btn-pink', text: 'Save flags', onClick: save })), status);
}

// ---------- content (mods, resource packs, shader packs per instance) ----------
const CONTENT_TYPES = { pack: 'Petal Pack', mods: 'Mods', resourcepacks: 'Resource packs', shaderpacks: 'Shader packs' };
const contentView = { type: 'pack', data: null, loading: false, query: '', show: 'all' };
const contentTypes = () => Object.keys(CONTENT_TYPES).filter(key => key !== 'pack' || state.boot.instance.petal);
let contentRequest = 0;

async function loadContent() {
  const request = ++contentRequest;
  contentView.loading = true;
  if (state.page === 'content') render();
  try {
    if (!contentTypes().includes(contentView.type)) contentView.type = 'mods';
    const data = contentView.type === 'pack' ? { type: 'pack', ...(await window.petal.packList()) } : await window.petal.listContent(contentView.type);
    if (request === contentRequest) contentView.data = data;
  } catch (err) { if (request === contentRequest) toast(err.message, 'error'); }
  finally { if (request === contentRequest) { contentView.loading = false; if (state.page === 'content') render(); } }
}

function formatSize(bytes) {
  if (bytes == null) return 'Folder';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function packView(data) {
  const running = state.game.running || state.game.preparing;
  const on = data.mods.filter(m => m.enabled).length;
  const q = contentView.query.trim().toLowerCase();
  const groups = h('div', { class: 'pack-groups' });
  const fill = () => {
    const shown = data.mods.filter(m => (contentView.show === 'all' || (contentView.show === 'on') === m.enabled) && (!q || `${m.name} ${m.description} ${m.category}`.toLowerCase().includes(contentView.query.trim().toLowerCase())));
    groups.replaceChildren(...[...new Set(shown.map(m => m.category))].map(category => h('section', { class: 'pack-group' },
      h('span', { class: 'label', text: category }),
      h('div', { class: 'content-list' }, shown.filter(m => m.category === category).map(m => {
        const locked = !m.chosen && m.neededBy.length > 0;
        return h('div', { class: `content-item${m.enabled ? '' : ' off'}` },
          h('div', { class: 'tile', 'aria-hidden': 'true', text: m.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() }),
          h('div', { class: 'grow' },
            h('div', { class: 'content-title' }, h('span', { class: 'name', text: m.name }), h('span', { class: 'mono ver', text: m.version }),
              !m.defaultEnabled ? h('span', { class: 'badge', text: 'Starts off' }) : null,
              locked ? h('span', { class: 'badge modrinth', text: `Needed by ${m.neededBy.join(', ')}` }) : null,
              m.ownCopy && m.enabled ? h('span', { class: 'badge', title: m.ownCopy, text: 'Using your copy' }) : null,
              m.conflicts.length ? h('span', { class: 'badge petal', text: `Conflicts with ${m.conflicts.join(', ')}` }) : null),
            h('p', { class: 'note small clamp', text: m.description }),
            m.note ? h('p', { class: 'note small pack-note', text: m.note }) : null),
          h('button', { class: 'switch', 'aria-pressed': String(m.enabled), 'aria-label': `${m.name} ${m.enabled ? 'on' : 'off'}`, disabled: running || locked || undefined,
            title: locked ? `Stays on while ${m.neededBy.join(', ')} is on` : running ? 'Close Minecraft first' : '',
            onClick: () => attempt(async () => {
              contentView.data = { type: 'pack', ...(await window.petal.packSet(m.slug, !m.enabled)) };
              toast(`${m.name} ${m.enabled ? 'switched off' : 'switched on'}. Petal ${m.enabled ? 'removes' : 'downloads'} it next launch.`, 'success');
              render();
            }) }));
      })))));
    if (!groups.childElementCount) groups.append(h('p', { class: 'note empty', text: 'Nothing matches that search.' }));
  };
  fill();
  const search = h('input', { type: 'search', class: 'text-input', placeholder: 'Search the Petal Pack', value: contentView.query, 'aria-label': 'Search the Petal Pack' });
  search.addEventListener('input', () => { contentView.query = search.value; fill(); });
  return h('section', { class: 'card' },
    h('div', { class: 'card-head' },
      h('div', {}, h('h2', { text: 'Petal Pack' }), h('span', { class: 'mono small muted', text: `${on} of ${data.mods.length} on · ${formatSize(data.downloadBytes)} with libraries · Minecraft ${data.gameVersion}` })),
      h('div', { class: 'gallery-toolbar' },
        data.customized ? h('button', { class: 'btn btn-line', text: 'Reset to Petal defaults', disabled: running, onClick: () => attempt(async () => { contentView.data = { type: 'pack', ...(await window.petal.packReset()) }; render(); }) }) : null)),
    h('p', { class: 'note', text: 'Hand-picked SMP mods, pinned to exact builds and checked before every launch. Switch any of them off; Petal adds or removes the files the next time you play. Mods that some servers ban start off.' }),
    data.mods.length ? null : h('p', { class: 'note', text: 'This build of Petal has no pack mods pinned yet.' }),
    h('div', { class: 'gallery-toolbar content-toolbar' }, search,
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Show' }, [['all', 'All'], ['on', 'On'], ['off', 'Off']].map(([key, label]) =>
        h('button', { 'aria-pressed': String(contentView.show === key), text: label, onClick: () => { contentView.show = key; render(); } })))),
    running ? h('p', { class: 'note', text: 'Close Minecraft to change the pack.' }) : null,
    groups,
    data.libraries.length ? h('p', { class: 'note small', text: `Libraries installed for these mods: ${data.libraries.join(', ')}.` }) : null,
    data.unavailable.length || data.skipped.length ? h('details', {}, h('summary', { text: `Not in the pack (${data.unavailable.length + data.skipped.length})` }),
      h('ul', { class: 'fixes' }, [...data.unavailable, ...data.skipped].map(u => h('li', { text: `${u.name}: ${u.reason}` })))) : null);
}

function ordinal(n) {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${tail}`;
}

function contentPage() {
  const instance = state.boot.instance;
  if (!contentTypes().includes(contentView.type)) contentView.type = 'mods';
  const type = contentView.type;
  const data = contentView.data?.type === type ? contentView.data : null;
  const running = state.game.running;
  const enabled = (data?.items || []).filter(i => i.enabled).length;
  const list = h('div', { class: 'content-list' });
  const fill = () => {
    const q = contentView.query.trim().toLowerCase();
    const items = (data?.items || []).filter(item => (contentView.show === 'all' || (contentView.show === 'on') === item.enabled)
      && (!q || `${item.name} ${item.file} ${item.description || ''}`.toLowerCase().includes(q)));
    list.replaceChildren(...items.map(item => h('div', { class: `content-item${item.enabled ? '' : ' off'}` },
      h('div', { class: 'tile', 'aria-hidden': 'true', text: item.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?' }),
      h('div', { class: 'grow' },
        h('div', { class: 'content-title' }, h('span', { class: 'name', text: item.name }), item.version ? h('span', { class: 'mono ver', text: item.version }) : null,
          h('span', { class: `badge ${item.source === 'Petal' ? 'petal' : item.source === 'Modrinth' ? 'modrinth' : ''}`, text: item.source })),
        item.description ? h('p', { class: 'note small clamp', text: item.description }) : null,
        h('span', { class: 'mono file', text: `${item.file} · ${formatSize(item.size)}` })),
      type === 'mods'
        ? h('button', { class: 'switch', 'aria-pressed': String(item.enabled), 'aria-label': `${item.name} ${item.enabled ? 'on' : 'off'}`, title: item.managed ? 'Installed by Petal. Use the Petal Pack tab.' : running ? 'Close Minecraft first' : '',
          disabled: item.managed || running || undefined, onClick: () => attempt(async () => {
            contentView.data = await window.petal.toggleContent(item.file, !item.enabled);
            toast(`${item.name} ${item.enabled ? 'switched off' : 'switched on'}. Applies next launch.`, 'success');
            render();
          }) })
        : type === 'resourcepacks'
          ? h('span', { class: `pack-state${item.enabled ? ' on' : ''}`, title: 'Switch packs on and reorder them in game: Options, then Resource Packs.', text: item.enabled ? (item.position === 1 ? 'On · top' : `On · ${ordinal(item.position)}`) : 'Off' })
          : null)));
    if (!items.length) list.append(h('p', { class: 'note empty', text: contentView.loading ? 'Reading the folder…' : q ? 'Nothing matches that search.' : type === 'mods' ? 'No mods here yet. Add .jar files or find some in Downloads.' : `No ${CONTENT_TYPES[type].toLowerCase()} yet. Add .zip files or drop them in the folder.` }));
  };
  fill();
  const search = h('input', { type: 'search', class: 'text-input', placeholder: `Search ${CONTENT_TYPES[type].toLowerCase()}`, value: contentView.query, 'aria-label': 'Search content' });
  search.addEventListener('input', () => { contentView.query = search.value; fill(); });
  return h('div', { class: 'catalog-page' },
    h('div', { class: 'callout' }, h('span', { text: `Showing ${instance.name} · Minecraft ${instance.gameVersion} · ${instance.loader}. Changes apply the next time you launch.` })),
    h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Content type' }, contentTypes().map(key =>
      h('button', { role: 'tab', 'aria-selected': String(key === type), text: CONTENT_TYPES[key], onClick: () => { contentView.type = key; contentView.query = ''; contentView.show = 'all'; loadContent(); } }))),
    type === 'pack' ? (data ? packView(data) : h('section', { class: 'card' }, h('p', { class: 'note', text: 'Loading the Petal Pack…' }))) : h('section', { class: 'card' },
      h('div', { class: 'card-head' },
        h('div', {}, h('h2', { text: CONTENT_TYPES[type] }), h('span', { class: 'mono small muted', text: data ? (type !== 'shaderpacks' ? `${enabled} of ${data.items.length} on` : `${data.items.length} installed`) : '…' })),
        h('div', { class: 'gallery-toolbar' },
          h('button', { class: 'btn btn-pink', text: 'Add files', disabled: running && type === 'mods', onClick: () => attempt(async () => {
            const result = await window.petal.addContent(type);
            if (!result) return;
            if (result.added.length) toast(`Added ${result.added.length} file${result.added.length === 1 ? '' : 's'}.`, 'success');
            for (const skip of result.skipped.slice(0, 3)) toast(`${skip.name}: ${skip.reason}`, 'error');
            loadContent();
          }) }),
          h('button', { class: 'btn btn-line', text: 'Open folder', onClick: () => attempt(() => window.petal.openContentFolder(type)) }),
          h('button', { class: 'btn btn-dark', text: 'Refresh', disabled: contentView.loading, onClick: loadContent }))),
      h('div', { class: 'gallery-toolbar content-toolbar' }, search,
        type !== 'shaderpacks' ? h('div', { class: 'seg', role: 'group', 'aria-label': 'Show' }, [['all', 'All'], ['on', 'On'], ['off', 'Off']].map(([key, label]) =>
          h('button', { 'aria-pressed': String(contentView.show === key), text: label, onClick: () => { contentView.show = key; render(); } }))) : null),
      running && type === 'mods' ? h('p', { class: 'note', text: 'Minecraft is running. Close it to switch mods on or off.' }) : null,
      list),
    ({ mods: 'mod', resourcepacks: 'resourcepack', shaderpacks: 'shader' })[type] && (type === 'resourcepacks' || instance.loader === 'fabric')
      ? h('button', { class: 'btn btn-line', text: `Find more ${CONTENT_TYPES[type].toLowerCase()} on Modrinth`, onClick: () => {
        const next = { mods: 'mod', resourcepacks: 'resourcepack', shaderpacks: 'shader' }[type];
        if (discover.type !== next) { discover.type = next; discover.category = ''; discover.hits = []; discover.searched = false; discover.project = null; }
        go('downloads');
      } }) : null);
}

// ---------- console ----------
const consoleView = { lines: [], filter: 'all', query: '', follow: true };
function lineLevel(line) {
  if (/\b(ERROR|FATAL|SEVERE)\b|Exception|^\s+at /.test(line)) return 'error';
  if (/\bWARN(ING)?\b/.test(line)) return 'warn';
  return 'info';
}
function lineVisible(line) {
  const level = lineLevel(line);
  if (consoleView.filter === 'warn' && level === 'info') return false;
  if (consoleView.filter === 'error' && level !== 'error') return false;
  return !consoleView.query || line.toLowerCase().includes(consoleView.query.toLowerCase());
}
function consoleRow(line) { return h('div', { class: `log-line ${lineLevel(line)}`, text: line }); }

function consolePage() {
  const box = h('div', { class: 'console-lines', id: 'console-lines', role: 'log', tabindex: '0', 'aria-label': 'Minecraft output' });
  const shown = consoleView.lines.filter(lineVisible).slice(-2000);
  box.append(...shown.map(consoleRow));
  if (!consoleView.lines.length) box.append(h('p', { class: 'note empty', text: 'Minecraft output shows up here while the game runs. Launch from the Play page.' }));
  box.addEventListener('scroll', () => {
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    if (atBottom !== consoleView.follow) { consoleView.follow = atBottom; const f = $('console-follow'); if (f) f.setAttribute('aria-pressed', String(atBottom)); }
  });
  setTimeout(() => { if (consoleView.follow) box.scrollTop = box.scrollHeight; }, 0);
  const search = h('input', { type: 'search', class: 'text-input', placeholder: 'Filter lines', value: consoleView.query, 'aria-label': 'Filter lines' });
  search.addEventListener('input', () => {
    consoleView.query = search.value;
    box.replaceChildren(...consoleView.lines.filter(lineVisible).slice(-2000).map(consoleRow));
    if (consoleView.follow) box.scrollTop = box.scrollHeight;
  });
  const counts = consoleView.lines.reduce((c, l) => { c[lineLevel(l)]++; return c; }, { info: 0, warn: 0, error: 0 });
  return h('div', { class: 'console-page' },
    h('div', { class: 'console-bar' },
      h('div', { class: 'console-state' }, h('span', { class: `live-dot${state.game.running ? '' : ' idle'}`, 'aria-hidden': 'true' }),
        h('span', { text: state.game.running ? `Minecraft running · ${formatDuration(Date.now() - Date.parse(state.game.startedAt))}` : state.game.preparing ? 'Starting…' : 'Minecraft is not running' })),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Level' }, [['all', `All ${consoleView.lines.length}`], ['warn', `Warnings ${counts.warn + counts.error}`], ['error', `Errors ${counts.error}`]].map(([key, label]) =>
        h('button', { 'aria-pressed': String(consoleView.filter === key), text: label, onClick: () => { consoleView.filter = key; render(); } }))),
      search,
      h('button', { class: 'btn btn-line slim', id: 'console-follow', 'aria-pressed': String(consoleView.follow), text: 'Follow', onClick: () => { consoleView.follow = true; box.scrollTop = box.scrollHeight; $('console-follow').setAttribute('aria-pressed', 'true'); } }),
      h('button', { class: 'btn btn-line slim', text: 'Copy', disabled: !consoleView.lines.length, onClick: () => attempt(async () => { await window.petal.copyLog(consoleView.lines.filter(lineVisible)); toast('Copied to clipboard', 'success'); }) }),
      h('button', { class: 'btn btn-line slim', text: 'Open log file', onClick: () => attempt(() => window.petal.openLog()) }),
      state.game.running ? h('button', { class: 'btn btn-line slim danger', text: 'Force stop', onClick: stopGame }) : null,
      state.lastCrash ? h('button', { class: 'btn btn-dark slim', text: 'Crash details', onClick: () => showCrash(state.lastCrash) }) : null),
    box);
}

function appendLog(batch) {
  consoleView.lines.push(...batch);
  const overflow = consoleView.lines.length - 5000;
  if (overflow > 0) consoleView.lines.splice(0, overflow);
  if (state.page !== 'console') return;
  const box = $('console-lines');
  if (!box) return;
  box.querySelector('.empty')?.remove();
  box.append(...batch.filter(lineVisible).map(consoleRow));
  while (box.childElementCount > 2000) box.firstElementChild.remove();
  if (consoleView.follow) box.scrollTop = box.scrollHeight;
}

async function stopGame() {
  const ok = await confirmDialog({ title: 'Force stop Minecraft?', body: 'Unsaved progress since the last autosave may be lost. Use this only when the game is frozen.', confirm: 'Force stop', danger: true });
  if (ok) await attempt(() => window.petal.stopGame());
}

// ---------- dialogs ----------
let sheetClose = null;
function openSheet(content, { wide = false, onClose } = {}) {
  const sheet = $('sheet');
  const body = $('sheet-body');
  body.className = `dialog${wide ? ' wide' : ''}`;
  body.replaceChildren(content);
  sheet.classList.remove('hidden');
  sheetClose = onClose || null;
  const focusable = body.querySelector('button.btn-pink, button, input');
  setTimeout(() => focusable?.focus(), 0);
}
function closeSheet(result) {
  if ($('sheet').classList.contains('hidden')) return;
  $('sheet').classList.add('hidden');
  $('sheet-body').replaceChildren();
  const done = sheetClose;
  sheetClose = null;
  done?.(result);
}
$('sheet').addEventListener('mousedown', e => { if (e.target === $('sheet')) closeSheet(false); });

function confirmDialog({ title, body, confirm = 'Continue', danger = false }) {
  return new Promise(resolve => {
    openSheet(h('div', { class: 'sheet-stack' },
      h('h2', { text: title }), h('p', { class: 'note', text: body }),
      h('div', { class: 'dialog-actions' },
        h('button', { class: `btn ${danger ? 'btn-danger' : 'btn-pink'}`, text: confirm, onClick: () => closeSheet(true) }),
        h('button', { class: 'btn btn-line', text: 'Cancel', onClick: () => closeSheet(false) }))), { onClose: resolve });
  });
}

function showCrash(c) {
  state.crashSeen = true;
  const fix = { memory: ['Change memory', () => go('settings')], content: ['Open Content', () => go('content')], repair: ['Repair game files', () => go('settings')] }[c.action];
  openSheet(h('div', { class: 'sheet-stack crash' },
    h('span', { class: 'eyebrow danger-text', text: c.exitCode != null ? `Crashed · exit code ${c.exitCode}` : 'Crashed' }),
    h('h2', { text: c.title }),
    h('p', { class: 'note', text: c.explain }),
    c.detail ? h('pre', { class: 'log-excerpt', text: c.detail }) : null,
    h('div', {}, h('span', { class: 'label', text: 'Try this' }), h('ol', { class: 'fixes' }, c.fixes.map(f => h('li', { text: f })))),
    c.excerpt ? h('details', {}, h('summary', { text: c.report ? `From ${c.report}` : 'Last log lines' }), h('pre', { class: 'log-excerpt', text: c.excerpt })) : null,
    h('div', { class: 'dialog-actions' },
      h('button', { class: 'btn btn-pink', text: 'Launch again', disabled: state.game.running || state.game.preparing, onClick: () => { closeSheet(); doLaunch(); } }),
      fix ? h('button', { class: 'btn btn-dark', text: fix[0], onClick: () => { closeSheet(); fix[1](); } }) : null,
      h('button', { class: 'btn btn-line', text: 'Copy details', onClick: () => attempt(async () => { await window.petal.copyCrash(); toast('Crash details copied. Paste them when asking for help.', 'success'); }) }),
      c.report ? h('button', { class: 'btn btn-line', text: 'Open crash report', onClick: () => attempt(() => window.petal.openCrashReport(c.report)) }) : null,
      c.nativeLog && !c.report ? h('button', { class: 'btn btn-line', text: 'Open Java error log', onClick: () => attempt(() => window.petal.openCrashReport(c.nativeLog)) }) : null,
      h('button', { class: 'btn btn-line', text: 'Console', onClick: () => { closeSheet(); go('console'); } }))), { wide: true });
}

function crashCallout() {
  const c = state.lastCrash;
  if (!c) return null;
  return h('section', { class: 'crash-callout', role: 'status' },
    h('div', { class: 'grow' }, h('span', { class: 'eyebrow danger-text', text: 'Last session crashed' }), h('span', { class: 'title', text: c.title })),
    h('button', { class: 'btn btn-line', text: 'Details', onClick: () => showCrash(c) }),
    h('button', { class: 'x', 'aria-label': 'Dismiss', onClick: () => { state.lastCrash = null; render(); } }, icon(ICON_X)));
}

/** Release notes as plain elements: headings, bullets and paragraphs. Never parsed as HTML. */
function releaseNotes(text) {
  const out = [];
  let list = null;
  for (const raw of String(text || '').split(/\r?\n/).slice(0, 80)) {
    const line = raw.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
    if (!line) { list = null; continue; }
    if (/^#{1,6}\s/.test(line)) { list = null; out.push(h('h3', { text: line.replace(/^#+\s*/, '') })); }
    else if (/^[-*+]\s/.test(line)) { if (!list) { list = h('ul', {}); out.push(list); } list.append(h('li', { text: line.slice(2) })); }
    else { list = null; out.push(h('p', { text: line })); }
  }
  return h('div', { class: 'release-notes' }, out.length ? out : h('p', { class: 'note', text: 'No notes were published with this release.' }));
}

function maybeShowWhatsNew(u) {
  const current = state.boot?.version;
  if (!u || !current || u.version !== current || state.settings.lastSeenVersion === current) return;
  window.petal.setSettings({ lastSeenVersion: current }).then(next => { state.settings = next; }).catch(() => {});
  if (!u.notes) return;
  openSheet(h('div', { class: 'sheet-stack' },
    h('span', { class: 'eyebrow', text: 'Updated' }), h('h2', { text: `Welcome to Petal ${current}` }), releaseNotes(u.notes),
    h('div', { class: 'dialog-actions' }, h('button', { class: 'btn btn-pink', text: 'Let’s play', onClick: () => closeSheet() }),
      u.page ? h('button', { class: 'btn btn-line', text: 'Release page', onClick: () => attempt(() => window.petal.openRelease()) }) : null)), { wide: true });
}

// ---------- command palette ----------
const palette = { items: [], index: 0 };
function paletteEntries() {
  const busy = state.game.running || state.game.preparing;
  const entries = PAGES.map((page, i) => ({ group: 'Go to', label: TITLES[page], hint: `Ctrl ${i + 1}`, run: () => go(page) }));
  if (!busy) entries.unshift({ group: 'Action', label: `Launch ${state.boot.instance.name}`, hint: 'Ctrl Enter', run: () => doLaunch() });
  if (state.game.running) entries.unshift({ group: 'Action', label: 'Force stop Minecraft', run: stopGame });
  for (const item of state.boot.instances) if (!item.active && !busy) entries.push({ group: 'Instance', label: `Switch to ${item.name}`, hint: `${item.gameVersion} ${item.loader}`, run: () => selectInstance(item.id) });
  for (const sv of state.settings.servers || []) if (!busy) entries.push({ group: 'Server', label: `Join ${sv.name}`, hint: sv.address, run: () => doLaunch(sv.address) });
  entries.push(
    { group: 'Action', label: 'Add mods to this instance', run: () => { contentView.type = 'mods'; go('content'); attempt(async () => { const r = await window.petal.addContent('mods'); if (r) loadContent(); }); } },
    { group: 'Action', label: 'Open game folder', run: () => attempt(() => window.petal.openInstanceFolder()) },
    { group: 'Action', label: 'Open last game log', run: () => attempt(() => window.petal.openLog()) },
    { group: 'Action', label: 'Check for updates', run: checkForUpdates },
    { group: 'Action', label: 'Add a Microsoft account', run: startSignIn });
  if (state.lastCrash) entries.push({ group: 'Action', label: 'Show last crash', run: () => showCrash(state.lastCrash) });
  return entries;
}
function openPalette() {
  if (!state.boot) return;
  $('palette').classList.remove('hidden');
  const input = $('palette-input');
  input.value = '';
  fillPalette();
  input.focus();
}
function closePalette() { $('palette').classList.add('hidden'); }
function fillPalette() {
  const q = $('palette-input').value.trim().toLowerCase();
  const words = q.split(/\s+/).filter(Boolean);
  palette.items = paletteEntries().filter(e => words.every(w => `${e.group} ${e.label} ${e.hint || ''}`.toLowerCase().includes(w))).slice(0, 40);
  palette.index = 0;
  drawPalette();
}
function drawPalette() {
  const list = $('palette-list');
  list.replaceChildren(...palette.items.map((e, i) => h('button', { class: 'palette-item', role: 'option', 'aria-selected': String(i === palette.index), onMouseenter: () => { palette.index = i; drawPalette(); }, onClick: () => runPalette(i) },
    h('span', { class: 'label', text: e.group }), h('span', { class: 'grow', text: e.label }), e.hint ? h('span', { class: 'mono hint', text: e.hint }) : null)));
  if (!palette.items.length) list.append(h('p', { class: 'note empty', text: 'Nothing matches.' }));
  list.children[palette.index]?.scrollIntoView({ block: 'nearest' });
}
function runPalette(i) { const e = palette.items[i]; closePalette(); e?.run(); }
$('palette-input').addEventListener('input', fillPalette);
$('palette-input').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); palette.index = Math.min(palette.items.length - 1, palette.index + 1); drawPalette(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); palette.index = Math.max(0, palette.index - 1); drawPalette(); }
  else if (e.key === 'Enter') { e.preventDefault(); runPalette(palette.index); }
});
$('palette').addEventListener('mousedown', e => { if (e.target === $('palette')) closePalette(); });
$('palette-open').addEventListener('click', openPalette);

document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') {
    if (!$('palette').classList.contains('hidden')) return closePalette();
    if (!$('sheet').classList.contains('hidden')) return closeSheet(false);
  }
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); return $('palette').classList.contains('hidden') ? openPalette() : closePalette(); }
  if (!state.boot || !$('palette').classList.contains('hidden') || !$('sheet').classList.contains('hidden') || !$('signin').classList.contains('hidden')) return;
  if (mod && e.key === 'Enter') { e.preventDefault(); doLaunch(); return; }
  if (mod && /^[1-9]$/.test(e.key) && PAGES[Number(e.key) - 1]) { e.preventDefault(); go(PAGES[Number(e.key) - 1]); }
});

// ---------- sign-in ----------
async function startSignIn() {
  const accounts = await attempt(() => window.petal.signIn());
  if (accounts) { state.accounts = accounts; toast(`Signed in as ${activeAccount()?.name}`, 'success'); render(); }
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
function go(page) {
  state.page = page; render(); $('page').scrollTop = 0;
  if (page === 'screenshots') loadScreenshots();
  if (page === 'mods') refreshModules();
  if (page === 'downloads') refreshInstalled();
  if (page === 'content') loadContent();
}
document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
$('me').addEventListener('click', () => (activeAccount() ? go('settings') : startSignIn()));
$('win-min').addEventListener('click', () => window.petal.minimize());
$('win-max').addEventListener('click', () => window.petal.maximize());
document.querySelector('.topbar').addEventListener('dblclick', e => { if (e.target.closest('button, input, select')) return; window.petal.maximize(); });
$('win-close').addEventListener('click', () => window.petal.close());

let progressFrame = 0;
window.petal.onProgress(p => {
  state.progress = p;
  if (!['home', 'settings', 'downloads', 'instances', 'content'].includes(state.page) || progressFrame) return;
  progressFrame = requestAnimationFrame(() => { progressFrame = 0; render(); });
});
window.petal.onGameState(g => {
  const wasRunning = state.game.running;
  state.game = g;
  if (!g.preparing && !g.running) state.progress = null;
  if (wasRunning && !g.running) {
    // Play time changed; refresh instance stats quietly.
    window.petal.bootstrap().then(boot => { applyBootstrap(boot); render(); }).catch(() => {});
    if (g.crashed) {
      state.lastCrash = g.crash || { title: 'Minecraft closed unexpectedly', explain: 'Open the console for the last lines Minecraft printed.', fixes: ['Try launching again.'], exitCode: g.exitCode, excerpt: '' };
      showCrash(state.lastCrash);
    }
  }
  // While playing, refresh the Play page once a minute so the session timer moves.
  clearInterval(window.playTimer);
  if (g.running) window.playTimer = setInterval(() => { if (['home', 'console'].includes(state.page) && $('sheet').classList.contains('hidden')) render(); }, 60000);
  render();
});
window.petal.onGameLog(appendLog);
window.petal.onGameLogReset(() => { consoleView.lines = []; if (state.page === 'console') render(); });
window.petal.onMaximized(max => { state.maximized = max; $('win-max').setAttribute('aria-label', max ? 'Restore' : 'Maximize'); });
window.addEventListener('online', renderShell);
window.addEventListener('offline', renderShell);
window.petal.onAccounts(list => { state.accounts = list; renderShell(); });
window.petal.onUpdate(st => { state.update = st; maybeShowWhatsNew(st); if (['home', 'settings'].includes(state.page)) render(); });
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
  // Pick up output from a game that was already running when the window reloaded.
  const lines = await window.petal.gameLog().catch(() => []);
  if (lines.length) appendLog(lines);
})().catch(err => toast(`Petal could not start: ${err.message}`, 'error'));
