const test = require('node:test');
const assert = require('node:assert/strict');
const {buildComment} = require('./preview-links.cjs');

const previewUrl = 'https://preview.example';
const sha = '1234567890abcdef';

test('links modified pages to the preview and production page', () => {
  const body = buildComment({
    files: [{filename: 'docs/proxy/setup.md', status: 'modified'}],
    routeMap: {'docs/proxy/setup.md': '/docs/proxy/setup/'},
    previewUrl,
    sha,
  });

  assert.match(body, /\[\/docs\/proxy\/setup\/\]\(https:\/\/preview\.example\/docs\/proxy\/setup\/\)/);
  assert.match(body, /\(\[prod\]\(https:\/\/docs\.litellm\.ai\/docs\/proxy\/setup\/\)\)/);
  assert.match(body, /1234567/);
});

test('marks added pages as new without a production link', () => {
  const body = buildComment({
    files: [{filename: 'docs/new.md', status: 'added'}],
    routeMap: {'docs/new.md': '/docs/new/'},
    previewUrl,
    sha,
  });

  assert.match(body, /\(new\)/);
  assert.doesNotMatch(body, /\[prod\]/);
});

test('links the new path for a rename and lists the previous path as removed', () => {
  const body = buildComment({
    files: [{filename: 'docs/new-name.md', previous_filename: 'docs/old-name.md', status: 'renamed'}],
    routeMap: {'docs/new-name.md': '/docs/new-name/'},
    previewUrl,
    sha,
  });

  assert.match(body, /\[\/docs\/new-name\/\]/);
  assert.match(body, /### Removed pages\n- docs\/old-name\.md/);
});

test('lists removed pages without a preview link', () => {
  const body = buildComment({
    files: [{filename: 'docs/gone.mdx', status: 'removed'}],
    routeMap: {},
    previewUrl,
    sha,
  });

  assert.match(body, /### Removed pages\n- docs\/gone\.mdx/);
  assert.doesNotMatch(body, /https:\/\/preview\.example\/docs\/gone/);
});

test('counts non-page changes', () => {
  const body = buildComment({
    files: [{filename: 'src/components/Card.js', status: 'modified'}],
    routeMap: {},
    previewUrl,
    sha,
  });

  assert.match(body, /1 other changed files are not pages; shared files such as components, sidebars or config can affect many pages/);
});

test('uses the loaded route for slugged source paths', () => {
  const body = buildComment({
    files: [{filename: 'docs/old-source-name.md', status: 'modified'}],
    routeMap: {'docs/old-source-name.md': '/docs/custom-slug/'},
    previewUrl,
    sha,
  });

  assert.match(body, /\[\/docs\/custom-slug\/\]\(https:\/\/preview\.example\/docs\/custom-slug\/\)/);
});

test('handles an empty change set', () => {
  const body = buildComment({files: [], routeMap: {}, previewUrl, sha});

  assert.match(body, /^<!-- preview-links -->/);
  assert.match(body, /No changed pages are available on this preview/);
});

test('caps changed-page links at 100', () => {
  const files = Array.from({length: 101}, (_, index) => ({
    filename: `docs/page-${index}.md`,
    status: 'modified',
  }));
  const routeMap = Object.fromEntries(files.map((file, index) => [file.filename, `/docs/page-${index}/`]));
  const body = buildComment({files, routeMap, previewUrl, sha});

  assert.equal((body.match(/^- \[/gm) || []).length, 100);
  assert.match(body, /^- and 1 more$/m);
});
