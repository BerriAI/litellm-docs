import React, { useState } from 'react';
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

interface BenchmarkGroup {
  label: string;
  description: string;
  profiles: readonly BenchmarkProfile[];
}

interface BenchmarkVisualizationProps {
  configLabel?: string;
  pythonLabel?: string;
  rustLabel?: string;
  groups?: readonly BenchmarkGroup[];
}

const DEFAULT_GROUPS: readonly BenchmarkGroup[] = [
  {
    label: 'Default workload',
    description: '1,000 concurrent requests · 1 worker',
    profiles: [
      {
        name: 'Default',
        description: 'Measured workload',
        metrics: [
          { label: 'Median latency', unit: 'ms', python: 21, rust: 13, lowerIsBetter: true },
          { label: 'Throughput', unit: 'RPS', python: 3_785, rust: 6_577, lowerIsBetter: false },
        ],
      },
    ],
  },
];

const formatValue = (value: number, unit: string): string => `${value.toLocaleString()} ${unit}`;

const getRatio = ({ python, rust, lowerIsBetter }: BenchmarkMetric): number =>
  lowerIsBetter ? (python - rust) / python : (rust - python) / python;

const getImprovement = (metric: BenchmarkMetric): string => {
  const ratio = getRatio(metric);
  const direction = ratio >= 0
    ? metric.lowerIsBetter ? 'lower' : 'higher'
    : metric.lowerIsBetter ? 'higher' : 'lower';

  return `${Math.abs(Math.round(ratio * 100))}% ${direction}`;
};

export default function BenchmarkVisualization({
  configLabel = 'Measured locally against recorded traffic profiles',
  pythonLabel = 'Python implementation',
  rustLabel = 'Rust core',
  groups = DEFAULT_GROUPS,
}: BenchmarkVisualizationProps) {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedMetricIndex, setSelectedMetricIndex] = useState(0);
  const group = groups[selectedGroupIndex];
  const metricNames = group.profiles[0].metrics.map((metric) => metric.label);
  const metricName = metricNames[Math.min(selectedMetricIndex, metricNames.length - 1)];
  const comparisons = group.profiles.map((profile) => ({
    profile,
    metric: profile.metrics.find((candidate) => candidate.label === metricName)!,
  }));
  const maximum = Math.max(...comparisons.flatMap(({ metric }) => [metric.python, metric.rust]));
  const strongest = comparisons.reduce((current, comparison) =>
    Math.abs(getRatio(comparison.metric)) > Math.abs(getRatio(current.metric)) ? comparison : current,
  );

  return (
    <figure className={styles.benchmarkWrapper}>
      <figcaption className={styles.benchmarkConfig}>{configLabel}</figcaption>
      <div className={styles.chartLegend}>
        <span><i className={`${styles.legendSwatch} ${styles.pythonSwatch}`} />{pythonLabel}</span>
        <span><i className={`${styles.legendSwatch} ${styles.rustSwatch}`} />{rustLabel}</span>
      </div>
      <div className={styles.chartControls}>
        <div className={styles.controlGroup} aria-label="Traffic shape">
          {groups.map((candidate, index) => (
            <button
              className={index === selectedGroupIndex ? styles.controlActive : styles.controlButton}
              key={candidate.label}
              onClick={() => {
                setSelectedGroupIndex(index);
                setSelectedMetricIndex(0);
              }}
              type="button"
            >
              {candidate.label}
            </button>
          ))}
        </div>
        <div className={styles.controlGroup} aria-label="Metric">
          {metricNames.map((name, index) => (
            <button
              className={index === selectedMetricIndex ? styles.controlActive : styles.controlButton}
              key={name}
              onClick={() => setSelectedMetricIndex(index)}
              type="button"
            >
              {name}
            </button>
          ))}
        </div>
      </div>
      <section className={styles.comparisonChart}>
        <header className={styles.profileHeader}>
          <strong>{group.label}: {metricName}</strong>
          <span>{group.description}</span>
        </header>
        <p className={styles.chartInsight}>
          Largest measured difference: {strongest.profile.name}, where Rust is {getImprovement(strongest.metric)} than Python.
        </p>
        <div className={styles.profileChart}>
          {comparisons.map(({ profile, metric }) => (
            <div className={styles.profileRow} key={profile.name}>
              <div className={styles.profileLabel}>
                <strong>{profile.name}</strong>
                <span>{profile.description}</span>
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
          ))}
        </div>
      </section>
    </figure>
  );
}
