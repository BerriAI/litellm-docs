import React from 'react';
import './diagrams.css';

const formImage = require('./auto_router_form.png');
const formSet = (formImage?.default ?? formImage)?.src;
const formShot =
  formSet?.images?.reduce((best, image) => (image.width > best.width ? image : best))?.path ?? formSet?.src ?? formImage;

const arrow = (id) =>
  `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" class="s-arrow"/></marker></defs>`;

const chip = (x, y, w, tool, result, ok) =>
  `<rect x="${x}" y="${y}" width="${w}" height="54" rx="8" class="${ok ? 's-box' : 's-box s-failbox'}"/>` +
  `<text x="${x + 14}" y="${y + 23}" class="s-mono">${tool}</text>` +
  `<text x="${x + 14}" y="${y + 43}" class="${ok ? 's-ok' : 's-fail'}">${result}</text>`;

const lane = (y, chips) => chips.map(([tool, result, ok], i) => chip(24 + i * 132, y, 120, tool, result, ok)).join('');

const ROUTING = `
<figure class="uca-figure u8">
<input class="u8-pause" type="checkbox" id="sw-routing-motion"/><label class="u8-control" for="sw-routing-motion">Pause animation</label>
<div class="u8-art">
<div class="u8-head"><span>01 / ROUTING</span><h3>Route by tool execution history</h3><p>Clean tool results stay on the efficient model. Failures escalate to the capable model.</p></div>
<div class="u9-scroll" tabindex="0" role="region" aria-label="Two agent sessions pass through the Switchyard stage router. A session whose tool calls succeed is routed to the efficient model, Claude Haiku. A session whose test run fails is escalated to the capable model, Claude Opus. Scroll horizontally on small screens.">
<svg class="u9-svg" viewBox="0 0 900 330" role="img" aria-label="Two agent sessions pass through the Switchyard stage router. A session whose tool calls succeed is routed to the efficient model, Claude Haiku. A session whose test run fails is escalated to the capable model, Claude Opus.">
${arrow('sw-ok-arrow')}${arrow('sw-fail-arrow').replace('class="s-arrow"', 'class="s-arrow-fail"')}
<text x="24" y="30" class="s-eyebrow">TOOL EXECUTION HISTORY</text>
<text x="464" y="30" class="s-eyebrow">SWITCHYARD</text>
<text x="676" y="30" class="s-eyebrow">ROUTED TO</text>
${lane(56, [['read_file', '✓ ok', true], ['edit', '✓ applied', true], ['pytest', '✓ 44 passed', true]])}
${lane(218, [['edit', '✓ applied', true], ['pytest', '✗ 3 failed', false], ['edit', '✗ not found ×2', false]])}
<rect x="464" y="96" width="166" height="160" rx="12" class="s-box s-accent"/>
<text text-anchor="middle" x="547" y="148" class="s-title">Stage</text>
<text text-anchor="middle" x="547" y="170" class="s-title">router</text>
<text text-anchor="middle" x="547" y="198" class="s-small">reads results,</text>
<text text-anchor="middle" x="547" y="216" class="s-small">errors, retries</text>
<rect x="676" y="44" width="200" height="78" rx="10" class="s-box"/>
<text x="696" y="76" class="s-title">Claude Haiku</text>
<text x="696" y="100" class="s-ok">efficient · routine turn</text>
<rect x="676" y="206" width="200" height="78" rx="10" class="s-box s-failbox"/>
<text x="696" y="238" class="s-title">Claude Opus</text>
<text x="696" y="262" class="s-fail">capable · escalated</text>
<path d="M408 83H436V136H464" class="s-wire" marker-end="url(#sw-ok-arrow)"/><path d="M408 83H436V136H464" class="s-flow"/>
<path d="M408 245H436V216H464" class="s-wire" marker-end="url(#sw-fail-arrow)"/><path d="M408 245H436V216H464" class="s-flow s-flow-fail"/>
<path d="M630 136H652V83H676" class="s-wire" marker-end="url(#sw-ok-arrow)"/><path d="M630 136H652V83H676" class="s-flow"/>
<path d="M630 216H652V245H676" class="s-wire" marker-end="url(#sw-fail-arrow)"/><path d="M630 216H652V245H676" class="s-flow s-flow-fail"/>
<text x="24" y="314" class="s-note">Ambiguous turns can go to an optional LLM judge or decision model before routing.</text>
</svg>
</div>
<div class="u8-footer"><span>Success → efficient</span><span>Failure → capable</span><span>Every pick logged</span></div>
</div>
<figcaption>Illustrative sessions. Switchyard scores each turn from the tool calls and results before it.</figcaption>
</figure>`;

const STEPS = [
  { n: 1, x: 96, y: 25, title: 'Pick Switchyard', text: 'Choose it next to Heuristics, LLM and Decisions Model.' },
  { n: 2, x: 49, y: 51, title: 'Choose two models', text: 'A capable model for hard turns, an efficient one for routine work.' },
  { n: 3, x: 91, y: 66, title: 'Add a judge (optional)', text: 'An LLM or decision model settles turns the tool history leaves unclear.' },
];

export function RoutingFlow() {
  return <div dangerouslySetInnerHTML={{ __html: ROUTING }} />;
}

export function ConfigureRouter() {
  return (
    <figure className="uca-figure u8 sw-center">
      <div className="u8-art">
        <div className="u8-head">
          <span>02 / SETUP</span>
          <h3>Enable it from the Auto Router form</h3>
          <p>Models → Auto-Routers → Add Auto Router.</p>
        </div>
        <div className="sw-setup">
          <div className="sw-shot">
            <img src={formShot} alt="The Add Auto Router form with the Switchyard strategy selected, Claude Opus as the capable model and Claude Haiku as the efficient model" />
            {STEPS.map((s) => (
              <span key={s.n} className="sw-pin" style={{ left: `${s.x}%`, top: `${s.y}%` }}>{s.n}</span>
            ))}
          </div>
          <ol className="sw-steps">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="sw-step-n">{s.n}</span>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="u8-footer"><span>Save, then call the router by name from any agent</span></div>
      </div>
      <figcaption>The Add Auto Router form in the LiteLLM dashboard.</figcaption>
    </figure>
  );
}

const TURNS = [
  { tool: 'read_file', result: '✓', ok: true, capable: false },
  { tool: 'edit', result: '✓', ok: true, capable: false },
  { tool: 'pytest', result: '✗ 3 failed', ok: false, capable: true },
  { tool: 'edit', result: '✓', ok: true, capable: true },
  { tool: 'pytest', result: '✓ passed', ok: true, capable: true },
  { tool: 'read_file', result: '✓', ok: true, capable: false },
];

const turnX = (i) => 170 + i * 128;
const CAPABLE_Y = 196;
const EFFICIENT_Y = 266;

const TIMELINE_SVG = (() => {
  const marks = TURNS.map(
    (t, i) =>
      `<text text-anchor="middle" x="${turnX(i)}" y="62" class="s-title" style="font-size:14px">Turn ${i + 1}</text>` +
      `<text text-anchor="middle" x="${turnX(i)}" y="86" class="s-mono" style="font-size:12px">${t.tool}</text>` +
      `<text text-anchor="middle" x="${turnX(i)}" y="108" class="${t.ok ? 's-ok' : 's-fail'}">${t.result}</text>` +
      `<circle cx="${turnX(i)}" cy="${t.capable ? CAPABLE_Y : EFFICIENT_Y}" r="9" class="${t.capable ? 's-dot-on' : 's-dot'}"/>`,
  ).join('');
  const path = TURNS.map((t, i) => `${i ? 'L' : 'M'}${turnX(i)} ${t.capable ? CAPABLE_Y : EFFICIENT_Y}`).join(' ');
  return (
    `<rect x="${turnX(2) - 44}" y="${CAPABLE_Y - 30}" width="${turnX(4) - turnX(2) + 88}" height="60" rx="10" class="s-hold"/>` +
    `<text text-anchor="middle" x="${turnX(3)}" y="${CAPABLE_Y - 40}" class="s-eyebrow">SESSION HOLD</text>` +
    `<path d="M${turnX(0) - 50} ${CAPABLE_Y}H${turnX(5) + 50}" class="s-lane"/>` +
    `<path d="M${turnX(0) - 50} ${EFFICIENT_Y}H${turnX(5) + 50}" class="s-lane"/>` +
    `<text x="16" y="${CAPABLE_Y + 5}" class="s-title" style="font-size:14px">Claude Opus</text>` +
    `<text x="16" y="${EFFICIENT_Y + 5}" class="s-title" style="font-size:14px">Claude Haiku</text>` +
    `<path d="${path}" class="s-path"/><path d="${path}" class="s-flow"/>` +
    marks
  );
})();

const TRACE = [
  ['1', 'read_file ✓', 'claude-haiku', 'fall_open'],
  ['2', 'edit ✓', 'claude-haiku', 'fall_open'],
  ['3', 'pytest ✗ 3 failed', 'claude-opus', 'override'],
  ['4', 'edit ✓', 'claude-opus', 'capable_hold'],
  ['5', 'pytest ✓', 'claude-opus', 'capable_hold'],
  ['6', 'read_file ✓', 'claude-haiku', 'fall_open'],
];

const SESSIONS = `
<figure class="uca-figure u8">
<input class="u8-pause" type="checkbox" id="sw-session-motion"/><label class="u8-control" for="sw-session-motion">Pause animation</label>
<div class="u8-art">
<div class="u8-head"><span>03 / SESSIONS</span><h3>Session-aware routing you can trace</h3><p>A failure escalates the session and holds it on the capable model while it recovers.</p></div>
<div class="u9-scroll" tabindex="0" role="region" aria-label="A six turn session: turns one and two run on Claude Haiku, a failing test in turn three escalates to Claude Opus, the session holds on Opus through turn five, and turn six returns to Haiku. Scroll horizontally on small screens.">
<svg class="u9-svg" viewBox="0 0 900 300" role="img" aria-label="A six turn session: turns one and two run on Claude Haiku, a failing test in turn three escalates to Claude Opus, the session holds on Opus through turn five, and turn six returns to Haiku">
${TIMELINE_SVG}
</svg>
</div>
<div class="sw-log">
<div class="sw-log-head">Session trace · session_id agent-7f3a</div>
<table><thead><tr><th>TURN</th><th>TOOL RESULT</th><th>ROUTED TO</th><th>EVIDENCE</th></tr></thead><tbody>
${TRACE.map(([n, tool, model, evidence]) => `<tr><td>${n}</td><td>${tool}</td><td class="${model === 'claude-opus' ? 'sw-cap' : ''}">${model}</td><td><code>${evidence}</code></td></tr>`).join('')}
</tbody></table>
</div>
<div class="u8-footer"><span>Escalate on failure</span><span>Hold while recovering</span><span>Return when routine</span></div>
</div>
<figcaption>Illustrative session. The evidence column uses the values Switchyard records for each decision.</figcaption>
</figure>`;

export function SessionTimeline() {
  return <div dangerouslySetInnerHTML={{ __html: SESSIONS }} />;
}
