import React, {useEffect, useRef, useState} from 'react';
import styles from './router-swap-hero.module.css';

// Requests pass through the router's core. On the Python side the lines inside the box are
// tangled; a sweep repaints the box orange and straightens them into Rust's clean runs. The
// requests outside the box never change. Geometry is seeded, so the server render and client
// hydration match.

const BX = 470;
const BY = 140;
const BW = 300;
const BH = 300;
const CORE = {x: 1010, y: 290};
const N = 42;
const DOTS = 80;
const PY = '#7d9cc4';
const RS = '#f08a4b';
const HOT = '#ffb27a';
const LINE = '#efe7d6';
// Python dots move at this fraction of Rust's speed, measured along their own paths.
const PY_PACE = 0.8;
// One loop in seconds: Python holds, the sweep, Rust holds, a fade back.
const HOLD_PY = 1.4;
const SWEEP = 0.8;
const HOLD_RS = 2.2;
const RESET = 0.45;
const CYCLE = HOLD_PY + SWEEP + HOLD_RS + RESET;

const seeded = start => {
  let seed = start;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
};

const LINES = (() => {
  const rnd = seeded(7);
  const lo = BY + 24;
  const hi = BY + BH - 24;
  return Array.from({length: N}, (_, i) => {
    const t = i / (N - 1);
    const y0 = -40 + t * 710;
    const yb = BY + 16 + t * (BH - 32);
    // Every control point sits inside the box with a margin, so each curve stays inside it, and
    // the two halves share a tangent at the midpoint.
    const k = () => lo + rnd() * (hi - lo);
    const a = k();
    const mid = k();
    const d = (rnd() * 2 - 1) * Math.min(70, mid - lo, hi - mid);
    const b = k();
    return {
      t,
      yb,
      alpha: 0.22 + 0.2 * Math.sin(t * Math.PI),
      left: `M0 ${y0} C${BX - 220} ${y0} ${BX - 160} ${yb} ${BX} ${yb}`,
      right: `M${BX + BW} ${yb} C${BX + BW + 160} ${yb} ${CORE.x - 160} ${CORE.y} ${CORE.x} ${CORE.y}`,
      py: `M${BX} ${yb} C${BX + 60} ${a} ${BX + 110} ${mid - d} ${BX + 150} ${mid} C${BX + 190} ${mid + d} ${BX + 240} ${b} ${BX + BW} ${yb}`,
      rs: `M${BX} ${yb} H${BX + BW}`,
    };
  });
})();

const ease = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

// Where the loop is at time c (seconds into a cycle).
function phase(c) {
  if (c < HOLD_PY) return {w: 0, sweeping: false, fade: 1};
  if (c < HOLD_PY + SWEEP) return {w: ease((c - HOLD_PY) / SWEEP), sweeping: true, fade: 1};
  if (c < HOLD_PY + SWEEP + HOLD_RS) return {w: 1, sweeping: false, fade: 1};
  return {w: 1, sweeping: false, fade: 1 - (c - HOLD_PY - SWEEP - HOLD_RS) / RESET};
}

export default function RouterSwapHero() {
  const figureRef = useRef(null);
  const refs = useRef({});
  const dotRefs = useRef([]);
  const [paused, setPaused] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setStill(preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const r = refs.current;
    const set = (node, attrs) => {
      for (const key in attrs) node.setAttribute(key, attrs[key]);
    };
    const paths = LINES.map((_, i) => ({left: r[`left${i}`], right: r[`right${i}`], py: r[`py${i}`]}));
    const lens = paths.map(p => ({left: p.left.getTotalLength(), right: p.right.getTotalLength(), py: p.py.getTotalLength()}));
    const rnd = seeded(11);

    const spawn = (p, anywhere) => {
      p.i = Math.floor(rnd() * N);
      p.seg = 0;
      p.d = 0;
      p.u = 0;
      if (anywhere) {
        const L = lens[p.i];
        const at = rnd() * (L.left + BW + L.right);
        if (at < L.left) p.d = at;
        else if (at < L.left + BW) Object.assign(p, {seg: 1, u: (at - L.left) / BW});
        else Object.assign(p, {seg: 2, d: at - L.left - BW});
      }
      return p;
    };
    const parts = dotRefs.current.map(dot => spawn({v: 120 + rnd() * 70, dot}, true));

    // Advance one dot by dt seconds. Inside the box it rides the Rust run where that spot is left
    // of the seam, else its Python curve, at Python's slower pace.
    const step = (p, dt, seamX) => {
      const L = lens[p.i];
      const line = paths[p.i];
      if (p.seg === 0) {
        p.d += p.v * dt;
        if (p.d < L.left) return {pt: line.left.getPointAtLength(p.d), fade: Math.min(1, p.d / 60)};
        Object.assign(p, {seg: 1, u: 0});
      }
      if (p.seg === 1) {
        const onRust = BX + p.u * BW < seamX;
        p.u += onRust ? (p.v * dt) / BW : (p.v * PY_PACE * dt) / L.py;
        if (p.u < 1) {
          const x = BX + p.u * BW;
          return {pt: x < seamX ? {x, y: LINES[p.i].yb} : line.py.getPointAtLength(p.u * L.py), fade: 1};
        }
        Object.assign(p, {seg: 2, d: 0});
      }
      p.d += p.v * dt;
      if (p.d >= L.right) return step(spawn(p, false), 0, seamX);
      return {pt: line.right.getPointAtLength(p.d), fade: Math.min(1, (L.right - p.d) / 40)};
    };

    const draw = (c, dt) => {
      const {w, sweeping, fade} = phase(c);
      const resetting = fade < 1;
      const x = BX + BW * (resetting ? 0 : w);
      set(r.clipRs, {width: resetting ? BW : Math.max(0, x - BX)});
      set(r.clipPy, {x: resetting ? BX : x, width: resetting ? BW : Math.max(0, BX + BW - x)});
      for (const key of ['gRs', 'fillRs', 'strokeRs']) set(r[key], {opacity: fade});
      for (const key of ['gPy', 'fillPy', 'strokePy']) set(r[key], {opacity: resetting ? 1 - fade : 1});
      set(r.seam, {x: x - 1.5, opacity: sweeping ? 1 : 0});
      set(r.seamHalo, {x: x - 36, opacity: sweeping ? 1 : 0});
      const since = c - HOLD_PY - SWEEP;
      const flashing = since > 0 && since < 0.5;
      set(r.flash, {opacity: flashing ? (1 - since / 0.5) * 0.9 : 0, 'stroke-width': flashing ? 3 + since * 10 : 3});
      set(r.tagPy, {opacity: resetting ? 1 - fade : w < 0.6 ? 1 - w : 0});
      set(r.tagRs, {opacity: w > 0.4 ? Math.min(1, (w - 0.4) / 0.6) * fade : 0});
      const seamX = resetting ? BX + BW * (fade > 0.5 ? 1 : 0) : x;
      for (const p of parts) {
        const {pt, fade: edge} = step(p, dt, seamX);
        set(p.dot, {cx: pt.x, cy: pt.y, opacity: edge.toFixed(2)});
      }
    };

    if (paused || still) {
      // A still frame: the swap is done.
      draw(HOLD_PY + SWEEP + 0.6, 0);
      return undefined;
    }

    let visible = true;
    let frame = 0;
    let clock = 0;
    let last = null;
    const tick = now => {
      const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      clock += dt;
      draw(clock % CYCLE, dt);
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame);
      last = null;
      if (visible && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(figureRef.current);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [paused, still]);

  const ref = key => node => {
    refs.current[key] = node;
  };

  return (
    <figure ref={figureRef} className={styles.hero}>
      <svg
        className={styles.stage}
        viewBox="0 60 1200 460"
        role="img"
        aria-label="Requests flow into a box marked Python, where their paths are tangled. A sweep repaints the box orange and marks it Rust, and the paths inside straighten into clean parallel lines. The requests outside the box don't change, and all of them converge on one glowing core.">
        <defs>
          <radialGradient id="rsh-glow">
            <stop offset="0" stopColor={HOT} />
            <stop offset=".25" stopColor={RS} stopOpacity=".55" />
            <stop offset="1" stopColor={RS} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="rsh-seam" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={HOT} stopOpacity="0" />
            <stop offset=".5" stopColor={HOT} />
            <stop offset="1" stopColor={HOT} stopOpacity="0" />
          </linearGradient>
          <clipPath id="rsh-clip-rs">
            <rect ref={ref('clipRs')} x={BX} y={BY} width={BW} height={BH} />
          </clipPath>
          <clipPath id="rsh-clip-box">
            <rect x={BX} y={BY} width={BW} height={BH} rx="22" />
          </clipPath>
          <clipPath id="rsh-clip-py">
            <rect ref={ref('clipPy')} x={BX} y={BY} width="0" height={BH} />
          </clipPath>
        </defs>
        <rect x="0" y="0" width="1200" height="630" fill="#36362c" />

        <g fill="none" strokeWidth=".9">
          {LINES.map((line, i) => (
            <g key={i} stroke={LINE} strokeOpacity={line.alpha}>
              <path ref={ref(`left${i}`)} d={line.left} />
              <path ref={ref(`right${i}`)} d={line.right} />
            </g>
          ))}
        </g>

        <rect ref={ref('fillPy')} x={BX} y={BY} width={BW} height={BH} rx="22" fill={PY} fillOpacity=".16" clipPath="url(#rsh-clip-py)" />
        <rect ref={ref('fillRs')} x={BX} y={BY} width={BW} height={BH} rx="22" fill={RS} fillOpacity=".26" clipPath="url(#rsh-clip-rs)" />
        <g ref={ref('gPy')} clipPath="url(#rsh-clip-py)" fill="none" stroke="#c9d6e8" strokeOpacity=".32" strokeWidth=".9">
          {LINES.map((line, i) => (
            <path key={i} ref={ref(`py${i}`)} d={line.py} />
          ))}
        </g>
        <g ref={ref('gRs')} clipPath="url(#rsh-clip-rs)" fill="none" stroke={HOT} strokeOpacity=".5" strokeWidth=".9">
          {LINES.map((line, i) => (
            <path key={i} d={line.rs} />
          ))}
        </g>
        <rect ref={ref('strokePy')} x={BX} y={BY} width={BW} height={BH} rx="22" fill="none" stroke={PY} strokeWidth="2" clipPath="url(#rsh-clip-py)" />
        <rect ref={ref('strokeRs')} x={BX} y={BY} width={BW} height={BH} rx="22" fill="none" stroke={RS} strokeWidth="2" clipPath="url(#rsh-clip-rs)" />
        <rect ref={ref('flash')} x={BX - 6} y={BY - 6} width={BW + 12} height={BH + 12} rx="27" fill="none" stroke={HOT} strokeWidth="3" opacity="0" />
        <rect ref={ref('seamHalo')} x={BX} y={BY} width="40" height={BH} fill={HOT} fillOpacity=".12" opacity="0" clipPath="url(#rsh-clip-box)" />
        <rect ref={ref('seam')} x={BX} y={BY - 16} width="3" height={BH + 32} fill="url(#rsh-seam)" opacity="0" />
        <text ref={ref('tagPy')} x={BX + BW} y={BY - 16} className={styles.tag} fill={PY} textAnchor="end" opacity="0">
          PYTHON
        </text>
        <text ref={ref('tagRs')} x={BX} y={BY - 16} className={styles.tag} fill={RS}>
          RUST
        </text>

        <circle cx={CORE.x} cy={CORE.y} r="42" fill="url(#rsh-glow)" />
        <circle cx={CORE.x} cy={CORE.y} r="6" fill={HOT} />

        <g fill="#f5f1e8" aria-hidden="true">
          {Array.from({length: DOTS}, (_, i) => (
            <circle key={i} ref={node => (dotRefs.current[i] = node)} r="2.1" cx="-10" cy="-10" />
          ))}
        </g>
      </svg>
      {!still && (
        <button type="button" className={styles.toggle} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
          {paused ? 'Play animation' : 'Pause animation'}
        </button>
      )}
    </figure>
  );
}
