import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function chunkHash(promptVersion, model, locale, glossaryHash, chunkText) {
  return sha256(`${promptVersion}\n${model}\n${locale}\n${glossaryHash}\n${chunkText}`);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(p, obj) {
  fs.mkdirSync(path.dirname(p), {recursive: true});
  fs.writeFileSync(p, JSON.stringify(sortDeep(obj), null, 2) + '\n');
}

function sortDeep(v) {
  if (Array.isArray(v)) return v;
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = sortDeep(v[k]);
    return o;
  }
  return v;
}

export function manifestPath(i18nLocaleDir) {
  return path.join(i18nLocaleDir, 'manifest.json');
}

export function loadManifest(i18nLocaleDir) {
  return readJson(manifestPath(i18nLocaleDir)) || {files: {}, ui: {}};
}

export function writeManifest(i18nLocaleDir, manifest) {
  writeJson(manifestPath(i18nLocaleDir), manifest);
}

export function cacheDir(i18nLocaleDir) {
  return path.join(i18nLocaleDir, 'cache');
}

// Load every cache/*.json into one hash -> text map. Returns {map, files}.
export function loadAllCaches(i18nLocaleDir) {
  const dir = cacheDir(i18nLocaleDir);
  const map = new Map();
  const files = new Map(); // cacheRel -> {fileAbs, entries}
  if (fs.existsSync(dir)) {
    const stack = [dir];
    while (stack.length) {
      const cur = stack.pop();
      for (const ent of fs.readdirSync(cur, {withFileTypes: true})) {
        const full = path.join(cur, ent.name);
        if (ent.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (!ent.name.endsWith('.json')) continue;
        const entries = readJson(full) || {};
        const rel = path.relative(dir, full).split(path.sep).join('/');
        files.set(rel, {fileAbs: full, entries});
        for (const [h, t] of Object.entries(entries)) map.set(h, t);
      }
    }
  }
  return {map, files};
}

// cacheRel for a source rel path: mirrors the path under cache/ with .json ext.
export function cacheRelFor(sourceRel) {
  return `${sourceRel}.json`;
}

export function writeCacheFile(i18nLocaleDir, cacheRel, entries) {
  const p = path.join(cacheDir(i18nLocaleDir), cacheRel);
  const keys = Object.keys(entries).sort();
  if (!keys.length) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return;
  }
  const o = {};
  for (const k of keys) o[k] = entries[k];
  writeJson(p, o);
}

export function removeCacheFile(i18nLocaleDir, cacheRel) {
  const p = path.join(cacheDir(i18nLocaleDir), cacheRel);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

export {writeJson};
