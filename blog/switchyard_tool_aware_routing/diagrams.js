import React from 'react';
import './diagrams.css';

const arrow = (id) =>
  `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" class="s-arrow"/></marker></defs>`;

const wire = (d, id, flow = true) =>
  `<path d="${d}" class="s-wire" marker-end="url(#${id})"/>${flow ? `<path d="${d}" class="s-flow"/>` : ''}`;

const box = (x, y, w, h, title, label, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" class="s-box ${extra}"/>` +
  `<text text-anchor="middle" x="${x + w / 2}" y="${y + h / 2 - 4}" class="s-title">${title}</text>` +
  `<text text-anchor="middle" x="${x + w / 2}" y="${y + h / 2 + 18}" class="s-label">${label}</text>`;

const turn = (y, tool, result, ok) =>
  `<rect x="24" y="${y}" width="250" height="64" rx="8" class="s-box"/>` +
  `<text x="42" y="${y + 27}" class="s-title" style="font-size:15px">${tool}</text>` +
  `<text x="42" y="${y + 48}" class="${ok ? 's-ok' : 's-fail'}">${result}</text>`;

const ROUTING = `
<figure class="uca-figure u8">
<input class="u8-pause" type="checkbox" id="sw-routing-motion"/><label class="u8-control" for="sw-routing-motion">Pause animation</label>
<div class="u8-art">
<div class="u8-head"><span>01 / ROUTING</span><h3>Route by tool execution history</h3><p>Each turn is classified from the tool calls and results that came before it.</p></div>
<div class="u9-scroll" tabindex="0" role="region" aria-label="Agent turns with tool results flow into the Switchyard stage router, which sends routine turns to the efficient model and failed tool calls to the capable model, with an optional judge for ambiguous turns. Scroll horizontally on small screens.">
<svg class="u9-svg" viewBox="0 0 900 430" role="img" aria-label="Agent turns with tool results flow into the Switchyard stage router, which sends routine turns to the efficient model and failed tool calls to the capable model, with an optional judge for ambiguous turns">
${arrow('sw-routing-arrow')}
<text x="24" y="30" class="s-eyebrow">AGENT TURNS</text>
<text x="352" y="30" class="s-eyebrow">CLASSIFY</text>
<text x="652" y="30" class="s-eyebrow">ROUTE</text>
${turn(56, 'read_file src/app.py', '✓ ok', true)}
${turn(146, 'bash pytest -q', '✗ 3 failed, 41 passed', false)}
${turn(236, 'edit utils.py', '✗ string not found ×3', false)}
<rect x="352" y="118" width="210" height="142" rx="10" class="s-box s-accent"/>
<text text-anchor="middle" x="457" y="160" class="s-title">Switchyard</text>
<text text-anchor="middle" x="457" y="182" class="s-title">stage router</text>
<text text-anchor="middle" x="457" y="210" class="s-label">tool calls · results</text>
<text text-anchor="middle" x="457" y="231" class="s-label">failure signals</text>
<rect x="362" y="328" width="190" height="70" rx="8" class="s-judge"/>
<text text-anchor="middle" x="457" y="357" class="s-title" style="font-size:15px">Optional judge</text>
<text text-anchor="middle" x="457" y="379" class="s-small">LLM or decision model</text>
<path d="M457 260V328" class="s-dashwire"/>
<text x="467" y="300" class="s-note">ambiguous turns</text>
${box(652, 66, 224, 84, 'Efficient model', 'routine turns')}
${box(652, 228, 224, 84, 'Capable model', 'failures + recovery', 's-accent')}
${wire('M274 88H312V160H352', 'sw-routing-arrow')}
${wire('M274 178H352', 'sw-routing-arrow')}
${wire('M274 268H312V200H352', 'sw-routing-arrow')}
${wire('M562 160H606V108H652', 'sw-routing-arrow')}
${wire('M562 220H606V270H652', 'sw-routing-arrow')}
</svg>
</div>
<div class="u8-footer"><span>Tool-aware</span><span>Judge optional</span><span>Evidence logged</span></div>
</div>
<figcaption>Illustrative turns. Routine work stays on the efficient model; failed tool calls escalate to the capable model.</figcaption>
</figure>`;

const card = (x, y, title, label, on) =>
  `<rect x="${x}" y="${y}" width="170" height="74" rx="8" class="${on ? 's-card-on' : 's-card'}"/>` +
  `<text x="${x + 16}" y="${y + 31}" class="s-title" style="font-size:15px">${title}</text>` +
  `<text x="${x + 16}" y="${y + 53}" class="s-small">${label}</text>`;

const endpoint = (y, path, client) =>
  `<rect x="660" y="${y}" width="216" height="70" rx="8" class="s-box"/>` +
  `<text x="678" y="${y + 29}" class="s-title" style="font-size:14px;font-family:var(--ifm-font-family-monospace)">${path}</text>` +
  `<text x="678" y="${y + 51}" class="s-small">${client}</text>`;

const SETUP = `
<figure class="uca-figure u8">
<input class="u8-pause" type="checkbox" id="sw-setup-motion"/><label class="u8-control" for="sw-setup-motion">Pause animation</label>
<div class="u8-art">
<div class="u8-head"><span>02 / SETUP</span><h3>Configure once, serve every agent API</h3><p>Pick Switchyard in the dashboard. Every agent calls the same router name.</p></div>
<div class="u9-scroll" tabindex="0" role="region" aria-label="The dashboard strategy picker with Switchyard selected creates one router, which serves chat completions, Anthropic Messages and Responses requests. Scroll horizontally on small screens.">
<svg class="u9-svg" viewBox="0 0 900 360" role="img" aria-label="The dashboard strategy picker with Switchyard selected creates one router, which serves chat completions, Anthropic Messages and Responses requests">
${arrow('sw-setup-arrow')}
<rect x="24" y="30" width="390" height="290" rx="12" class="s-boundary"/>
<text x="44" y="60" class="s-eyebrow">DASHBOARD · ADD AUTO ROUTER</text>
<text x="44" y="92" class="s-title">Choose your routing strategy</text>
${card(44, 116, 'Heuristics', 'Default · local', false)}
${card(226, 116, 'LLM', 'Judge classifies', false)}
${card(44, 208, 'Jev', 'Decision model', false)}
${card(226, 208, 'Switchyard', 'Tool execution history', true)}
<rect x="464" y="140" width="148" height="84" rx="10" class="s-box s-accent"/>
<text text-anchor="middle" x="538" y="176" class="s-title" style="font-size:15px">switchyard-route</text>
<text text-anchor="middle" x="538" y="198" class="s-small">one router name</text>
<text x="660" y="30" class="s-eyebrow">AGENT APIS</text>
${endpoint(48, '/v1/chat/completions', 'OpenAI SDK agents')}
${endpoint(146, '/v1/messages', 'Claude Code')}
${endpoint(244, '/v1/responses', 'Codex')}
${wire('M396 245H430V182H464', 'sw-setup-arrow', false)}
<text x="420" y="270" class="s-note">save</text>
${wire('M660 83H636V168H612', 'sw-setup-arrow')}
${wire('M660 181H612', 'sw-setup-arrow')}
${wire('M660 279H636V196H612', 'sw-setup-arrow')}
</svg>
</div>
<div class="u8-footer"><span>Chat Completions · Anthropic Messages · Responses</span></div>
</div>
<figcaption>Illustrative form. The same router serves agents on all three APIs without client changes.</figcaption>
</figure>`;

const TURNS = [
  { tool: 'read_file', result: '✓', ok: true, capable: false },
  { tool: 'edit', result: '✓', ok: true, capable: false },
  { tool: 'pytest', result: '✗ 3 failed', ok: false, capable: true },
  { tool: 'edit', result: '✓', ok: true, capable: true },
  { tool: 'pytest', result: '✓ passed', ok: true, capable: true },
  { tool: 'read_file', result: '✓', ok: true, capable: false },
];

const turnX = (i) => 150 + i * 132;
const CAPABLE_Y = 200;
const EFFICIENT_Y = 270;

const TIMELINE_SVG = (() => {
  const dots = TURNS.map(
    (t, i) =>
      `<text text-anchor="middle" x="${turnX(i)}" y="70" class="s-title" style="font-size:14px">Turn ${i + 1}</text>` +
      `<text text-anchor="middle" x="${turnX(i)}" y="96" class="s-small">${t.tool}</text>` +
      `<text text-anchor="middle" x="${turnX(i)}" y="118" class="${t.ok ? 's-ok' : 's-fail'}">${t.result}</text>` +
      `<circle cx="${turnX(i)}" cy="${t.capable ? CAPABLE_Y : EFFICIENT_Y}" r="9" class="${t.capable ? 's-dot-on' : 's-dot'}"/>`,
  ).join('');
  const path = TURNS.map((t, i) => `${i ? 'L' : 'M'}${turnX(i)} ${t.capable ? CAPABLE_Y : EFFICIENT_Y}`).join(' ');
  return (
    `<rect x="${turnX(2) - 40}" y="${CAPABLE_Y - 30}" width="${turnX(4) - turnX(2) + 80}" height="60" rx="10" class="s-hold"/>` +
    `<text text-anchor="middle" x="${turnX(3)}" y="${CAPABLE_Y - 38}" class="s-eyebrow">SESSION HOLD</text>` +
    `<path d="M${turnX(0) - 50} ${CAPABLE_Y}H${turnX(5) + 50}" class="s-lane"/>` +
    `<path d="M${turnX(0) - 50} ${EFFICIENT_Y}H${turnX(5) + 50}" class="s-lane"/>` +
    `<text x="20" y="${CAPABLE_Y + 5}" class="s-title" style="font-size:14px">Capable</text>` +
    `<text x="20" y="${EFFICIENT_Y + 5}" class="s-title" style="font-size:14px">Efficient</text>` +
    `<path d="${path}" class="s-path"/><path d="${path}" class="s-flow"/>` +
    dots
  );
})();

const LOG_ROWS = [
  ['1', 'read_file ✓', 'efficient', 'fall_open'],
  ['3', 'pytest ✗', 'capable', 'override'],
  ['4', 'edit ✓', 'capable', 'capable_hold'],
  ['6', 'read_file ✓', 'efficient', 'fall_open'],
];

const SESSIONS = `
<figure class="uca-figure u8">
<input class="u8-pause" type="checkbox" id="sw-session-motion"/><label class="u8-control" for="sw-session-motion">Pause animation</label>
<div class="u8-art">
<div class="u8-head"><span>03 / SESSIONS</span><h3>Session-aware routing you can audit</h3><p>A failure escalates the session. Every pick is logged with its evidence.</p></div>
<div class="u9-scroll" tabindex="0" role="region" aria-label="A six turn session: turns one and two run on the efficient model, a failing test in turn three escalates to the capable model, the session holds on the capable model through turn five, and turn six returns to the efficient model. Scroll horizontally on small screens.">
<svg class="u9-svg" viewBox="0 0 900 310" role="img" aria-label="A six turn session: turns one and two run on the efficient model, a failing test in turn three escalates to the capable model, the session holds on the capable model through turn five, and turn six returns to the efficient model">
${TIMELINE_SVG}
</svg>
</div>
<div class="sw-log">
<div class="sw-log-head">Spend logs · routing decision per turn</div>
<table><thead><tr><th>TURN</th><th>TOOL RESULT</th><th>ROUTED TO</th><th>EVIDENCE</th></tr></thead><tbody>
${LOG_ROWS.map(([n, tool, model, evidence]) => `<tr><td>${n}</td><td>${tool}</td><td class="${model === 'capable' ? 'sw-cap' : ''}">${model}</td><td><code>${evidence}</code></td></tr>`).join('')}
</tbody></table>
</div>
<div class="u8-footer"><span>Session holds</span><span>Per-key isolation</span><span>Logged evidence</span></div>
</div>
<figcaption>Illustrative session. Evidence values match what the router records in spend logs.</figcaption>
</figure>`;

export function RoutingFlow() {
  return <div dangerouslySetInnerHTML={{ __html: ROUTING }} />;
}

export function SetupToRequest() {
  return <div dangerouslySetInnerHTML={{ __html: SETUP }} />;
}

export function SessionTimeline() {
  return <div dangerouslySetInnerHTML={{ __html: SESSIONS }} />;
}
