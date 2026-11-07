import React, { useEffect, useId, useRef, useState } from "react";
import useBaseUrl from "@docusaurus/useBaseUrl";
import styles from "./workflow-animation.module.css";

const WIDTH = 1200;
const HEIGHT = 640;
const GRID = 6;
const FRAME_INTERVAL = 1000 / 16;
const RUN_TIMING = { json: 0.4, python: 0.85, condition: 1.32, model: 2.1, reply: 2.65 };
const COLORS = {
  input: "#a5b8cf",
  llm: "#79cbb5",
  python: "#b1a2ec",
  urgent: "#e8bea4",
  routine: "#d6bc87",
  result: "#95cfb2",
};

function hash(a, b) {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

// Sample the original rounded graph once; each frame only paints its particles.
function roundedPath(points, radius = 24) {
  const samples = [points[0]];
  const line = (from, to) => {
    const count = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 3));
    for (let index = 1; index <= count; index += 1) {
      samples.push([
        from[0] + ((to[0] - from[0]) * index) / count,
        from[1] + ((to[1] - from[1]) * index) / count,
      ]);
    }
  };
  let current = points[0];
  let path = `M${current[0]} ${current[1]}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const before = points[index - 1];
    const after = points[index + 1];
    const incoming = Math.hypot(point[0] - before[0], point[1] - before[1]);
    const outgoing = Math.hypot(after[0] - point[0], after[1] - point[1]);
    const cut = Math.min(radius, incoming / 2, outgoing / 2);
    const start = [
      point[0] - ((point[0] - before[0]) * cut) / incoming,
      point[1] - ((point[1] - before[1]) * cut) / incoming,
    ];
    const end = [
      point[0] + ((after[0] - point[0]) * cut) / outgoing,
      point[1] + ((after[1] - point[1]) * cut) / outgoing,
    ];
    line(current, start);
    path += `L${start[0]} ${start[1]}Q${point[0]} ${point[1]} ${end[0]} ${end[1]}`;
    for (let step = 1; step <= 16; step += 1) {
      const time = step / 16;
      const inverse = 1 - time;
      samples.push([
        inverse * inverse * start[0] + 2 * inverse * time * point[0] + time * time * end[0],
        inverse * inverse * start[1] + 2 * inverse * time * point[1] + time * time * end[1],
      ]);
    }
    current = end;
  }
  const last = points[points.length - 1];
  line(current, last);
  path += `L${last[0]} ${last[1]}`;
  let length = 0;
  const distances = [0];
  for (let index = 1; index < samples.length; index += 1) {
    length += Math.hypot(samples[index][0] - samples[index - 1][0], samples[index][1] - samples[index - 1][1]);
    distances.push(length);
  }
  return { samples, distances, length, path };
}

function pointAt(edge, distance) {
  const position = Math.max(0, Math.min(edge.length, distance));
  let lower = 0;
  let upper = edge.distances.length - 1;
  while (lower < upper) {
    const middle = (lower + upper) >> 1;
    if (edge.distances[middle] < position) lower = middle + 1;
    else upper = middle;
  }
  const index = Math.max(1, lower);
  const start = edge.samples[index - 1];
  const end = edge.samples[index];
  const fraction = (position - edge.distances[index - 1]) / (edge.distances[index] - edge.distances[index - 1] || 1);
  return [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction];
}

function offsetPoint(edge, distance, spread) {
  const point = pointAt(edge, distance);
  const before = pointAt(edge, distance - 2);
  const after = pointAt(edge, distance + 2);
  const dx = after[0] - before[0];
  const dy = after[1] - before[1];
  const length = Math.hypot(dx, dy) || 1;
  return [point[0] - (dy / length) * spread, point[1] + (dx / length) * spread];
}

const EDGES = [
  [[[135, 354], [254, 354]], COLORS.input],
  [[[336, 354], [455, 354]], COLORS.llm],
  [[[535, 354], [657, 354]], COLORS.python],
  [[[763, 354], [827, 354], [827, 194], [918, 194]], COLORS.urgent],
  [[[763, 354], [827, 354], [827, 514], [918, 514]], COLORS.routine],
  [[[1002, 194], [1060, 194], [1060, 354], [1094, 354]], COLORS.urgent],
  [[[1002, 514], [1060, 514], [1060, 354], [1094, 354]], COLORS.routine],
].map(([points, color]) => ({ ...roundedPath(points), color }));

const SOURCE_STEM = roundedPath([[575, 74], [600, 74], [600, 119], [495, 119], [495, 314]], 14);

function paintParticles(context, time, reducedMotion) {
  context.clearRect(0, 0, WIDTH, HEIGHT);
  const cells = new Map();
  const routine = !reducedMotion && time >= 4.2;
  const elapsed = reducedMotion ? 2.8 : time - (routine ? 4.2 : 0.8);

  const dot = (x, y, radius, color, opacity) => {
    if (opacity <= 0.015) return;
    const gx = Math.round(x / GRID);
    const gy = Math.round(y / GRID);
    const key = gx + gy * 201;
    const existing = cells.get(key);
    if (!existing || opacity > existing.opacity) cells.set(key, { x: gx * GRID, y: gy * GRID, radius, color, opacity });
  };

  const ribbon = (edge, opacity, progress = 1, source = false) => {
    for (let index = 0; index < Math.ceil(edge.length * 2.3); index += 1) {
      const distance = (hash(index, 17) * edge.length + time * 48) % edge.length;
      if (distance > edge.length * progress) continue;
      const taper = Math.pow(Math.sin(Math.PI * distance / edge.length), 0.45);
      const point = offsetPoint(edge, distance, (hash(index, 18) - 0.5) * 52 * taper);
      dot(point[0], point[1], 1.65, source ? COLORS.python : index % 9 === 0 ? "#ccd2de" : edge.color, opacity * (0.25 + 0.7 * hash(index, 19)) * taper);
    }
    const count = Math.max(1, Math.floor(edge.length / 100));
    for (let index = 0; index < count; index += 1) {
      const head = (time * 58 + index * edge.length / count) % edge.length;
      if (head > edge.length * progress) continue;
      for (let tail = 0; tail < 6; tail += 1) {
        const distance = head - tail * GRID;
        if (distance < 0) continue;
        const point = offsetPoint(edge, distance, (hash(index, 21) - 0.5) * 16);
        dot(point[0], point[1], tail === 0 ? 2 : 1.7, source ? "#dbd0ff" : edge.color, (1 - tail / 7) * opacity);
      }
    }
  };

  const busy = (x, y, color) => {
    for (let index = 0; index < 62; index += 1) {
      const angle = index * 2.39996 + time * 2.8;
      const radius = 47 + hash(index, 8) * 14;
      dot(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius * 0.76, 1.6, color, 0.25 + 0.45 * hash(index, 9));
    }
  };

  if (time < 0.8 && !reducedMotion) {
    const assembly = 0.25 + 0.75 * time / 0.8;
    ribbon(SOURCE_STEM, 0.75, Math.min(1, assembly * 2), true);
    EDGES.forEach((edge, index) => ribbon(edge, 0.4, Math.max(0, Math.min(1, (assembly - 0.14 - index * 0.035) * 1.8)), true));
  }

  if (elapsed >= 0) {
    const selected = routine ? 4 : 3;
    const output = routine ? 6 : 5;
    [[0, 0.05], [1, 0.5], [2, 0.92], [selected, 1.42], [output, 2.25]].forEach(([index, start]) => {
      if (elapsed >= start) ribbon(EDGES[index], index < 3 ? 0.58 : 0.83, Math.min(1, (elapsed - start) / 0.35));
    });
    if (!reducedMotion) {
      if (elapsed < RUN_TIMING.json) busy(295, 354, COLORS.llm);
      else if (elapsed < RUN_TIMING.python) busy(495, 354, COLORS.python);
      else if (elapsed < RUN_TIMING.condition) busy(710, 354, COLORS.python);
      else if (elapsed < RUN_TIMING.model) busy(960, routine ? 514 : 194, routine ? COLORS.routine : COLORS.urgent);
      else if (elapsed >= RUN_TIMING.reply) busy(1115, 354, COLORS.result);
    }
  }

  for (const cell of cells.values()) {
    context.globalAlpha = cell.opacity;
    context.fillStyle = cell.color;
    context.beginPath();
    context.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  return { routine, elapsed };
}

function Provider({ name, href, x, y, className }) {
  return (
    <g className={className}>
      <circle cx={x} cy={y} r="39" fill="#f4f4f5" />
      <image href={href} x={x - 29} y={y - 29} width="58" height="58" aria-hidden="true" />
      <text x={x} y={name === "Mistral" ? y + 82 : y - 85} textAnchor="middle" className={styles.nodeLabel}>{name}</text>
    </g>
  );
}

export default function WorkflowAnimation() {
  const containerRef = useRef(null);
  const graphFrameRef = useRef(null);
  const canvasRef = useRef(null);
  const graphRef = useRef(null);
  const inputRef = useRef(null);
  const jsonRef = useRef(null);
  const pythonRef = useRef(null);
  const replyRef = useRef(null);
  const pausedRef = useRef(false);
  const playbackRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [inspecting, setInspecting] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const viewportId = useId();
  const openai = useBaseUrl("/img/providers/openai_small.svg");
  const anthropic = useBaseUrl("/img/providers/anthropic.svg");
  const mistral = useBaseUrl("/img/providers/mistral.svg");

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let active = false;
    let inView = false;
    let elapsed = 0;
    let previousTime = null;
    let lastPaint = -Infinity;
    let lastStage = "";

    const draw = (time, reducedMotion = motionPreference.matches) => {
      const state = paintParticles(context, time, reducedMotion);
      const stage = state.elapsed < 0 ? 0 : state.elapsed < RUN_TIMING.json ? 1 : state.elapsed < RUN_TIMING.python ? 2 : state.elapsed < RUN_TIMING.condition ? 3 : state.elapsed < RUN_TIMING.model ? 4 : state.elapsed < RUN_TIMING.reply ? 5 : 6;
      const key = `${state.routine}-${stage}`;
      if (key === lastStage) return;
      lastStage = key;
      const priority = state.routine ? "routine" : "urgent";
      graphRef.current.dataset.branch = stage >= 4 ? priority : "none";
      graphRef.current.dataset.stage = String(stage);
      inputRef.current.textContent = stage > 0 ? priority : "email input";
      jsonRef.current.textContent = stage >= 2 ? `{ "priority": "${priority.toUpperCase()}" }` : "JSON";
      pythonRef.current.textContent = stage >= 3 ? `"${priority}"` : "normalize";
      replyRef.current.textContent = stage >= 6 ? "ready" : "";
    };

    const tick = (now) => {
      if (!active) return;
      if (previousTime !== null) elapsed += Math.min(now - previousTime, 100);
      previousTime = now;
      if (now - lastPaint >= FRAME_INTERVAL) {
        draw((elapsed / 1000) % 10);
        lastPaint = now;
      }
      frame = window.requestAnimationFrame(tick);
    };

    const syncPlayback = () => {
      const shouldAnimate = inView && !document.hidden && !motionPreference.matches && !pausedRef.current;
      if (shouldAnimate === active) {
        if (motionPreference.matches) draw(3.6, true);
        return;
      }
      active = shouldAnimate;
      previousTime = null;
      window.cancelAnimationFrame(frame);
      if (active) frame = window.requestAnimationFrame(tick);
      else if (motionPreference.matches) draw(3.6, true);
    };
    playbackRef.current = syncPlayback;

    const resize = () => {
      const width = graphFrameRef.current.getBoundingClientRect().width;
      const scale = Math.min(window.devicePixelRatio || 1, 2) * width / WIDTH;
      canvas.width = Math.max(1, Math.round(WIDTH * scale));
      canvas.height = Math.max(1, Math.round(HEIGHT * scale));
      context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
      draw(motionPreference.matches ? 3.6 : (elapsed / 1000) % 10);
    };

    const intersection = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncPlayback();
    });
    const observer = new ResizeObserver(resize);
    resize();
    intersection.observe(containerRef.current);
    observer.observe(graphFrameRef.current);
    document.addEventListener("visibilitychange", syncPlayback);
    motionPreference.addEventListener("change", syncPlayback);

    return () => {
      active = false;
      playbackRef.current = null;
      window.cancelAnimationFrame(frame);
      intersection.disconnect();
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncPlayback);
      motionPreference.removeEventListener("change", syncPlayback);
    };
  }, []);

  return (
    <div className={styles.animation} ref={containerRef} data-inspecting={inspecting}>
      <div
        id={viewportId}
        className={styles.viewport}
        role="region"
        aria-label={inspecting ? "Workflow diagram. Scroll horizontally to inspect all steps." : "Workflow diagram overview"}
        tabIndex={inspecting ? 0 : undefined}
      >
        <div className={styles.graphFrame} ref={graphFrameRef}>
          <canvas ref={canvasRef} className={styles.particles} width={WIDTH} height={HEIGHT} aria-hidden="true" />
          <svg ref={graphRef} className={styles.graph} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-labelledby={`${titleId} ${descriptionId}`} data-branch="urgent" data-stage="6">
            <title id={titleId}>Python unfolds into a Liteflow workflow</title>
            <desc id={descriptionId}>Graph API preview. A Python workflow definition connects email input to OpenAI structured JSON, a Python normalization step, and an if/else condition. An urgent email selects Anthropic; a routine email selects Mistral. Only the selected model sends a reply. Motion and timing are illustrative.</desc>
            <defs>
              <pattern id={`${titleId}-grid`} width="30" height="30" patternUnits="userSpaceOnUse">
                <circle cx="3" cy="3" r="0.65" fill="#657082" opacity="0.2" />
              </pattern>
            </defs>
            <rect x="0" y="105" width={WIDTH} height="500" fill={`url(#${titleId}-grid)`} />
            <g className={styles.wires} aria-hidden="true">
              {EDGES.map((edge, index) => <path key={index} d={edge.path} />)}
              <path d={SOURCE_STEM.path} className={styles.sourceWire} />
            </g>
            <text x="54" y="32" className={styles.fileName}>email_reply.py</text>
            <text x="1146" y="32" textAnchor="end" className={styles.sourceLabel}>SOURCE / EXCERPT</text>
            <text x="54" y="78" className={styles.sourceCode}>
              <tspan fill={COLORS.python}>Workflow</tspan><tspan fill="#c6cedb">{`(name="email-reply", nodes=[…])`}</tspan>
            </text>
            <g className={styles.nodes}>
              <text x="105" y="274" textAnchor="middle" className={styles.nodeLabel}>Email</text>
              <path d="M75 333h60v43H75zm0 0 30 23 30-23m-60 43 21-22m39 22-21-22" className={styles.envelope} />
              <text ref={inputRef} x="105" y="454" textAnchor="middle" className={styles.inputStatus}>urgent</text>
              <Provider name="OpenAI" href={openai} x={295} y={354} />
              <text ref={jsonRef} x="295" y="454" textAnchor="middle" className={styles.jsonStatus}>{'{ "priority": "URGENT" }'}</text>
              <text x="495" y="274" textAnchor="middle" className={styles.nodeLabel}>Python</text>
              <text x="495" y="367" textAnchor="middle" className={styles.pythonIcon}>{"{ }"}</text>
              <text ref={pythonRef} x="495" y="454" textAnchor="middle" className={styles.pythonStatus}>"urgent"</text>
              <path d="M710 302 762 354 710 406 658 354Z" className={styles.condition} />
              <text x="710" y="364" textAnchor="middle" className={styles.conditionText}>IF</text>
              <text x="710" y="454" textAnchor="middle" className={styles.conditionQuestion}>urgent?</text>
              <text x="837" y="161" textAnchor="middle" className={styles.ifLabel}>IF</text>
              <Provider name="Anthropic" href={anthropic} x={960} y={194} className={styles.anthropic} />
              <text x="837" y="556" textAnchor="middle" className={styles.elseLabel}>ELSE</text>
              <Provider name="Mistral" href={mistral} x={960} y={514} className={styles.mistral} />
              <text x="1115" y="274" textAnchor="middle" className={styles.nodeLabel}>Reply</text>
              <path d="M1105 330h-12v48h12m20-48h12v48h-12" className={styles.replyIcon} />
              <text ref={replyRef} x="1115" y="454" textAnchor="middle" className={styles.replyStatus}>ready</text>
            </g>
            <text x="54" y="624" className={styles.previewLabel}>Graph API preview</text>
          </svg>
        </div>
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.inspectButton}
          aria-expanded={inspecting}
          aria-controls={viewportId}
          onClick={() => setInspecting((value) => !value)}
        >
          {inspecting ? "Show overview" : "Inspect workflow"}
        </button>
        <button
          type="button"
          className={styles.pauseButton}
          aria-pressed={paused}
          onClick={() => {
            pausedRef.current = !pausedRef.current;
            setPaused(pausedRef.current);
            playbackRef.current?.();
          }}
        >
          {paused ? "Play animation" : "Pause animation"}
        </button>
      </div>
    </div>
  );
}
