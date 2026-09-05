import React, { useState, type CSSProperties } from 'react';
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
  takeaway?: string;
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

const getRelativePerformance = ({ python, rust, lowerIsBetter }: BenchmarkMetric): number =>
  lowerIsBetter ? python / rust : rust / python;

const getDifference = ({ python, rust, lowerIsBetter }: BenchmarkMetric): string => {
  const difference = (rust - python) / python;
  const favorable = lowerIsBetter ? difference <= 0 : difference >= 0;
  const direction = difference >= 0 ? 'higher' : 'lower';

  if (Math.abs(difference) < 0.02) {
    return 'within 2% of Python';
  }

  return `${Math.abs(Math.round(difference * 100))}% ${direction}${favorable ? '' : ' (regression)'}`;
};

const formatRelativePerformance = (metric: BenchmarkMetric): string => {
  const relativePerformance = getRelativePerformance(metric);

  return Math.abs(relativePerformance - 1) < 0.02
    ? '≈1×'
    : `${relativePerformance.toFixed(relativePerformance >= 2 ? 1 : 2)}×`;
};

export default function BenchmarkVisualization({
  configLabel = 'Measured locally against recorded traffic profiles',
  pythonLabel = 'Python implementation',
  rustLabel = 'Rust core',
  groups = DEFAULT_GROUPS,
}: BenchmarkVisualizationProps) {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(0);
  const [selectedMetricIndex, setSelectedMetricIndex] = useState(0);
  const [selectedProfileIndex, setSelectedProfileIndex] = useState(0);
  const group = groups[selectedGroupIndex];
  const metrics = group.profiles[0].metrics;
  const selectedProfile = group.profiles[Math.min(selectedProfileIndex, group.profiles.length - 1)];
  const selectedMetric = selectedProfile.metrics[Math.min(selectedMetricIndex, selectedProfile.metrics.length - 1)];
  const matrixStyle = { '--benchmark-profile-count': group.profiles.length } as CSSProperties;

  return (
    <figure className={styles.benchmarkWrapper}>
      <figcaption className={styles.benchmarkConfig}>{configLabel}</figcaption>
      {groups.length > 1 && (
        <div className={styles.chartControls}>
          <div className={styles.controlGroup} aria-label="Workload group">
            {groups.map((candidate, index) => (
              <button
                className={index === selectedGroupIndex ? styles.controlActive : styles.controlButton}
                key={candidate.label}
                onClick={() => {
                  setSelectedGroupIndex(index);
                  setSelectedMetricIndex(0);
                  setSelectedProfileIndex(0);
                }}
                aria-pressed={index === selectedGroupIndex}
                type="button"
              >
                {candidate.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <section className={styles.comparisonChart}>
        <header className={styles.profileHeader}>
          <strong>{group.label}</strong>
          <span>{group.description}</span>
        </header>
        <p className={styles.chartInsight} aria-live="polite">
          {group.takeaway ?? `Compare ${rustLabel} with ${pythonLabel} across the measured workload.`}
        </p>
        <div className={styles.matrixLegend}>1× is parity · above 1× favors Rust · below 1× favors Python</div>
        <div className={styles.matrixViewport}>
          <div className={styles.benchmarkMatrix} role="grid" aria-label={`${group.label} relative performance`} style={matrixStyle}>
            <div className={styles.matrixCorner} role="columnheader">Rust vs Python</div>
            {group.profiles.map((profile) => (
              <div className={styles.matrixColumnHeader} key={profile.name} role="columnheader">
                <strong>{profile.name}</strong>
                <span>{profile.description}</span>
              </div>
            ))}
            {metrics.map((metric, metricIndex) => (
              <React.Fragment key={metric.label}>
                <div className={styles.matrixRowHeader} role="rowheader">{metric.label}</div>
                {group.profiles.map((profile, profileIndex) => {
                  const profileMetric = profile.metrics[metricIndex];
                  const relativePerformance = getRelativePerformance(profileMetric);
                  const selected = metricIndex === selectedMetricIndex && profileIndex === selectedProfileIndex;
                  const resultClass = relativePerformance < 0.98
                    ? styles.matrixRegression
                    : relativePerformance < 1.05
                      ? styles.matrixParity
                      : styles.matrixImprovement;

                  return (
                    <button
                      aria-label={`${profile.name}, ${profileMetric.label}: Rust relative performance ${formatRelativePerformance(profileMetric)}`}
                      aria-pressed={selected}
                      className={`${styles.matrixCell} ${resultClass} ${selected ? styles.matrixCellSelected : ''}`}
                      key={profile.name}
                      onClick={() => {
                        setSelectedMetricIndex(metricIndex);
                        setSelectedProfileIndex(profileIndex);
                      }}
                      role="gridcell"
                      type="button"
                    >
                      {formatRelativePerformance(profileMetric)}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <p className={styles.matrixDetail} aria-live="polite">
          <strong>{selectedProfile.name} · {selectedMetric.label}:</strong>{' '}
          {pythonLabel} {formatValue(selectedMetric.python, selectedMetric.unit)} →{' '}
          {rustLabel} {formatValue(selectedMetric.rust, selectedMetric.unit)}. Rust is {getDifference(selectedMetric)}.
        </p>
      </section>
    </figure>
  );
}
