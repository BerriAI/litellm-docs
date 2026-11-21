import React, {useEffect, useRef, useState} from 'react';
import styles from './styles.module.css';

const LOGO = `██▄         ██████████▄ ██▄     ██▄   ████████▄
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
    "model": "gpt-5.4-mini",
    "passed": 24,
    "passRate": 100.0,
    "cost": 0.024874500000000004,
    "recommended": true
  },
  {
    "rank": 2,
    "harness": "OpenAI Agents",
    "model": "gpt-5.5",
    "passed": 24,
    "passRate": 100.0,
    "cost": 0.068675,
    "recommended": false
  },
  {
    "rank": 3,
    "harness": "Claude Agent SDK",
    "model": "gpt-5.5",
    "passed": 24,
    "passRate": 100.0,
    "cost": 0.12601500000000002,
    "recommended": false
  },
  {
    "rank": 4,
    "harness": "Deep Agents",
    "model": "gpt-5.5",
    "passed": 24,
    "passRate": 100.0,
    "cost": 0.379485,
    "recommended": false
  },
  {
    "rank": 5,
    "harness": "Deep Agents",
    "model": "gpt-5.4-mini",
    "passed": 23,
    "passRate": 95.83333333333333,
    "cost": 0.07152900000000001,
    "recommended": false
  },
  {
    "rank": 6,
    "harness": "Claude Agent SDK",
    "model": "claude-sonnet-5-5",
    "passed": 23,
    "passRate": 95.83333333333333,
    "cost": 0.07645199999999999,
    "recommended": false
  },
  {
    "rank": 7,
    "harness": "Deep Agents",
    "model": "claude-sonnet-5-5",
    "passed": 23,
    "passRate": 95.83333333333333,
    "cost": 0.274952,
    "recommended": false
  },
  {
    "rank": 8,
    "harness": "OpenAI Agents",
    "model": "gpt-5.4-mini",
    "passed": 22,
    "passRate": 91.66666666666667,
    "cost": 0.00876,
    "recommended": false
  },
  {
    "rank": 9,
    "harness": "OpenAI Agents",
    "model": "claude-opus-5-5",
    "passed": 22,
    "passRate": 91.66666666666667,
    "cost": 0.10354399999999998,
    "recommended": false
  },
  {
    "rank": 10,
    "harness": "Deep Agents",
    "model": "claude-opus-5-5",
    "passed": 22,
    "passRate": 91.66666666666667,
    "cost": 0.5531039999999999,
    "recommended": false
  },
  {
    "rank": 11,
    "harness": "OpenAI Agents",
    "model": "claude-sonnet-5-5",
    "passed": 20,
    "passRate": 83.33333333333333,
    "cost": 0.05172199999999998,
    "recommended": false
  },
  {
    "rank": 12,
    "harness": "Claude Agent SDK",
    "model": "claude-opus-5-5",
    "passed": 12,
    "passRate": 50.0,
    "cost": 0.17777199999999999,
    "recommended": false
  }
];

function CostQualityChart() {
  const plot = {left: 42, top: 24, width: 330, height: 174};
  const lowCost = Math.min(...RESULTS.map(row => row.cost)) / 1.4;
  const highCost = Math.max(...RESULTS.map(row => row.cost)) * 1.4;
  const x = cost => plot.left + Math.log(cost / lowCost) / Math.log(highCost / lowCost) * plot.width;
  const y = rate => plot.top + (102 - rate) / 32 * plot.height;
  const points = RESULTS.filter(row => row.passRate >= 70);
  const frontier = points.filter(row => !RESULTS.some(other =>
    other.cost <= row.cost && other.passRate >= row.passRate &&
    (other.cost < row.cost || other.passRate > row.passRate)
  )).sort((a, b) => a.cost - b.cost);
  return (
    <section className={styles.chart} aria-label="Cost versus quality of the saved sample run">
      <h3><span>▍</span> Cost vs quality</h3>
      <svg viewBox="0 0 410 240" role="img" aria-labelledby="lens-cli-chart-title">
        <title id="lens-cli-chart-title">Estimated cost on a log scale versus pass rate. Recommended rank one passed all twenty-four sample cases at an estimated total cost of 0.0248745 dollars.</title>
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
        <polyline points={frontier.map(row => `${x(row.cost)},${y(row.passRate)}`).join(' ')} className={styles.frontier} />
        {[...points].reverse().map(row => <g key={row.rank} className={row.recommended ? styles.recommendedPoint : styles.chartPoint}>
          <title>{row.rank}. {row.harness}, {row.model}: {row.passRate.toFixed(1)}%, ${row.cost.toFixed(4)} estimated total cost</title>
          <circle cx={x(row.cost)} cy={y(row.passRate)} r={row.recommended ? 4.5 : 3} />
          {row.rank <= 5 && <text x={x(row.cost) + 8} y={y(row.passRate) + (row.rank === 5 ? 13 : 4)}>{row.rank}</text>}
        </g>)}
        <text x="208" y="237" textAnchor="middle" className={styles.axisTitle}>Estimated total cost (USD, log)</text>
      </svg>
      <p className={styles.outlier}>12&nbsp; Claude SDK / claude-opus-5-5&nbsp; ·&nbsp; 50%&nbsp; ▼</p>
    </section>
  );
}

function NativeCliPreview() {
  const sceneRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const complete = elapsed >= 4200;
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
    const timer = window.setInterval(() => setElapsed(value => Math.min(value + 200, 4200)), 200);
    return () => window.clearInterval(timer);
  }, [playing]);

  const tick = reducedMotion ? 4200 : elapsed;
  const typed = COMMAND.slice(0, Math.floor(tick / 70));
  const ready = tick >= 1300;


  return (
    <figure ref={sceneRef} className={styles.cliPreview} data-playing={playing || undefined}>
      <div className={styles.terminal}>
        <div className={styles.command} aria-hidden="true"><span className={styles.prompt}>❯</span> {typed}<span className={styles.cursor} /></div>
        <div className={styles.nativeBrand}>
          <pre className={styles.asciiLogo} aria-hidden="true">{LOGO}</pre>
          <div className={styles.nativeBrandCopy}><strong>LENS REPORT</strong><span>24 sample tasks × 12 configurations</span><span>288 recorded attempts · local</span></div>
        </div>
        <div className={`${styles.savedReport} ${!ready ? styles.pending : ''}`}>
          <div className={styles.recommendation}><span>⏺ Recommendation</span><strong>Claude Agent SDK + gpt-5.4-mini</strong><small>24 / 24 passed · $0.0249 estimated total cost</small></div>
          <div className={styles.reportGrid}>
            <section className={styles.results} aria-label="Top five configurations from the saved sample run">
              <h3><span>▍</span> Results <small>top 5 of 12</small></h3>
              <table className={styles.rankTable}>
                <thead><tr><th scope="col">#</th><th scope="col">Harness</th><th scope="col">Model</th><th scope="col">Pass</th><th scope="col">Est. cost</th></tr></thead>
                <tbody>{RESULTS.slice(0, 5).map(row => <tr key={row.rank} className={row.recommended ? styles.recommendedRow : undefined}>
                  <td>{row.rank}</td><td>{row.harness}</td><td>{row.model}</td><td>{row.passRate.toFixed(1)}%</td><td>${row.cost.toFixed(4)}</td>
                </tr>)}</tbody>
              </table>
            </section>
            <CostQualityChart />
          </div>
          <div className={styles.terminalFooter}><span>263 pass · 25 fail · 0 errors</span><span>Full report below</span></div>
        </div>
      </div>
      <figcaption className={styles.replayCaption}>Animated replay of a saved sample report. Costs are token-based estimates.</figcaption>
    </figure>
  );
}

export default function LaunchHero() {
  return (
    <header className={styles.hero} data-full-width>
      <div className={styles.heroContent}>
        <h1>Lens CLI</h1>
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
