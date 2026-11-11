import React, {useEffect, useRef, useState} from 'react';
import styles from './hero.module.css';

// The same requests, in the same order, pass through a Python gateway and a Rust gateway. Each
// request takes its gateway's median overhead at 50 rps (0.9 ms for Rust, 79.3 ms for Python, from
// headline.csv) to cross the box, slowed down by one shared factor: Python's requests crawl through
// and Rust's flash across. As each request leaves, its time in the box joins a tally under its lane,
// on one scale for both lanes, so the tallies keep the true ratio. The scene is a pure function of time and arrivals are seeded, so the server
// render and the first client render match.

const W = 1200;
const H = 460;
const BX = 450;
const BW = 300;
const PY = '#7d9cc4';
const RS = '#f08a4b';
const HOT = '#ffb27a';
const LINE = '#efe7d6';
const DOT = '#f5f1e8';

// Seconds to cross Python's box on screen; Rust's keeps the measured ratio.
const PY_HOLD = 4;
const RS_HOLD = PY_HOLD * (0.9 / 79.3);
// One loop: the tallies fill and reset, and the arrivals repeat.
const LOOP = 10;
const RATE = 5; // requests per on-screen second
const N = RATE * LOOP;
const SPEED = 240; // px per on-screen second, outside the boxes
const THREADS = 12;
const TALLY_X = 60;
const TALLY_W = W - 2 * TALLY_X;
// Tally px per second in the box: Python's requests in one loop fill about the whole track.
const PX_PER_S = TALLY_W / (N * PY_HOLD);
const FADE = 0.6;
// The frame shown on the server and under prefers-reduced-motion: most of the way through a loop.
const STILL = 2 * LOOP - 1.5;

const seeded = start => {
  let seed = start;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
};

// Seeded Poisson arrivals over one loop, each on a thread.
const ARRIVALS = (() => {
  const rnd = seeded(5);
  const gaps = Array.from({length: N}, () => -Math.log(1 - rnd()));
  const total = gaps.reduce((a, b) => a + b, 0);
  let at = 0;
  return gaps.map(g => {
    const a = at;
    at += (g / total) * LOOP;
    return {a, thread: Math.floor(rnd() * THREADS)};
  });
})();

const bez = (p0, p1, p2, p3, s) => {
  const u = 1 - s;
  return u * u * u * p0 + 3 * u * u * s * p1 + 3 * u * s * s * p2 + s * s * s * p3;
};

function lane(top, hold, color, fill, tag) {
  const boxTop = top + 40;
  const boxH = 110;
  const threads = Array.from({length: THREADS}, (_, i) => {
    const f = i / (THREADS - 1);
    const y0 = top - 10 + f * 190;
    const yb = boxTop + 12 + f * (boxH - 24);
    const y1 = top + 5 + (((i * 7) % THREADS) / (THREADS - 1)) * 160;
    return {
      y0,
      yb,
      y1,
      left: `M0 ${y0}C${BX - 200} ${y0} ${BX - 150} ${yb} ${BX} ${yb}`,
      right: `M${BX + BW} ${yb}C${BX + BW + 150} ${yb} ${W - 200} ${y1} ${W} ${y1}`,
    };
  });
  return {top, hold, color, fill, tag, boxTop, boxH, threads, tallyY: top + 188};
}

const LANES = [lane(14, PY_HOLD, PY, 0.16, 'PYTHON'), lane(236, RS_HOLD, RS, 0.26, 'RUST')];
const T_IN = BX / SPEED;
const T_OUT = (W - BX - BW) / SPEED;

// Where one request is at `age` seconds after it arrived, or null once it has left.
function place(ln, r, age) {
  const th = ln.threads[r.thread];
  if (age < T_IN) {
    const s = age / T_IN;
    return {x: bez(0, BX - 200, BX - 150, BX, s), y: bez(th.y0, th.y0, th.yb, th.yb, s), o: Math.min(1, age * 2)};
  }
  let t = age - T_IN;
  if (t < ln.hold) return {x: BX + (t / ln.hold) * BW, y: th.yb, o: 1, inBox: true};
  t -= ln.hold;
  // Just out of a box it crossed in a flash: a streak across the box, fading.
  const streak = ln.hold < 0.5 && t < 0.3 ? {streakY: th.yb, streak: 1 - t / 0.3} : {};
  if (t < T_OUT) {
    const s = t / T_OUT;
    return {x: bez(BX + BW, BX + BW + 150, W - 200, W, s), y: bez(th.yb, th.yb, th.y1, th.y1, s), o: Math.min(1, (T_OUT - t) * 2), ...streak};
  }
  return null;
}

// Requests on screen, and the box crossings that have finished since this loop began, oldest first.
function scene(ln, t) {
  const cycle = Math.floor(t / LOOP);
  const loopStart = cycle * LOOP;
  const dots = [];
  const done = [];
  for (const c of [cycle - 1, cycle]) {
    if (c < 0) continue;
    ARRIVALS.forEach((r, k) => {
      const start = c * LOOP + r.a;
      const age = t - start;
      if (age < 0) return;
      const p = place(ln, r, age);
      if (p) dots.push({key: `${c}-${k}`, ...p});
      const end = start + T_IN + ln.hold;
      if (end >= loopStart && end <= t) done.push(end);
    });
  }
  done.sort((a, b) => a - b);
  return {dots, done, since: t - loopStart};
}

export default function LanesHero() {
  const figureRef = useRef(null);
  const [t, setT] = useState(STILL);
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
    if (paused || still) return undefined;
    let visible = true;
    let frame = 0;
    let last = null;
    const tick = now => {
      const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
      last = now;
      setT(value => value + dt);
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

  const now = still ? STILL : t;
  return (
    <figure ref={figureRef} className={styles.hero}>
      <svg
        className={styles.stage}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="The same stream of requests flows through two gateways, Python on top and Rust below. In the Python gateway, every request slows to a crawl, and the box fills with slow-moving requests. In the Rust gateway, requests flash straight across. Under each gateway, the time its requests spent inside adds up as a bar: Python's bar grows block by block across the whole width, while Rust's stays a sliver.">
        <rect x="0" y="0" width={W} height={H} fill="#36362c" />
        {LANES.map(ln => {
          const {dots, done, since} = scene(ln, now);
          const fade = Math.min(1, (LOOP - since) / FADE);
          const seg = ln.hold * PX_PER_S;
          const fresh = done.length > 0 && now - done[done.length - 1] < 0.3;
          const end = TALLY_X + Math.min(TALLY_W, done.length * seg);
          return (
            <g key={ln.tag}>
              <g fill="none" stroke={LINE} strokeWidth=".9">
                {ln.threads.map((th, i) => (
                  <g key={i} strokeOpacity={0.18 + 0.14 * Math.sin((i / (THREADS - 1)) * Math.PI)}>
                    <path d={th.left} />
                    <path d={th.right} />
                  </g>
                ))}
              </g>
              <rect x={BX} y={ln.boxTop} width={BW} height={ln.boxH} rx="18" fill={ln.color} fillOpacity={ln.fill} />
              <g stroke={ln.color} strokeOpacity=".4" strokeWidth=".9">
                {ln.threads.map((th, i) => (
                  <path key={i} d={`M${BX} ${th.yb}H${BX + BW}`} />
                ))}
              </g>
              <rect x={BX} y={ln.boxTop} width={BW} height={ln.boxH} rx="18" fill="none" stroke={ln.color} strokeWidth="2" />
              <text x={BX} y={ln.boxTop - 12} className={styles.tag} fill={ln.color}>
                {ln.tag}
              </text>

              <g aria-hidden="true">
                {dots.map(d =>
                  d.streak ? (
                    <path key={`${d.key}-s`} d={`M${BX + 4} ${d.streakY}H${BX + BW}`} stroke={HOT} strokeWidth="2" strokeLinecap="round" opacity={(d.streak * 0.8).toFixed(2)} />
                  ) : null,
                )}
                {dots.map(d => (
                  <circle key={d.key} cx={d.x} cy={d.y} r={d.inBox ? 2.6 : 2.1} fill={d.inBox ? HOT : DOT} opacity={d.o.toFixed(2)} />
                ))}
              </g>

              {/* The tally: one block per finished request, as wide as its time in the box. */}
              <rect x={TALLY_X} y={ln.tallyY} width={TALLY_W} height="8" rx="4" fill={LINE} fillOpacity=".08" />
              <g opacity={fade.toFixed(2)}>
                {seg >= 4 ? (
                  done.map((_, i) => {
                    const x = TALLY_X + i * seg;
                    if (x >= TALLY_X + TALLY_W) return null;
                    return <rect key={i} x={x} y={ln.tallyY} width={Math.min(seg - 2, TALLY_X + TALLY_W - x)} height="8" rx="2" fill={ln.color} />;
                  })
                ) : (
                  <rect x={TALLY_X} y={ln.tallyY} width={end - TALLY_X} height="8" rx="2" fill={ln.color} />
                )}
                {fresh && <circle cx={end} cy={ln.tallyY + 4} r="9" fill={HOT} fillOpacity=".35" />}
              </g>
            </g>
          );
        })}
      </svg>
      {!still && (
        <button type="button" className={styles.toggle} aria-pressed={paused} onClick={() => setPaused(value => !value)}>
          {paused ? 'Play animation' : 'Pause animation'}
        </button>
      )}
    </figure>
  );
}
