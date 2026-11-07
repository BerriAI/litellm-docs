// Export the existing React hero as a seamless GIF for the blog listing.
// Run from the repository root with PYTHON pointing to Python with Pillow.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const Module = require('node:module');
const {spawnSync} = require('node:child_process');
const {transformSync} = require('@swc/core');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const sharp = require('sharp');

const FPS = 20;
const DURATION = 12;
const WIDTH = 960;
const HEIGHT = 504;
const post = path.resolve(__dirname, '..');

function pathSamples(data) {
  const tokens = data.match(/[A-Za-z]|-?\d+(?:\.\d+)?/g);
  const points = [];
  let cursor = 0;
  let current;
  const number = () => Number(tokens[cursor++]);
  while (cursor < tokens.length) {
    const command = tokens[cursor++];
    if (command === 'M') {
      current = [number(), number()];
      points.push(current);
    } else if (command === 'L') {
      current = [number(), number()];
      points.push(current);
    } else if (command === 'C') {
      const start = current;
      const first = [number(), number()];
      const second = [number(), number()];
      const end = [number(), number()];
      for (let step = 1; step <= 120; step++) {
        const t = step / 120;
        const u = 1 - t;
        points.push([0, 1].map(axis => u ** 3 * start[axis]
          + 3 * u ** 2 * t * first[axis] + 3 * u * t ** 2 * second[axis] + t ** 3 * end[axis]));
      }
      current = end;
    } else {
      throw new Error(`Unsupported hero path command: ${command}`);
    }
  }
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    distances.push(distances[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }
  return {points, distances};
}

function position({points, distances}, progress) {
  const distance = progress * distances.at(-1);
  let low = 1;
  let high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (distances[middle] < distance) low = middle + 1;
    else high = middle;
  }
  const start = points[low - 1];
  const end = points[low];
  const t = (distance - distances[low - 1]) / (distances[low] - distances[low - 1]);
  return [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t,
    Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI];
}

async function main() {
  const filename = path.join(post, 'RequestFlowHero.js');
  const source = (await fs.readFile(filename, 'utf8')).replace(
    /import styles from ['"].*?['"];?/, 'const styles = new Proxy({}, {get: (_, key) => key});');
  const {code} = transformSync(source, {
    filename, jsc: {parser: {syntax: 'ecmascript', jsx: true}, target: 'es2022'}, module: {type: 'commonjs'},
  });
  const component = new Module(filename, module);
  component.filename = filename;
  component.paths = module.paths;
  component._compile(code, filename);
  const html = renderToStaticMarkup(React.createElement(component.exports.default));
  let svg = html.match(/<svg\b[\s\S]*?<\/svg>/)[0];
  svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="504" ')
    .replace('viewBox="0 0 1100 520"', 'viewBox="-50 -55 1200 630"')
    .replace('<rect width="1100" height="520"', '<rect x="-50" y="-55" width="1200" height="630"');
  svg = svg.replace(/(<svg[^>]*>)/, '$1<style>.labels{font-family:Arial,Helvetica,sans-serif;font-weight:400}.metadata{font-family:monospace;font-size:11px;letter-spacing:.07em}</style>');
  const particles = [];
  svg = svg.replace(/<g opacity="([^"]+)">([\s\S]*?)<animateMotion\s+([^>]+)><\/animateMotion><\/g>/g,
    (_, opacity, shapes, attributes) => {
      const attribute = key => attributes.match(new RegExp(`${key}="([^"]+)"`))[1];
      const duration = parseFloat(attribute('dur'));
      particles.push({opacity, shapes, samples: pathSamples(attribute('path')),
        phase: -parseFloat(attribute('begin')) / duration,
        // Three fast cycles and one slow cycle make the exported loop seamless.
        duration: duration < 6 ? 4 : 12});
      return `<!--particle-${particles.length - 1}-->`;
    });
  assert.equal(particles.length, 156);
  assert(!svg.includes('<animateMotion'));
  const frame = time => svg.replace(/<!--particle-(\d+)-->/g, (_, index) => {
    const particle = particles[Number(index)];
    const progress = (particle.phase + time / particle.duration) % 1;
    const [x, y, angle] = position(particle.samples, progress).map(value => value.toFixed(3));
    return `<g opacity="${particle.opacity}" transform="translate(${x} ${y}) rotate(${angle})">${particle.shapes}</g>`;
  });
  assert.equal(frame(0), frame(DURATION), 'The GIF loop does not close');
  assert.notEqual(frame(0), frame(0.5), 'The GIF has no motion');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rust-request-cover-'));
  for (let i = 0; i < FPS * DURATION; i++) {
    await sharp(Buffer.from(frame(i / FPS))).png().toFile(path.join(directory, `${String(i).padStart(4, '0')}.png`));
    if (i % 60 === 0) console.log(`Rendered ${i + 1}/${FPS * DURATION} frames`);
  }
  const output = path.join(post, 'request-flow-cover.gif');
  const result = spawnSync(process.env.PYTHON || 'python3', [path.join(__dirname, 'encode-cover.py'), directory, output], {stdio: 'inherit'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`GIF encoding failed; frames remain in ${directory}`);
  const metadata = await sharp(output, {animated: true}).metadata();
  assert.equal(metadata.width, WIDTH);
  assert.equal(metadata.pageHeight, HEIGHT);
  assert.equal(metadata.pages, FPS * DURATION);
  assert.equal(metadata.loop, 0);
  assert.equal(metadata.delay.reduce((sum, delay) => sum + delay, 0), DURATION * 1000);
  await fs.rm(directory, {recursive: true});
  console.log(JSON.stringify({output, frames: metadata.pages, duration: DURATION, width: WIDTH, height: HEIGHT, bytes: (await fs.stat(output)).size}));
}

main().catch(error => {console.error(error); process.exitCode = 1;});
