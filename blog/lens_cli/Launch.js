import React, {useEffect, useRef, useState} from 'react';
import styles from './styles.module.css';

const LENS_LOGO = `██▄         ██████████▄ ██▄     ██▄   ████████▄
███         ███▀▀▀▀▀▀▀▀ ████▄   ███ ██▄▀▀▀▀▀▀▀▀
███         ████████▄   ███▀██▄ ███  ▀██████▄
███         ███▀▀▀▀▀▀   ███  ▀█████    ▀▀▀▀▀██▄
██████████▄ ██████████▄ ███    ▀███ ████████▄▀▀
 ▀▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀▀  ▀▀      ▀▀  ▀▀▀▀▀▀▀▀`;
const COMMAND = 'lens show';
const RESULTS = [
  {
    "rank": 1,
    "harness": "Claude Agent SDK",
    "glyph": "\u273b",
    "brandColor": "#D97757",
    "model": "gpt-5.4-mini",
    "passed": 24,
    "failed": 0,
    "errors": 0,
    "passRate": 100.0,
    "cost": 0.024874500000000004,
    "costPerPass": 0.0010364375000000002,
    "p50": 1.663863834,
    "recommended": true
  },
  {
    "rank": 2,
    "harness": "OpenAI Agents",
    "glyph": "\u25ce",
    "brandColor": "#E8E8E8",
    "model": "gpt-5.5",
    "passed": 24,
    "failed": 0,
    "errors": 0,
    "passRate": 100.0,
    "cost": 0.068675,
    "costPerPass": 0.0028614583333333335,
    "p50": 2.274153959,
    "recommended": false
  },
  {
    "rank": 3,
    "harness": "Claude Agent SDK",
    "glyph": "\u273b",
    "brandColor": "#D97757",
    "model": "gpt-5.5",
    "passed": 24,
    "failed": 0,
    "errors": 0,
    "passRate": 100.0,
    "cost": 0.12601500000000002,
    "costPerPass": 0.005250625000000001,
    "p50": 2.80204625,
    "recommended": false
  },
  {
    "rank": 4,
    "harness": "Deep Agents",
    "glyph": "\u2b21",
    "brandColor": "#7FC8C0",
    "model": "gpt-5.5",
    "passed": 24,
    "failed": 0,
    "errors": 0,
    "passRate": 100.0,
    "cost": 0.379485,
    "costPerPass": 0.015811875,
    "p50": 2.354434542,
    "recommended": false
  },
  {
    "rank": 5,
    "harness": "Deep Agents",
    "glyph": "\u2b21",
    "brandColor": "#7FC8C0",
    "model": "gpt-5.4-mini",
    "passed": 23,
    "failed": 1,
    "errors": 0,
    "passRate": 95.83333333333333,
    "cost": 0.07152900000000001,
    "costPerPass": 0.0031099565217391307,
    "p50": 1.5373508340000002,
    "recommended": false
  },
  {
    "rank": 6,
    "harness": "Claude Agent SDK",
    "glyph": "\u273b",
    "brandColor": "#D97757",
    "model": "claude-sonnet-5-5",
    "passed": 23,
    "failed": 1,
    "errors": 0,
    "passRate": 95.83333333333333,
    "cost": 0.07645199999999999,
    "costPerPass": 0.0033239999999999997,
    "p50": 1.767168209,
    "recommended": false
  },
  {
    "rank": 7,
    "harness": "Deep Agents",
    "glyph": "\u2b21",
    "brandColor": "#7FC8C0",
    "model": "claude-sonnet-5-5",
    "passed": 23,
    "failed": 1,
    "errors": 0,
    "passRate": 95.83333333333333,
    "cost": 0.274952,
    "costPerPass": 0.011954434782608695,
    "p50": 1.537578667,
    "recommended": false
  },
  {
    "rank": 8,
    "harness": "OpenAI Agents",
    "glyph": "\u25ce",
    "brandColor": "#E8E8E8",
    "model": "gpt-5.4-mini",
    "passed": 22,
    "failed": 2,
    "errors": 0,
    "passRate": 91.66666666666667,
    "cost": 0.00876,
    "costPerPass": 0.0003981818181818182,
    "p50": 1.421009958,
    "recommended": false
  },
  {
    "rank": 9,
    "harness": "OpenAI Agents",
    "glyph": "\u25ce",
    "brandColor": "#E8E8E8",
    "model": "claude-opus-5-5",
    "passed": 22,
    "failed": 2,
    "errors": 0,
    "passRate": 91.66666666666667,
    "cost": 0.10354399999999998,
    "costPerPass": 0.004706545454545454,
    "p50": 1.375606833,
    "recommended": false
  },
  {
    "rank": 10,
    "harness": "Deep Agents",
    "glyph": "\u2b21",
    "brandColor": "#7FC8C0",
    "model": "claude-opus-5-5",
    "passed": 22,
    "failed": 2,
    "errors": 0,
    "passRate": 91.66666666666667,
    "cost": 0.5531039999999999,
    "costPerPass": 0.025141090909090905,
    "p50": 1.38707825,
    "recommended": false
  },
  {
    "rank": 11,
    "harness": "OpenAI Agents",
    "glyph": "\u25ce",
    "brandColor": "#E8E8E8",
    "model": "claude-sonnet-5-5",
    "passed": 20,
    "failed": 4,
    "errors": 0,
    "passRate": 83.33333333333333,
    "cost": 0.05172199999999998,
    "costPerPass": 0.002586099999999999,
    "p50": 1.923955667,
    "recommended": false
  },
  {
    "rank": 12,
    "harness": "Claude Agent SDK",
    "glyph": "\u273b",
    "brandColor": "#D97757",
    "model": "claude-opus-5-5",
    "passed": 12,
    "failed": 12,
    "errors": 0,
    "passRate": 50.0,
    "cost": 0.17777199999999999,
    "costPerPass": 0.014814333333333332,
    "p50": 2.051267292,
    "recommended": false
  }
];

function CostQualityChart({visibleCount, activeRank, onPreview, onSelect}) {
  const plot = {left: 42, top: 24, width: 330, height: 174};
  const lowCost = Math.min(...RESULTS.map(row => row.cost)) / 1.4;
  const highCost = Math.max(...RESULTS.map(row => row.cost)) * 1.4;
  const x = cost => plot.left + Math.log(cost / lowCost) / Math.log(highCost / lowCost) * plot.width;
  const y = rate => plot.top + (102 - rate) / 32 * plot.height;
  const points = RESULTS.filter(row => row.passRate >= 70 && row.rank <= visibleCount);
  const frontier = RESULTS.filter(row => !RESULTS.some(other =>
    other.cost <= row.cost && other.passRate >= row.passRate &&
    (other.cost < row.cost || other.passRate > row.passRate)
  )).sort((a, b) => a.cost - b.cost);
  const hitRadius = row => {
    const nearest = Math.min(...points.filter(other => other.rank !== row.rank).map(other =>
      Math.hypot(x(row.cost) - x(other.cost), y(row.passRate) - y(other.passRate))
    ));
    return Math.max(3.5, Math.min(11, nearest / 2));
  };
  const activateKey = (event, rank) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(rank);
    }
  };
  return (
    <section className={styles.chart} aria-label="Cost versus quality of the saved sample run">
      <h3><span>▍</span> Cost vs quality</h3>
      <svg viewBox="0 0 410 240" role="group" aria-labelledby="lens-cli-chart-title">
        <title id="lens-cli-chart-title">Select a saved configuration to inspect its pass rate and estimated cost. The cost axis is logarithmic.</title>
        <text x="4" y="12" className={styles.axisTitle}>Pass rate</text>
        {[70, 80, 90, 100].map(rate => <g key={rate}>
          <line x1={plot.left} x2={plot.left + plot.width} y1={y(rate)} y2={y(rate)} className={styles.gridLine} />
          <text x="34" y={y(rate) + 4} textAnchor="end" className={styles.axisText}>{rate}%</text>
        </g>)}
        <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.top + plot.height} className={styles.axisLine} />
        <line x1={plot.left} x2={plot.left + plot.width} y1={plot.top + plot.height} y2={plot.top + plot.height} className={styles.axisLine} />
        {[0.01, 0.03, 0.1, 0.3, 0.6].map(cost => <g key={cost}>
          <line x1={x(cost)} x2={x(cost)} y1={plot.top + plot.height} y2={plot.top + plot.height + 5} className={styles.axisLine} />
          <text x={x(cost)} y={plot.top + plot.height + 19} textAnchor="middle" className={styles.axisText}>${cost.toFixed(2)}</text>
        </g>)}
        {visibleCount === RESULTS.length && <polyline points={frontier.map(row => `${x(row.cost)},${y(row.passRate)}`).join(' ')} className={styles.frontier} />}
        {[...points].reverse().map(row => <g
          key={row.rank}
          className={`${styles.chartPoint} ${row.rank === activeRank ? styles.activePoint : ''}`}
          style={{'--brand': row.brandColor}}
          tabIndex={0}
          role="button"
          aria-label={`Inspect rank ${row.rank}, ${row.harness}, ${row.model}`}
          onMouseEnter={() => onPreview(row.rank)}
          onMouseLeave={() => onPreview(null)}
          onFocus={() => onPreview(row.rank)}
          onBlur={() => onPreview(null)}
          onClick={() => onSelect(row.rank)}
          onKeyDown={event => activateKey(event, row.rank)}
        >
          <title>{row.rank}. {row.harness}, {row.model}: {row.passRate.toFixed(1)}%, ${row.cost.toFixed(4)} estimated total cost</title>
          <circle className={styles.pointHitArea} cx={x(row.cost)} cy={y(row.passRate)} r={hitRadius(row)} />
          <circle className={styles.pointDot} cx={x(row.cost)} cy={y(row.passRate)} r={row.rank === activeRank ? 5 : 3.5} />
          {(row.rank <= 4 || row.rank === activeRank) && <text x={x(row.cost) + 8} y={y(row.passRate) + (row.rank === 5 || row.rank === 6 ? 14 : 4)}>{row.rank}</text>}
        </g>)}
        <text x="208" y="237" textAnchor="middle" className={styles.axisTitle}>Estimated total cost (USD, log)</text>
      </svg>
      {visibleCount === RESULTS.length && <button type="button" className={`${styles.outlier} ${activeRank === 12 ? styles.activeOutlier : ''}`} onMouseEnter={() => onPreview(12)} onMouseLeave={() => onPreview(null)} onFocus={() => onPreview(12)} onBlur={() => onPreview(null)} onClick={() => onSelect(12)}>12&nbsp; Claude SDK / claude-opus-5-5&nbsp; ·&nbsp; 50%&nbsp; ▼</button>}
      <p className={styles.chartHint}>Select a row or point to inspect the configuration.</p>
    </section>
  );
}

function NativeCliPreview() {
  const sceneRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [selectedRank, setSelectedRank] = useState(1);
  const [previewRank, setPreviewRank] = useState(null);
  const activeRank = previewRank ?? selectedRank;
  const complete = elapsed >= 4500;
  const playing = visible && !hidden && !reducedMotion && !complete;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      setReducedMotion(query.matches);
    };
    const updateVisibility = () => setHidden(document.hidden);
    updateMotion();
    updateVisibility();
    query.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {threshold: 0.08});
    observer.observe(sceneRef.current);
    return () => {
      observer.disconnect();
      query.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => setElapsed(value => Math.min(value + 100, 4500)), 100);
    return () => window.clearInterval(timer);
  }, [playing]);

  const tick = reducedMotion ? 4500 : elapsed;
  const typed = COMMAND.slice(0, Math.floor(tick / 70));
  const visibleCount = Math.min(RESULTS.length, Math.max(0, Math.floor((tick - 650) / 250) + 1));
  const ready = visibleCount === RESULTS.length;
  const active = RESULTS.find(row => row.rank === activeRank);


  return (
    <figure ref={sceneRef} className={styles.cliPreview} data-playing={playing || undefined}>
      <div className={styles.terminal}>
        <button type="button" className={styles.command} aria-label="Replay the saved sample report" title="Replay the saved sample report" onClick={() => { setElapsed(0); setSelectedRank(1); setPreviewRank(null); }}><span className={styles.prompt}>❯</span> {typed}<span className={styles.cursor} /></button>
        <div className={styles.reportMeta}><strong>Saved evaluation</strong><span>24 sample tasks × 12 configurations · 288 attempts</span></div>
        <div className={styles.savedReport}>
          <div className={`${styles.recommendation} ${!ready ? styles.pending : ''}`}><span>⏺ Recommendation</span><strong>Claude Agent SDK + gpt-5.4-mini</strong><small>24 / 24 passed · $0.0249 estimated total cost</small></div>
          <div className={styles.reportGrid}>
            <section className={styles.results} aria-label="Twelve ranked configurations from the saved sample run">
              <h3><span>▍</span> Results <small>{visibleCount} / 12 rows</small></h3>
              <div className={styles.tableScroll}>
                <table className={styles.rankTable}>
                  <thead><tr><th scope="col">#</th><th scope="col">Harness</th><th scope="col">Model</th><th scope="col">Pass</th><th scope="col">Fail</th><th scope="col">Err</th><th scope="col">Est. cost</th><th scope="col">$/pass</th><th scope="col">P50</th></tr></thead>
                  <tbody>{RESULTS.map(row => <tr
                    key={row.rank}
                    className={`${row.recommended ? styles.recommendedRow : ''} ${row.rank === activeRank ? styles.activeRow : ''} ${row.rank > visibleCount ? styles.unrevealedRow : ''}`}
                    aria-hidden={row.rank > visibleCount || undefined}
                    onMouseEnter={() => setPreviewRank(row.rank)}
                    onMouseLeave={() => setPreviewRank(null)}
                    onFocus={() => setPreviewRank(row.rank)}
                    onBlur={() => setPreviewRank(null)}
                    onClick={() => setSelectedRank(row.rank)}
                  >
                    <td><button type="button" className={styles.rankSelect} tabIndex={row.rank <= visibleCount ? 0 : -1} aria-label={`Inspect rank ${row.rank}, ${row.harness}, ${row.model}`} onClick={() => setSelectedRank(row.rank)}>{row.rank}</button></td>
                    <td><span className={styles.brandGlyph} style={{color: row.brandColor}}>{row.glyph}</span> {row.harness}</td>
                    <td><span className={styles.brandGlyph} style={{color: row.model.startsWith('claude') ? '#D97757' : '#E8E8E8'}}>{row.model.startsWith('claude') ? '✻' : '◎'}</span> {row.model}</td>
                    <td className={styles.passValue}>{row.passRate.toFixed(1)}%</td><td className={row.failed ? styles.failValue : styles.mutedValue}>{row.failed}</td><td className={row.errors ? styles.errorValue : styles.mutedValue}>{row.errors}</td><td>${row.cost.toFixed(4)}</td><td>${row.costPerPass.toFixed(4)}</td><td>{row.p50.toFixed(1)}s</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </section>
            <div className={styles.chartColumn}>
              <CostQualityChart visibleCount={visibleCount} activeRank={activeRank} onPreview={setPreviewRank} onSelect={setSelectedRank} />
              <div className={`${styles.configurationDetail} ${active.rank > visibleCount ? styles.pending : ''}`} aria-live="polite" aria-atomic="true">
                <strong><span style={{color: active.brandColor}}>{active.glyph}</span> {active.harness}</strong>
                <span>{active.model}</span>
                <small>{active.passRate.toFixed(1)}% pass · ${active.cost.toFixed(4)} estimated cost · p50 {active.p50.toFixed(1)}s</small>
              </div>
            </div>
          </div>
          <div className={styles.terminalFooter}><span>263 pass · 25 fail · 0 errors</span><span>Saved sample · full report below</span></div>
        </div>
      </div>
      <figcaption className={styles.replayCaption}>Saved-report replay, revealed in rank order. Costs are token-based estimates.</figcaption>
    </figure>
  );
}

export default function LaunchHero() {
  return (
    <header className={styles.hero} data-full-width>
      <div className={styles.heroContent}>
        <h1><span className={styles.screenReaderOnly}>Lens CLI</span><span className={styles.brandRow} aria-hidden="true"><span className={styles.asciiHeading}>{LENS_LOGO}</span><span className={styles.cliLabel}>CLI</span></span></h1>
        <p className={styles.tagline}>Evaluate models, harnesses, and custom agents on your own tasks.</p>
        <NativeCliPreview />
        <p className={styles.byline}>Private preview <span aria-hidden="true">·</span> November 21, 2026 <span aria-hidden="true">·</span> Ishaan Jaffer</p>
        <a className={styles.cta} href="/docs/proxy/lens/cli">Read the walkthrough</a>
      </div>
    </header>
  );
}

export function PreviewNote() {
  return (
    <aside className={styles.preview}>
      <strong>Private preview.</strong> You need access to the SDK-backed Lens CLI to follow this walkthrough.
    </aside>
  );
}

export function ReportFigure({src, alt, children}) {
  return (
    <figure className={styles.figure} data-full-width>
      <img src={src} alt={alt} loading="lazy" />
      <figcaption>{children}</figcaption>
    </figure>
  );
}
