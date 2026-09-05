import React from 'react';
import styles from './styles.module.css';

interface BenchmarkMetric {
  label: string;
  unit: string;
  python: number;
  rust: number;
  lowerIsBetter: boolean;
}

interface BenchmarkProfile {
  name: string;
  description: string;
  metrics: readonly BenchmarkMetric[];
}

interface BenchmarkVisualizationProps {
  configLabel?: string;
  pythonLabel?: string;
  rustLabel?: string;
  profiles?: readonly BenchmarkProfile[];
}

const DEFAULT_PROFILES: readonly BenchmarkProfile[] = [
  {
    name: 'Default workload',
    description: '1,000 concurrent requests · 1 worker',
    metrics: [
      { label: 'Median latency', unit: 'ms', python: 21, rust: 13, lowerIsBetter: true },
      { label: 'Throughput', unit: 'RPS', python: 3_785, rust: 6_577, lowerIsBetter: false },
    ],
  },
];

const formatValue = (value: number, unit: string): string => `${value.toLocaleString()} ${unit}`;

const getImprovement = ({ python, rust, lowerIsBetter }: BenchmarkMetric): string => {
  const ratio = lowerIsBetter ? (python - rust) / python : (rust - python) / python;
  const direction = ratio >= 0
    ? lowerIsBetter ? 'lower' : 'higher'
    : lowerIsBetter ? 'higher' : 'lower';

  return `${Math.abs(Math.round(ratio * 100))}% ${direction}`;
};

export default function BenchmarkVisualization({
  configLabel = 'Measured locally against recorded traffic profiles',
  pythonLabel = 'Python implementation',
  rustLabel = 'Rust core',
  profiles = DEFAULT_PROFILES,
}: BenchmarkVisualizationProps) {
  return (
    <figure className={styles.benchmarkWrapper}>
      <figcaption className={styles.benchmarkConfig}>{configLabel}</figcaption>
      <div className={styles.chartLegend}>
        <span><i className={`${styles.legendSwatch} ${styles.pythonSwatch}`} />{pythonLabel}</span>
        <span><i className={`${styles.legendSwatch} ${styles.rustSwatch}`} />{rustLabel}</span>
      </div>
      <div className={styles.profileGrid}>
        {profiles.map((profile) => (
          <section className={styles.comparisonChart} key={profile.name}>
            <header className={styles.profileHeader}>
              <strong>{profile.name}</strong>
              <span>{profile.description}</span>
            </header>
            {profile.metrics.map((metric) => {
              const maximum = Math.max(metric.python, metric.rust);

              return (
                <div className={styles.chartMetric} key={metric.label}>
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
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </figure>
  );
}
