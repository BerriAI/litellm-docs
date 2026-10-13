import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Run with: node generate-diagrams.mjs
const out = dirname(fileURLToPath(import.meta.url));
const c = {
  ink: '#12283e', muted: '#536a7e', line: '#8da0b2', border: '#c8d3de',
  paper: '#f7f9fc', green: '#82b545', greenBg: '#eff7e7',
  blue: '#5e97d5', blueBg: '#edf5ff', orange: '#dc9b3c', orangeBg: '#fff5e6',
};
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const text = (x, y, value, size = 16, options = {}) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${options.bold ? 650 : 400}" fill="${options.color ?? c.ink}"${options.center ? ' text-anchor="middle"' : ''}>${esc(value)}</text>`;
const rect = (x, y, w, h, fill = '#fff', stroke = c.border, radius = 15, dash = false) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="1.7"${dash ? ' stroke-dasharray="7 6"' : ''}/>`;
const path = (d, options = {}) => `<path d="${d}" fill="none" stroke="${options.green ? c.green : c.line}" stroke-width="${options.solid ? 2.5 : 2}" stroke-linecap="round" stroke-linejoin="round"${options.solid ? '' : ' stroke-dasharray="5 5"'}${options.arrow === false ? '' : ` marker-end="url(#${options.green ? 'greenArrow' : 'arrow'})"`}/>`;
const title = (name, subtitle) => text(24, 42, name, 28, { bold: true }) + text(24, 73, subtitle, 16, { color: c.muted });
const outside = (x, y, w, h, lines, fill = c.paper, stroke = c.border) => rect(x, y, w, h, fill, stroke) + lines.map((s, i) => text(x + w / 2, y + h / 2 - (lines.length - 1) * 11 + i * 23 + 5, s, i === 0 ? 17 : 15, { center: true, bold: i === 0, color: i === 0 ? c.ink : c.muted })).join('');
const svg = (height, name, desc, body) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${height}" viewBox="0 0 800 ${height}" role="img" aria-labelledby="title desc">
<title id="title">${esc(name)}</title>
<desc id="desc">${esc(desc)}</desc>
<defs>
  <marker id="arrow" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${c.line}"/></marker>
  <marker id="greenArrow" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" fill="${c.green}"/></marker>
</defs>
<rect width="800" height="${height}" fill="#ffffff"/>
<g font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif">
${body}
</g>
</svg>
`;

const before = [
  title('Earlier test deployment', 'One request worker per gateway pod'),
  rect(186, 118, 410, 332, c.paper, c.line, 20, true),
  text(208, 150, 'Gateway pod', 20, { bold: true }),
  rect(208, 174, 366, 252, c.greenBg, c.green),
  text(230, 205, 'Gateway container', 16, { color: c.muted }),
  text(391, 241, '1 request worker', 24, { bold: true, center: true }),
  text(391, 276, 'Auth · budgets · token counting', 17, { center: true }),
  text(391, 309, 'Metrics · spend processing', 17, { center: true }),
  rect(234, 351, 314, 57),
  text(391, 386, 'Per-worker database pool', 17, { center: true, bold: true }),
  outside(24, 203, 130, 88, ['Kubernetes', 'Service']),
  outside(638, 203, 138, 88, ['Model', 'providers']),
  outside(638, 340, 138, 80, ['Postgres']),
  outside(638, 469, 138, 70, ['Redis', 'Shared state']),
  path('M154 247 H206', { solid: true }),
  path('M574 247 H636', { solid: true }),
  path('M548 380 H636'),
  path('M225 426 V504 H636'),
  text(24, 554, 'Metrics and spend processing share the request worker.', 16, { color: c.muted }),
].join('\n');

const after = [
  title('High-throughput deployment', 'Four request workers, with separate metrics and spend containers'),
  rect(186, 118, 410, 474, c.paper, c.line, 20, true),
  text(208, 150, 'Gateway pod · 3 containers', 20, { bold: true }),
  rect(208, 174, 366, 224, '#fff', c.green),
  text(230, 203, 'Gateway container', 19, { bold: true }),
  ...[0, 1, 2, 3].map((i) => rect(224 + i * 83, 221, 75, 54, c.greenBg, c.green, 10) + text(261.5 + i * 83, 254, `Worker ${i + 1}`, 15, { bold: true, center: true })),
  text(391, 301, 'Auth and budget checks', 16, { center: true, color: c.muted }),
  rect(224, 329, 143, 49, c.greenBg, c.green, 10),
  text(295.5, 350, 'Rust token', 16, { center: true, bold: true }),
  text(295.5, 368, 'counting', 16, { center: true }),
  rect(414, 329, 144, 49, c.greenBg, c.green, 10),
  text(486, 350, 'PgBouncer', 16, { center: true, bold: true }),
  text(486, 368, 'Shared pool', 15, { center: true }),
  rect(208, 454, 161, 111, c.blueBg, c.blue),
  text(288.5, 485, 'Metrics', 19, { center: true, bold: true }),
  text(288.5, 510, 'container', 17, { center: true }),
  text(288.5, 543, 'Serves metrics', 15, { center: true, color: c.muted }),
  rect(397, 454, 177, 111, c.orangeBg, c.orange),
  text(485.5, 485, 'Spend collector', 18, { center: true, bold: true }),
  text(485.5, 510, 'container', 17, { center: true }),
  text(485.5, 543, 'After the response', 15, { center: true, color: c.muted }),
  outside(24, 204, 130, 88, ['Kubernetes', 'Service']),
  outside(638, 204, 138, 88, ['Model', 'providers']),
  outside(638, 314, 138, 80, ['Postgres']),
  outside(638, 476, 138, 70, ['Redis', 'Shared state']),
  outside(24, 476, 150, 70, ['Prometheus'], c.blueBg, c.blue),
  path('M154 248 H222', { solid: true }),
  path('M548 248 H636', { solid: true }),
  path('M510 275 V327'),
  path('M558 354 H636'),
  path('M289 398 V452'),
  path('M429 398 V452'),
  path('M542 454 V380'),
  path('M208 511 H176'),
  path('M574 376 H615 V511 H636'),
  path('M574 511 H614', { arrow: false }),
  `<circle cx="615" cy="511" r="3.5" fill="${c.line}"/>`,
  rect(186, 639, 410, 76, c.greenBg, c.green),
  text(391, 669, 'Autoscaler adds whole gateway pods', 18, { center: true, bold: true }),
  text(391, 696, 'Requests · tokens · CPU · memory', 16, { center: true }),
  path('M391 639 V595', { green: true }),
  text(24, 752, 'Solid arrows: model requests. Dotted arrows: supporting work.', 15, { color: c.muted }),
].join('\n');

writeFileSync(join(out, 'deployment-before.svg'), svg(579, 'Earlier LiteLLM test deployment', 'A Kubernetes Service sends requests to a gateway pod with one request worker. Authentication, budgets, token counting, metrics and spend processing share that worker. Its database pool connects to Postgres, and Redis holds shared state. The gateway sends model requests to providers.', before));
writeFileSync(join(out, 'deployment-after.svg'), svg(779, 'LiteLLM high-throughput deployment', 'A Kubernetes Service sends requests to four workers in the gateway container. The gateway uses Rust token counting and a shared PgBouncer pool for Postgres. Separate metrics and spend collector containers run in the same pod. Prometheus receives metrics, and the workers and collector use Redis shared state. The collector processes spend after responses and shares the PgBouncer pool. An autoscaler adds whole three-container gateway pods based on requests, tokens, CPU and memory.', after));
