import React, {useEffect, useRef} from 'react';
import openwebui from './assets/bare-openwebui.png';
import claude from './assets/bare-claude-code.png';
import codex from './assets/bare-codex.png';
import hermes from './assets/bare-hermes.png';
import openai from './assets/bare-openai.png';
import anthropic from './assets/bare-anthropic.png';
import bedrock from './assets/bare-bedrock.png';
import vertex from './assets/bare-vertex-ai.png';
import styles from './hero.module.css';

const ROWS = [226, 309, 392, 475];
const LOGOS = [
  ['Open WebUI', openwebui, 140, ROWS[0]],
  ['Claude Code', claude, 140, ROWS[1]],
  ['Codex', codex, 140, ROWS[2]],
  ['Hermes', hermes, 140, ROWS[3]],
  ['OpenAI', openai, 1060, ROWS[0]],
  ['Anthropic', anthropic, 1060, ROWS[1]],
  ['Amazon Bedrock', bedrock, 1060, ROWS[2]],
  ['Vertex AI', vertex, 1060, ROWS[3]],
];
const SLOW_COLORS = [[0,159,205], [213,78,128], [213,144,21], [125,83,208], [54,114,209], [86,146,174]];
const FAST_COLORS = [[54,220,249], [255,111,177], [255,211,74], [183,151,255], [108,200,255], [239,252,255]];
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
const lerp = (a, b, p) => a + (b - a) * p;
const mix = (a, b, p) => `rgb(${a.map((value, i) => Math.round(lerp(value, b[i], p))).join(',')})`;
const logoUrl = image => typeof image === 'string' ? image : image.src.src;

function cubic(a, b, c, d, t) {
  const u = 1 - t;
  return [0, 1].map(i => u*u*u*a[i] + 3*u*u*t*b[i] + 3*u*t*t*c[i] + t*t*t*d[i]);
}

function createPath(branch, strand) {
  const y = ROWS[branch] + (strand - 2.5) * 2.8;
  const middle = 343 + (branch - 1.5) * 4 + (strand - 2.5) * 1.4;
  const points = [];
  for (let i = 0; i <= 80; i++) points.push(cubic([181,y], [337,y], [388,middle], [483,middle], i/80));
  for (let i = 1; i <= 50; i++) points.push([lerp(483,717,i/50), middle]);
  for (let i = 1; i <= 80; i++) points.push(cubic([717,middle], [812,middle], [863,y], [1019,y], i/80));
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i-1] + Math.hypot(points[i][0]-points[i-1][0], points[i][1]-points[i-1][1]));
  return {points, lengths, length: lengths[lengths.length-1]};
}

function pathPoint(path, distance) {
  const target = Math.max(0, Math.min(path.length, distance));
  let low = 0;
  let high = path.lengths.length - 1;
  while (low + 1 < high) {
    const middle = (low + high) >> 1;
    if (path.lengths[middle] < target) low = middle;
    else high = middle;
  }
  const p = (target-path.lengths[low]) / (path.lengths[high]-path.lengths[low] || 1);
  return [lerp(path.points[low][0],path.points[high][0],p), lerp(path.points[low][1],path.points[high][1],p)];
}

// Same 24 ribbons and 960 points as the downloadable animation.
const PATHS = Array.from({length: 24}, (_, i) => createPath(Math.floor(i/6), i%6));
const PARTICLES = Array.from({length: 960}, (_, i) => {
  const ribbon = i % 24;
  const slot = Math.floor(i / 24);
  return {path: PATHS[ribbon], phase: (slot/40 + ribbon*.010739)%1,
    color: (slot+Math.floor(ribbon*.75))%6, radius: 1.4+((i*.43857)%1)*.25,
    opacity: .78+((i*.754878)%1)*.22};
});

function travel(t) {
  const elapsed = Math.max(0, t-3.42);
  const u = clamp(elapsed/.22);
  const integral = .22*(u*u*u-.5*u*u*u*u) + Math.max(0, elapsed-.22);
  return 60*t + 840*integral;
}

function drawSwarm(context, t, active, opacity, dark) {
  const distance = travel(t);
  const palette = dark ? FAST_COLORS : SLOW_COLORS;
  const colors = palette.map((color, i) => mix(color, FAST_COLORS[i], active));
  context.save();
  context.beginPath();
  context.rect(178, 196, 844, 312);
  context.clip();
  for (const particle of PARTICLES) {
    const {path} = particle;
    const at = ((particle.phase + distance/path.length)%1) * path.length;
    const [x, y] = pathPoint(path, at);
    const alpha = ease(at/10) * (1-ease((at-path.length+10)/10)) * particle.opacity * opacity;
    context.fillStyle = colors[particle.color];
    if (active > .01) {
      const [tailX, tailY] = pathPoint(path, Math.max(0, at-7*active));
      context.globalAlpha = alpha * .4;
      context.strokeStyle = colors[particle.color];
      context.lineWidth = .8;
      context.beginPath();
      context.moveTo(tailX, tailY);
      context.lineTo(x, y);
      context.stroke();
    }
    context.globalAlpha = alpha;
    context.beginPath();
    context.arc(x, y, particle.radius, 0, Math.PI*2);
    context.fill();
  }
  context.restore();
}

function drawSpeedField(context, t, active) {
  if (active < .01) return;
  context.save();
  for (let i = 0; i < 18; i++) {
    const y = 10+i*34+(i%2 ? 6 : 0);
    const length = 125+(i*43)%190;
    const phase = ((t-3.42)/(.48+(i%5)*.05)+(i*.61803398875)%1+20)%1;
    const head = -50+phase*(1310+length);
    const gradient = context.createLinearGradient(head-length, 0, head, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(.9, `rgba(255,255,255,${active*.2})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.strokeStyle = gradient;
    context.lineWidth = 1.2;
    context.beginPath();
    context.moveTo(head-length, y);
    context.lineTo(head, y);
    context.stroke();
  }
  context.restore();
}

export default function PromptLatencyHero() {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const oldRef = useRef(null);
  const newRef = useRef(null);
  const resultRef = useRef(null);
  const captionRef = useRef(null);
  const resultCaptionRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    let dark = document.documentElement.dataset.theme === 'dark';
    let frame = 0;
    let elapsed = 0;
    let previous = null;
    let width = 0;
    let height = 0;

    function render(t) {
      const reset = ease((t-9.67)/.31);
      const active = ease((t-3.42)/.22) * (1-reset);
      root.style.setProperty('--active', active.toFixed(4));
      root.style.setProperty('--hero-ink', mix(dark ? [235,240,250] : [47,60,82], [255,255,255], active));
      root.style.setProperty('--hero-muted', mix(dark ? [175,189,211] : [80,100,132], [210,226,255], active));
      root.style.setProperty('--hero-logo', mix(dark ? [184,184,184] : [112,112,112], [230,230,230], active));
      oldRef.current.style.opacity = (1-ease((t-3.70)/.18))*(1-reset)+reset;
      newRef.current.style.opacity = ease((t-3.91)/.18)*(1-ease((t-5.20)/.2))*(1-reset);
      resultRef.current.style.opacity = ease((t-5.47)/.3)*(1-reset);
      captionRef.current.style.opacity = (1-ease((t-5.20)/.2))*(1-reset)+reset;
      resultCaptionRef.current.style.opacity = ease((t-5.47)/.3)*(1-reset);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.setTransform(canvas.width/1200, 0, 0, canvas.height/600, 0, 0);
      drawSpeedField(context, t, active);
      if (reset > 0) {
        drawSwarm(context, 9.67, 1, 1-reset, dark);
        drawSwarm(context, 0, 0, reset, dark);
      } else drawSwarm(context, t, active, 1, dark);
    }

    function resize() {
      const bounds = root.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(bounds.width*dpr));
      height = Math.max(1, Math.round(bounds.height*dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      render(reducedMotion.matches ? 6.7 : elapsed%10);
    }

    function tick(now) {
      if (previous !== null) elapsed += Math.min((now-previous)/1000, .1);
      previous = now;
      render(elapsed%10);
      frame = window.requestAnimationFrame(tick);
    }

    function syncPlayback() {
      window.cancelAnimationFrame(frame);
      previous = null;
      if (reducedMotion.matches) render(6.7);
      else if (visible && !document.hidden) frame = window.requestAnimationFrame(tick);
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);
    const intersectionObserver = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      syncPlayback();
    });
    intersectionObserver.observe(root);
    const themeObserver = new MutationObserver(() => {
      dark = document.documentElement.dataset.theme === 'dark';
      render(reducedMotion.matches ? 6.7 : elapsed%10);
    });
    themeObserver.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    reducedMotion.addEventListener('change', syncPlayback);
    document.addEventListener('visibilitychange', syncPlayback);
    window.addEventListener('resize', resize);
    resize();
    syncPlayback();
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      reducedMotion.removeEventListener('change', syncPlayback);
      document.removeEventListener('visibilitychange', syncPlayback);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.hero} role="img" aria-label="LiteLLM routes requests from Open WebUI, Claude Code, Codex and Hermes to OpenAI, Anthropic, Amazon Bedrock and Vertex AI. A local 440k-token, single-deployment benchmark with a mock upstream reduced median time to first byte from 554 to 37 milliseconds, 93 percent lower. Motion is illustrative.">
      <div className={styles.blue} aria-hidden="true" />
      <div className={styles.gateway} aria-hidden="true" />
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div className={styles.labels} aria-hidden="true">
        <div ref={oldRef} className={styles.metric}>554 ms</div>
        <div ref={newRef} className={`${styles.metric} ${styles.hidden}`}>37 ms</div>
        <div ref={resultRef} className={`${styles.metric} ${styles.hidden}`}>93% lower</div>
        <div ref={captionRef} className={styles.caption}>time to first byte</div>
        <div ref={resultCaptionRef} className={`${styles.caption} ${styles.hidden}`}>554 ms → 37 ms · time to first byte</div>
        <div className={styles.gatewayLabel}>LiteLLM</div>
        {LOGOS.map(([name, image, x, y]) => (
          <span key={name} className={styles.logo} title={name} style={{left: `${x/12}%`, top: `${y/6}%`, maskImage: `url("${logoUrl(image)}")`, WebkitMaskImage: `url("${logoUrl(image)}")`}} />
        ))}
        <div className={styles.footer}>440k-token local benchmark · one deployment · mock upstream</div>
      </div>
    </div>
  );
}
