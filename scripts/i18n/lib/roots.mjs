import fs from 'node:fs';
import path from 'node:path';

// Content roots and their localized target directories under i18n/<locale>/.
// Plugin ids come from docusaurus.config.js.
export const ROOTS = [
  {
    id: 'docs',
    srcDir: 'docs',
    routeBase: 'docs',
    targetDir: 'docusaurus-plugin-content-docs/current',
    exts: ['.md', '.mdx'],
  },
  {
    id: 'release-notes',
    srcDir: 'release_notes',
    routeBase: 'release_notes',
    targetDir: 'docusaurus-plugin-content-docs-release-notes/current',
    exts: ['.md', '.mdx'],
  },
  {
    id: 'blog',
    srcDir: 'blog',
    // plugin id is 'blog' (not 'default'), so Docusaurus names the dir
    // <pluginName>-<pluginId>
    routeBase: 'blog',
    targetDir: 'docusaurus-plugin-content-blog-blog',
    exts: ['.md', '.mdx'],
  },
  {
    id: 'pages',
    srcDir: 'src/pages',
    routeBase: '',
    targetDir: 'docusaurus-plugin-content-pages',
    exts: ['.md', '.mdx'],
  },
];

export function toPosix(p) {
  return p.split(path.sep).join('/');
}

export function walkFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const ent of fs.readdirSync(cur, {withFileTypes: true})) {
      const full = path.join(cur, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (exts.includes(path.extname(ent.name))) out.push(full);
    }
  }
  return out.sort();
}

// Returns [{root, sourceAbs, sourceRel (repo-relative posix), targetRel (under i18n/<locale>)}]
export function listSourceFiles(repoRoot, filter) {
  const files = [];
  for (const root of ROOTS) {
    const srcAbs = path.join(repoRoot, root.srcDir);
    for (const abs of walkFiles(srcAbs, root.exts)) {
      const rel = toPosix(path.relative(srcAbs, abs));
      const sourceRel = toPosix(path.join(root.srcDir, rel));
      if (filter && !filter.has(sourceRel)) continue;
      files.push({
        root,
        sourceAbs: abs,
        sourceRel,
        targetRel: toPosix(path.join(root.targetDir, rel)),
      });
    }
  }
  files.sort((a, b) => a.sourceRel.localeCompare(b.sourceRel));
  return files;
}
