const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const socialCardsPlugin = require('../../plugins/social-cards');
const {renderSocialCard} = require('./index.cjs');

const siteDir = path.resolve(__dirname, '../..');
const doc = (id, title, extra = {}) => ({id, title, permalink: `/docs/${id}`, sidebar: 'main', frontMatter: {}, ...extra});
const content = (title = 'Routing') => ({
  'docusaurus-plugin-content-docs': {
    default: {loadedVersions: [{
      docs: [doc('routing', title), doc('other', title), doc('custom', 'Custom', {frontMatter: {image: '/custom.png'}})],
      sidebars: {main: [{type: 'category', label: 'LLM Gateway',
        link: {type: 'generated-index', permalink: '/docs/category/gateway', title: 'Gateway'},
        items: [{type: 'doc', id: 'routing'}, {type: 'doc', id: 'other'}]}]},
    }, {
      docs: [doc('routing', 'Old routing', {permalink: '/zh-Hans/docs/1.0/routing'})], sidebars: {},
    }]},
    'release-notes': {loadedVersions: [{docs: [doc('release', 'v1.0', {permalink: '/release_notes/v1'})], sidebars: {}}]},
  },
  'docusaurus-plugin-content-blog': {blog: {blogPosts: [
    {metadata: {title: 'New release', permalink: '/blog/release', frontMatter: {}}},
    {metadata: {title: 'Custom cover', permalink: '/blog/custom', frontMatter: {image: '/cover.png'}}},
  ]}},
});

test('generates distinct page images, preserves overrides, and refreshes changed titles', async (t) => {
  const generatedFilesDir = await fs.mkdtemp(path.join(os.tmpdir(), 'litellm-social-cards-'));
  t.after(() => fs.rm(generatedFilesDir, {recursive: true, force: true}));
  const plugin = socialCardsPlugin({siteDir, generatedFilesDir});
  const run = async (allContent) => {
    let data;
    await plugin.allContentLoaded({allContent, actions: {setGlobalData: (value) => {data = value;}}});
    return data.images;
  };
  const images = await run(content());
  assert.equal(Object.keys(images).length, 6);
  assert.equal(images['/docs/custom'], undefined);
  assert.equal(images['/blog/custom'], undefined);
  assert.notEqual(images['/docs/routing'], images['/docs/other']);
  for (const route of ['/docs/routing', '/docs/category/gateway', '/zh-Hans/docs/1.0/routing', '/release_notes/v1', '/blog/release']) {
    assert.ok(images[route], route);
    const metadata = await sharp(path.join(generatedFilesDir, 'social-cards', images[route])).metadata();
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 630);
  }
  const routingFile = path.join(generatedFilesDir, 'social-cards', images['/docs/routing']);
  assert.deepEqual(await fs.readFile(routingFile), await renderSocialCard({title: 'Routing', section: 'LLM Gateway'}));
  const before = await fs.stat(routingFile);
  assert.deepEqual(await run(content()), images);
  assert.equal((await fs.stat(routingFile)).mtimeMs, before.mtimeMs);
  const updated = await run(content('Routing & fallbacks'));
  assert.notEqual(updated['/docs/routing'], images['/docs/routing']);
  assert.equal(updated['/blog/release'], images['/blog/release']);
  await assert.rejects(fs.access(routingFile), {code: 'ENOENT'});
});

test('renders long and escaped titles and leaves the area beside the logo empty', async () => {
  for (const title of ['Budget < $10 & rate limits', 'Routing, load balancing, and fallbacks across your AI providers', 'Mock Completion() Responses - Save Testing Costs 💰', 'v1.102.1 - Claude Code Auto Mode, Realtime Handshake Errors, OTEL Metadata & TypeSafe Jev']) {
    const image = await renderSocialCard({title, section: 'LLM Gateway'});
    const {data, info} = await sharp(image).extract({left: 410, top: 70, width: 700, height: 100}).raw().toBuffer({resolveWithObject: true});
    for (let pixel = 0; pixel < data.length; pixel += info.channels) {
      assert.deepEqual([...data.subarray(pixel, pixel + 3)], [245, 245, 242]);
    }
  }
  await assert.rejects(renderSocialCard({title: ' '}), /title is required/);
  await assert.rejects(renderSocialCard({title: 'W'.repeat(180)}), /too long/);
});
