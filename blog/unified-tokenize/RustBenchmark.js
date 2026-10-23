import React, { useState } from "react";
import benchmark from "./results.json";
import styles from "./benchmark.module.css";

const source =
  "https://github.com/BerriAI/litellm-docs/blob/main/blog/unified-tokenize/benchmark.py";

export default function RustBenchmark() {
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const result = benchmark.results[selected];
  const latency = result.p50_ms.toFixed(2);

  return (
    <figure className={`${styles.benchmark} ${paused ? styles.paused : ""}`}>
      <div className={styles.masthead}>
        <span>SDK / RUST / LOCAL BENCHMARK</span>
        <span>RECORDED ON {benchmark.environment.machine.toUpperCase()}</span>
      </div>

      <div className={styles.performance}>
        <div className={styles.speedLines} aria-hidden="true" />
        <div className={styles.primaryMetric}>
          <span className={styles.metricLabel}>
            MEDIAN LATENCY / LOCAL vLLM ADAPTER TEST
          </span>
          <div
            className={styles.latency}
            role="group"
            aria-label={`${latency} milliseconds median latency`}
          >
            <strong aria-hidden="true">{latency.replace(/^0\./, ".")}</strong>
            <span aria-hidden="true">ms</span>
          </div>
          <span className={styles.measurementNote}>
            {result.concurrency === 1
              ? "One request at a time"
              : `${result.concurrency} concurrent requests`}
          </span>
        </div>
        <dl className={styles.secondaryMetrics}>
          <div>
            <dt>95th percentile</dt>
            <dd>
              {result.p95_ms.toFixed(2)} <span>ms</span>
            </dd>
          </div>
          <div>
            <dt>Throughput</dt>
            <dd>
              {Math.round(result.requests_per_second).toLocaleString("en-US")}
              <span>requests / sec</span>
            </dd>
          </div>
        </dl>
      </div>

      <div className={styles.controls}>
        <span className={styles.controlLabel}>CONCURRENT REQUESTS</span>
        <div
          className={styles.selections}
          role="group"
          aria-label="Benchmark concurrency"
        >
          {benchmark.results.map((item, index) => (
            <button
              key={item.concurrency}
              type="button"
              aria-pressed={index === selected}
              aria-label={`${item.concurrency} concurrent requests`}
              onClick={() => setSelected(index)}
            >
              {item.concurrency}
            </button>
          ))}
        </div>
        <span className={styles.recorded}>Recorded measurements</span>
        <span className={styles.srOnly} aria-live="polite" aria-atomic="true">
          {result.concurrency} concurrent requests: {latency} milliseconds
          median, {result.p95_ms.toFixed(2)} milliseconds at the 95th
          percentile,
          {Math.round(result.requests_per_second).toLocaleString("en-US")}{" "}
          requests per second.
        </span>
      </div>

      <div className={styles.raceway}>
        <div className={styles.racewayHeader}>
          <span>REQUEST PATH / ANIMATED ILLUSTRATION</span>
          <button
            className={styles.motionControl}
            type="button"
            onClick={() => setPaused(!paused)}
            aria-label={
              paused ? "Resume request animation" : "Pause request animation"
            }
          >
            <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
            {paused ? "Resume" : "Pause"}
          </button>
        </div>
        <div
          className={styles.route}
          role="img"
          aria-label="The Python SDK sends a request through Rust to a local HTTP test server and receives a normalized response."
        >
          <div className={styles.tracks} aria-hidden="true">
            {[0, 1, 2].map((lane) => (
              <div className={styles.track} key={lane}>
                <span style={{ "--delay": `${lane * -0.32}s` }} />
                <span style={{ "--delay": `${lane * -0.32 - 0.6}s` }} />
              </div>
            ))}
          </div>
          <div className={styles.nodes} aria-hidden="true">
            <div className={styles.node}>
              <span>01</span>
              <strong>SDK</strong>
              <small>Python</small>
            </div>
            <div className={`${styles.node} ${styles.rustNode}`}>
              <span>02</span>
              <strong>RUST</strong>
              <small>Native integration</small>
            </div>
            <div className={styles.node}>
              <span>03</span>
              <strong>LOCAL</strong>
              <small>HTTP test server</small>
            </div>
          </div>
          <div className={styles.returnPath} aria-hidden="true">
            <span>←</span>
            <span>normalized response</span>
            <span>←</span>
          </div>
        </div>
        <p className={styles.animationNote}>
          Animation illustrates the path, not request timing.
        </p>
      </div>

      <figcaption className={styles.caption}>
        <div className={styles.scope}>
          <strong>SDK → Rust → local HTTP test server</strong>
          <p>
            Public async SDK calls through the vLLM adapter with a fixed
            two-token response. Includes the Python/Rust bridge, loopback HTTP
            and response normalization. Excludes real token computation,
            internet latency and the proxy server.
          </p>
        </div>
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
            Read the raw measurements <span aria-hidden="true">↗</span>
          </a>
        </details>
        <a className={styles.sourceLink} href={source}>
          Run the benchmark <span aria-hidden="true">↗</span>
        </a>
      </figcaption>
    </figure>
  );
}
