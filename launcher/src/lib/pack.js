// Petal Pack: the curated mods in mods-lock.json that players can switch on and off for the Petal
// instance. Choices live in <instance>/.petal-pack.json as { mods: { slug: true|false } }; a mod with
// no choice uses its defaultEnabled. Libraries follow whatever needs them and are never chosen directly.
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const defaultLock = require('./game/mods-lock.json');

const FILE = '.petal-pack.json';
const SLUG = /^[a-z0-9][a-z0-9_.-]{0,63}$/;

function readChoices(instanceDir) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(instanceDir, FILE), 'utf8'));
    const out = {};
    for (const [slug, on] of Object.entries(data.mods || {})) if (SLUG.test(slug) && typeof on === 'boolean') out[slug] = on;
    return out;
  } catch { return {}; }
}

async function writeChoices(instanceDir, choices) {
  await fsp.mkdir(instanceDir, { recursive: true });
  const file = path.join(instanceDir, FILE);
  await fsp.writeFile(`${file}.tmp`, JSON.stringify({ note: 'Petal Pack choices. Edit them from Content > Petal Pack in the launcher.', mods: choices }, null, 2));
  await fsp.rename(`${file}.tmp`, file);
}

/**
 * Works out which lock entries this instance installs: required mods, chosen pack mods, then
 * everything those need. Returns { install: Set<slug>, neededBy: Map<slug, string[]> }.
 */
function resolve(choices, lock = defaultLock) {
  const bySlug = new Map(lock.mods.map(m => [m.slug, m]));
  const install = new Set();
  const neededBy = new Map();
  const visit = (slug, from) => {
    const mod = bySlug.get(slug);
    if (!mod) return;
    if (from) neededBy.set(slug, [...(neededBy.get(slug) || []), from]);
    if (install.has(slug)) return;
    install.add(slug);
    for (const dep of mod.dependencies || []) visit(dep, mod.name);
  };
  for (const mod of lock.mods) {
    if (mod.category === 'required') visit(mod.slug);
    else if (mod.category !== 'library' && (choices[mod.slug] ?? mod.defaultEnabled)) visit(mod.slug);
  }
  return { install, neededBy };
}

/** The pack as the Content page shows it. */
/** Pack files Petal skipped because the player has their own copy: filename -> their file. */
function shadowedFiles(instanceDir) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(instanceDir, 'mods', '.petal-managed.json'), 'utf8'));
    return new Map((Array.isArray(data.shadowed) ? data.shadowed : []).filter(s => typeof s?.file === 'string' && typeof s.by === 'string').map(s => [s.file, s.by]));
  } catch { return new Map(); }
}

function list(instanceDir, lock = defaultLock) {
  const choices = readChoices(instanceDir);
  const shadowed = shadowedFiles(instanceDir);
  const { install, neededBy } = resolve(choices, lock);
  const mods = lock.mods.filter(m => m.category !== 'required' && m.category !== 'library').map(m => {
    const chosen = choices[m.slug] ?? m.defaultEnabled;
    const needers = (neededBy.get(m.slug) || []).filter(n => n !== m.name);
    return {
      slug: m.slug, name: m.name, description: m.description, category: m.category, version: m.version, note: m.note || null,
      defaultEnabled: m.defaultEnabled, enabled: install.has(m.slug), chosen, neededBy: chosen ? [] : needers,
      size: m.file.size, ownCopy: shadowed.get(m.file.filename) || null, conflicts: (m.incompatible || []).filter(slug => install.has(slug))
    };
  });
  const downloadBytes = lock.mods.filter(m => install.has(m.slug)).reduce((sum, m) => sum + m.file.size, 0);
  return { gameVersion: lock.gameVersion, mods, libraries: lock.mods.filter(m => m.category === 'library' && install.has(m.slug)).map(m => m.name),
    unavailable: lock.unavailable || [], skipped: lock.skipped || [], downloadBytes, customized: Object.keys(choices).length > 0 };
}

async function set(instanceDir, slug, enabled, lock = defaultLock) {
  const mod = lock.mods.find(m => m.slug === slug);
  if (!mod || mod.category === 'required' || mod.category === 'library') throw new Error('That mod is not part of the Petal Pack.');
  const choices = readChoices(instanceDir);
  if (Boolean(enabled) === Boolean(mod.defaultEnabled)) delete choices[slug];
  else choices[slug] = Boolean(enabled);
  await writeChoices(instanceDir, choices);
  return list(instanceDir, lock);
}

async function reset(instanceDir, lock = defaultLock) {
  await writeChoices(instanceDir, {});
  return list(instanceDir, lock);
}

module.exports = { list, set, reset, resolve, readChoices };
