const test = require('node:test');
const assert = require('node:assert/strict');
const {mdxToMarkdown, endpointIndexMarkdown, passThroughIndexMarkdown, setEndpointIndex} = require('./llms');
const remarkRawMarkdown = require('../src/remark/raw-markdown');

test('version badges become plain text in the markdown export', () => {
  const page = [
    '# Reasoning',
    '',
    '<SinceVersion v="1.63.0" />',
    '',
    'Set it to keep IDs out. <SinceVersion v="v1.87.0" />',
    '',
    "| Versions | <SinceVersion v={'1.63.8'} /> |",
    '',
    'Requires the SDK 1.1.0 {/* keep-version-note */}',
    '',
    'Needs Python 3.11 or later. {/* keep-python-version: the integration needs it */}',
    '',
    '<SinceVersion />',
    '',
    '```jsx',
    '<SinceVersion v="1.85.0" />',
    '{/* keep-version-note */}',
    '```',
  ].join('\n');
  assert.equal(
    mdxToMarkdown(page),
    [
      '# Reasoning',
      '',
      'Available in LiteLLM v1.63.0 and later.',
      '',
      'Set it to keep IDs out. (since LiteLLM v1.87.0)',
      '',
      '| Versions | (since LiteLLM v1.63.8) |',
      '',
      'Requires the SDK 1.1.0',
      '',
      'Needs Python 3.11 or later.',
      '',
      '```jsx',
      '<SinceVersion v="1.85.0" />',
      '{/* keep-version-note */}',
      '```',
      '',
    ].join('\n'),
  );
});

test('backported versions reach the markdown export with their release line', () => {
  const page = [
    '<SinceVersion v="1.111.0" backports={["1.108.10"]} />',
    '',
    `| \`LITELLM_X\` | <SinceVersion v="1.4.0" backports={["v1.2.3", '1.3.4']} /> Turns X on. |`,
    '',
    "Set it to keep IDs out. <SinceVersion v={'1.111.0'} backports={['1.108.10']} />",
  ].join('\n');
  assert.equal(
    mdxToMarkdown(page),
    [
      'Available in LiteLLM v1.111.0 and later, and in v1.108.10 and later 1.108.x patches.',
      '',
      '| `LITELLM_X` | (since LiteLLM v1.4.0, and v1.2.3 and later 1.2.x patches and v1.3.4 and later 1.3.x patches) Turns X on. |',
      '',
      'Set it to keep IDs out. (since LiteLLM v1.111.0, and v1.108.10 and later 1.108.x patches)',
      '',
    ].join('\n'),
  );
});

test('copy page gives the same version text as the markdown export', () => {
  const page = [
    '# Reasoning',
    '',
    '<SinceVersion v="1.63.0" />',
    '',
    'Set it to keep IDs out. <SinceVersion v="v1.87.0" />',
    '',
    'Requires the SDK 1.1.0 {/* keep-version-note */}',
    '',
    'Needs Python 3.11 or later. {/* keep-python-version: the integration needs it */}',
  ].join('\n');
  const file = {value: page, data: {}};
  remarkRawMarkdown()(null, file);
  assert.equal(
    Buffer.from(file.data.frontMatter.rawMarkdownB64, 'base64').toString(),
    [
      '# Reasoning',
      '',
      'Available in LiteLLM v1.63.0 and later.',
      '',
      'Set it to keep IDs out. (since LiteLLM v1.87.0)',
      '',
      'Requires the SDK 1.1.0',
      '',
      'Needs Python 3.11 or later.',
    ].join('\n'),
  );
});

test('endpoint catalog and flow become markdown in the export', () => {
  const byId = new Map([
    ['completion/input', {permalink: '/docs/completion/input'}],
    ['pass_through/intro', {permalink: '/docs/pass_through/intro'}],
    ['pass_through/anthropic_completion', {permalink: '/docs/pass_through/anthropic_completion'}],
  ]);
  const md = endpointIndexMarkdown(
    {
      CATEGORIES: [{id: 'chat', label: 'Chat and responses', blurb: 'Send messages to a model.'}],
      ENDPOINTS: [
        {id: 'chat_completions', name: 'Chat Completions', method: 'POST', path: '/v1/chat/completions', description: 'Chat with any model.', category: 'chat', doc: 'completion/input'},
      ],
      PASS_THROUGH: [{label: 'Anthropic', doc: 'pass_through/anthropic_completion'}],
      PASS_THROUGH_INTRO: 'pass_through/intro',
    },
    byId,
  );
  assert.match(md, /### Chat and responses/);
  assert.match(md, /- \[Chat Completions\]\(https:\/\/docs\.litellm\.ai\/docs\/completion\/input\.md\) \(`POST \/v1\/chat\/completions`\): Chat with any model\./);
  const pass = passThroughIndexMarkdown({PASS_THROUGH: [{label: 'Anthropic', doc: 'pass_through/anthropic_completion'}]}, byId);
  assert.match(pass, /- \[Anthropic\]\(https:\/\/docs\.litellm\.ai\/docs\/pass_through\/anthropic_completion\.md\)/);
  setEndpointIndex(md);
  const out = mdxToMarkdown('# Supported Endpoints\n\n<EndpointPaths />\n\n## All endpoints {#all-endpoints}\n\n<EndpointCatalog />\n');
  assert.match(out, /- Translated: /);
  assert.match(out, /### Chat and responses/);
  assert.doesNotMatch(out, /<Endpoint/);
});

const {headingIndex, pageEntry, navTree, plainText} = require('./mcp-manifest');

test('page index gives headings the anchor ids the rendered page uses', () => {
  const md = [
    '---',
    'title: "Logging"',
    '---',
    '# Logging',
    '',
    '## Logging',
    '',
    '## Quick Start {#quick-start-custom}',
    '',
    '### `config.yaml` setup',
    '',
    '```bash',
    '# not a heading',
    '```',
    '',
    '## Send to [Langfuse](https://langfuse.com) **now**',
    '',
    '## Quick Start',
    '',
    '## Quick Start',
    '',
  ].join('\n');
  const headings = headingIndex(md);
  assert.deepEqual(
    headings.map((h) => [h.depth, h.title, h.id]),
    [
      [1, 'Logging', null],
      [2, 'Logging', 'logging-1'],
      [2, 'Quick Start', 'quick-start-custom'],
      [3, 'config.yaml setup', 'configyaml-setup'],
      [2, 'Send to Langfuse now', 'send-to-langfuse-now'],
      [2, 'Quick Start', 'quick-start'],
      [2, 'Quick Start', 'quick-start-1'],
    ],
  );
  // A front matter title takes no slug, so the first "## Logging" is "logging".
  assert.deepEqual(headingIndex(md, {titleInSource: false}).slice(0, 2).map((h) => h.id), [null, 'logging']);
});

test('page index sections cover the text up to the next heading of the same level', () => {
  const md = '# Page\n\nintro\n\n## A\n\na text\n\n### A.1\n\nsub\n\n## B\n\nb text\n';
  const [page, a, a1, b] = headingIndex(md);
  assert.equal(md.slice(a.start, a.end), '## A\n\na text\n\n### A.1\n\nsub\n\n');
  assert.equal(md.slice(a1.start, a1.end), '### A.1\n\nsub\n\n');
  assert.equal(md.slice(b.start, b.end), '## B\n\nb text\n');
  assert.deepEqual([page.start, page.end], [0, md.length]);
});

test('page index entries point at the .md file the build writes', () => {
  assert.equal(pageEntry({url: '/docs/proxy/logging', title: 'Logging', type: 'docs', markdown: '# Logging\n'}).md, 'docs/proxy/logging.md');
  assert.equal(pageEntry({url: '/docs/', title: 'Docs', type: 'docs', markdown: ''}).md, 'docs/index.md');
  assert.equal(pageEntry({url: '/', title: 'Home', type: 'home', markdown: ''}).md, 'index.md');
  assert.equal(plainText('Use `a_b` with _emphasis_ and snake_case'), 'Use a_b with emphasis and snake_case');
});

test('nav tree keeps sidebar order and drops unpublished docs', () => {
  const byId = new Map([
    ['proxy/logging', {permalink: '/docs/proxy/logging', title: 'Logging'}],
    ['proxy/intro', {permalink: '/docs/proxy/intro', title: 'Intro'}],
  ]);
  const tree = navTree(
    {
      tutorialSidebar: [
        {type: 'doc', id: 'proxy/intro'},
        {
          type: 'category',
          label: 'Observability',
          link: {type: 'generated-index', permalink: '/docs/observability'},
          items: [{type: 'doc', id: 'proxy/logging', label: 'Logging'}, {type: 'doc', id: 'proxy/draft'}, {type: 'html', value: '<hr>'}],
        },
        {type: 'category', label: 'Empty', items: [{type: 'doc', id: 'proxy/draft'}]},
        {type: 'link', label: 'GitHub', href: 'https://github.com/BerriAI/litellm'},
      ],
    },
    byId,
  );
  assert.deepEqual(tree, {
    tutorialSidebar: [
      {title: 'Intro', url: '/docs/proxy/intro'},
      {title: 'Observability', url: '/docs/observability', items: [{title: 'Logging', url: '/docs/proxy/logging'}]},
      {title: 'GitHub', url: 'https://github.com/BerriAI/litellm'},
    ],
  });
});

test('heading text follows CommonMark: code keeps underscores, loose emphasis stays literal, nested link text', () => {
  const md = '# T\n\n#### `litellm/__init__.py`\n\n#### [** API DOCS**](https://x)\n\n## [[PROXY-Only] Control Access](/docs/a)\n\n## Related pages\n';
  const headings = headingIndex(md, {sourceEnd: md.indexOf('## Related')});
  assert.deepEqual(headings.map((h) => h.id), [null, 'litellm__init__py', '-api-docs', 'proxy-only-control-access', null]);
  const nested = headingIndex('# T\n\n   ## Indented\n\n> ## Quoted\n\n    ## Code block\n\n## C# client\n\n## Closed ##\n');
  assert.deepEqual(nested.map((h) => h.id), [null, 'indented', 'quoted', 'c-client', 'closed']);
});

test('unlisted docs retain direct markdown exports without entering discovery indexes', async (t) => {
  const fs = require('node:fs/promises');
  const os = require('node:os');
  const path = require('node:path');
  const siteDir = await fs.mkdtemp(path.join(os.tmpdir(), 'litellm-unlisted-docs-'));
  t.after(() => fs.rm(siteDir, {recursive: true, force: true}));
  const offline = process.env.LITELLM_DOCS_OFFLINE;
  process.env.LITELLM_DOCS_OFFLINE = '1';
  t.after(() => {
    if (offline === undefined) delete process.env.LITELLM_DOCS_OFFLINE;
    else process.env.LITELLM_DOCS_OFFLINE = offline;
  });
  await fs.mkdir(path.join(siteDir, 'src/data'), {recursive: true});
  await fs.writeFile(path.join(siteDir, 'src/data/endpoints.js'), 'exports.CATEGORIES = []; exports.ENDPOINTS = []; exports.PASS_THROUGH = [];');
  const docs = [
    {id: 'current', title: 'Current setup'},
    {id: 'legacy', title: 'Legacy setup', unlisted: true},
    {id: 'draft', title: 'Draft setup', draft: true},
  ].map((doc) => ({...doc, source: `@site/${doc.id}.md`, permalink: `/docs/${doc.id}`}));
  await Promise.all(docs.map((doc) => fs.writeFile(path.join(siteDir, `${doc.id}.md`), `# ${doc.title}\n\n${doc.id} instructions.\n`)));

  for (const selected of [docs, docs.slice(1)]) {
    const outDir = path.join(siteDir, `build-${selected.length}`);
    const plugin = require('./llms')({siteDir});
    await plugin.allContentLoaded({allContent: {'docusaurus-plugin-content-docs': {default: {loadedVersions: [{
      docs: selected,
      sidebars: {tutorialSidebar: selected.map((doc) => ({type: 'doc', id: doc.id}))},
    }]}}}});
    await plugin.postBuild({outDir});
    assert.match(await fs.readFile(path.join(outDir, 'docs/legacy.md'), 'utf8'), /legacy instructions/);
    await assert.rejects(fs.access(path.join(outDir, 'docs/draft.md')), {code: 'ENOENT'});
    for (const file of ['llms.txt', 'llms-full.txt', 'sitemap.md', 'mcp-pages.json', 'mcp-nav.json']) {
      const content = await fs.readFile(path.join(outDir, file), 'utf8');
      assert.doesNotMatch(content, /Legacy setup|legacy instructions|\/docs\/legacy|Draft setup/, file);
      if (selected.length === docs.length) assert.match(content, /Current setup/, file);
    }
  }
});
