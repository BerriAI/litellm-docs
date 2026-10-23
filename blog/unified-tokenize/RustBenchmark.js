import React, { useState } from "react";
import benchmark from "./results.json";
import styles from "./benchmark.module.css";

const source =
  "https://github.com/BerriAI/litellm-docs/blob/main/blog/unified-tokenize/benchmark.py";

export default function RustBenchmark() {
  const [selected, setSelected] = useState(0);
  const result = benchmark.results[selected];
  const maximum = Math.max(
    ...benchmark.results.map((item) => item.requests_per_second),
  );
  return (
    <figure className={styles.benchmark}>
      <div className={styles.header}>
        <span>RUST / LOCAL BENCHMARK</span>
        <span className={styles.recorded}>Recorded measurements</span>
      </div>
      <div className={styles.metrics} aria-live="polite" aria-atomic="true">
        <div className={styles.throughput}>
          <strong>
            {Math.round(result.requests_per_second).toLocaleString("en-US")}
          </strong>
          <span>requests / second</span>
        </div>
        <div className={styles.latency}>
          <div>
            <strong>
              {result.p50_ms.toFixed(2)}
              <small> ms</small>
            </strong>
            <span>median latency</span>
          </div>
          <div>
            <strong>
              {result.p95_ms.toFixed(2)}
              <small> ms</small>
            </strong>
            <span>95th percentile</span>
          </div>
        </div>
      </div>
      <div
        className={styles.chart}
        role="group"
        aria-label="Benchmark concurrency"
      >
        <div className={styles.chartLabel}>
          <span>CONCURRENT REQUESTS</span>
          <span>REQUESTS / SEC</span>
        </div>
        {benchmark.results.map((item, index) => (
          <button
            key={item.concurrency}
            type="button"
            aria-pressed={index === selected}
            aria-label={`${item.concurrency} concurrent requests`}
            onClick={() => setSelected(index)}
          >
            <span className={styles.concurrency}>{item.concurrency}</span>
            <span className={styles.track} aria-hidden="true">
              <span
                style={{
                  width: `${(item.requests_per_second / maximum) * 100}%`,
                }}
              />
            </span>
            <span className={styles.rate}>
              {Math.round(item.requests_per_second).toLocaleString("en-US")}
            </span>
          </button>
        ))}
      </div>
      <figcaption className={styles.caption}>
        <strong>SDK → Rust → local HTTP test server</strong>
        <p>
          This test measures the native provider request path with a fixed
          two-token response. It excludes real token computation, internet
          latency and the proxy server. Select a concurrency level to inspect
          the recorded results.
        </p>
        <details className={styles.methods}>
          <summary>Test conditions and raw measurements</summary>
          <p>
            {benchmark.environment.machine}, {benchmark.environment.os}, Python{" "}
            {benchmark.environment.python}. Optimized Rust release build at{" "}
            <a
              href={`https://github.com/BerriAI/litellm/commit/${benchmark.environment.implementation_commit}`}
            >
              {benchmark.environment.implementation_commit.slice(0, 7)}
            </a>
            .
          </p>
          <p>
            {benchmark.methodology.requests_per_trial.toLocaleString("en-US")}{" "}
            requests per trial, {benchmark.methodology.trials} trials per
            concurrency level, after{" "}
            {benchmark.methodology.warmup_requests_per_concurrency} warmup
            calls. We show the trial with median throughput and that trial’s
            latency percentiles. Workers start their next call after the
            previous call completes.
          </p>
          <a href="https://github.com/BerriAI/litellm-docs/blob/main/blog/unified-tokenize/results.json">
            Read every trial and the environment details ↗
          </a>
        </details>
        <a href={source}>View the benchmark and rerun it ↗</a>
      </figcaption>
    </figure>
  );
}
