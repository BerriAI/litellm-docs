import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import {visit} from 'unist-util-visit';

const REPOSITORY = 'BerriAI/litellm-lens-example';
const SITE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LENS_DIR = path.join(SITE_DIR, 'docs/proxy/lens');
const parser = unified().use(remarkParse).use(remarkGfm).use(remarkStringify, {fences: true});

function relativePath(value) {
  if (typeof value !== 'string' || value.includes('\\') || value.includes('\0') || value.startsWith('/') || path.posix.normalize(value) !== value || value.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error('Invalid repository path: ' + value);
  }
  return value;
}

export function validateManifest(manifest) {
  if (manifest.schema_version !== 1 || !Array.isArray(manifest.pages) || !manifest.pages.length) throw new Error('Expected a nonempty schema_version: 1 publication manifest');
  const sources = new Set();
  const slugs = new Set();
  for (const page of manifest.pages) {
    relativePath(page.source);
    if (!page.source.endsWith('/README.md') || !['integrations', 'coding-agents'].includes(page.category) || !new RegExp('^/' + page.category + '/[a-z0-9]+(?:-[a-z0-9]+)*$').test(page.slug)) throw new Error('Invalid publication entry: ' + page.source);
    if (!page.title?.trim() || !page.description?.trim() || sources.has(page.source) || slugs.has(page.slug)) throw new Error('Missing metadata or duplicate source/slug: ' + page.source);
    sources.add(page.source);
    slugs.add(page.slug);
  }
}

export async function transformReadme(content, page, pages, revision, readFile, knownFiles, legacy) {
  const tree = parser.parse(content);
  const headings = tree.children.filter((node) => node.type === 'heading' && node.depth === 1);
  const headingText = (node) => (node.children ?? []).map((child) => child.value ?? headingText(child)).join('');
  if (headings.length !== 1 || headingText(headings[0]) !== page.title) throw new Error('README must have one H1 matching its manifest title: ' + page.source);
  const published = new Map(pages.map((item) => [item.source, '/docs/proxy/lens' + item.slug]));
  const imageDefinitions = new Set();
  visit(tree, 'imageReference', (node) => imageDefinitions.add(node.identifier));
  const assets = new Map();
  const pending = [];
  visit(tree, (node) => {
    if (!['link', 'image', 'definition'].includes(node.type)) return;
    const url = node.url;
    const old = 'https://docs.litellm.ai/docs/proxy/lens';
    if (url === old || url.startsWith(old + '#') || url.startsWith(old + '/') || url.startsWith('/docs/proxy/lens')) {
      const tail = url.startsWith(old) ? url.slice(old.length) : url.slice('/docs/proxy/lens'.length);
      if (tail.startsWith('/coding_agents')) node.url = '/docs/proxy/lens/coding-agents' + tail.slice('/coding_agents'.length);
      else if (tail.startsWith('#')) node.url = legacy.anchors[tail.slice(1)] ?? '/docs/proxy/lens' + tail;
      else node.url = '/docs/proxy/lens' + tail;
      return;
    }
    if (!url || url.startsWith('#') || url.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(url)) return;
    const [, filePart, suffix = ''] = url.match(/^([^?#]*)(.*)$/);
    const target = relativePath(path.posix.normalize(path.posix.join(path.posix.dirname(page.source), decodeURIComponent(filePart))));
    if (!knownFiles.has(target)) throw new Error('Missing relative link in ' + page.source + ': ' + url);
    if (node.type === 'image' || (node.type === 'definition' && imageDefinitions.has(node.identifier))) {
      if (!/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(target)) throw new Error('Unsupported image asset: ' + target);
      const asset = 'assets/' + createHash('sha256').update(target).digest('hex').slice(0, 16) + path.posix.extname(target);
      node.url = path.posix.relative(path.posix.dirname(page.slug.slice(1) + '.md'), asset) + suffix;
      pending.push(readFile(target).then((bytes) => assets.set(asset, bytes)));
    } else {
      node.url = (published.get(target) ?? 'https://github.com/' + REPOSITORY + '/blob/' + revision + '/' + target.split('/').map(encodeURIComponent).join('/')) + suffix;
    }
  });
  await Promise.all(pending);
  const meta = {title: page.title, description: page.description, slug: '/proxy/lens' + page.slug, sidebar_label: page.title,
    custom_edit_url: 'https://github.com/' + REPOSITORY + '/edit/main/' + page.source};
  const frontmatter = '---\n' + Object.entries(meta).map(([key, value]) => key + ': ' + JSON.stringify(value)).join('\n') + '\nmdx:\n  format: md\n---\n\n';
  const provenance = '<!-- Generated from ' + REPOSITORY + '/' + page.source + ' at ' + revision + '. Edit the source README. -->\n\n';
  return {content: frontmatter + provenance + parser.stringify(tree), assets};
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--source-dir')) {
    throw new Error('Usage: sync-lens-docs.mjs [--source-dir PATH]');
  }
  let temporary;
  try {
    let source = args[1];
    if (!source) {
      temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'litellm-lens-docs-'));
      source = path.join(temporary, 'examples');
      execFileSync('git', ['clone', '--depth', '1', '--branch', 'main', 'https://github.com/' + REPOSITORY + '.git', source], {stdio: 'inherit'});
    }
    const revision = execFileSync('git', ['-C', source, 'rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
    const knownFiles = new Set(execFileSync('git', ['-C', source, 'ls-tree', '-r', '--name-only', revision], {encoding: 'utf8'}).trim().split('\n'));
    const readFile = async (name) => execFileSync('git', ['-C', source, 'show', revision + ':' + relativePath(name)], {maxBuffer: 20 * 1024 * 1024});
    const manifest = JSON.parse((await readFile('docs.json')).toString());
    validateManifest(manifest);
    const legacy = JSON.parse(await fs.readFile(path.join(LENS_DIR, 'legacy-links.json'), 'utf8'));
    const generated = new Map();
    for (const page of manifest.pages) {
      const {content, assets} = await transformReadme((await readFile(page.source)).toString(), page, manifest.pages, revision, readFile, knownFiles, legacy);
      generated.set(page.slug.slice(1) + '.md', content);
      for (const [name, bytes] of assets) generated.set(name, bytes);
    }
    const sidebar = Object.fromEntries(['integrations', 'coding-agents'].map((category) => [category,
      manifest.pages.filter((page) => page.category === category).map((page) => ({type: 'doc', id: 'proxy/lens/imported' + page.slug, label: page.title})),
    ]));
    generated.set('sidebar.json', JSON.stringify(sidebar, null, 2) + '\n');
    const stage = await fs.mkdtemp(path.join(LENS_DIR, '.import-'));
    try {
      for (const [name, content] of generated) {
        const target = path.join(stage, name);
        await fs.mkdir(path.dirname(target), {recursive: true});
        await fs.writeFile(target, content);
      }
      await fs.rm(path.join(LENS_DIR, 'imported'), {recursive: true, force: true});
      await fs.rename(stage, path.join(LENS_DIR, 'imported'));
    } finally {
      await fs.rm(stage, {recursive: true, force: true});
    }
    console.log('Imported ' + manifest.pages.length + ' Lens guides from main at ' + revision);
  } finally {
    if (temporary) await fs.rm(temporary, {recursive: true, force: true});
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
