import React from 'react';
import styles from './cost.module.css';

const DEVIN_TOTAL = 101872.24;
const MOYAI_PER_DAY = 700;

// Daily bar heights read off the Devin billing dashboard (Aug 30 to Sep 29), rescaled below to its stated total.
const DEVIN_SHAPE = [
  0.1, 0.9, 1.5, 1.6, 1.25, 0.65, 0.55, 0.1, 0.6, 2.35, 1.75, 2.45, 2.4, 1.9, 0.5, 3.95, 4.4, 5.3, 6.3,
  5.75, 3.4, 1.2, 8.75, 10.6, 8.2, 7.6, 2.6, 4.0, 1.0, 1.9, 2.8,
];

const SHAPE_SUM = DEVIN_SHAPE.reduce((a, b) => a + b, 0);
const DEVIN_CUMULATIVE = DEVIN_SHAPE.map((_, i) =>
  (DEVIN_SHAPE.slice(0, i + 1).reduce((a, b) => a + b, 0) / SHAPE_SUM) * DEVIN_TOTAL,
);
const DAYS = DEVIN_SHAPE.length;
const MOYAI_CUMULATIVE = DEVIN_SHAPE.map((_, i) => MOYAI_PER_DAY * (i + 1));
const MOYAI_TOTAL = MOYAI_CUMULATIVE[DAYS - 1];
const SAVED = DEVIN_TOTAL - MOYAI_TOTAL;
const SAVED_PCT = Math.round((SAVED / DEVIN_TOTAL) * 100);
const Y_MAX = Math.ceil(DEVIN_TOTAL / 20000) * 20000;

const W = 760, H = 320, PAD_L = 52, PAD_B = 34, PAD_T = 16, PAD_R = 150;
const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
const x = (i) => PAD_L + (i / (DAYS - 1)) * plotW;
const y = (v) => PAD_T + plotH - (v / Y_MAX) * plotH;
const line = (values) => values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
const back = (values) => values.map((_, i) => `L${x(DAYS - 1 - i).toFixed(1)},${y(values[DAYS - 1 - i]).toFixed(1)}`).join('');
const GAP = `${line(DEVIN_CUMULATIVE)}${back(MOYAI_CUMULATIVE)}Z`;

const usd = (v) => `$${Math.round(v).toLocaleString('en-US')}`;
const short = (v) => (v ? `$${v / 1000}k` : '$0');
const TICKS = Array.from({length: Y_MAX / 20000 + 1}, (_, i) => i * 20000);
const dayLabel = (i) => (i < 2 ? `Aug ${30 + i}` : `Sep ${i - 1}`);
const LABELS = [0, 6, 12, 18, 24, 30];
const END = x(DAYS - 1);
const MID = (DEVIN_TOTAL + MOYAI_TOTAL) / 2;

export default function CostChart() {
  return (
    <figure className={styles.cost}>
      <div className={styles.headline}>
        <span className={styles.pct}>{SAVED_PCT}% lower estimate</span>
        <span className={styles.headlineText}>
          About {usd(MOYAI_TOTAL)} estimated for Moyai vs our {usd(DEVIN_TOTAL)} Devin bill over 31 days.
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Internal 31-day comparison. The Devin bill totals ${usd(DEVIN_TOTAL)}; the Moyai estimate is ${usd(MOYAI_TOTAL)}, a difference of ${usd(SAVED)}. This is not a matched-workload benchmark.`}
      >
        {TICKS.map((v) => (
          <g key={v}>
            <line x1={PAD_L} x2={END} y1={y(v)} y2={y(v)} className={styles.grid} />
            <text x={PAD_L - 10} y={y(v) + 4} textAnchor="end" className={styles.axis}>{short(v)}</text>
          </g>
        ))}
        <path d={GAP} className={styles.gap} />
        <path d={line(DEVIN_CUMULATIVE)} className={styles.devin} />
        <path d={line(MOYAI_CUMULATIVE)} className={styles.line} />
        <circle cx={END} cy={y(DEVIN_TOTAL)} r="4" className={styles.devinDot} />
        <circle cx={END} cy={y(MOYAI_TOTAL)} r="4" className={styles.moyaiDot} />
        <line x1={END + 6} x2={END + 6} y1={y(DEVIN_TOTAL) + 10} y2={y(MOYAI_TOTAL) - 10} className={styles.bracket} />
        <text x={END + 14} y={y(DEVIN_TOTAL) + 4} className={styles.endLabel}>Devin {usd(DEVIN_TOTAL)}</text>
        <text x={END + 14} y={y(MID) + 4} className={styles.savedLabel}>gap {usd(SAVED)}</text>
        <text x={END + 14} y={y(MOYAI_TOTAL) + 4} className={styles.endLabelMoyai}>Moyai {usd(MOYAI_TOTAL)}</text>
        {LABELS.map((i) => (
          <text key={i} x={x(i)} y={H - 10} textAnchor="middle" className={styles.axis}>{dayLabel(i)}</text>
        ))}
      </svg>
      <figcaption>
        <span><i className={styles.swatchDevin} />Devin bill</span>
        <span><i className={styles.swatchMoyai} />Moyai estimate</span>
        <span><i className={styles.swatchGap} />Difference</span>
        <p className={styles.note}>Devin's daily curve is approximated from its billing dashboard and scaled to the invoice total. The Moyai line assumes $700/day for our team. Actual costs depend on your workload and infrastructure.</p>
      </figcaption>
    </figure>
  );
}
