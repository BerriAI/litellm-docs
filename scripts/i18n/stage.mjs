#!/usr/bin/env node
// Populate .i18n-staging/<locale>/ as a full mirror of every content root:
// fresh-complete translations where they exist, the English source verbatim
// everywhere else, so relative links and assets resolve inside one tree.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOTS, toPosix} from './lib/roots.mjs';
import {sha256, loadManifest, writeJson} from './lib/cache.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// under src/pages, JS/TS component files must not be duplicated into the
// localized route tree; only md/mdx and non-code assets are mirrored
const PAGES_SKIP_EXTS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css']);
const MD_EXTS = new Set(['.md', '.mdx']);

function walkAll(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const ent of fs.readdirSync(cur, {withFileTypes: true})) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out.sort();
}

export function stage({repoRoot = path.resolve(HERE, '../..'), i18nRoot, stagingDir, log = console.log} = {}) {
  i18nRoot = i18nRoot || path.join(repoRoot, 'i18n');
  stagingDir = stagingDir || path.join(repoRoot, '.i18n-staging');

  fs.rmSync(stagingDir, {recursive: true, force: true});
  fs.mkdirSync(stagingDir, {recursive: true});

  const fallback = {};
  const locales = fs.existsSync(i18nRoot)
    ? fs.readdirSync(i18nRoot, {withFileTypes: true}).filter((d) => d.isDirectory() && d.name !== 'en').map((d) => d.name)
    : [];
  if (!locales.length) {
    writeJson(path.join(stagingDir, 'fallback.json'), fallback);
    log('i18n: no non-en locale found; staging dir left empty');
    return {locales: []};
  }

  const results = {};

  for (const locale of locales) {
    const localeDir = path.join(i18nRoot, locale);
    const outDir = path.join(stagingDir, locale);
    const manifest = loadManifest(localeDir);
    const manifestFiles = manifest.files || {};
    const staged = [];
    const stale = [];
    const missing = [];
    const fallbacks = [];

    const copyTo = (abs, rel) => {
      const dst = path.join(outDir, rel);
      fs.mkdirSync(path.dirname(dst), {recursive: true});
      fs.copyFileSync(abs, dst);
    };
    const alias = (rel) => `@site/.i18n-staging/${locale}/${rel}`;

    // Markdown file links like (](/docs/x.md) and (](../docs/x.md) resolve via
    // siteDir/contentPath fallback in the English build but cannot map to a
    // localized source path here; rewrite them to a relative path into the
    // target root inside this staged tree. Only .md/.mdx targets are links
    // handled by the file resolver; route-style links are left alone.
    const rootNames = new Map(ROOTS.filter((r) => !r.srcDir.includes('/')).map((r) => [r.srcDir, r.targetDir]));
    const linkRe = /(!?\[[^\]]*\]\()((?:\.\.\/)+|\/)(docs|release_notes|blog)\/([^)\s]+?\.mdx?)([^)\s]*)\)/g;
    // Internal route links (](/docs/x) and (](../docs/x)-style relatives that
    // resolve against the page URL) must carry the locale prefix, because
    // /zh-Hans/ adds a URL level and unprefixed targets land on the English
    // routes. Resolve each link against the English page URL, then re-emit it
    // as /<locale>/<resolved>. Links outside our content roots are untouched.
    const routeRe =
      /(!?\[[^\]]*\]\()((\.\.\/)+)(docs|release_notes|blog)\/([^)\s]+)\)|(!?\[[^\]]*\]\()(\/(?:docs|release_notes|blog)\/[^)\s]+)\)/g;
    const writeMd = (abs, targetRel, enDir) => {
      const dst = path.join(outDir, targetRel);
      fs.mkdirSync(path.dirname(dst), {recursive: true});
      const dir = toPosix(path.posix.dirname(targetRel));
      let text = fs.readFileSync(abs, 'utf8');
      text = text.replace(linkRe, (m, head, prefix, name, rest, tail) => {
        if (head.startsWith('!')) return m; // image targets resolve as files
        const target = `${rootNames.get(name)}/${rest}`;
        let rel = toPosix(path.posix.relative(dir, target));
        if (!rel.startsWith('.')) rel = `./${rel}`;
        return `${head}${rel}${tail})`;
      });
      text = text.replace(routeRe, (m, head, ups, _d1, name, rest, ihead, abs) => {
        if ((head || ihead).startsWith('!')) return m;
        if (abs) return `${ihead}/${locale}${abs})`;
        const resolved = toPosix(path.posix.resolve(enDir, `${ups}${name}/${rest}`));
        return `${head}/${locale}${resolved})`;
      });
      fs.writeFileSync(dst, text);
    };

    for (const root of ROOTS) {
      const srcAbs = path.join(repoRoot, root.srcDir);
      for (const abs of walkAll(srcAbs)) {
        const rel = toPosix(path.relative(srcAbs, abs));
        const ext = path.extname(abs);
        const targetRel = toPosix(path.join(root.targetDir, rel));
        if (root.id === 'pages' && !MD_EXTS.has(ext) && PAGES_SKIP_EXTS.has(ext)) continue;
        if (!MD_EXTS.has(ext)) {
          copyTo(abs, targetRel);
          continue;
        }
        const sourceRel = toPosix(path.join(root.srcDir, rel));
        const entry = manifestFiles[sourceRel];
        const currentHash = sha256(fs.readFileSync(abs));
        const translatedAbs = path.join(localeDir, targetRel);
        const stagedFile =
          entry && entry.status === 'complete' && entry.sourceHash === currentHash && fs.existsSync(translatedAbs)
            ? translatedAbs
            : abs;
        const enDir = `/${root.routeBase ? `${root.routeBase}/` : ''}${toPosix(path.posix.dirname(rel))}`;
        writeMd(stagedFile, targetRel, enDir);
        if (stagedFile === translatedAbs) {
          staged.push(sourceRel);
        } else {
          fallbacks.push(alias(targetRel));
          if (entry) stale.push(sourceRel);
          else missing.push(sourceRel);
        }
      }
    }
    // manifest entries whose source vanished entirely count as stale
    const existing = new Set(staged.concat(missing, stale));
    for (const rel of Object.keys(manifestFiles)) {
      if (!existing.has(rel)) stale.push(rel);
    }

    // Sources reference assets outside their content root (e.g. `../../img/`
    // from docs, which lands inside the plugin dir because `current/` adds a
    // level, and `../../img/` from blog posts, which lands in the locale root).
    // Mirror repo-root asset dirs into every directory a relative escape can
    // resolve to. Blog is mirrored as non-md assets only (docs link to blog
    // images, never to blog content).
    const mirrorTargets = new Set(['']);
    for (const root of ROOTS) {
      const top = root.targetDir.split('/')[0];
      if (root.targetDir.includes('/')) mirrorTargets.add(top);
    }
    for (const base of ['img', 'static', 'src']) {
      const abs = path.join(repoRoot, base);
      for (const relFile of walkAll(abs)) {
        const rel = toPosix(path.relative(abs, relFile));
        for (const t of mirrorTargets) copyTo(relFile, t ? `${t}/${base}/${rel}` : `${base}/${rel}`);
      }
    }
    const blogAbs = path.join(repoRoot, 'blog');
    for (const f of walkAll(blogAbs)) {
      if (MD_EXTS.has(path.extname(f))) continue;
      const rel = toPosix(path.relative(blogAbs, f));
      for (const t of mirrorTargets) copyTo(f, t ? `${t}/blog/${rel}` : `blog/${rel}`);
    }

    // copy every non-md/mdx file under the locale dir (UI json etc.) that is
    // not inside the mirrored content trees; skip manifest.json and cache/
    const contentDirNames = ROOTS.map((r) => r.targetDir.split('/')[0]);
    const stack = [localeDir];
    while (stack.length) {
      const cur = stack.pop();
      for (const ent of fs.readdirSync(cur, {withFileTypes: true})) {
        const full = path.join(cur, ent.name);
        const rel = toPosix(path.relative(localeDir, full));
        if (ent.isDirectory()) {
          if (rel === 'cache') continue;
          stack.push(full);
          continue;
        }
        if (rel === 'manifest.json') continue;
        const ext = path.extname(ent.name);
        const inContentDir = contentDirNames.some((d) => rel === d || rel.startsWith(d + '/'));
        if (inContentDir && MD_EXTS.has(ext)) continue; // handled via mirror
        // non-md files inside content dirs are UI json (e.g. options.json);
        // mirror-copied assets already exist in outDir and win via existsSync
        if (!fs.existsSync(path.join(outDir, rel))) copyTo(full, rel);
      }
    }

    fallback[locale] = fallbacks.sort();
    results[locale] = {staged, stale, missing};
    writeJson(path.join(outDir, 'staging-report.json'), {staged, stale, missing});
    log(`i18n/${locale}: staged ${staged.length}, stale ${stale.length}, missing ${missing.length}`);
  }
  writeJson(path.join(stagingDir, 'fallback.json'), fallback);
  return results;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) stage();
