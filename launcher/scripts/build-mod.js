#!/usr/bin/env node
// Builds the two Java pieces the launcher ships:
//   ../mod/          the Petal Fabric mod (Gradle wrapper)  -> ../mod/build/libs/petal-client-<version>.jar
//   launchwrapper/   tiny entry point that receives the access token over stdin -> launchwrapper/build/petal-launchwrapper.jar
// Needs a JDK 21: uses JAVA_HOME if set, otherwise looks in the usual Windows install folders.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const env = { ...process.env };

function findJdk() {
  if (env.JAVA_HOME && fs.existsSync(env.JAVA_HOME)) return env.JAVA_HOME;
  if (process.platform !== 'win32') return null;
  for (const base of ['C:\\Program Files\\Java', 'C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Microsoft']) {
    try {
      const hit = fs.readdirSync(base).filter(d => /^jdk-?21/i.test(d)).sort().pop();
      if (hit) return path.join(base, hit);
    } catch { /* not installed there */ }
  }
  return null;
}

env.JAVA_HOME = findJdk();
if (!env.JAVA_HOME) { console.error('Set JAVA_HOME to a JDK 21 installation (for example Eclipse Temurin 21).'); process.exit(1); }
const tool = name => path.join(env.JAVA_HOME, 'bin', process.platform === 'win32' ? `${name}.exe` : name);

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// ---- launch wrapper ----
const wrapperDir = path.join(root, 'launchwrapper');
const classes = path.join(wrapperDir, 'build', 'classes');
const wrapperJar = path.join(wrapperDir, 'build', 'petal-launchwrapper.jar');
fs.rmSync(path.join(wrapperDir, 'build'), { recursive: true, force: true });
fs.mkdirSync(classes, { recursive: true });
run(tool('javac'), ['--release', '8', '-encoding', 'UTF-8', '-d', classes, path.join(wrapperDir, 'src', 'dev', 'petal', 'launch', 'TokenWrapper.java')], root);
run(tool('jar'), ['--create', '--file', wrapperJar, '-C', classes, '.'], root);
console.log(`Built ${path.relative(root, wrapperJar)}`);

// ---- Petal mod ----
// Windows refuses to spawn .bat files directly, so go through cmd.exe.
const modDir = path.join(root, '..', 'mod');
if (process.platform === 'win32') run('cmd.exe', ['/d', '/c', path.join(modDir, 'gradlew.bat'), 'clean', 'build', '-x', 'test', '--console=plain'], modDir);
else run(path.join(modDir, 'gradlew'), ['clean', 'build', '-x', 'test', '--console=plain'], modDir);

const libs = path.join(modDir, 'build', 'libs');
const jars = fs.readdirSync(libs).filter(f => /^petal-client-.*\.jar$/.test(f) && !/-(sources|dev)\.jar$/.test(f));
if (jars.length !== 1) {
  console.error(`Expected one Petal jar in ${libs}, found: ${jars.join(', ') || 'none'}.`);
  process.exit(1);
}
console.log(`Built ${jars[0]}`);
