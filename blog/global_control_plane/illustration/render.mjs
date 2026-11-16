import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const sharp = createRequire(import.meta.url)('sharp');
const root = path.dirname(fileURLToPath(import.meta.url));
const post = path.dirname(root);
const width = 1600, height = 720;
const logo = await fs.readFile(path.join(root, 'assets/litellm.svg'), 'utf8');
const logoPaths = [...logo.matchAll(/<path[^>]* d="([^"]+)"\s*\/>/g)]
  .map(match => `<path d="${match[1]}"/>`).join('');
function illustration(dark = false, mobile = false) {
  const sceneWidth = mobile ? 900 : width;
  const center = sceneWidth / 2;
  const positions = mobile ? [150, 450, 750] : [300, 800, 1300];
  const regions = ['US', 'EU', 'APAC'].map((name, index) => ({name, x: positions[index]}));
  const regionWidth = mobile ? 232 : 326;
  const text = dark ? '#E4E9F4' : '#334155';
  const logoColor = dark ? '#FFFFFF' : '#0117BE';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sceneWidth}" height="${height}" viewBox="0 0 ${sceneWidth} ${height}">
  <title>Global Control Plane</title>
  <desc>One management API connects to independent LiteLLM gateways in US, EU, and APAC regions.</desc>
  <g fill="none" stroke="#8794AD" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M${center} 266V342M${positions[0]} 416V366Q${positions[0]} 342 ${positions[0]+24} 342H${positions[2]-24}Q${positions[2]} 342 ${positions[2]} 366V416M${center} 342V416"/>
    ${regions.map(({x}) => `<path d="M${x-10} 402L${x} 416L${x+10} 402"/>`).join('')}
  </g>
  <g transform="translate(${center-800} 0)" fill="none" stroke="#667CF0" stroke-width="4" stroke-linecap="round">
    <circle cx="800" cy="198" r="66"/>
    <ellipse cx="800" cy="198" rx="29" ry="66"/>
    <path d="M734 198H866M744 163H856M744 233H856"/>
  </g>
  ${regions.map(({x, name}) => `<g>
    <rect x="${x-regionWidth/2}" y="414" width="${regionWidth}" height="228" rx="22" fill="none" stroke="#A8B7D5" stroke-width="2" stroke-dasharray="5 10"/>
    <g class="control-plane-logo" fill="${logoColor}" transform="translate(${x-65} 451) scale(${130/372.14})">${logoPaths}</g>
    <text class="control-plane-label" x="${x}" y="618" fill="${text}" font-size="36" font-weight="500" text-anchor="middle" font-family="Arial, Helvetica, sans-serif">${name}</text>
  </g>`).join('')}
  <text class="control-plane-label" x="${center}" y="91" fill="${text}" font-size="42" font-weight="500" text-anchor="middle" font-family="Arial, Helvetica, sans-serif">Control plane</text>
  <text class="control-plane-label" x="${center+28}" y="309" fill="${text}" font-size="30" font-family="Arial, Helvetica, sans-serif">Management API</text>
</svg>`;
}

await fs.writeFile(path.join(post, 'cover.svg'), illustration());
await fs.writeFile(path.join(post, 'cover-mobile.svg'), illustration(false, true));
await sharp(Buffer.from(illustration())).png().toFile(path.join(post, 'cover.png'));
await sharp(Buffer.from(illustration(true))).png().toFile(path.join(post, 'cover-dark.png'));
console.log(`Rendered ${width} × ${height} SVG and light/dark PNG covers.`);
