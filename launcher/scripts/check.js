#!/usr/bin/env node
// Syntax-checks every launcher source file and confirms the lock files parse. Run: npm run check
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
let failed = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith('.js')) {
      const r = spawnSync(process.execPath, ['--check', full], { encoding: 'utf8' });
      if (r.status !== 0) { failed++; console.error(r.stderr); }
    } else if (entry.name.endsWith('.json')) {
      try { JSON.parse(fs.readFileSync(full, 'utf8')); } catch (e) { failed++; console.error(`${full}: ${e.message}`); }
    }
  }
}
walk(path.join(root, 'src'));
walk(path.join(root, 'scripts'));
console.log(failed ? `${failed} problem(s)` : 'All launcher files OK');
process.exit(failed ? 1 : 0);
