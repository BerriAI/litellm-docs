import React from 'react';
import s from './charts.module.css';

// Charts for the "Better Benchmarks" post, drawn in the same frame as the "Routing in Rust"
// diagrams. Each one is a plain SVG themed through the CSS variables in charts.module.css, so it
// follows the site's light and dark mode. The numbers come from ./data/*.csv.

const cx = (...names) => names.filter(Boolean).map(name => s[name]).join(' ');

function Fig({n, eyebrow, title, label, viewBox, caption, children}) {
  return (
    <figure className={s.fig}>
      <div className={s.art}>
        <div className={s.head}>
          <span className={s.eyebrow}>
            <span className={s.num}>{n}</span>
            {eyebrow}
          </span>
          <p className={s.title}>{title}</p>
        </div>
        <div className={s.scroll}>
          <svg className={s.svg} viewBox={viewBox} role="img" aria-label={label}>
            {children}
          </svg>
        </div>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

// Each gateway keeps one color in every chart: Rust and Python take the Rust orange and Python
// blue from the router post, and the other gateways take two grays.
const GW = {
  rust: {name: 'LiteLLM Rust', v: 'Rs'},
  python: {name: 'LiteLLM Python', v: 'Py'},
  bifrost: {name: 'Bifrost', v: 'Gray'},
  portkey: {name: 'Portkey', v: 'Pale'},
};
const fillOf = g => `fill${GW[g].v}`;
const lineOf = g => `line${GW[g].v}`;
const inkOf = g => `t${GW[g].v}`;

const num = (v, digits = 2) => v.toLocaleString('en-US', {maximumFractionDigits: digits});
const sum = values => values.reduce((a, b) => a + b, 0);
const ms = v => (v >= 1000 ? `${num(v / 1000)} s` : `${num(v)} ms`);

// Horizontal bars, one per gateway. A value past `max` runs off the end with a break mark.
function BarPanel({x, y, w, title, unit, max, ticks, rows}) {
  const left = x + 92;
  const span = w - 92 - 88;
  const sx = v => left + (Math.min(v, max) / max) * span;
  const top = y + 22;
  const step = 30;
  const bottom = top + rows.length * step;
  return (
    <g>
      <text x={x} y={y + 6} className={s.t}>{title}</text>
      {ticks.map(t => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={top} y2={bottom} className={s.grid} />
          <text x={sx(t)} y={bottom + 14} className={s.tick} textAnchor="middle">{num(t)}</text>
        </g>
      ))}
      {rows.map(([g, v], i) => {
        const by = top + i * step + 6;
        const off = v > max;
        const end = off ? left + span + 22 : sx(v);
        return (
          <g key={g}>
            <text x={x} y={by + 13} className={cx('s', g === 'rust' && 'tRs', g === 'rust' && 'bold')}>{GW[g].name}</text>
            <rect x={left} y={by} width={Math.max(end - left, 2)} height={18} rx={3} className={s[fillOf(g)]} />
            {off ? (
              <>
                <path d={`M${end - 30} ${by - 3}l6 24M${end - 24} ${by - 3}l6 24`} className={s.breakMark} />
                <text x={end - 38} y={by + 13} className={s.inBar} textAnchor="end">{num(v)} {unit}</text>
                <text x={end + 8} y={by + 13} className={s.s}>off scale</text>
              </>
            ) : (
              <text x={end + 8} y={by + 13} className={cx('val', inkOf(g))}>{num(v)} {unit}</text>
            )}
          </g>
        );
      })}
    </g>
  );
}

// A line per gateway, labeled at its right end. `log` sets a log10 y axis and `xLog` a log2
// x axis (for rates that double).
function LineChart({x, y, w, h, title, xs, xLog, yDomain, yTicks, yFmt, log, series, marks = []}) {
  const left = x + 52;
  const right = x + w - 96;
  const top = y + 26;
  const bottom = y + h - 22;
  const fx = xLog ? Math.log2 : v => v;
  const fy = log ? Math.log10 : v => v;
  const sx = v => left + ((fx(v) - fx(xs[0])) / (fx(xs[xs.length - 1]) - fx(xs[0]))) * (right - left);
  const sy = v => bottom - ((fy(v) - fy(yDomain[0])) / (fy(yDomain[1]) - fy(yDomain[0]))) * (bottom - top);
  // End labels sit at each line's last point, pushed apart so they never overlap.
  const ends = series.map(se => ({g: se.g, ly: sy(se.ys[se.ys.length - 1]) + 4})).sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < ends.length; i++) ends[i].ly = Math.max(ends[i].ly, ends[i - 1].ly + 14);
  const overflow = ends[ends.length - 1].ly - (bottom + 4);
  if (overflow > 0) ends.forEach(e => (e.ly -= overflow));
  return (
    <g>
      <text x={x} y={y + 6} className={s.t}>{title}</text>
      {yTicks.map(t => (
        <g key={t}>
          <line x1={left} x2={right} y1={sy(t)} y2={sy(t)} className={s.grid} />
          <text x={left - 8} y={sy(t) + 4} className={s.tick} textAnchor="end">{yFmt(t)}</text>
        </g>
      ))}
      {xs.map((v, i) => (
        <text key={v} x={sx(v)} y={bottom + 16} className={s.tick} textAnchor="middle">
          {i === xs.length - 1 ? `${v} rps` : v}
        </text>
      ))}
      {series.map(({g, ys, open = []}) => (
        <g key={g}>
          <path d={ys.map((v, i) => `${i ? 'L' : 'M'}${sx(xs[i])} ${sy(v)}`).join('')} className={cx('line', lineOf(g))} />
          {ys.map((v, i) =>
            open[i] ? (
              <circle key={i} cx={sx(xs[i])} cy={sy(v)} r={4.5} className={s.open} />
            ) : (
              <circle key={i} cx={sx(xs[i])} cy={sy(v)} r={g === 'rust' ? 3.4 : 2.8} className={s[fillOf(g)]} />
            ),
          )}
        </g>
      ))}
      {ends.map(({g, ly}) => (
        <text key={g} x={right + 10} y={ly} className={cx('s', inkOf(g), g === 'rust' && 'bold')}>{GW[g].name}</text>
      ))}
      {marks.map(m => (
        <text key={m.text} x={sx(m.x) + (m.dx || 0)} y={sy(m.y) + m.dy} className={s.tick} textAnchor={m.anchor || 'middle'}>{m.text}</text>
      ))}
    </g>
  );
}

// 1. The headline: every gateway at 50 rps with full features (Portkey has none).
const HEADLINE = [
  {title: 'Median overhead', unit: 'ms', max: 3, ticks: [0, 1, 2, 3], rows: [['rust', 0.9], ['bifrost', 1.2], ['portkey', 2.1], ['python', 79.3]]},
  {title: 'p99 overhead', unit: 'ms', max: 6, ticks: [0, 2, 4, 6], rows: [['rust', 1.8], ['bifrost', 4.2], ['portkey', 5.3], ['python', 1587.8]]},
  {title: 'CPU used', unit: 'cores', max: 3, ticks: [0, 1, 2, 3], rows: [['rust', 0.15], ['bifrost', 0.41], ['portkey', 0.49], ['python', 2.92]]},
  {title: 'Peak memory', unit: 'MiB', max: 10000, ticks: [0, 5000, 10000], rows: [['rust', 357], ['bifrost', 2809], ['portkey', 609], ['python', 9553]]},
];

export function HeadlineChart() {
  return (
    <Fig
      n="01"
      eyebrow="50 REQUESTS / SEC · FULL FEATURES"
      title="Same load, less overhead"
      viewBox="0 0 760 370"
      label="At 50 requests per second with full features. Median overhead: LiteLLM Rust 0.9 ms, Bifrost 1.2 ms, Portkey 2.1 ms, LiteLLM Python 79.3 ms. p99 overhead: LiteLLM Rust 1.8 ms, Bifrost 4.2 ms, Portkey 5.3 ms, LiteLLM Python 1,587.8 ms. CPU used: LiteLLM Rust 0.15 cores, Bifrost 0.41, Portkey 0.49, LiteLLM Python 2.92. Peak memory: LiteLLM Rust 357 MiB, Bifrost 2,809 MiB, Portkey 609 MiB, LiteLLM Python 9,553 MiB."
      caption="Lower is better. Five minutes per gateway, 4 cores and 16 GiB each, single run, every request served. Latency subtracts a direct-to-mock run at the same rate. Portkey runs with no features; OpenRouter used a separate test.">
      {HEADLINE.map((panel, i) => (
        <BarPanel key={panel.title} x={i % 2 ? 400 : 20} y={i < 2 ? 24 : 202} w={340} {...panel} />
      ))}
    </Fig>
  );
}

// 2. The rate sweep: 10 to 100 rps, five minutes each.
const SWEEP_RPS = [10, 25, 50, 75, 100];
const SWEEP = {
  python: {p50: [36.5, 41.2, 79.3, 42227.8, 56914.8], p99: [80.3, 392.8, 1587.8, 119568.7, 173336.2], cpu: [0.6, 1.42, 2.92, 3.83, 3.86], mem: [3923, 5812, 9553, 13753, 16076]},
  portkey: {p50: [2.6, 2.2, 2.1, 1.8, 1.8], p99: [7.7, 6.7, 5.3, 4.7, 4.7], cpu: [0.12, 0.25, 0.49, 0.67, 0.78], mem: [529, 566, 609, 670, 743]},
  bifrost: {p50: [2.0, 1.5, 1.2, 1.2, 1.2], p99: [5.3, 4.9, 4.2, 3.9, 4.4], cpu: [0.11, 0.23, 0.41, 0.64, 0.84], mem: [1021, 1680, 2809, 3969, 5307]},
  rust: {p50: [1.7, 1.0, 0.9, 0.6, 0.4], p99: [2.7, 1.7, 1.8, 1.3, 0.9], cpu: [0.04, 0.07, 0.15, 0.2, 0.26], mem: [117, 210, 357, 525, 659]},
};
// Python was overloaded at 75 and 100 rps: 78.9% and 29.3% of requests served.
const PY_OVERLOADED = [false, false, false, true, true];
const sweepSeries = (key, scale = 1) =>
  Object.entries(SWEEP).map(([g, d]) => ({g, ys: d[key].map(v => v / scale), open: g === 'python' ? PY_OVERLOADED : []}));
const LOG_TICKS = [1, 10, 100, 1000, 10000, 100000];

export function SweepChart() {
  const common = {w: 360, h: 250, xs: SWEEP_RPS};
  return (
    <Fig
      n="02"
      eyebrow="BY REQUEST RATE · FULL FEATURES"
      title="LiteLLM Rust gets cheaper per request as load rises"
      viewBox="0 0 760 540"
      label="Four line charts against 10, 25, 50, 75 and 100 requests per second. Median overhead on a log scale: LiteLLM Rust falls from 1.7 to 0.4 ms, Bifrost from 2.0 to 1.2 ms, Portkey from 2.6 to 1.8 ms, LiteLLM Python rises from 36.5 ms to 57 seconds. p99 overhead on a log scale: LiteLLM Rust 2.7 to 0.9 ms, Bifrost about 4 to 5 ms, Portkey 7.7 to 4.7 ms, LiteLLM Python 80 ms to 173 seconds. CPU: LiteLLM Rust 0.04 to 0.26 cores, Bifrost 0.11 to 0.84, Portkey 0.12 to 0.78, LiteLLM Python 0.6 to 3.86. Peak memory: LiteLLM Rust 117 to 659 MiB, Bifrost 1.0 to 5.2 GiB, Portkey 529 to 743 MiB, LiteLLM Python 3.8 to 15.7 GiB. LiteLLM Python was overloaded at 75 and 100 requests per second."
      caption="Latency axes are logarithmic and subtract a direct-to-mock run at the same rate (runs drift about ±0.7 ms). Open circles: Python was overloaded and served only 78.9% of requests at 75 rps and 29.3% at 100 rps. Portkey runs with no features.">
      <LineChart
        x={20}
        y={20}
        {...common}
        title="Median overhead"
        log
        yDomain={[0.3, 300000]}
        yTicks={LOG_TICKS}
        yFmt={ms}
        series={sweepSeries('p50')}
        marks={[
          {x: 75, y: 42227.8, dx: -10, dy: 4, text: '79% served', anchor: 'end'},
          {x: 100, y: 56914.8, dy: 18, text: '29% served', anchor: 'end'},
        ]}
      />
      <LineChart x={400} y={20} {...common} title="p99 overhead" log yDomain={[0.3, 300000]} yTicks={LOG_TICKS} yFmt={ms} series={sweepSeries('p99')} />
      <LineChart x={20} y={290} {...common} title="CPU used" yDomain={[0, 4]} yTicks={[0, 1, 2, 3, 4]} yFmt={v => `${v} cores`} series={sweepSeries('cpu')} />
      <LineChart x={400} y={290} {...common} title="Peak memory" yDomain={[0, 16]} yTicks={[0, 4, 8, 12, 16]} yFmt={v => `${v} GiB`} series={sweepSeries('mem', 1024)} />
    </Fig>
  );
}

// 3. 870k to 1M token requests, every one streamed.
const BIG_RPS = [0.5, 1, 2, 4, 8];
const BIG = {
  portkey: {p50: [79.7, 74.4, 73.0, 73.5, 78.5], p99: [114.4, 109.3, 138.8, 144.2, 187.4], mem: [0.7, 1.1, 1.5, 2.2, 4.1]},
  bifrost: {p50: [41.0, 39.7, 37.0, 34.9, 35.0], p99: [93.4, 82.2, 87.9, 78.5, 89.1], mem: [1.7, 2.9, 4.8, 7.5, 13.6]},
  rust: {p50: [20.5, 20.8, 20.2, 19.9, 20.0], p99: [32.8, 35.2, 32.6, 31.7, 30.4], mem: [0.2, 0.2, 0.3, 0.4, 0.6]},
};
const bigSeries = key => Object.entries(BIG).map(([g, d]) => ({g, ys: d[key]}));

export function BigBodiesChart() {
  const common = {xs: BIG_RPS, xLog: true};
  return (
    <Fig
      n="03"
      eyebrow="1M-TOKEN REQUESTS · ~4 MB EACH · STREAMED"
      title="Large requests: flat first byte, flat memory"
      viewBox="0 0 760 530"
      label="Three line charts against 0.5, 1, 2, 4 and 8 requests per second, with 870k to 1M token requests, every one streamed. First-byte overhead at p50: LiteLLM Rust about 20 ms throughout, Bifrost 35 to 41 ms, Portkey 73 to 80 ms. At p99: LiteLLM Rust 30 to 35 ms, Bifrost 78 to 93 ms, Portkey 109 to 187 ms. Peak memory: LiteLLM Rust 0.2 to 0.6 GiB, Portkey 0.7 to 4.1 GiB, Bifrost 1.7 to 13.6 GiB."
      caption="Basic features; Portkey has none. Three minutes per rate, 4 cores and 16 GiB per pod. First byte includes moving 4 MB over two hops, with no direct-to-mock run subtracted. Portkey served 99.85% at 4 rps; every other point served 100%.">
      <LineChart x={20} y={20} w={360} h={240} {...common} title="First-byte overhead, p50" yDomain={[0, 100]} yTicks={[0, 25, 50, 75, 100]} yFmt={ms} series={bigSeries('p50')} />
      <LineChart x={400} y={20} w={360} h={240} {...common} title="First-byte overhead, p99" yDomain={[0, 200]} yTicks={[0, 50, 100, 150, 200]} yFmt={ms} series={bigSeries('p99')} />
      <LineChart x={20} y={280} w={740} h={240} {...common} title="Peak memory" yDomain={[0, 15]} yTicks={[0, 5, 10, 15]} yFmt={v => `${v} GiB`} series={bigSeries('mem')} />
    </Fig>
  );
}

// 4. One request, split by phase.
const PHASES = ['auth', 'limits and hooks', 'build request, call provider', 'everything else'];
const REQUESTS = [
  {g: 'python', label: 'LiteLLM Python, cached key', ms: [7.483, 2.768, 18.662, 4.78]},
  {g: 'python', label: 'LiteLLM Python, uncached key', ms: [19.989, 5.592, 18.841, 7.118]},
  {g: 'rust', label: 'LiteLLM Rust, cached key', ms: [0.143, 0.712, 0.789, 0.083]},
  {g: 'rust', label: 'LiteLLM Rust, uncached key', ms: [2.72, 0.592, 0.785, 0.08]},
];

function StackRows({y, max, ticks, rows}) {
  const left = 200;
  const span = 480;
  const sx = v => left + (v / max) * span;
  const step = 34;
  const bottom = y + rows.length * step - 6;
  return (
    <g>
      {ticks.map((t, i) => (
        <g key={t}>
          <line x1={sx(t)} x2={sx(t)} y1={y - 6} y2={bottom} className={s.grid} />
          <text x={sx(t)} y={bottom + 14} className={s.tick} textAnchor="middle">{i === ticks.length - 1 ? `${t} ms` : t}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        const by = y + i * step;
        let at = 0;
        return (
          <g key={r.label}>
            <text x={190} y={by + 15} className={cx('s', r.g === 'rust' && 'tRs')} textAnchor="end">{r.label}</text>
            {r.ms.map((v, p) => {
              const x0 = sx(at);
              at += v;
              return <rect key={p} x={x0} y={by} width={sx(at) - x0} height={20} className={cx('seg', fillOf(r.g), p && `ph${p}`)} />;
            })}
            <text x={sx(at) + 8} y={by + 15} className={cx('val', inkOf(r.g))}>{num(sum(r.ms), 1)} ms</text>
          </g>
        );
      })}
    </g>
  );
}

export function RequestPhasesChart() {
  return (
    <Fig
      n="04"
      eyebrow="ONE NON-STREAMED CHAT COMPLETION"
      title="Where a request spends its time"
      viewBox="0 0 760 350"
      label="One request through each gateway, split into auth, limits and hooks, building the request and calling the provider, and everything else. LiteLLM Python with a cached key: 7.5, 2.8, 18.7 and 4.8 ms, 33.7 ms in all. LiteLLM Python with an uncached key: 20.0, 5.6, 18.8 and 7.1 ms, 51.5 ms in all. LiteLLM Rust with a cached key: 0.14, 0.71, 0.79 and 0.08 ms, 1.7 ms in all. LiteLLM Rust with an uncached key: 2.72, 0.59, 0.79 and 0.08 ms, 4.2 ms in all. A second scale enlarges the two LiteLLM Rust requests twelve times."
      caption="One pinned core per gateway, all callbacks on. Python phases are VizTracer times scaled to the untraced time of the same request; Rust phases come from in-gateway span timers.">
      <defs>
        <marker id="bb-phase-head" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0L10 5L0 10Z" className={s.headSoft} />
        </marker>
      </defs>
      <text x={20} y={20} className={s.e}>ALL FOUR · SAME SCALE</text>
      <StackRows y={36} max={55} ticks={[0, 10, 20, 30, 40, 50]} rows={REQUESTS} />

      {/* The Rust bars are slivers at this scale, so frame them and enlarge them below. */}
      <rect x={195} y={100} width={36} height={60} rx={6} className={s.frame} />
      <path d="M213 160V222" className={s.wireSoft} markerEnd="url(#bb-phase-head)" />
      <text x={20} y={220} className={s.e}>LITELLM RUST ONLY · 12× ZOOM</text>
      <StackRows y={236} max={4.5} ticks={[0, 1, 2, 3, 4]} rows={REQUESTS.slice(2)} />

      {PHASES.map((name, p) => (
        <g key={name} transform={`translate(${170 + [0, 74, 210, 410][p]} 330)`}>
          <rect y={-10} width={14} height={12} rx={2} className={cx('swatch', p && `ph${p}`)} />
          <text x={20} className={s.s}>{name}</text>
        </g>
      ))}
    </Fig>
  );
}

// 5. Heap held per open stream, by what holds it.
const HEAP = [
  {g: 'python', name: 'LiteLLM Python', parts: [['parsed request', 3.22], ['raw body', 2.85], ['json.dumps for logging', 2.45], ['outbound bytes', 2.43]]},
  {g: 'bifrost', name: 'Bifrost', parts: [['parsed request', 3.59], ['re-encoded messages', 1.9], ['trace text', 1.89], ['trace summary', 1.88], ['outbound (SetBody)', 1.5], ['inbound read', 0.4]]},
  {g: 'rust', name: 'LiteLLM Rust', parts: [['read buffers and per-call state', 0.47]]},
  {g: 'rust', name: 'LiteLLM Rust + S3 logs', parts: [['body kept for the S3 log', 2.45], ['read buffers and per-call state', 0.47]]},
];
const BODY_MB = 2.45;
const MB_PX = 58;
const SEG_H = 50;
const CHAR_PX = 5.8; // rough width of one character of segment text

// Fit a name into `width` px on one line, or on two balanced lines; null if it can't fit.
const fitLines = (name, width) => {
  const max = Math.floor(width / CHAR_PX);
  if (name.length <= max) return [name];
  const words = name.split(' ');
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const pair = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const longest = Math.max(...pair.map(line => line.length));
    if (longest <= max && (!best || longest < best.longest)) best = {pair, longest};
  }
  return best ? best.pair : null;
};

export function HeapChart() {
  const left = 20;
  const sx = mb => left + mb * MB_PX;
  let y = 52;
  const blocks = HEAP.map(h => {
    let at = 0;
    const parts = h.parts.map(([name, mb]) => {
      const x0 = sx(at);
      at += mb;
      const w = sx(at) - x0;
      return {name, mb, x0, w, lines: fitLines(name, w - 12)};
    });
    // Parts too narrow for their text get a callout under the bar instead.
    const callouts = parts.filter(p => !p.lines);
    const block = {...h, y, parts, callouts, total: at};
    y += SEG_H + 46 + (callouts.length ? 26 : 0);
    return block;
  });
  const height = y - 20;
  return (
    <Fig
      n="05"
      eyebrow="500K-TOKEN STREAM · 2.45 MB BODY"
      title="Heap held per open stream"
      viewBox={`0 0 760 ${height}`}
      label="Heap held for each open stream of a 500k-token, 2.45 MB request. LiteLLM Python holds 10.95 MB: the parsed request, 3.22 MB; the raw body, 2.85 MB; a json.dumps copy for logging, 2.45 MB; and the outbound bytes, 2.43 MB; about four and a half copies of the body. Bifrost holds 11.16 MB: the parsed request, 3.59 MB; re-encoded messages, 1.9 MB; trace text, 1.89 MB; a trace summary, 1.88 MB; the outbound body, 1.5 MB; and the inbound read, 0.4 MB. LiteLLM Rust holds 0.47 MB of read buffers and per-call state, and no copy of the body. With S3 logs on, LiteLLM Rust holds 2.92 MB: one copy of the body for the log, 2.45 MB, plus the same buffers."
      caption="Profiled heap allocations, not process RSS: memray for Python, pprof for Bifrost, heaptrack for Rust, one core per gateway. With S3 logs on, Rust keeps one copy of the body for the stream's life.">
      {[1, 2, 3, 4].map(k => (
        <g key={k}>
          <line x1={sx(k * BODY_MB)} x2={sx(k * BODY_MB)} y1={30} y2={height - 6} className={s.guide} />
          <text x={sx(k * BODY_MB)} y={22} className={s.tick} textAnchor="middle">{k}×</text>
        </g>
      ))}
      <text x={sx(4 * BODY_MB) + 28} y={22} className={s.tick}>copies of the body</text>
      {blocks.map(b => {
        const top = b.y + 10;
        return (
          <g key={b.name}>
            <text x={left} y={b.y} className={cx('t', b.g === 'rust' && 'tRs')}>{b.name}</text>
            {b.parts.map(p => (
              <g key={p.name}>
                <rect x={p.x0 + 1} y={top} width={p.w - 2} height={SEG_H} rx={6} className={s[`seg${GW[b.g].v}`]} />
                {p.lines && (
                  <>
                    {p.lines.map((line, i) => (
                      <text key={i} x={p.x0 + 8} y={top + 17 + i * 13 - (p.lines.length - 1) * 6} className={s.segText}>{line}</text>
                    ))}
                    <text x={p.x0 + 8} y={top + SEG_H - 9} className={cx('segSize', inkOf(b.g))}>{p.mb} MB</text>
                  </>
                )}
              </g>
            ))}
            <text x={sx(b.total) + 10} y={top + SEG_H / 2 + 5} className={cx('val', inkOf(b.g))}>{num(b.total)} MB</text>
            {b.callouts.map(p => {
              const cxp = p.x0 + p.w / 2;
              const alignEnd = cxp > 400;
              return (
                <g key={`c-${p.name}`}>
                  <path d={`M${cxp} ${top + SEG_H + 2}V${top + SEG_H + 12}`} className={s.leader} />
                  <text x={cxp + (alignEnd ? 6 : -6)} y={top + SEG_H + 24} className={s.segText} textAnchor={alignEnd ? 'end' : 'start'}>
                    {p.name} <tspan className={cx('segSize', inkOf(b.g))}>{p.mb} MB</tspan>
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </Fig>
  );
}
