import React from 'react';
import styles from './diagrams.module.css';

const benchmark = {
  before: {label: 'Before', value: '386', unit: 's'},
  after: {label: 'After', value: '3.2', unit: 's'},
  improvement: '120×',
  context: '30-day Usage view · 5,000 API keys · same database',
  metrics: [
    {label: 'Usage requests', before: '315', after: '6'},
    {label: 'Data transferred', before: '1.3 GB', after: '17 MB'},
    {label: 'Peak browser heap', before: '2.0 GB', after: '72 MB'},
  ],
};

const flows = [
  {
    id: 'before',
    label: 'Before',
    title: 'Download, then calculate',
    stages: [
      {label: 'Database', detail: 'Daily rows for every key'},
      {label: 'Transfer', detail: 'Page through the results'},
      {label: 'Browser', detail: 'Sum totals and sort keys'},
    ],
  },
  {
    id: 'after',
    label: 'After',
    title: 'Calculate, then download',
    stages: [
      {label: 'Database', detail: 'Aggregate across all keys'},
      {label: 'Transfer', detail: 'Totals and usage breakdowns'},
      {label: 'Browser', detail: 'Display the results'},
    ],
  },
];

function Arrow({className}) {
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true">
      <path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PerformanceResults() {
  return (
    <figure className={styles.figure}>
      <div className={styles.results}>
        <div className={styles.resultHeading}>
          <p className={styles.eyebrow}>Time to usage totals</p>
          <span className={styles.improvement}>{benchmark.improvement} faster in this benchmark</span>
        </div>
        <div className={styles.timing}>
          {[benchmark.before, benchmark.after].map((result, index) => (
            <React.Fragment key={result.label}>
              {index > 0 && <Arrow className={styles.timingArrow} />}
              <div className={index === 0 ? styles.beforeTime : styles.afterTime}>
                <span className={styles.timeLabel}>{result.label}</span>
                <span className={styles.timeValue}>{result.value}<span className={styles.timeUnit}>{result.unit}</span></span>
              </div>
            </React.Fragment>
          ))}
        </div>
        <table className={styles.metrics}>
          <thead>
            <tr>
              <th scope="col">30-day page load</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
            </tr>
          </thead>
          <tbody>
            {benchmark.metrics.map(metric => (
              <tr key={metric.label}>
                <th scope="row">{metric.label}</th>
                <td>{metric.before}</td>
                <td>{metric.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className={styles.caption}>{benchmark.context}</figcaption>
    </figure>
  );
}

export function UsageDataFlow() {
  return (
    <figure className={styles.figure}>
      <div className={styles.flows}>
        {flows.map(flow => (
          <div className={flow.id === 'after' ? `${styles.flow} ${styles.after}` : styles.flow} key={flow.id}>
            <div>
              <span className={styles.flowLabel}>{flow.label}</span>
              <p className={styles.flowTitle}>{flow.title}</p>
            </div>
            <ol className={styles.stages} aria-label={`${flow.label} data flow`}>
              {flow.stages.map((stage, index) => (
                <li className={styles.stage} key={stage.label}>
                  {index > 0 && <Arrow className={styles.flowArrow} />}
                  <span className={styles.stageLabel}>{stage.label}</span>
                  <span className={styles.stageDetail}>{stage.detail}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <figcaption className={styles.caption}>Aggregate in the database. Send less to the browser.</figcaption>
    </figure>
  );
}
