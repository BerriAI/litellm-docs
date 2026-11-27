import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const sharp = createRequire(import.meta.url)('sharp');
const root = path.dirname(fileURLToPath(import.meta.url));
const post = path.dirname(root);
const site = path.resolve(post, '../..');
const WIDTH = 1440, HEIGHT = 800;
const palette = {management: '#8A75B5', data: '#9AA5B5', border: '#C5CDD8'};
const logo = await fs.readFile(path.join(root, 'assets/litellm.svg'), 'utf8');
const logoPaths = [...logo.matchAll(/<path[^>]* d="([^"]+)"\s*\/>/g)]
  .map(match => `<path d="${match[1]}"/>`).join('');
const assetNames = [
  'aws-eks', 'aws-aurora', 'aws-elasticache',
  'azure-kubernetes-services', 'azure-azure-database-postgresql-server', 'azure-cache-redis',
  'gcp-google-kubernetes-engine', 'gcp-cloud-sql', 'gcp-memorystore',
  'kubernetes', 'postgresql', 'redis',
];
const assets = Object.fromEntries(await Promise.all(assetNames.map(async name => {
  const source = await fs.readFile(path.join(site, `static/img/cloud_icons/${name}.svg`), 'utf8');
  const match = source.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>/);
  return [name, {
    viewBox: match[1].match(/viewBox="([^"]+)"/)[1],
    content: match[2].replace(/<title[^>]*>[\s\S]*?<\/title>/g, ''),
  }];
})));
let iconIndex = 0;
function icon(name, x, y, size) {
  const prefix = `cp-${name}-${iconIndex++}-`;
  let content = assets[name].content
    .replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`)
    .replace(/(?:xlink:)?href="#([^"]+)"/g, (_, id) => `href="#${prefix}${id}"`);
  const classes = [...new Set([...content.matchAll(/class="([^"]+)"/g)]
    .flatMap(match => match[1].split(/\s+/)))];
  for (const name of classes) content = content.replaceAll(`.${name}`, `.${prefix}${name}`);
  content = content.replace(/class="([^"]+)"/g, (_, names) => `class="${names.split(/\s+/).map(name => prefix + name).join(' ')}"`);
  return `<svg x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" viewBox="${assets[name].viewBox}" preserveAspectRatio="xMidYMid meet">${content}</svg>`;
}
const route = (d, color, width=2.5) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
const arrow = (x, y, direction, color) => route(`M${x-direction*7} ${y-4.5}L${x} ${y}L${x-direction*7} ${y+4.5}`, color, 2.3);
const environments = [
  {mark: 'aws-eks', database: 'aws-aurora', cache: 'aws-elasticache', x: 70, y: 64, side: -1},
  {mark: 'azure-kubernetes-services', database: 'azure-azure-database-postgresql-server', cache: 'azure-cache-redis', x: 920, y: 64, side: 1},
  {mark: 'gcp-google-kubernetes-engine', database: 'gcp-cloud-sql', cache: 'gcp-memorystore', x: 70, y: 486, side: -1},
  {mark: 'kubernetes', database: 'postgresql', cache: 'redis', x: 920, y: 486, side: 1},
];
function environment({mark, database, cache, x, y, side}) {
  const cy = y + 125;
  const gateway = side < 0 ? x+330 : x+120;
  const stores = side < 0 ? x+115 : x+335;
  const trunk = (gateway + stores)/2;
  const edge = gateway + side*50;
  const stop = stores - side*43;
  return `<rect class="cp-environment" x="${x}" y="${y}" width="450" height="250" rx="16" fill="#94A3B8" fill-opacity=".025" stroke="${palette.border}" stroke-width="1.8"/>`
    + route(`M${edge} ${cy}H${trunk}M${trunk} ${cy-61}V${cy+61}M${trunk} ${cy-61}H${stop}M${trunk} ${cy+61}H${stop}`, palette.data, 2)
    + arrow(stop, cy-61, side, palette.data) + arrow(stop, cy+61, side, palette.data)
    + icon(mark, gateway, cy, 94)
    + icon(database, stores, cy-61, 68)
    + icon(cache, stores, cy+61, 68);
}
function scene(dark=false) {
  iconIndex = 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <title>LiteLLM Global Control Plane API</title>
  <desc>One LiteLLM control plane manages four independent deployments: AWS EKS with Aurora and ElastiCache, Azure AKS with Azure Database for PostgreSQL and Azure Redis, GCP GKE with Cloud SQL and Memorystore, and on-premises Kubernetes with PostgreSQL and Redis. Connections from LiteLLM represent management traffic.</desc>
  ${environments.map(environment).join('\n')}
  ${route('M650 400H610V189H456M610 400V611H456', palette.management)}
  ${route('M790 400H830V189H984M830 400V611H984', palette.management)}
  ${arrow(456,189,-1,palette.management)}${arrow(456,611,-1,palette.management)}
  ${arrow(984,189,1,palette.management)}${arrow(984,611,1,palette.management)}
  <g class="cp-mark" transform="translate(650 330) scale(${140/372.14})" fill="${dark ? '#FFFFFF' : '#0117BE'}">${logoPaths}</g>
</svg>`;
}
const svg = scene().replace(/[ \t]+$/gm, '');
await fs.writeFile(path.join(post, 'cover.svg'), svg);
await sharp(Buffer.from(svg)).png().toFile(path.join(post, 'cover.png'));
if (process.env.COVER_REVIEW_DIR) {
  await fs.mkdir(process.env.COVER_REVIEW_DIR, {recursive:true});
  await sharp(Buffer.from(svg)).flatten({background:'#ffffff'}).resize(1200).png().toFile(path.join(process.env.COVER_REVIEW_DIR, 'multicloud-light.png'));
  await sharp(Buffer.from(scene(true))).flatten({background:'#0b0e14'}).resize(1200).png().toFile(path.join(process.env.COVER_REVIEW_DIR, 'multicloud-dark.png'));
  await sharp(Buffer.from(svg)).flatten({background:'#ffffff'}).resize(375).png().toFile(path.join(process.env.COVER_REVIEW_DIR, 'multicloud-mobile.png'));
}
console.log(`Rendered flat text-free ${WIDTH} × ${HEIGHT} multi-cloud SVG and PNG.`);
