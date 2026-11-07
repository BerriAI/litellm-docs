import React from 'react';
import './diagrams.css';

const imageUrl = (mod) => {
  const set = (mod?.default ?? mod)?.src;
  return set?.images?.reduce((best, image) => (image.width > best.width ? image : best))?.path ?? set?.src ?? mod;
};

const arrow = (id, cls = 's-arrow') =>
  `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" class="${cls}"/></marker></defs>`;

const chip = (x, y, w, tool, result, ok) =>
  `<rect x="${x}" y="${y}" width="${w}" height="54" rx="8" class="${ok ? 's-box' : 's-box s-failbox'}"/>` +
  `<text x="${x + 14}" y="${y + 23}" class="s-mono">${tool}</text>` +
  `<text x="${x + 14}" y="${y + 43}" class="${ok ? 's-ok' : 's-fail'}">${result}</text>`;

const lane = (y, chips) => chips.map(([tool, result, ok], i) => chip(24 + i * 132, y, 120, tool, result, ok)).join('');

const ROUTING = `
<figure class="uca-figure u8">
<input class="u8-pause" type="checkbox" id="sw-routing-motion"/><label class="u8-control" for="sw-routing-motion">Pause animation</label>
<div class="u8-art">
<div class="u8-head"><span>01 / ROUTING</span><h3>Steer the session by its tool trajectory</h3><p>Switchyard scores the session’s recent tool history and steers each turn to the model the work needs.</p></div>
<div class="u9-scroll" tabindex="0" role="region" aria-label="Two agent sessions pass through the Switchyard stage router. A session exploring cleanly stays on the efficient model, Claude Haiku. A session stuck on a failing step is escalated to the capable model, Claude Opus. Scroll horizontally on small screens.">
<svg class="u9-svg" viewBox="0 0 900 340" role="img" aria-label="Two agent sessions pass through the Switchyard stage router. A session exploring cleanly stays on the efficient model, Claude Haiku. A session stuck on a failing step is escalated to the capable model, Claude Opus.">
${arrow('sw-ok-arrow')}${arrow('sw-fail-arrow', 's-arrow-fail')}
<text x="24" y="30" class="s-eyebrow">SESSION TRAJECTORY</text>
<text x="464" y="30" class="s-eyebrow">SWITCHYARD</text>
<text x="676" y="30" class="s-eyebrow">STEERED TO</text>
<text x="24" y="54" class="s-small">Exploring cleanly</text>
${lane(64, [['read_file', '✓ ok', true], ['edit', '✓ applied', true], ['pytest', '✓ 44 passed', true]])}
<text x="24" y="218" class="s-small">Stuck on a failing step</text>
${lane(228, [['edit', '✓ applied', true], ['pytest', '✗ 3 failed', false], ['edit', '✗ not found ×2', false]])}
<rect x="464" y="100" width="166" height="166" rx="12" class="s-box s-accent"/>
<text text-anchor="middle" x="547" y="152" class="s-title">Stage</text>
<text text-anchor="middle" x="547" y="174" class="s-title">router</text>
<text text-anchor="middle" x="547" y="202" class="s-small">severity · retries</text>
<text text-anchor="middle" x="547" y="220" class="s-small">recovery · holds</text>
<rect x="676" y="52" width="200" height="78" rx="10" class="s-box"/>
<text x="696" y="84" class="s-title">Claude Haiku</text>
<text x="696" y="108" class="s-ok">efficient · stays put</text>
<rect x="676" y="216" width="200" height="78" rx="10" class="s-box s-failbox"/>
<text x="696" y="248" class="s-title">Claude Opus</text>
<text x="696" y="272" class="s-fail">capable · escalated</text>
<path d="M408 91H436V140H464" class="s-wire" marker-end="url(#sw-ok-arrow)"/><path d="M408 91H436V140H464" class="s-flow"/>
<path d="M408 255H436V226H464" class="s-wire" marker-end="url(#sw-fail-arrow)"/><path d="M408 255H436V226H464" class="s-flow s-flow-fail"/>
<path d="M630 140H652V91H676" class="s-wire" marker-end="url(#sw-ok-arrow)"/><path d="M630 140H652V91H676" class="s-flow"/>
<path d="M630 226H652V255H676" class="s-wire" marker-end="url(#sw-fail-arrow)"/><path d="M630 226H652V255H676" class="s-flow s-flow-fail"/>
<text x="24" y="324" class="s-note">Turns the trajectory leaves unclear can go to an optional LLM judge or decision model.</text>
</svg>
</div>
<div class="u8-footer"><span>Reads the trajectory</span><span>Steers the session</span><span>Explains every pick</span></div>
</div>
<figcaption>Illustrative sessions. Each turn is scored against the session’s recent tool calls and results.</figcaption>
</figure>`;

const STEPS = [
  {
    n: 1,
    title: 'Pick Switchyard',
    text: 'It sits next to Heuristics, LLM and Decisions Model in the strategy picker.',
    image: imageUrl(require('./form_step_strategy.png')),
    box: { left: 75.0, top: 29.5, width: 23.6, height: 65.5 },
  },
  {
    n: 2,
    title: 'Choose your models',
    text: 'A capable model for the hard stretches, an efficient model for everything else.',
    image: imageUrl(require('./form_step_models.png')),
    box: { left: 1.0, top: 51.5, width: 98.0, height: 45.5 },
  },
  {
    n: 3,
    title: 'Add a judge (optional)',
    text: 'An LLM or decision model settles the turns the trajectory leaves unclear.',
    image: imageUrl(require('./form_step_judge.png')),
    box: { left: 1.0, top: 1.5, width: 98.0, height: 44.0 },
  },
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
          <h3>Three steps in the Auto Router form</h3>
          <p>Models → Auto-Routers → Add Auto Router</p>
        </div>
        <ol className="sw-stepper">
          {STEPS.map((s) => (
            <li key={s.n}>
              <div className="sw-step-copy">
                <span className="sw-step-n">{s.n}</span>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.text}</p>
                </div>
              </div>
              <div className="sw-crop">
                <img src={s.image} alt={`Add Auto Router form, step ${s.n}: ${s.title}`} loading="lazy" />
                <span
                  className="sw-box"
                  style={{ left: `${s.box.left}%`, top: `${s.box.top}%`, width: `${s.box.width}%`, height: `${s.box.height}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
        <div className="u8-footer"><span>Save, then call the router by name from any agent</span></div>
      </div>
      <figcaption>Crops of the Add Auto Router form in the LiteLLM dashboard.</figcaption>
    </figure>
  );
}

const TURNS = [
  { tool: 'read_file', result: '✓', ok: true, capable: false, severity: 0 },
  { tool: 'edit', result: '✓', ok: true, capable: false, severity: 0 },
  { tool: 'pytest', result: '✗ 3 failed', ok: false, capable: true, severity: 0.7 },
  { tool: 'edit', result: '✓', ok: true, capable: true, severity: 0.7 },
  { tool: 'pytest', result: '✓ passed', ok: true, capable: true, severity: 0.35 },
  { tool: 'read_file', result: '✓', ok: true, capable: false, severity: 0 },
];

const turnX = (i) => 190 + i * 124;
const CAPABLE_Y = 188;
const EFFICIENT_Y = 258;
const STRIP_BASE = 352;
const STRIP_MAX = 46;

const TIMELINE_SVG = (() => {
  const marks = TURNS.map(
    (t, i) =>
      `<text text-anchor="middle" x="${turnX(i)}" y="40" class="s-title" style="font-size:14px">Turn ${i + 1}</text>` +
      `<text text-anchor="middle" x="${turnX(i)}" y="64" class="s-mono" style="font-size:12px">${t.tool}</text>` +
      `<text text-anchor="middle" x="${turnX(i)}" y="86" class="${t.ok ? 's-ok' : 's-fail'}">${t.result}</text>` +
      `<circle cx="${turnX(i)}" cy="${t.capable ? CAPABLE_Y : EFFICIENT_Y}" r="9" class="${t.capable ? 's-dot-on' : 's-dot'}"/>` +
      `<rect x="${turnX(i) - 28}" y="${STRIP_BASE - STRIP_MAX}" width="56" height="${STRIP_MAX}" rx="5" class="s-sev-track"/>` +
      (t.severity
        ? `<rect x="${turnX(i) - 28}" y="${STRIP_BASE - STRIP_MAX * t.severity}" width="56" height="${STRIP_MAX * t.severity}" rx="5" class="s-sev"/>`
        : ''),
  ).join('');
  const path = TURNS.map((t, i) => `${i ? 'L' : 'M'}${turnX(i)} ${t.capable ? CAPABLE_Y : EFFICIENT_Y}`).join(' ');
  const phase = (x, y, label, cls = '') =>
    `<text text-anchor="middle" x="${x}" y="${y}" class="s-phase ${cls}">${label}</text>`;
  return (
    `<rect x="${turnX(2) - 44}" y="${CAPABLE_Y - 30}" width="${turnX(4) - turnX(2) + 88}" height="60" rx="10" class="s-hold"/>` +
    `<path d="M${turnX(0) - 56} ${CAPABLE_Y}H${turnX(5) + 50}" class="s-lane"/>` +
    `<path d="M${turnX(0) - 56} ${EFFICIENT_Y}H${turnX(5) + 50}" class="s-lane"/>` +
    `<text x="16" y="${CAPABLE_Y + 5}" class="s-title" style="font-size:14px">Claude Opus</text>` +
    `<text x="16" y="${EFFICIENT_Y + 5}" class="s-title" style="font-size:14px">Claude Haiku</text>` +
    `<text x="16" y="${STRIP_BASE - 26}" class="s-eyebrow">SIGNAL</text>` +
    `<text x="16" y="${STRIP_BASE - 10}" class="s-small">window severity</text>` +
    `<path d="${path}" class="s-path"/><path d="${path}" class="s-flow"/>` +
    phase(turnX(2), CAPABLE_Y - 40, 'ESCALATE', 's-phase-fail') +
    phase((turnX(3) + turnX(4)) / 2, CAPABLE_Y - 40, 'HOLD WHILE RECOVERING') +
    phase(turnX(5), EFFICIENT_Y + 34, 'STEP DOWN') +
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
<div class="u8-head"><span>03 / TRAJECTORY-AWARE ROUTING</span><h3>Escalate, hold, step down</h3><p>Failure signals persist over a rolling window, so the session holds on the capable model until the trajectory stabilizes.</p></div>
<div class="u9-scroll" tabindex="0" role="region" aria-label="A six turn session: turns one and two run on Claude Haiku, a failing test in turn three escalates to Claude Opus, the failure signal persists through the recovery window and the session holds on Opus through turn five, and turn six steps down to Haiku. Scroll horizontally on small screens.">
<svg class="u9-svg" viewBox="0 0 900 370" role="img" aria-label="A six turn session: turns one and two run on Claude Haiku, a failing test in turn three escalates to Claude Opus, the failure signal persists through the recovery window and the session holds on Opus through turn five, and turn six steps down to Haiku">
${TIMELINE_SVG}
</svg>
</div>
<div class="sw-log">
<div class="sw-log-head">Session trace · session_id agent-7f3a</div>
<table><thead><tr><th>TURN</th><th>TOOL RESULT</th><th>STEERED TO</th><th>EVIDENCE</th></tr></thead><tbody>
${TRACE.map(([n, tool, model, evidence]) => `<tr><td>${n}</td><td>${tool}</td><td class="${model === 'claude-opus' ? 'sw-cap' : ''}">${model}</td><td><code>${evidence}</code></td></tr>`).join('')}
</tbody></table>
</div>
<div class="u8-footer"><span>Rolling signal window</span><span>Escalation holds</span><span>Per-key session state</span></div>
</div>
<figcaption>Illustrative session. The evidence column uses the values Switchyard records for each decision.</figcaption>
</figure>`;

export function SessionTimeline() {
  return <div dangerouslySetInnerHTML={{ __html: SESSIONS }} />;
}
