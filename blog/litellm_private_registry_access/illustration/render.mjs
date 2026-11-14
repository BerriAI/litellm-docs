import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const {createCanvas, loadImage} = createRequire(import.meta.url)('@napi-rs/canvas');
const root = path.dirname(fileURLToPath(import.meta.url));
const post = path.dirname(root);
const width = 1600, height = 680;
const [ecr, cognito, logo] = await Promise.all([
  fs.readFile(path.join(root, 'assets/ecr.svg'), 'utf8'),
  fs.readFile(path.join(root, 'assets/cognito.svg'), 'utf8'),
  fs.readFile(path.join(root, 'assets/litellm.svg'), 'utf8'),
]);
const awsIcon = (source, x, y, size) => `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 80 80">${source.match(/<g id="Icon-Architecture\/64\/[\s\S]*<\/g>/)[0]}</svg>`;
const logoPaths = [...logo.matchAll(/<path[^>]* d="([^"]+)"\s*\/>/g)].map(match => `<path d="${match[1]}"/>`).join('');

function illustration(dark = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>LiteLLM Private Registry</title>
  <desc>Amazon Cognito provides OAuth authentication. Pull artifacts from the private Amazon ECR registry into a LiteLLM deployment.</desc>
  <g fill="none" stroke="#8794AD" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M414 418H736M864 418H1154"/>
    <path d="M1138 406L1154 418L1138 430"/>
    <path d="M800 242V348" stroke-dasharray="5 10"/>
  </g>
  ${awsIcon(ecr, 180, 322, 192)}
  ${awsIcon(cognito, 744, 102, 112)}
  <g transform="translate(1194 322) scale(${192/372.14})" class="registry-logo" fill="${dark ? '#FFFFFF' : '#0117BE'}">${logoPaths}</g>
  <g fill="none" stroke="#667CF0" stroke-width="4" stroke-linejoin="round">
    <path d="M800 372L840 395V441L800 464L760 441V395Z"/>
    <path d="M760 395L800 418L840 395M800 418V464M780 383L820 406V423"/>
  </g>
</svg>`;
}

await fs.writeFile(path.join(post, 'cover.svg'), illustration());
for (const dark of [false, true]) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  if (dark) {
    context.fillStyle = '#0B0E14';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(await loadImage(Buffer.from(illustration(dark))), 0, 0);
  await fs.writeFile(path.join(post, dark ? 'cover-dark.png' : 'cover.png'), await canvas.encode('png'));
}
console.log('Rendered SVG and 1600 × 680 light/dark covers.');
