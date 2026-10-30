// Explains why Minecraft closed. Reads the captured game output plus the crash report Minecraft wrote
// for this session (if any), then matches a short list of well-known causes. Everything returned is
// plain text for the renderer; nothing here runs or rewrites files.
const fsp = require('node:fs/promises');
const path = require('node:path');

const REPORT = /^crash-[\w.-]+\.txt$/;
const HS_ERR = /^hs_err_pid\d+\.log$/;

/** Known causes, checked in order. `match` gets the joined text and returns a detail string, true, or null. */
const RULES = [
  {
    id: 'out-of-memory',
    title: 'Minecraft ran out of memory',
    match: text => /java\.lang\.OutOfMemoryError|There is insufficient memory for the Java Runtime/.test(text),
    explain: 'The game used all the memory Petal gave it.',
    fixes: ['Give the game more memory on the Play page or in Settings (4 to 6 GB suits most packs).', 'Lower render distance or remove heavy resource packs and shaders.'],
    action: 'memory'
  },
  {
    id: 'heap-too-large',
    title: 'Java could not reserve that much memory',
    match: text => /Could not reserve enough space for|Invalid maximum heap size|Initial heap size set to a larger value/.test(text),
    explain: 'The memory setting is more than this computer can hand to Java right now.',
    fixes: ['Lower game memory in Settings, then launch again.', 'Close other large programs before playing.'],
    action: 'memory'
  },
  {
    id: 'mod-dependencies',
    title: 'Some mods are missing or incompatible',
    match: text => {
      const at = text.search(/Incompatible mods? (?:set|found)|Mod resolution (?:encountered|failed)|requires (?:any version|version) .* of ['"]?[\w-]+['"]?, which is missing/);
      if (at < 0) return null;
      return text.slice(at).split(/\r?\n/).slice(0, 14).filter(l => /^\s*(?:-|•|\t)/.test(l) || /requires|missing|incompatible|breaks/i.test(l)).slice(0, 8).join('\n');
    },
    explain: 'Fabric stopped before the game opened because the mods folder does not add up.',
    fixes: ['Install the missing mods it names, or disable the mod that needs them, from the Content page.', 'Make sure every mod is built for this Minecraft version and Fabric.'],
    action: 'content'
  },
  {
    id: 'duplicate-mods',
    title: 'The same mod is installed twice',
    match: text => {
      const m = /(?:Found )?[Dd]uplicate mods?(?: found)?[:\s]+([^\n]+)/.exec(text);
      return m ? m[1].trim().slice(0, 300) : null;
    },
    explain: 'Two files in the mods folder provide the same mod.',
    fixes: ['Open the Content page and turn off the older copy.'],
    action: 'content'
  },
  {
    id: 'mixin',
    title: 'A mod failed to load into Minecraft',
    match: text => {
      const m = /Mixin apply(?: for mod)? ([\w-]+)? ?failed|from mod ([\w-]+)\] .*?(?:failed|InvalidInjectionException)/.exec(text);
      return m ? `Mod: ${m[1] || m[2] || 'unknown'}` : null;
    },
    explain: 'One of the mods does not match this exact Minecraft build, so its changes could not be applied.',
    fixes: ['Update or turn off the mod named above on the Content page.', 'Check that the mod supports this Minecraft version.'],
    action: 'content'
  },
  {
    id: 'java-version',
    title: 'A mod needs a different Java version',
    match: text => /UnsupportedClassVersionError|has been compiled by a more recent version of the Java Runtime/.test(text),
    explain: 'A mod was built for newer Java than the runtime this Minecraft version uses.',
    fixes: ['Use a build of that mod made for this Minecraft version.'],
    action: 'content'
  },
  {
    id: 'graphics-driver',
    title: 'Your graphics driver stopped the game',
    match: text => /GLFW error 6554[23]|Pixel format not accelerated|WGL: The driver does not appear to support OpenGL|GL_INVALID|nvoglv(?:64|32)\.dll|atio6axx\.dll|ig\d+icd\d+\.dll|Could not create (?:the )?OpenGL context/.test(text),
    explain: 'Minecraft could not talk to the graphics card, which usually means an old or broken driver.',
    fixes: ['Update your graphics driver from NVIDIA, AMD or Intel.', 'On laptops, set Java to use the dedicated GPU in Windows graphics settings.', 'Turn off shaders and try again.'],
    action: 'driver'
  },
  {
    id: 'native-crash',
    title: 'Java crashed outside Minecraft',
    match: text => /EXCEPTION_ACCESS_VIOLATION|SIGSEGV|A fatal error has been detected by the Java Runtime Environment/.test(text),
    explain: 'The crash happened in native code, most often a graphics driver, overlay or antivirus hook.',
    fixes: ['Update your graphics driver.', 'Turn off overlays (Discord, GeForce Experience, MSI Afterburner) and try again.', 'Use Repair game files in Settings.'],
    action: 'repair'
  },
  {
    id: 'corrupt-files',
    title: 'Some game files look damaged',
    match: text => /ZipException|invalid (?:LOC|CEN) header|java\.util\.zip\.|NoClassDefFoundError: net\/minecraft|ClassNotFoundException: net\.minecraft/.test(text),
    explain: 'A library or game jar could not be read.',
    fixes: ['Use Repair game files in Settings to download clean copies.'],
    action: 'repair'
  }
];

async function newestMatching(dir, pattern, since) {
  let best = null;
  for (const name of await fsp.readdir(dir).catch(() => [])) {
    if (!pattern.test(name)) continue;
    const stat = await fsp.stat(path.join(dir, name)).catch(() => null);
    if (!stat?.isFile() || stat.mtimeMs < since) continue;
    if (!best || stat.mtimeMs > best.mtimeMs) best = { name, file: path.join(dir, name), mtimeMs: stat.mtimeMs, size: stat.size };
  }
  return best;
}

async function readHead(file, max = 256 * 1024) {
  const handle = await fsp.open(file, 'r');
  try {
    const { size } = await handle.stat();
    const buf = Buffer.alloc(Math.min(size, max));
    await handle.read(buf, 0, buf.length, 0);
    return buf.toString('utf8');
  } finally {
    await handle.close();
  }
}

/** Pulls "Description:" and the first stack frames from a vanilla crash report. */
function summarizeReport(text) {
  const description = /^Description: (.+)$/m.exec(text)?.[1]?.trim() || null;
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex(l => /^Description: /.test(l));
  const excerpt = start >= 0 ? lines.slice(start + 1, start + 14).filter(l => l.trim()).slice(0, 10).join('\n') : '';
  return { description, excerpt };
}

/** Lines in the output most worth showing when there is no crash report. */
function errorExcerpt(lines) {
  const picked = [];
  for (let i = 0; i < lines.length && picked.length < 12; i++) {
    if (/\b(ERROR|FATAL|Exception|Error:)\b/.test(lines[i])) picked.push(...lines.slice(i, i + 3));
  }
  return [...new Set(picked)].slice(0, 12).join('\n').slice(0, 4000);
}

/** Pure matcher, exported for checks. */
function diagnoseText(text) {
  for (const rule of RULES) {
    const detail = rule.match(text);
    if (detail) return { id: rule.id, title: rule.title, explain: rule.explain, fixes: rule.fixes, action: rule.action, detail: typeof detail === 'string' ? detail : null };
  }
  return null;
}

/**
 * @param {object} o
 * @param {string} o.gameDir instance folder (holds crash-reports/ and hs_err logs)
 * @param {string[]} o.lines captured stdout/stderr
 * @param {number} o.since epoch ms when this session started; older reports are ignored
 * @param {number|null} o.exitCode
 */
async function diagnose({ gameDir, lines = [], since = 0, exitCode = null }) {
  const report = await newestMatching(path.join(gameDir, 'crash-reports'), REPORT, since);
  const hsErr = await newestMatching(gameDir, HS_ERR, since);
  const reportText = report ? await readHead(report.file).catch(() => '') : '';
  const hsText = hsErr ? await readHead(hsErr.file, 32 * 1024).catch(() => '') : '';
  const output = lines.slice(-1500).join('\n');
  const match = diagnoseText(`${output}\n${reportText}\n${hsText}`);
  const summary = reportText ? summarizeReport(reportText) : { description: null, excerpt: '' };
  return {
    exitCode,
    title: match?.title || (summary.description ? `Minecraft crashed: ${summary.description}` : 'Minecraft closed unexpectedly'),
    explain: match?.explain || (report ? 'Minecraft wrote a crash report. The lines below are the most useful part of it.' : 'No known cause matched. The log lines below are where things went wrong.'),
    fixes: match?.fixes || ['Try launching again.', 'If you added mods recently, turn them off on the Content page and try again.', 'Use Repair game files in Settings.'],
    action: match?.action || null,
    cause: match?.id || 'unknown',
    detail: match?.detail || null,
    excerpt: (summary.excerpt || errorExcerpt(lines) || lines.slice(-12).join('\n')).slice(0, 4000),
    report: report ? report.name : null,
    nativeLog: hsErr ? hsErr.name : null
  };
}

/** Resolves a crash report name from diagnose() back to a path, refusing anything else. */
function reportPath(gameDir, name) {
  if (REPORT.test(name || '')) return path.join(gameDir, 'crash-reports', name);
  if (HS_ERR.test(name || '')) return path.join(gameDir, name);
  throw new Error('Unknown crash report.');
}

module.exports = { diagnose, diagnoseText, reportPath, summarizeReport };
