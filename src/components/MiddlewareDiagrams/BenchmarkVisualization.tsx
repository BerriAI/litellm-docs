import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './styles.module.css';

type Accent = 'before' | 'after';

interface FlowLayer {
  label: string;
  warning?: boolean;
}

interface Metric {
  label: string;
  value: number;
  suffix?: string;
}

interface BenchmarkColumn {
  title: string;
  accent: Accent;
  layers: readonly FlowLayer[];
  durationMs: number;
  metrics: readonly Metric[];
}

interface SummaryStat {
  value: string;
  label: string;
}

interface BenchmarkTable {
  title: string;
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}

interface BenchmarkVisualizationProps {
  configLabel?: string;
  totalRequests?: number;
  columns?: readonly [BenchmarkColumn, BenchmarkColumn];
  summaryStats?: readonly SummaryStat[];
  table?: BenchmarkTable;
}

interface Dot {
  id: number;
  progress: number;
}

const DEFAULT_COLUMNS: readonly [BenchmarkColumn, BenchmarkColumn] = [
  {
    title: 'Before (1 ASGI + 1 BaseHTTP)',
    accent: 'before',
    durationMs: 13_920,
    layers: [
      { label: 'ab client' },
      { label: 'uvicorn · 1 worker' },
      { label: 'ASGI Middleware' },
      { label: 'BaseHTTPMiddleware', warning: true },
      { label: 'GET /health → "ok"' },
    ],
    metrics: [
      { label: 'RPS', value: 3_785 },
      { label: 'P50', value: 21, suffix: 'ms' },
    ],
  },
  {
    title: 'After (2x Pure ASGI)',
    accent: 'after',
    durationMs: 8_000,
    layers: [
      { label: 'ab client' },
      { label: 'uvicorn · 1 worker' },
      { label: 'ASGI Middleware' },
      { label: 'ASGI Middleware' },
      { label: 'GET /health → "ok"' },
    ],
    metrics: [
      { label: 'RPS', value: 6_577 },
      { label: 'P50', value: 13, suffix: 'ms' },
    ],
  },
];

const DEFAULT_SUMMARY_STATS: readonly SummaryStat[] = [
  { value: '+74%', label: 'Throughput (RPS)' },
  { value: '-38%', label: 'Median Latency (P50)' },
];

const DEFAULT_TABLE: BenchmarkTable = {
  title: 'Per-run data (3 runs each)',
  headers: ['Config', 'Run', 'RPS', 'P50 (ms)'],
  rows: [
    ['Before (1 ASGI + 1 BaseHTTP)', '1', '3,596', '21'],
    ['Before (1 ASGI + 1 BaseHTTP)', '2', '3,599', '21'],
    ['Before (1 ASGI + 1 BaseHTTP)', '3', '4,161', '21'],
    ['After (2x Pure ASGI)', '1', '6,504', '13'],
    ['After (2x Pure ASGI)', '2', '6,631', '13'],
    ['After (2x Pure ASGI)', '3', '6,595', '13'],
  ],
};

const formatMetric = ({ value, suffix }: Metric): string => `${value.toLocaleString()}${suffix ?? ''}`;

const getMetricValue = (metric: Metric, running: boolean, complete: boolean): string => {
  if (!running || complete) {
    return formatMetric(metric);
  }

  return formatMetric({ ...metric, value: Math.round(metric.value * (0.9 + Math.random() * 0.2)) });
};

const getAccentClass = (accent: Accent, beforeClass: string, afterClass: string): string =>
  accent === 'before' ? beforeClass : afterClass;

export default function BenchmarkVisualization({
  configLabel = '50,000 requests · 1,000 concurrent · 1 worker',
  totalRequests = 50_000,
  columns = DEFAULT_COLUMNS,
  summaryStats = DEFAULT_SUMMARY_STATS,
  table = DEFAULT_TABLE,
}: BenchmarkVisualizationProps) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [completedColumns, setCompletedColumns] = useState<readonly boolean[]>([false, false]);
  const [tableOpen, setTableOpen] = useState(false);
  const [dots, setDots] = useState<readonly Dot[][]>([[], []]);
  const dotIdRef = useRef(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStartedRef = useRef(false);
  const maxDurationMs = Math.max(...columns.map((column) => column.durationMs));

  const reset = useCallback(() => {
    setElapsed(0);
    setCompletedColumns([false, false]);
    setDots([[], []]);
    dotIdRef.current = 0;
  }, []);

  const startSimulation = useCallback(() => {
    reset();
    setRunning(true);
  }, [reset]);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStartedRef.current) {
          hasStartedRef.current = true;
          startSimulation();
        }
      },
      { threshold: 0.3 },
    );

    if (wrapperRef.current) {
      observerRef.current.observe(wrapperRef.current);
    }

    return () => observerRef.current?.disconnect();
  }, [startSimulation]);

  useEffect(() => {
    if (!running) {
      return;
    }

    timerRef.current = setInterval(() => {
      setElapsed((previousElapsed) => {
        const nextElapsed = previousElapsed + 50;
        const completed = columns.map((column) => nextElapsed >= column.durationMs);
        setCompletedColumns(completed);

        if (nextElapsed >= maxDurationMs) {
          window.setTimeout(startSimulation, 2_000);
          setRunning(false);
        }

        return nextElapsed;
      });
    }, 50);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [columns, maxDurationMs, running, startSimulation]);

  useEffect(() => {
    if (!running) {
      return;
    }

    const interval = setInterval(() => {
      setDots((previousDots) =>
        previousDots.map((columnDots, index) => {
          const column = columns[index];
          const complete = completedColumns[index];
          const spawnRate = column.accent === 'before' ? 0.4 : 0.65;
          const speed = column.accent === 'before' ? 0.08 : 0.14;
          const nextDots = !complete && Math.random() < spawnRate
            ? [...columnDots, { id: dotIdRef.current++, progress: 0 }].slice(-14)
            : columnDots;

          return nextDots
            .map((dot) => ({ ...dot, progress: dot.progress + speed }))
            .filter((dot) => dot.progress <= 1);
        }),
      );
    }, 100);

    return () => clearInterval(interval);
  }, [columns, completedColumns, running]);

  return (
    <div className={styles.benchmarkWrapper} ref={wrapperRef}>
      <div className={styles.benchmarkConfig}>{configLabel}</div>
      <div className={styles.benchmarkColumns}>
        {columns.map((column, index) => {
          const progress = Math.min(elapsed / column.durationMs, 1);
          const complete = completedColumns[index];
          const currentMetric = getMetricValue(column.metrics[0], running, complete);
          const completed = Math.round(progress * totalRequests).toLocaleString();

          return (
            <div className={styles.benchmarkColumn} key={column.title}>
              <div className={`${styles.columnTitle} ${getAccentClass(column.accent, styles.columnTitleBefore, styles.columnTitleAfter)}`}>
                {column.title}
                {complete && (
                  <span className={`${styles.doneBadge} ${getAccentClass(column.accent, styles.doneBadgeBefore, styles.doneBadgeAfter)}`}>done</span>
                )}
              </div>
              <div className={styles.flowStack}>
                <div className={styles.dotsCanvas}>
                  {dots[index].map((dot) => (
                    <div
                      className={`${styles.dot} ${getAccentClass(column.accent, styles.dotSlow, styles.dotFast)}`}
                      key={dot.id}
                      style={{
                        top: `${dot.progress * 92}%`,
                        left: `${48 + Math.sin(dot.id * 1.7) * 12}%`,
                        opacity: dot.progress > 0.85 ? (1 - dot.progress) * 6 : 0.8,
                      }}
                    />
                  ))}
                </div>
                {column.layers.map((layer, layerIndex) => (
                  <React.Fragment key={layer.label}>
                    {layerIndex > 0 && <div className={styles.flowArrow}>&darr;</div>}
                    <div className={`${styles.flowLayer} ${layer.warning ? styles.flowLayerWarning : ''}`}>
                      {layer.label}
                      {layer.warning && <span className={styles.overheadTag}>&larr; overhead</span>}
                    </div>
                  </React.Fragment>
                ))}
              </div>
              <div className={styles.statsRow}>
                <div className={styles.stat}>
                  <div className={styles.statValue}>{currentMetric}</div>
                  <div className={styles.statLabel}>{column.metrics[0].label}</div>
                </div>
                <div className={styles.stat}>
                  <div className={styles.statValue}>{completed}</div>
                  <div className={styles.statLabel}>Completed</div>
                </div>
                {column.metrics.slice(1).map((metric) => (
                  <div className={styles.stat} key={metric.label}>
                    <div className={styles.statValue}>{formatMetric(metric)}</div>
                    <div className={styles.statLabel}>{metric.label}</div>
                  </div>
                ))}
              </div>
              <div className={styles.progressBar}>
                <div
                  className={`${styles.progressFill} ${getAccentClass(column.accent, styles.progressFillBefore, styles.progressFillAfter)}`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.summaryStats}>
        {summaryStats.map((stat) => (
          <div className={styles.summaryItem} key={stat.label}>
            <div className={styles.summaryValue}>{stat.value}</div>
            <div className={styles.summaryLabel}>{stat.label}</div>
          </div>
        ))}
      </div>
      <div className={styles.collapsible}>
        <button className={styles.collapsibleToggle} onClick={() => setTableOpen(!tableOpen)}>
          <span className={`${styles.collapsibleChevron} ${tableOpen ? styles.collapsibleChevronOpen : ''}`}>&#9654;</span>
          {table.title}
        </button>
        <div className={`${styles.collapsibleContent} ${tableOpen ? styles.collapsibleContentOpen : ''}`}>
          <table className={styles.dataTable}>
            <thead>
              <tr>{table.headers.map((header) => <th key={header}>{header}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((row, rowIndex) => (
                <tr key={`${row.join('-')}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
