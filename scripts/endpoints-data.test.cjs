const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const docsDir = path.join(root, 'docs');

// Build the set of Docusaurus doc ids by scanning docs/ the way Docusaurus does.
function frontMatterId(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const line = match[1].split(/\r?\n/).find((l) => /^id\s*:/.test(l));
  if (!line) return null;
  return line.replace(/^id\s*:\s*/, '').trim().replace(/^['"]|['"]$/g, '') || null;
}

function collectDocIds(dir = docsDir, rel = '', ids = new Set()) {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) {
      collectDocIds(path.join(dir, entry.name), rel ? `${rel}/${entry.name}` : entry.name, ids);
    } else if (/\.mdx?$/.test(entry.name)) {
      const base = entry.name.replace(/\.mdx?$/, '');
      const override = frontMatterId(path.join(dir, entry.name));
      const name = override || base;
      ids.add(rel ? `${rel}/${name}` : name);
    }
  }
  return ids;
}

function sidebarDocIds(items, out = []) {
  for (const item of items) {
    if (typeof item === 'string') out.push(item);
    else if (item.type === 'doc' || item.type === 'ref') out.push(item.id);
    else if (item.type === 'category') {
      if (item.link && item.link.type === 'doc') out.push(item.link.id);
      sidebarDocIds(item.items || [], out);
    }
  }
  return out;
}

function allStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => allStrings(v, out));
  return out;
}

let dataPromise;
function load() {
  dataPromise = dataPromise || import('../src/data/endpoints.js');
  return dataPromise;
}

test('every doc and subLink doc id resolves to a file under docs/', async () => {
  const {ENDPOINTS, PASS_THROUGH, PASS_THROUGH_INTRO} = await load();
  const ids = collectDocIds();
  const refs = [PASS_THROUGH_INTRO];
  for (const e of ENDPOINTS) {
    refs.push(e.doc);
    for (const s of e.subLinks || []) refs.push(s.doc);
  }
  for (const p of PASS_THROUGH) refs.push(p.doc);
  const missing = refs.filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `Unknown doc ids: ${missing.join(', ')}`);
});

test('every doc in the Supported Endpoints sidebar category is listed', async () => {
  const {ENDPOINTS, PASS_THROUGH, PASS_THROUGH_INTRO} = await load();
  const sidebars = require('../sidebars.js');
  const find = (items) => {
    for (const item of items) {
      if (item.type === 'category') {
        if (item.label === 'Supported Endpoints') return item;
        const nested = find(item.items || []);
        if (nested) return nested;
      }
    }
    return null;
  };
  const category = Object.values(sidebars).map((s) => find(s)).find(Boolean);
  assert.ok(category, 'Supported Endpoints category not found in sidebars.js');

  const referenced = new Set([PASS_THROUGH_INTRO]);
  for (const e of ENDPOINTS) {
    referenced.add(e.doc);
    for (const s of e.subLinks || []) referenced.add(s.doc);
  }
  for (const p of PASS_THROUGH) referenced.add(p.doc);

  const unlisted = sidebarDocIds(category.items).filter((id) => !referenced.has(id));
  assert.deepEqual(unlisted, [], `Sidebar docs missing from endpoints.js: ${unlisted.join(', ')}`);
});

test('category ids are valid and ids are unique', async () => {
  const {CATEGORIES, ENDPOINTS} = await load();
  const categoryIds = CATEGORIES.map((c) => c.id);
  assert.equal(new Set(categoryIds).size, categoryIds.length, 'duplicate category ids');
  const endpointIds = ENDPOINTS.map((e) => e.id);
  assert.equal(new Set(endpointIds).size, endpointIds.length, 'duplicate endpoint ids');
  for (const e of ENDPOINTS) {
    assert.ok(categoryIds.includes(e.category), `${e.id} has unknown category ${e.category}`);
  }
  for (const c of CATEGORIES) {
    assert.ok(ENDPOINTS.some((e) => e.category === c.id), `category ${c.id} has no endpoints`);
  }
});

test('endpoints follow the schema', async () => {
  const {ENDPOINTS} = await load();
  const formats = ['openai', 'anthropic', 'google', 'bedrock', 'litellm'];
  const capabilities = require('../src/data/providerCapabilities.json');
  const known = new Set();
  for (const provider of Object.values(capabilities)) {
    if (provider && Array.isArray(provider.capabilities)) provider.capabilities.forEach((c) => known.add(c));
  }
  for (const e of ENDPOINTS) {
    assert.ok(e.name && e.method && e.path && e.description, `${e.id} is missing a field`);
    // SDK-only endpoints have no route; their path is the Python call.
    if (e.method === 'SDK') assert.match(e.path, /\(\)$/, `${e.id} SDK path must be a function call`);
    else assert.ok(e.path.startsWith('/'), `${e.id} path must start with /`);
    assert.ok(formats.includes(e.format), `${e.id} has unknown format ${e.format}`);
    assert.equal(typeof e.bridged, 'boolean', `${e.id} bridged must be boolean`);
    assert.ok(Array.isArray(e.subLinks), `${e.id} subLinks must be an array`);
    assert.ok(Array.isArray(e.keywords), `${e.id} keywords must be an array`);
    assert.ok(e.capability === null || known.has(e.capability), `${e.id} has unknown capability ${e.capability}`);
    assert.ok(e.description.length <= 120, `${e.id} description is too long (${e.description.length})`);
  }
});

test('no dash punctuation or emoji in any string', async () => {
  const data = await load();
  const strings = allStrings({...data});
  const bad = strings.filter((s) => /[–—]/.test(s) || /\p{Extended_Pictographic}/u.test(s));
  assert.deepEqual(bad, [], `Strings with em dash, en dash or emoji: ${bad.join(' | ')}`);
});
