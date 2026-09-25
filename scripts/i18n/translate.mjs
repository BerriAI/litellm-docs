#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PROMPT_VERSION} from './prompt.mjs';
import {listSourceFiles, walkFiles, toPosix, ROOTS} from './lib/roots.mjs';
import {extractChunks, applyChunks} from './lib/chunk.mjs';
import {validateChunk} from './lib/validate.mjs';
import {TranslateClient} from './lib/client.mjs';
import {
  sha256,
  chunkHash,
  loadManifest,
  writeManifest,
  loadAllCaches,
  cacheRelFor,
  writeCacheFile,
  removeCacheFile,
} from './lib/cache.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_MODEL = 'vertex_ai/gemini-2.5-flash';
const MAX_BATCH_CHARS = 6000;
const MAX_BATCH_CHUNKS = 40;

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function batchChunks(chunks) {
  const batches = [];
  let cur = [];
  let chars = 0;
  for (const c of chunks) {
    if (cur.length && (chars + c.text.length > MAX_BATCH_CHARS || cur.length >= MAX_BATCH_CHUNKS)) {
      batches.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(c);
    chars += c.text.length;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

async function runPool(items, n, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({length: Math.min(n, items.length)}, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

// Collect translatable "message" values from a write-translations JSON file.
// Returns {chunks, apply(map)->jsonString}
function uiChunks(data) {
  const chunks = [];
  const targets = [];
  const walk = (node, keyPath) => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.message === 'string') targets.push({keyPath, node});
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === 'object') walk(v, [...keyPath, k]);
    }
  };
  walk(data, []);
  targets.forEach((t, i) => {
    if (/[A-Za-z]/.test(t.node.message)) {
      chunks.push({id: `c${i}`, kind: 'frontmatter', text: t.node.message, target: t.node});
    }
  });
  return chunks;
}

export async function translateFiles(opts = {}) {
  const repoRoot = opts.repoRoot || process.cwd();
  const i18nRoot = opts.i18nRoot || path.join(repoRoot, 'i18n');
  const stagingDir = opts.stagingDir || path.join(repoRoot, '.i18n-staging');
  const locale = opts.locale || 'zh-Hans';
  const model = opts.model || process.env.LITELLM_TRANSLATION_MODEL || DEFAULT_MODEL;
  const dryRun = !!opts.dryRun;
  const concurrency = opts.concurrency || 4;
  const log = opts.log || ((s) => console.log(s));
  const filesFilter = opts.files && opts.files.length ? new Set(opts.files.map((f) => toPosix(path.normalize(f)))) : null;
  const writeTranslations = opts.writeTranslations !== false;

  const glossary = JSON.parse(fs.readFileSync(path.join(HERE, 'glossary.json'), 'utf8'));
  const glossaryHash = sha256(fs.readFileSync(path.join(HERE, 'glossary.json')));
  const i18nLocaleDir = path.join(i18nRoot, locale);
  fs.mkdirSync(i18nLocaleDir, {recursive: true});

  // 1. regenerate the English UI baseline (.i18n-staging/en/**)
  if (writeTranslations && !dryRun) {
    execFileSync('npx', ['docusaurus', 'write-translations', '--locale', 'en'], {
      cwd: repoRoot,
      stdio: opts.verbose ? 'inherit' : 'pipe',
    });
  }

  const manifest = loadManifest(i18nLocaleDir);
  manifest.locale = locale;
  manifest.model = model;
  manifest.promptVersion = PROMPT_VERSION;
  manifest.glossaryHash = glossaryHash;
  manifest.files = manifest.files || {};
  manifest.ui = manifest.ui || {};

  const {map: cacheMap} = loadAllCaches(i18nLocaleDir);
  const hashFor = (text) => chunkHash(PROMPT_VERSION, model, locale, glossaryHash, text);

  const summary = {
    filesProcessed: 0,
    filesSkippedUnchanged: 0,
    chunksTranslated: 0,
    chunksReused: 0,
    chunksFailed: 0,
    filesComplete: 0,
    filesTotal: 0,
    filesPartial: 0,
    promptTokens: 0,
    completionTokens: 0,
    failedChunks: [],
    durationMs: 0,
  };
  const started = Date.now();

  // 2. gather work items: content files + ui json files
  const sourceFiles = listSourceFiles(repoRoot, filesFilter);
  const enUiDir = path.join(stagingDir, 'en');
  const uiFiles = fs.existsSync(enUiDir)
    ? walkFiles(enUiDir, ['.json']).map((abs) => ({abs, rel: toPosix(path.relative(enUiDir, abs))}))
    : [];

  const jobs = []; // {kind:'content'|'ui', ...}

  for (const f of sourceFiles) {
    const src = fs.readFileSync(f.sourceAbs);
    const sourceHash = sha256(src);
    const entry = manifest.files[f.sourceRel];
    if (entry && entry.sourceHash === sourceHash && entry.status === 'complete') {
      summary.filesSkippedUnchanged++;
      summary.filesTotal++;
      summary.filesComplete++;
      continue;
    }
    const text = src.toString('utf8');
    const {chunks} = extractChunks(text);
    for (const c of chunks) c.hash = hashFor(c.text);
    const toTranslate = chunks.filter((c) => !cacheMap.has(c.hash));
    jobs.push({kind: 'content', file: f, text, chunks, sourceHash, toTranslate});
  }

  for (const u of uiFiles) {
    const data = readJson(u.abs);
    if (data == null) continue;
    const sourceHash = sha256(fs.readFileSync(u.abs));
    const entry = manifest.ui[u.rel];
    if (entry && entry.sourceHash === sourceHash && entry.status === 'complete') continue;
    const chunks = uiChunks(data);
    for (const c of chunks) c.hash = hashFor(c.text);
    const toTranslate = chunks.filter((c) => !cacheMap.has(c.hash));
    jobs.push({kind: 'ui', file: u, data, chunks, sourceHash, toTranslate});
  }

  summary.filesTotal += jobs.filter((j) => j.kind === 'content').length;

  // 3. dry run report
  if (dryRun) {
    const perRoot = {};
    let totalChunks = 0;
    let cachedChunks = 0;
    let estInputTokens = 0;
    for (const j of jobs) {
      if (j.kind === 'content') {
        perRoot[j.file.root.srcDir] = perRoot[j.file.root.srcDir] || {files: 0, chunks: 0, toTranslate: 0};
        perRoot[j.file.root.srcDir].files++;
        perRoot[j.file.root.srcDir].chunks += j.chunks.length;
        perRoot[j.file.root.srcDir].toTranslate += j.toTranslate.length;
      }
      totalChunks += j.chunks.length;
      cachedChunks += j.chunks.length - j.toTranslate.length;
      for (const b of batchChunks(j.toTranslate)) {
        estInputTokens += 900 + b.reduce((s, c) => s + Math.ceil(c.text.length / 4), 0);
      }
    }
    log(`dry run: ${jobs.length} files need work (${summary.filesSkippedUnchanged} unchanged)`);
    for (const [root, r] of Object.entries(perRoot)) {
      log(`  ${root}: ${r.files} files, ${r.chunks} chunks, ${r.toTranslate} to translate`);
    }
    if (uiFiles.length) log(`  ui strings: ${uiFiles.length} json files`);
    log(`chunks: ${totalChunks} total, ${cachedChunks} cached, ${totalChunks - cachedChunks} to translate`);
    log(`estimated input tokens: ~${estInputTokens}`);
    return {summary, exitCode: 0};
  }

  // 4. build batches and run them through the pool
  const client = new TranslateClient({
    baseUrl: process.env.LITELLM_PROXY_URL || process.env.LITELLM_GATEWAY_BASE_URL,
    apiKey: process.env.LITELLM_API_KEY || process.env.LITELLM_GATEWAY_ADMIN_KEY,
    model,
    locale,
    glossary,
    fetchImpl: opts.fetchImpl,
    timeoutMs: opts.timeoutMs || 120000,
    backoffMs: opts.backoffMs || [1000, 4000],
  });

  const batchJobs = [];
  for (const j of jobs) {
    const batches = batchChunks(j.toTranslate);
    j.remaining = batches.length;
    j.okMap = new Map();
    j.failed = new Set();
    j.failedReasons = {};
    for (const b of batches) batchJobs.push({job: j, chunks: b});
  }

  const runBatch = async ({job, chunks}) => {
    const byId = new Map(chunks.map((c) => [c.id, c]));
    const attempt = async (sent, extraUser) => {
      const {content} = await client.translateBatch(
        sent.map((c) => ({id: c.id, text: c.text})),
        extraUser,
      );
      let parsed;
      try {
        parsed = JSON.parse(content);
      } catch {
        return {fatal: `response was not valid JSON: ${String(content).slice(0, 200)}`};
      }
      const arr = parsed && parsed.translations;
      if (!Array.isArray(arr)) return {fatal: 'response missing "translations" array'};
      const gotIds = new Set(arr.map((t) => t && t.id));
      const wantIds = new Set(sent.map((c) => c.id));
      const missing = [...wantIds].filter((id) => !gotIds.has(id));
      const extra = [...gotIds].filter((id) => !wantIds.has(id));
      if (missing.length || extra.length || arr.length !== sent.length) {
        return {fatal: `id mismatch: missing ${JSON.stringify(missing)} extra ${JSON.stringify(extra)}`};
      }
      const failures = {};
      const ok = new Map();
      for (const t of arr) {
        const c = byId.get(t.id);
        const reasons = validateChunk(c.text, t.text, c.kind);
        if (reasons.length) failures[t.id] = reasons;
        else ok.set(t.id, t.text);
      }
      return {ok, failures};
    };

    let res;
    try {
      res = await attempt(chunks, null);
    } catch (e) {
      // transport-level failure already exhausted request retries; no batch retry
      return {job, ok: new Map(), failed: new Set(chunks.map((c) => c.id)), failedReasons: {}, fatalNote: e.message};
    }
    const final = new Map(res.ok || []);
    let stillFailed = res.fatal ? chunks.map((c) => c.id) : Object.keys(res.failures || {});
    const failedReasons = {};
    for (const [id, rs] of Object.entries(res.failures || {})) failedReasons[id] = rs;
    if (res.fatal) for (const c of chunks) failedReasons[c.id] = [res.fatal];

    // up to two content-level retries, sending only the still-failed chunks
    for (let retry = 0; retry < 2 && stillFailed.length; retry++) {
      const sent = stillFailed.map((id) => byId.get(id));
      const reasons = res.fatal
        ? `Previous response was unusable: ${res.fatal}`
        : `Some translations failed validation; fix them and return entries for every id: ${JSON.stringify(res.failures)}`;
      let res2;
      try {
        res2 = await attempt(sent, reasons);
      } catch (e) {
        res2 = {fatal: `request failed: ${e.message}`};
      }
      if (!res2.fatal) {
        const nextFailed = [];
        for (const id of stillFailed) {
          if (res2.ok.has(id)) {
            final.set(id, res2.ok.get(id));
            delete failedReasons[id];
          } else {
            if (res2.failures[id]) failedReasons[id] = res2.failures[id];
            nextFailed.push(id);
          }
        }
        stillFailed = nextFailed;
        res = res2;
      } else {
        for (const id of stillFailed) {
          if (!failedReasons[id]) failedReasons[id] = [res2.fatal];
        }
        res = res2;
      }
    }
    return {job, ok: final, failed: new Set(stillFailed), failedReasons, fatalNote: res.fatal || null};
  };

  // 5. fold results back into jobs and write outputs. Each job is persisted
  // (cache file, translated file or removal, manifest entry) as soon as its
  // last batch completes, so a crash keeps everything finished so far. The
  // manifest itself is checkpointed every ~50 job completions and always
  // rewritten once at the end.
  const totals = {
    batchesDone: 0,
    batchesTotal: batchJobs.length,
    filesDone: 0,
    filesTotal: jobs.filter((j) => j.kind === 'content').length,
    manifestWritesAt: 0,
  };
  const quiet = !!opts.quiet;
  const progress = (force) => {
    if (quiet || !force && totals.batchesDone % 25) return;
    const fmt = (n) => (n >= 1000 ? `${(n / 1000).toFixed(0)}k` : String(n));
    log(
      `progress: batches ${totals.batchesDone}/${totals.batchesTotal}, ` +
        `files ${totals.filesDone}/${totals.filesTotal}, ` +
        `chunks ok ${summary.chunksTranslated + summary.chunksReused} failed ${summary.chunksFailed}, ` +
        `tokens ${fmt(client.usage.prompt_tokens)}+${fmt(client.usage.completion_tokens)}, ` +
        `${((Date.now() - started) / 60000).toFixed(1)} min`,
    );
  };

  const finalizeJob = (j) => {
    j.finalized = true;
    const now = new Date().toISOString();
    const okMap = j.okMap;
    const failed = j.failed;
    const translations = new Map();
    const cacheEntries = {};
    for (const c of j.chunks) {
      const text = okMap.get(c.id) ?? cacheMap.get(c.hash);
      if (text != null && !failed.has(c.id)) translations.set(c.id, text);
      if (text != null) {
        cacheEntries[c.hash] = text;
        cacheMap.set(c.hash, text);
      }
    }
    const cacheRel = j.kind === 'ui' ? `ui/${j.file.rel}.json` : cacheRelFor(j.file.sourceRel);
    writeCacheFile(i18nLocaleDir, cacheRel, cacheEntries);

    const stats = {
      sourceHash: j.sourceHash,
      chunks: j.chunks.length,
      translated: translations.size,
      updatedAt: now,
    };

    if (j.kind === 'content') {
      const targetAbs = path.join(i18nLocaleDir, j.file.targetRel);
      if (failed.size) {
        stats.status = 'partial';
        if (fs.existsSync(targetAbs)) fs.unlinkSync(targetAbs);
        summary.filesPartial++;
        for (const id of failed) {
          const c = j.chunks.find((x) => x.id === id);
          summary.failedChunks.push({
            file: j.file.sourceRel,
            chunk: id,
            reasons: j.failedReasons[id] || [],
            text: (c ? c.text : '').slice(0, 120),
          });
        }
      } else {
        stats.status = 'complete';
        const out = applyChunks(j.text, j.chunks, translations);
        fs.mkdirSync(path.dirname(targetAbs), {recursive: true});
        fs.writeFileSync(targetAbs, out);
        summary.filesComplete++;
      }
      manifest.files[j.file.sourceRel] = stats;
      summary.filesProcessed++;
      summary.chunksTranslated += okMap.size;
      summary.chunksReused += j.chunks.length - j.toTranslate.length;
      summary.chunksFailed += failed.size;
    } else {
      const targetAbs = path.join(i18nLocaleDir, j.file.rel);
      if (failed.size) {
        stats.status = 'partial';
        if (fs.existsSync(targetAbs)) fs.unlinkSync(targetAbs);
      } else {
        stats.status = 'complete';
        for (const c of j.chunks) {
          const t = translations.get(c.id);
          if (t != null) c.target.message = t;
        }
        fs.mkdirSync(path.dirname(targetAbs), {recursive: true});
        fs.writeFileSync(targetAbs, JSON.stringify(j.data, null, 2) + '\n');
      }
      manifest.ui[j.file.rel] = stats;
      summary.chunksTranslated += okMap.size;
      summary.chunksReused += j.chunks.length - j.toTranslate.length;
      summary.chunksFailed += failed.size;
    }

    if (j.kind === 'content') totals.filesDone++;
    if (failed.size) {
      const rel = j.kind === 'ui' ? j.file.rel : j.file.sourceRel;
      log(`job failed: ${rel} (${failed.size} chunk${failed.size === 1 ? '' : 's'} failed)`);
      progress(true);
    }
    if (++totals.manifestWritesAt % 50 === 0) writeManifest(i18nLocaleDir, manifest);
  };

  await runPool(batchJobs, concurrency, async (b) => {
    const r = await runBatch(b);
    for (const [id, text] of r.ok) r.job.okMap.set(id, text);
    for (const id of r.failed) r.job.failed.add(id);
    Object.assign(r.job.failedReasons, r.failedReasons || {});
    totals.batchesDone++;
    progress();
    if (--r.job.remaining === 0) finalizeJob(r.job);
    return r;
  });
  // jobs with zero batches (fully cached) never entered the pool
  for (const j of jobs) if (j.remaining === 0 && !j.finalized) finalizeJob(j);
  summary.promptTokens = client.usage.prompt_tokens;
  summary.completionTokens = client.usage.completion_tokens;

  // 6. prune when running over the whole repo
  if (!filesFilter) {
    const existing = new Set(listSourceFiles(repoRoot, null).map((f) => f.sourceRel));
    for (const [rel, entry] of Object.entries({...manifest.files})) {
      if (!existing.has(rel)) {
        delete manifest.files[rel];
        const tr = targetRelFor(repoRoot, rel);
        const targetAbs = tr && path.join(i18nLocaleDir, tr);
        if (targetAbs && fs.existsSync(targetAbs)) fs.unlinkSync(targetAbs);
        removeCacheFile(i18nLocaleDir, cacheRelFor(rel));
      }
    }
    // delete target md/mdx files with no manifest entry or not complete
    for (const f of listSourceFiles(repoRoot, null)) {
      const entry = manifest.files[f.sourceRel];
      const targetAbs = path.join(i18nLocaleDir, f.targetRel);
      if ((!entry || entry.status !== 'complete') && fs.existsSync(targetAbs)) fs.unlinkSync(targetAbs);
    }
    for (const [rel] of Object.entries({...manifest.ui})) {
      if (!fs.existsSync(path.join(enUiDir, rel))) {
        delete manifest.ui[rel];
        const targetAbs = path.join(i18nLocaleDir, rel);
        if (fs.existsSync(targetAbs)) fs.unlinkSync(targetAbs);
        removeCacheFile(i18nLocaleDir, `ui/${rel}.json`);
      }
    }
  }

  writeManifest(i18nLocaleDir, manifest);
  summary.durationMs = Date.now() - started;
  summary.model = model;
  summary.locale = locale;
  summary.coverage = summary.filesTotal ? `${summary.filesComplete}/${summary.filesTotal}` : '0/0';

  if (opts.summaryJson) {
    fs.mkdirSync(path.dirname(path.resolve(opts.summaryJson)), {recursive: true});
    fs.writeFileSync(opts.summaryJson, JSON.stringify(summary, null, 2) + '\n');
  }

  log(
    `files: ${summary.filesProcessed} processed, ${summary.filesSkippedUnchanged} unchanged; ` +
      `chunks: ${summary.chunksTranslated} translated, ${summary.chunksReused} reused, ${summary.chunksFailed} failed; ` +
      `coverage ${summary.coverage}; tokens ${summary.promptTokens}+${summary.completionTokens}; ${(summary.durationMs / 1000).toFixed(1)}s`,
  );
  if (summary.failedChunks.length) {
    for (const f of summary.failedChunks) {
      log(`  failed ${f.file} ${f.chunk}: ${f.text}`);
      for (const rsn of f.reasons) log(`    reason: ${rsn}`);
    }
  }
  return {summary, exitCode: summary.chunksFailed ? 1 : 0};
}

function targetRelFor(repoRoot, sourceRel) {
  for (const root of ROOTS) {
    if (sourceRel.startsWith(root.srcDir + '/')) {
      return toPosix(path.join(root.targetDir, sourceRel.slice(root.srcDir.length + 1)));
    }
  }
  return null;
}

function parseArgs(argv) {
  const o = {files: []};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--locale') o.locale = argv[++i];
    else if (a === '--files') {
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) o.files.push(argv[++i]);
    } else if (a === '--dry-run') o.dryRun = true;
    else if (a === '--concurrency') o.concurrency = Number(argv[++i]);
    else if (a === '--model') o.model = argv[++i];
    else if (a === '--summary-json') o.summaryJson = argv[++i];
    else if (a === '--no-write-translations') o.writeTranslations = false;
    else if (a === '--verbose') o.verbose = true;
    else if (a === '--quiet') o.quiet = true;
    else throw new Error(`unknown arg ${a}`);
  }
  return o;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const opts = parseArgs(process.argv.slice(2));
  translateFiles({...opts, repoRoot: path.resolve(HERE, '../..')})
    .then(({exitCode}) => process.exit(exitCode))
    .catch((e) => {
      console.error(e.stack || e.message);
      process.exit(1);
    });
}
