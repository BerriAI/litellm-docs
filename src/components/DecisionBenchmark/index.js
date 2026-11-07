import React from 'react';
import guardrails from '@site/src/data/decision-benchmarks/guardrails.json';
import autorouter from '@site/src/data/decision-benchmarks/autorouter.json';
import lensSignals from '@site/src/data/decision-benchmarks/lens-signals.json';
import styles from './styles.module.css';

// One leaderboard per benchmark, drawn from the JSON in src/data/decision-benchmarks.
// Each row is a stacked bar over the same number of decisions: agrees, two kinds
// of error, and no answer. To add a model or a new run, edit the JSON.
const BENCHMARKS = {guardrails, autorouter, 'lens-signals': lensSignals};

const SEGMENTS = [
  ['agree', styles.agree],
  ['errorA', styles.errorA],
  ['errorB', styles.errorB],
  ['noAnswer', styles.noAnswer],
];

// Round half to even, so 69 of 80 shows as 86.2%, as on the original charts.
function percent(n, total) {
  const tenths = (n * 1000) / total;
  const floor = Math.floor(tenths);
  const rounded = tenths - floor === 0.5 ? (floor % 2 ? floor + 1 : floor) : Math.round(tenths);
  return (rounded / 10).toFixed(1);
}

function costText(row, unit) {
  if (row.selfHosted) return 'your hardware';
  if (row.costPer1k == null) return 'cost not tracked';
  return `$${row.costPer1k.toFixed(3)} / 1k ${unit}`;
}

function Row({row, data}) {
  const counts = SEGMENTS.map(([key]) => row[key] || 0);
  const sum = counts.reduce((a, b) => a + b, 0);
  if (sum !== data.total) {
    return <div className={styles.invalid}>{row.model}: the counts add up to {sum}, not {data.total}. Check src/data/decision-benchmarks/{data.id}.json</div>;
  }
  const pct = percent(row.agree, data.total);
  const summary = SEGMENTS.filter(([key]) => row[key] && data.labels[key])
    .map(([key]) => `${data.labels[key]}: ${row[key]}`)
    .join(', ');
  return (
    <div className={styles.row}>
      <div className={styles.model}>
        <div className={styles.name}>{row.model}</div>
        <div className={styles.meta}>{row.provider}</div>
        <div className={styles.meta}>{costText(row, data.costUnit)} · p50 {row.p50Seconds.toFixed(2)}s</div>
      </div>
      <div className={styles.barCell}>
        <div className={styles.bar} role="img" aria-label={`${row.model}, ${pct}%. ${summary}`}>
          {SEGMENTS.map(([key, cls]) =>
            row[key] ? (
              <span
                key={key}
                className={cls}
                style={{flexGrow: row[key]}}
                title={`${data.labels[key]}: ${row[key]} of ${data.total}`}
              />
            ) : null,
          )}
        </div>
        {row.evidencePct != null && (
          <div className={styles.note}>right evidence passage for <b>{row.evidencePct}%</b> of yes answers</div>
        )}
        {row.note && <div className={styles.note}>{row.note}</div>}
      </div>
      <div className={styles.score}>
        <div className={styles.pct}>{pct}<small>%</small></div>
        <div className={styles.of}>{row.agree} of {data.total}</div>
      </div>
    </div>
  );
}

export default function DecisionBenchmark({id}) {
  const data = BENCHMARKS[id];
  if (!data) return <div className={styles.invalid}>Unknown benchmark "{id}"</div>;
  return (
    <figure className={styles.chart} aria-label={data.title}>
      <div className={styles.legend} style={{marginTop: 0}}>
        {SEGMENTS.filter(([key]) => data.labels[key]).map(([key, cls]) => (
          <span key={key}><i className={cls} />{data.labels[key]}</span>
        ))}
      </div>
      {data.groups.map((group, gi) => {
        const rows = [...group.rows].sort((a, b) => b.agree - a.agree);
        const top = gi === 0 ? data.topTier || 0 : 0;
        return (
          <section key={group.label} className={styles.group}>
            <div className={styles.groupHead}>
              <span className={styles.groupLabel}>{group.label}</span>
              {group.note && <span className={styles.groupNote}>{group.note}</span>}
            </div>
            {top > 0 && (
              <div className={styles.tier}>
                <span className={styles.tierTag}>Top tier · within noise</span>
                {rows.slice(0, top).map((row) => <Row key={row.model} row={row} data={data} />)}
              </div>
            )}
            {rows.slice(top).map((row) => <Row key={row.model} row={row} data={data} />)}
          </section>
        );
      })}
      <p className={styles.footnote}>{data.footnote}</p>
    </figure>
  );
}
