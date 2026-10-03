// Median TTFB: https://github.com/BerriAI/litellm/pull/44221
import React from 'react';
import styles from './diagrams.module.css';

const benchmarks = [
  {endpoint: 'Chat completions', before: 553, after: 35},
  {endpoint: 'Messages', before: 542, after: 40},
];

export function BenchmarkResults() {
  return (
    <figure className={styles.figure}>
      <div className={styles.heading}>
        <strong>Time to first byte</strong>
        <span className={styles.context}>Median of three requests</span>
      </div>
      <div className={styles.benchmarkGrid}>
        {benchmarks.map((item) => (
          <div className={styles.benchmarkCard} key={item.endpoint}>
            <div className={styles.cardHeading}>
              <span>{item.endpoint}</span>
            </div>
            <div className={styles.comparison}>
              <div>
                <span className={styles.metricLabel}>Before</span>
                <span className={styles.beforeValue}>{item.before}<small>ms</small></span>
              </div>
              <span className={styles.arrow} aria-hidden="true">→</span>
              <div>
                <span className={styles.metricLabel}>After</span>
                <span className={styles.afterValue}>{item.after}<small>ms</small></span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <figcaption className={styles.caption}>
        440k-token conversation · prompt-caching check enabled · instant mock upstream
      </figcaption>
    </figure>
  );
}
