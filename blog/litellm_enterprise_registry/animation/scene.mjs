import fs from 'node:fs';

export const WIDTH = 1600;
export const HEIGHT = 800;
export const FPS = 25;
export const DURATION = 10;
export const POSTER_TIME = 4.7;

const clamp = t => Math.max(0, Math.min(1, t));
const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const ramp = (t, a, b) => ease((t - a) / (b - a));
const mix = (a, b, u) => a + (b - a) * u;
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const color = (a, b, u) => {
  const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${rgb(a).map((v, i) => Math.round(mix(v, rgb(b)[i], clamp(u)))).join(',')})`;
};
const line = (d, stroke, width = 1, opacity = 1, extra = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const assets = Object.fromEntries(['litellm'].map(name => {
  const svg = fs.readFileSync(new URL(`./assets/${name}.svg`, import.meta.url), 'utf8');
  const tag = svg.match(/<svg\b([^>]*)>([\s\S]*)<\/svg>/);
  return [name, {viewBox: tag[1].match(/viewBox="([^"]+)"/)[1], inner: tag[2]}];
}));
function icon(name, x, y, size) {
  const prefix = `${name}-${x}-${y}-`;
  const art = assets[name].inner.replace(/id="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`).replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`);
  return `<svg x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" viewBox="${assets[name].viewBox}">${art}</svg>`;
}

// A dense, seeded fleet. Every glyph is one pod, not one network request.
const shades = ['#5363D6', '#7483E5', '#9BA9EF', '#394FC5', '#9D9AE0', '#6B86BA', '#58B4CA', '#B5C4ED', '#7F9CDA', '#5153A7'];
export const PODS = [];
for (let row = 0; row < 33; row++) {
  for (let col = 0; col < 33; col++) {
    const n = row * 33 + col;
    const x = 780 + col * 22.1 + (row % 2) * 11 + (hash(n + 19) - .5) * 4;
    const y = 67 + row * 21 + (hash(n + 27) - .5) * 4;
    // A broken, organic field uses the whole right half, with small islands
    // and breathing room instead of a closed perimeter around the cluster.
    const field = .59 + .18 * Math.sin(col * .39 + row * .19)
      + .16 * Math.cos(row * .43 - col * .21) + .13 * row / 32;
    const edge = Math.min(1, (col + 1) / 4, (34 - col) / 4, (row + 2) / 4, (34 - row) / 4);
    const left = .45 + .55 * clamp((col + row * .14) / 8);
    if (hash(n + 73) > field * edge * left) continue;
    PODS.push({x, y, r: 7.7 + hash(n + 11) * 2.7, seed: n, fill: shades[Math.floor(hash(n + 9) * shades.length)]});
  }
}
function hex(x, y, r) {
  return `M${x} ${y - r}L${x + r * .866} ${y - r * .5}V${y + r * .5}L${x} ${y + r}L${x - r * .866} ${y + r * .5}V${y - r * .5}Z`;
}
function pod(p, t, glowOnly = false) {
  const distance = Math.hypot((p.x - 850), (p.y - 435) * .92);
  const arrival = 3.45 + distance / 235 + hash(p.seed + 4) * .18;
  const age = t - arrival;
  const peak = Math.exp(-(((age - .36) / .29) ** 2));
  const cycle = age > 0 && age < 1.1 ? (.5 + .5 * Math.sin(age * Math.PI * 3.4)) * Math.sin(age / 1.1 * Math.PI) : 0;
  const reset = 1 - ramp(t, 8.65, 9.65);
  const pulse = Math.max(peak, cycle * .58) * reset;
  const deployed = ramp(age, .35, .95) * reset;
  if (glowOnly) return pulse > .04 ? `<circle cx="${p.x}" cy="${p.y}" r="${16 + pulse * 6}" fill="#61CFF4" opacity="${pulse * .48}"/>` : '';
  const rest = color(p.fill, '#63B8DE', deployed * .3);
  const fill = pulse > .01 ? color(p.fill, '#D8FAFF', pulse * .88) : rest;
  const size = p.r * (1 + pulse * .095);
  let s = `<path d="${hex(p.x, p.y, size)}" fill="${fill}" stroke="${pulse > .25 ? '#BEF8FF' : '#AABCF1'}" stroke-width="${.5 + pulse * 1.2}"/>`;
  // Small facets, ports, and status marks vary by workload without adding lettering.
  s += line(`M${p.x - 4.8} ${p.y - 4.2}h9.6`, '#EBF6FF', .8, .25 + pulse * .6);
  if (p.seed % 4 === 0) s += line(`M${p.x - 3} ${p.y - 1}l3 2 -3 2M${p.x + 2} ${p.y + 3}h3`, '#EAF9FF', .85, .68);
  else if (p.seed % 4 === 1) s += `<rect x="${p.x - 3.8}" y="${p.y - 1}" width="7.6" height="4.8" rx=".8" fill="#DCEBFF" opacity=".48"/>`;
  else s += line(`M${p.x - 4} ${p.y + 1}h${p.seed % 3 + 3}M${p.x + 2} ${p.y + 1}h2`, '#DBF4FF', 1.4, .68);
  if (deployed > .5) s += `<circle cx="${p.x}" cy="${p.y + 6}" r="1" fill="#DCFFF6"/>`;
  return s;
}

// The source is just the LiteLLM mark; its own negative space stays white.
function registry() {
  return '<rect x="236" y="164" width="128" height="128" rx="13" fill="#FFFFFF"/>'
    + icon('litellm', 300, 228, 128);
}

const START = [366, 270], END = [1200, 525];
const length = Math.hypot(END[0] - START[0], END[1] - START[1]);
const angle = Math.atan2(END[1] - START[1], END[0] - START[0]) * 180 / Math.PI;
function beam(t) {
  const travel = clamp((t - .85) / 4.7);
  const active = ramp(t, .6, 1.25) * (1 - ramp(t, 5.0, 5.8));
  if (active < .001) return '';
  const center = length * travel;
  const width = 48 + 48 * travel;
  // Only light moves. There is no persistent cone, track, or connection line.
  return `<g transform="translate(${START}) rotate(${angle})" opacity="${active}">
    <ellipse cx="${center}" cy="0" rx="175" ry="${width}" fill="url(#beam-bloom)"/>
    <ellipse cx="${center - 60}" cy="0" rx="205" ry="${width * .72}" fill="url(#beam-bloom)" opacity=".48"/>
    <ellipse cx="${center + 18}" cy="0" rx="85" ry="${width * .29}" fill="url(#beam-core)"/>
  </g>`;
}
export function frame(seconds) {
  const t = ((seconds % DURATION) + DURATION) % DURATION;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><title>LiteLLM Enterprise Registry image pull and rolling deployment</title><desc>A broad, slowly traveling pulse of light leaves the LiteLLM mark and reaches an organic field of ${PODS.length} varied gateway pods spread over the right half. Each workload lights up in a staggered rolling deployment.</desc><defs>
    <radialGradient id="beam-bloom"><stop stop-color="#BAEFFF" stop-opacity=".8"/><stop offset=".25" stop-color="#65C6F4" stop-opacity=".62"/><stop offset=".55" stop-color="#567DEB" stop-opacity=".3"/><stop offset="1" stop-color="#5877EB" stop-opacity="0"/></radialGradient>
    <radialGradient id="beam-core"><stop stop-color="#E0FCFF" stop-opacity=".92"/><stop offset=".4" stop-color="#8EE5FF" stop-opacity=".62"/><stop offset="1" stop-color="#72C8FF" stop-opacity="0"/></radialGradient>
    <filter id="fleet-glow" x="-25%" y="-40%" width="150%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>`;
  s += beam(t);
  s += `<g filter="url(#fleet-glow)">${PODS.map(p => pod(p, t, true)).join('')}</g>`;
  s += PODS.map(p => pod(p, t)).join('');
  s += registry(t);
  return s + '</svg>';
}
