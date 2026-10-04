const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');

function loadPlugin(sharp) {
  const module = {exports: {}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../plugins/optimize-images.js'), 'utf8'), {
    module,
    require: (name) => name === 'sharp' ? sharp : require(name),
    console: {log() {}},
  });
  return module.exports();
}

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-images-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  return dir;
}

test('bounds active image pipelines as the image collection grows', async (t) => {
  const dir = fixture(t);
  fs.mkdirSync(path.join(dir, 'nested'));
  const images = Array.from({length: 101}, (_, i) => path.join(dir, i % 2 ? 'nested' : '', `${i}.png`));
  for (const file of images) fs.writeFileSync(file, 'original image');
  fs.writeFileSync(path.join(dir, 'untouched.svg'), 'vector image');
  let active = 0;
  let peak = 0;
  let completed = 0;
  const plugin = loadPlugin(() => {
    active += 1;
    peak = Math.max(peak, active);
    return {
      png() { return this; },
      async toFile(output) {
        await new Promise(setImmediate);
        fs.writeFileSync(output, 'small');
        active -= 1;
        completed += 1;
      },
    };
  });
  await plugin.postBuild({outDir: dir});
  assert.ok(peak <= 2, `Opened ${peak} image pipelines simultaneously`);
  assert.equal(active, 0);
  assert.equal(completed, images.length);
  for (const file of images) {
    assert.equal(fs.readFileSync(file, 'utf8'), 'small');
    assert.equal(fs.existsSync(`${file}.opt`), false);
  }
  assert.equal(fs.readFileSync(path.join(dir, 'untouched.svg'), 'utf8'), 'vector image');
});

test('preserves originals and continues after failures or larger output', async (t) => {
  const dir = fixture(t);
  for (const name of ['broken.png', 'larger.jpg', 'valid.jpeg']) {
    fs.writeFileSync(path.join(dir, name), 'original');
  }
  const plugin = loadPlugin((input) => ({
    png() { return this; },
    jpeg() { return this; },
    async toFile(output) {
      if (input.endsWith('broken.png')) {
        fs.writeFileSync(output, 'partial');
        throw new Error('Could not decode image');
      }
      fs.writeFileSync(output, input.endsWith('larger.jpg') ? 'larger than original' : 'small');
    },
  }));
  await plugin.postBuild({outDir: dir});
  assert.equal(fs.readFileSync(path.join(dir, 'broken.png'), 'utf8'), 'original');
  assert.equal(fs.readFileSync(path.join(dir, 'larger.jpg'), 'utf8'), 'original');
  assert.equal(fs.readFileSync(path.join(dir, 'valid.jpeg'), 'utf8'), 'small');
  assert.equal(fs.readdirSync(dir).some((name) => name.endsWith('.opt')), false);
});
