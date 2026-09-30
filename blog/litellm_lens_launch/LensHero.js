import React, {useEffect, useRef} from 'react';

// Hero for the LiteLLM Lens launch post. Agent swarms on the left, every call pinched through the
// gateway, one trace out, and the insight loop flowing back into the gateway. Colors are CSS
// variables on .lens-hero, which follow Docusaurus' [data-theme] light / dark switch.
const css = `
.lens-hero { --bg: #ffffff; --fg: #12142b; --muted: #6b6f8c; --faint: rgba(18,20,43,0.075); --gate: #0017b7;
  position: relative; width: 100%; aspect-ratio: 16 / 8.2; margin: 0.5rem 0 2rem; }
[data-theme='dark'] .lens-hero { --bg: #1b1b1d; --fg: #eceefe; --muted: #9296b8; --faint: rgba(236,238,254,0.07); --gate: #7085ff; }
.lens-hero canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.lens-hero .tag { position: absolute; font-family: var(--ifm-font-family-monospace); font-size: 12px; line-height: 1.35;
  color: var(--muted); background: color-mix(in srgb, var(--bg) 84%, transparent); padding: 3px 6px; border-radius: 3px;
  white-space: nowrap; pointer-events: none; }
.lens-hero .tag b { display: block; color: var(--fg); font-weight: 500; }
.lens-hero .tag.blue b { color: var(--gate); }
.lens-hero .t-swarm { left: 0; top: 0; }
.lens-hero .t-gate { left: 46%; top: 16%; transform: translateX(-50%); text-align: center; }
.lens-hero .t-out { right: 0; top: 22%; text-align: right; }
.lens-hero .t-loop { left: 71.5%; bottom: 2%; transform: translateX(-50%); text-align: center; }
.lens-hero .t-run { left: 71.5%; top: 60%; transform: translateX(-50%); text-align: center; font-variant-numeric: tabular-nums; }
@media (max-width: 640px) { .lens-hero .tag { font-size: 10px; } .lens-hero .t-out, .lens-hero .t-swarm { display: none; } }
`;

// Palette index: 1..4 agent kinds, 5 LLM, 6 tool, 7 failure, 8 insight (theme blue)
const BASE_COLORS = ['#2aa889', '#8b5cf6', '#ec6f93', '#27b6e8', '#e3a42b', '#f28bb0', '#48c7f0', '#e5484d', '#0017b7'];
const GATE_X = 0.46, END_X = 0.975, GATE_Y = 0.42;
const CYCLE = 12; // seconds per run
const RUN_LABELS = ['failures: many', 'failures: fewer', 'failures: rare', 'failures: none'];
const COLONY_Y = [0.08, 0.24, 0.4, 0.56, 0.72, 0.88];

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

// 900 agents, each a small comet of dots: the head is the agent, the tail is its LLM and tool calls.
const AGENTS = Array.from({length: 900}, (_, n) => ({
  y0: 0.02 + hash(n, 1) * 0.96,
  phase: hash(n, 2),
  speed: 0.055 + hash(n, 3) * 0.05,
  colony: Math.floor(hash(n, 4) * 6),
  kind: 1 + Math.floor(hash(n, 5) * 4),
  wob: 0.012 + hash(n, 6) * 0.022,
  tail: 3 + Math.floor(hash(n, 7) * 5),
}));

function startField(stage, canvas, runTag) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = [...BASE_COLORS];
  let W = 0, H = 0, cell = 5.5, cols = 0, rows = 0, faint = '';
  let colorGrid = new Int8Array(0), alphaGrid = new Float32Array(0), bigGrid = new Uint8Array(0);
  let rafId = 0, stopped = false, lastRun = -1;

  function resize() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cell = W < 560 ? 4.5 : 5.5;
    cols = Math.ceil(W / cell); rows = Math.ceil(H / cell);
    colorGrid = new Int8Array(cols * rows); alphaGrid = new Float32Array(cols * rows); bigGrid = new Uint8Array(cols * rows);
    const cs = window.getComputedStyle(stage);
    faint = cs.getPropertyValue('--faint').trim();
    COLORS[8] = cs.getPropertyValue('--gate').trim() || BASE_COLORS[8];
  }

  function put(i, j, color, alpha, big = 0) {
    if (i < 0 || j < 0 || i >= cols || j >= rows) return;
    const k = j * cols + i;
    colorGrid[k] = color + 1; alphaGrid[k] = alpha; if (big) bigGrid[k] = 1;
  }

  function agentPos(a, u, t) {
    const pull = Math.pow(smooth((u - 0.3) / 0.7), 1.6);
    const mid = a.y0 + (COLONY_Y[a.colony] - a.y0) * smooth(u / 0.35);
    const wob = a.wob * Math.sin(u * 14 + a.phase * 20 + t * 0.9) * (1 - pull);
    return {nx: u * GATE_X, ny: mid + (GATE_Y - mid) * pull + wob};
  }

  function drawSwarm(t, failRate) {
    for (let n = 0; n < AGENTS.length; n++) {
      const a = AGENTS[n];
      const u = (a.phase + t * a.speed) % 1;
      for (let k = 0; k <= a.tail; k++) {
        const uk = u - k * 0.009;
        if (uk < 0) break;
        const {nx, ny} = agentPos(a, uk, t);
        let color = a.kind;
        if (k > 0) {
          const roll = hash(n * 31 + k, Math.floor(t * a.speed * 40));
          color = roll < failRate ? 7 : roll < 0.4 ? 5 : roll < 0.62 ? 6 : a.kind;
        }
        put(Math.round((nx * W) / cell), Math.round((ny * H) / cell), color, k === 0 ? 1 : 0.9 - (k / a.tail) * 0.45);
      }
    }
  }

  function drawTrace(t, failRate) {
    const iGate = Math.ceil((GATE_X * W) / cell), iEnd = Math.floor((END_X * W) / cell);
    for (let i = iGate; i <= iEnd; i++) {
      const nx = (i * cell + cell / 2) / W;
      const k = (nx - GATE_X) / (END_X - GATE_X);
      const half = 0.02 + 0.04 * Math.sqrt(k);
      const cy = GATE_Y - 0.03 * Math.sin(k * 3.1) + 0.008 * Math.sin(nx * 22 + t);
      const jc = (cy * H) / cell;
      const span = Math.ceil((half * H) / cell);
      for (let d = -span; d <= span; d++) {
        const j = Math.round(jc + d);
        const flow = Math.floor(i - t * 9);
        if (hash(flow, j) < 0.1 + 0.5 * (Math.abs(d) / span)) continue;
        const roll = hash(flow + 7, j + 3);
        const color = roll < failRate * 0.6 ? 7 : roll < 0.3 ? 5 : roll < 0.5 ? 6 : 1 + (Math.floor(roll * 4) % 4);
        put(i, j, color, 0.85);
      }
    }
  }

  // The insight loop is always drawn; its dashes and chevrons move back toward the gate.
  function drawLoop(t) {
    const cx = (GATE_X + END_X) / 2, rx = (END_X - GATE_X) / 2, ry = 0.43 * 0.93;
    const steps = Math.ceil((Math.PI * rx * W) / (cell * 0.6));
    for (let s = 0; s <= steps; s++) {
      const theta = (s / steps) * Math.PI;
      if (Math.sin((theta - t * 0.55) * 90) < -0.35) continue;
      const i = Math.round(((cx + rx * Math.cos(theta)) * W) / cell);
      const j = Math.round(((GATE_Y + 0.05 + ry * Math.sin(theta)) * H) / cell);
      put(i, j, 8, 0.75);
      put(i, j + 1, 8, 0.55);
    }
    for (let a = 0; a < 5; a++) {
      const theta = ((a + ((t * 0.12) % 1)) / 5) * Math.PI;
      if (theta < 0.12 || theta > Math.PI - 0.1) continue;
      const x = (cx + rx * Math.cos(theta)) * W, y = (GATE_Y + 0.05 + ry * Math.sin(theta)) * H;
      const tx = -rx * W * Math.sin(theta), ty = ry * H * Math.cos(theta);
      const len = Math.hypot(tx, ty), dx = tx / len, dy = ty / len;
      for (let k = 0; k <= 6; k++) {
        const back = k * cell * 0.9;
        for (const side of [-1, 1]) {
          const px = x - dx * back - dy * side * back * 1.05, py = y - dy * back + dx * side * back * 1.05;
          put(Math.round(px / cell), Math.round(py / cell), 8, 1, 1);
        }
      }
    }
  }

  function drawLanding(pulse) {
    if (pulse <= 0 || pulse >= 1) return;
    const gi = (GATE_X * W) / cell, gj = (GATE_Y * H) / cell;
    for (let ring = 0; ring < 2; ring++) {
      const radius = pulse * 14 - ring * 4;
      if (radius <= 0) continue;
      const n = Math.ceil(radius * 6);
      for (let s = 0; s < n; s++) {
        const a = (s / n) * Math.PI * 2;
        put(Math.round(gi + Math.cos(a) * radius), Math.round(gj + Math.sin(a) * radius * 0.8), 8, 1 - pulse);
      }
    }
  }

  function drawGate(glow) {
    const gx = GATE_X * W, gy = GATE_Y * H, gh = 0.05 * H;
    ctx.strokeStyle = COLORS[8];
    ctx.lineWidth = 2 + glow * 2;
    ctx.beginPath();
    ctx.moveTo(gx - 7, gy - gh); ctx.lineTo(gx, gy - gh); ctx.lineTo(gx, gy - gh * 0.5);
    ctx.moveTo(gx - 7, gy + gh); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx, gy + gh * 0.5);
    ctx.stroke();
  }

  function paint() {
    const r = cell * 0.26;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const c = colorGrid[k];
        const px = i * cell + cell / 2, py = j * cell + cell / 2;
        if (!c) {
          if (i % 5 === 0 && j % 5 === 0) {
            ctx.globalAlpha = 1; ctx.fillStyle = faint;
            ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
          }
          continue;
        }
        ctx.globalAlpha = alphaGrid[k];
        ctx.fillStyle = COLORS[c - 1];
        ctx.beginPath(); ctx.arc(px, py, r * (bigGrid[k] ? 1.9 : 1.3), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function frame(tMs, fixedPhase) {
    if (stopped) return;
    const t = tMs / 1000;
    const still = fixedPhase !== undefined;
    const run = still ? 0 : Math.floor(t / CYCLE) % 4;
    const t0 = still ? fixedPhase : t % CYCLE;
    const failRate = 0.2 * Math.pow(0.35, still ? 0 : (t / CYCLE) % 4);
    const landing = (t0 - 7) / 1.5;
    if (run !== lastRun) {
      lastRun = run;
      runTag.innerHTML = `<b>Run ${run + 1}</b>${RUN_LABELS[run]}`;
    }
    colorGrid.fill(0); bigGrid.fill(0);
    drawSwarm(t, failRate);
    drawTrace(t, failRate);
    drawLoop(t);
    drawLanding(landing);
    ctx.clearRect(0, 0, W, H);
    paint();
    drawGate(landing > 0 && landing < 1 ? 1 - landing : 0);
    if (!reduce) rafId = requestAnimationFrame((ms) => frame(ms));
  }

  const redraw = () => { resize(); if (reduce) frame(0, 7.4); };
  resize();
  window.addEventListener('resize', redraw);
  const themeObserver = new MutationObserver(redraw);
  themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  if (reduce) frame(0, 7.4);
  else rafId = requestAnimationFrame((ms) => frame(ms));

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', redraw);
    themeObserver.disconnect();
  };
}

export function LensHero() {
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const runRef = useRef(null);

  useEffect(() => startField(stageRef.current, canvasRef.current, runRef.current), []);

  return (
    <div className="lens-hero" ref={stageRef}>
      <style>{css}</style>
      <canvas
        ref={canvasRef}
        aria-label="Hundreds of agents swarm in from the left, all converge into a single gateway, leave as one trace, and the insight loops back into the gateway so the next run has fewer failures"
      />
      <div className="tag t-swarm"><b>Agent swarms</b>hundreds of agents · thousands of LLM + tool calls</div>
      <div className="tag blue t-gate"><b>LiteLLM gateway</b>every call, one choke point</div>
      <div className="tag t-out"><b>One trace per run</b>steps · tokens · $cost</div>
      <div className="tag blue t-loop"><b>Insight flows back into the gateway</b>routing · prompts · evals</div>
      <div hidden ref={runRef} />
    </div>
  );
}
