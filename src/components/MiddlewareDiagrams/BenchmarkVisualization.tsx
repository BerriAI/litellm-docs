import React from 'react';
import styles from './styles.module.css';

interface BenchmarkMetric {
  label: string;
  unit: string;
  python: number;
  rust: number;
  lowerIsBetter: boolean;
}

interface BenchmarkVisualizationProps {
  configLabel?: string;
  pythonLabel?: string;
  rustLabel?: string;
  metrics?: readonly BenchmarkMetric[];
}

const DEFAULT_METRICS: readonly BenchmarkMetric[] = [
  { label: 'Median latency', unit: 'ms', python: 21, rust: 13, lowerIsBetter: true },
  { label: 'Throughput', unit: 'RPS', python: 3_785, rust: 6_577, lowerIsBetter: false },
];

const formatValue = (value: number, unit: string): string => `${value.toLocaleString()} ${unit}`;

const getImprovement = ({ python, rust, lowerIsBetter }: BenchmarkMetric): string => {
  const ratio = lowerIsBetter ? 1 - rust / python : rust / python - 1;
  const direction = lowerIsBetter ? 'lower' : 'higher';

  return `${Math.round(ratio * 100)}% ${direction}`;
};

export default function BenchmarkVisualization({
  configLabel = '1,000 concurrent requests · 1 worker',
  pythonLabel = 'Python implementation',
  rustLabel = 'Rust core',
  metrics = DEFAULT_METRICS,
}: BenchmarkVisualizationProps) {
  return (
    <figure className={styles.benchmarkWrapper}>
      <figcaption className={styles.benchmarkConfig}>{configLabel}</figcaption>
      <div className={styles.chartLegend}>
        <span><i className={`${styles.legendSwatch} ${styles.pythonSwatch}`} />{pythonLabel}</span>
        <span><i className={`${styles.legendSwatch} ${styles.rustSwatch}`} />{rustLabel}</span>
      </div>
      <div className={styles.comparisonChart}>
        {metrics.map((metric) => {
          const maximum = Math.max(metric.python, metric.rust);

          return (
            <section className={styles.chartMetric} key={metric.label}>
              <div className={styles.chartMetricHeader}>
                <span>{metric.label}</span>
                <strong>{getImprovement(metric)}</strong>
              </div>
              <div className={styles.chartSeries}>
                <span className={styles.chartSeriesLabel}>Python</span>
                <div className={styles.chartTrack}>
                  <div className={`${styles.chartBar} ${styles.pythonBar}`} style={{ width: `${metric.python / maximum * 100}%` }} />
                </div>
                <span className={styles.chartValue}>{formatValue(metric.python, metric.unit)}</span>
              </div>
              <div className={styles.chartSeries}>
                <span className={styles.chartSeriesLabel}>Rust</span>
                <div className={styles.chartTrack}>
                  <div className={`${styles.chartBar} ${styles.rustBar}`} style={{ width: `${metric.rust / maximum * 100}%` }} />
                </div>
                <span className={styles.chartValue}>{formatValue(metric.rust, metric.unit)}</span>
              </div>
            </section>
          );
        })}
      </div>
    </figure>
  );
}
