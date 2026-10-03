const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sharp = require('sharp');
const {optimizeImages} = require('./optimize-images');

async function createFixtures(directory) {
  const width = 256;
  const height = 256;
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * channels;
      raw[offset] = x;
      raw[offset + 1] = y;
      raw[offset + 2] = (x + y) % 256;
    }
  }
  const input = {raw: {width, height, channels}};
  await sharp(raw, input).png({compressionLevel: 0}).toFile(path.join(directory, 'fixture.png'));
  await sharp(raw, input).jpeg({quality: 100, chromaSubsampling: '4:4:4'}).toFile(path.join(directory, 'fixture.jpeg'));
  return ['fixture.png', 'fixture.jpeg'];
}

test('optimizes PNG and JPEG files, caches their bytes, and prunes stale entries', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'litellm-optimize-images-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  const originalsDir = path.join(root, 'originals');
  const firstOutDir = path.join(root, 'first');
  const secondOutDir = path.join(root, 'second');
  const cacheDir = path.join(root, 'cache');
  await Promise.all([originalsDir, firstOutDir, secondOutDir, cacheDir].map((dir) => fs.mkdir(dir)));
  const names = await createFixtures(originalsDir);
  const originals = new Map(await Promise.all(names.map(async (name) => [
    name,
    await fs.readFile(path.join(originalsDir, name)),
  ])));
  await fs.writeFile(path.join(cacheDir, 'stale-entry'), 'stale');
  await Promise.all(names.map((name) => fs.copyFile(path.join(originalsDir, name), path.join(firstOutDir, name))));

  const first = await optimizeImages(firstOutDir, cacheDir);
  assert.equal(first.total, names.length);
  assert.equal(first.cached, 0);
  assert.ok(first.saved > 0);
  await assert.rejects(fs.access(path.join(cacheDir, 'stale-entry')), {code: 'ENOENT'});
  const optimized = new Map(await Promise.all(names.map(async (name) => [
    name,
    await fs.readFile(path.join(firstOutDir, name)),
  ])));
  for (const name of names) assert.ok(optimized.get(name).length < originals.get(name).length);

  await Promise.all(names.map((name) => fs.copyFile(path.join(originalsDir, name), path.join(secondOutDir, name))));
  const second = await optimizeImages(secondOutDir, cacheDir);
  assert.equal(second.total, names.length);
  assert.equal(second.cached, second.total);
  assert.deepEqual(second.saved, first.saved);
  for (const name of names) {
    assert.deepEqual(await fs.readFile(path.join(secondOutDir, name)), optimized.get(name));
  }
});

test('leaves a corrupt PNG untouched and does not cache it', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'litellm-optimize-corrupt-'));
  t.after(() => fs.rm(root, {recursive: true, force: true}));
  const outDir = path.join(root, 'out');
  const cacheDir = path.join(root, 'cache');
  await Promise.all([outDir, cacheDir].map((dir) => fs.mkdir(dir)));
  const input = Buffer.from('not a PNG');
  const filePath = path.join(outDir, 'corrupt.png');
  await fs.writeFile(filePath, input);

  const result = await optimizeImages(outDir, cacheDir);
  assert.deepEqual(result, {total: 1, cached: 0, saved: 0});
  assert.deepEqual(await fs.readFile(filePath), input);
  assert.deepEqual(await fs.readdir(cacheDir), []);
});
