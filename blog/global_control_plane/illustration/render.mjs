import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const sharp = createRequire(import.meta.url)('sharp');
const root = path.dirname(fileURLToPath(import.meta.url));
const post = path.dirname(root);
const site = path.resolve(post, '../..');
const WIDTH = 1440, HEIGHT = 720;
const management = '#8061A5';
const data = '#939AA7';
const logo = await fs.readFile(path.join(root, 'assets/litellm.svg'), 'utf8');
const logoPaths = [...logo.matchAll(/<path[^>]* d="([^"]+)"\s*\/>/g)].map(match => `<path d="${match[1]}"/>`).join('');
const assetNames = ['aws-eks', 'aws-aurora', 'aws-elasticache', 'kubernetes', 'postgresql', 'redis'];
const assets = Object.fromEntries(await Promise.all(assetNames.map(async name => {
  const source = await fs.readFile(path.join(site, `static/img/cloud_icons/${name}.svg`), 'utf8');
  const match = source.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>/);
  const viewBox = match[1].match(/viewBox="([^"]+)"/)[1];
  const content = match[2].replace(/<title>[\s\S]*?<\/title>/g, '')
    .replace(/id="([^"]+)"/g, (_,id) => `id="gcp-cover-${name}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_,id) => `url(#gcp-cover-${name}-${id})`)
    .replace(/xlink:href="#([^"]+)"/g, (_,id) => `xlink:href="#gcp-cover-${name}-${id}"`);
  return [name, {viewBox, content}];
})));
const icon = (name,x,y,size=82) => `<svg x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" viewBox="${assets[name].viewBox}" preserveAspectRatio="xMidYMid meet">${assets[name].content}</svg>`;
const route = (d,color,width=2.6) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
const arrow = (x,y,color) => `<path d="M${x-8} ${y-5}L${x} ${y}L${x-8} ${y+5}" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
function environment(y,compute,database,cache) {
  return `<rect class="environment" x="670" y="${y-125}" width="610" height="250" rx="12" fill="#939AA7" fill-opacity=".025" stroke="#C0C5CE" stroke-width="1.8"/>`
    + route(`M846 ${y}H955M955 ${y-58}V${y+58}M955 ${y-58}H1060M955 ${y+58}H1060`,data,2.2)
    + arrow(1060,y-58,data)+arrow(1060,y+58,data)
    + icon(compute,805,y)
    + icon(database,1110,y-58,76)
    + icon(cache,1110,y+58,76);
}
function scene(dark=false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <title>LiteLLM Global Control Plane API</title>
  <desc>One LiteLLM control plane manages two independent deployments: Amazon EKS with Aurora and ElastiCache, and Kubernetes with PostgreSQL and Redis. Each gateway connects only to its own database and cache.</desc>
  ${environment(185,'aws-eks','aws-aurora','aws-elasticache')}
  ${environment(535,'kubernetes','postgresql','redis')}
  ${route('M340 360H470M470 185V535M470 185H751M470 535H751',management)}
  ${arrow(751,185,management)}${arrow(751,535,management)}
  <g class="cp-mark" transform="translate(170 275) scale(${170/372.14})" fill="${dark ? '#FFFFFF' : '#0117BE'}">${logoPaths}</g>
</svg>`;
}
const svg = scene().replace(/[ \t]+$/gm, '');
await fs.writeFile(path.join(post,'cover.svg'),svg);
await sharp(Buffer.from(svg)).png().toFile(path.join(post,'cover.png'));
if (process.env.COVER_REVIEW_DIR) {
  await fs.mkdir(process.env.COVER_REVIEW_DIR,{recursive:true});
  await sharp(Buffer.from(svg)).flatten({background:'#ffffff'}).resize(1000).png().toFile(path.join(process.env.COVER_REVIEW_DIR,'flat-light.png'));
  await sharp(Buffer.from(scene(true))).flatten({background:'#0b0e14'}).resize(1000).png().toFile(path.join(process.env.COVER_REVIEW_DIR,'flat-dark.png'));
  await sharp(Buffer.from(svg)).flatten({background:'#ffffff'}).resize(375).png().toFile(path.join(process.env.COVER_REVIEW_DIR,'flat-mobile.png'));
}
console.log(`Rendered flat text-free ${WIDTH} × ${HEIGHT} SVG and PNG.`);
