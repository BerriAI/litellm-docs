// Measured offsets and median TTFB: https://github.com/BerriAI/litellm/pull/44221
// Cache span hierarchy: https://github.com/BerriAI/litellm/pull/44150
// Real DB I/O and attributes: https://github.com/BerriAI/litellm/pull/44148
// https://github.com/BerriAI/litellm/pull/44240
// TraceExamples is illustrative. MeasuredTrace reconstructs one local benchmark.
import React from 'react';
import styles from './diagrams.module.css';

const benchmarks = [
  {endpoint: 'Chat completions', before: 553, after: 35},
  {endpoint: 'Messages', before: 542, after: 40},
];

const trace = {
  name: 'POST /v1/chat/completions',
  windowMs: 15,
  ticks: [0, 3, 6, 9, 12, 15],
  spans: [
    {name: 'auth /v1/chat/completions', start: 3.8, end: 8.9, tone: 'auth'},
    {name: 'route claude-opus-5-5', start: 11.6, end: 12.7, tone: 'route'},
  ],
  events: [
    {name: 'litellm.request.body_received', at: 1.7, detail: '1,807,504 bytes'},
    {name: 'litellm.request.body_parsed', at: 3.7},
    {name: 'litellm.request.pre_call_completed', at: 11.2},
    {name: 'litellm.request.deployment_selected', at: 12.6, detail: 'Attempt 1 · initial'},
  ],
};

const databaseExample = {
  span: 'postgres.select LiteLLM_VerificationToken',
  attributes: [
    {name: 'db.operation.name', value: 'select'},
    {name: 'db.collection.name', value: 'LiteLLM_VerificationToken'},
  ],
};

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

export function MeasuredTrace() {
  return (
    <figure className={styles.figure}>
      <div className={styles.tracePanel}>
        <div className={styles.heading}>
          <strong><code>{trace.name}</code></strong>
          <span className={styles.context}>Measured request setup</span>
        </div>
        <div className={styles.axis} aria-hidden="true">
          {trace.ticks.map((tick) => <span key={tick}>{tick}{tick === trace.windowMs ? ' ms' : ''}</span>)}
        </div>
        <div className={styles.spanRows}>
          {trace.spans.map((span) => (
            <div className={styles.spanRow} key={span.name}>
              <div className={styles.spanLabel}>
                <code>{span.name}</code>
                <span className={styles.time}>{span.start.toFixed(1)}–{span.end.toFixed(1)} ms</span>
              </div>
              <div className={styles.track} aria-hidden="true">
                <div
                  className={`${styles.bar} ${styles[span.tone]}`}
                  style={{left: `${span.start / trace.windowMs * 100}%`, width: `${(span.end - span.start) / trace.windowMs * 100}%`}}
                />
              </div>
            </div>
          ))}
        </div>
        <div className={styles.events}>
          <div className={styles.sectionLabel}>Events on the request's SERVER span</div>
          <dl className={styles.eventList}>
            {trace.events.map((event) => (
              <div className={styles.eventRow} key={event.name}>
                <dt>
                  <code>{event.name}</code>
                  {event.detail && <span className={styles.eventDetail}>{event.detail}</span>}
                </dt>
                <dd className={styles.time}>{event.at.toFixed(1)} ms</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <figcaption className={styles.caption}>
        Reconstructed from the Python-path benchmark with an instant mock upstream. Offsets are from server start; only recorded request-setup spans and events are shown.
      </figcaption>
    </figure>
  );
}

export function TraceExamples() {
  return (
    <figure className={styles.figure}>
      <div className={styles.heading}>
        <strong>Read the work behind a request</strong>
        <span className={styles.context}>Illustrative trace excerpts</span>
      </div>
      <div className={styles.exampleGrid}>
        <div className={styles.exampleCard}>
          <div className={styles.sectionLabel}>Response cache</div>
          <div className={styles.tree}>
            <code>cache.get llm_response</code>
            <div className={styles.treeChild}><code>redis.get llm_response</code></div>
          </div>
          <p className={styles.explanation}>The Redis read sits inside the cache lookup it serves.</p>
        </div>
        <div className={styles.exampleCard}>
          <div className={styles.sectionLabel}>Database read</div>
          <code className={styles.databaseSpan}>{databaseExample.span}</code>
          <dl className={styles.attributeList}>
            {databaseExample.attributes.map((attribute) => (
              <div key={attribute.name}>
                <dt><code>{attribute.name}</code></dt>
                <dd><code>{attribute.value}</code></dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      <figcaption className={styles.caption}>An in-memory auth cache hit adds no Postgres span. A real database read does.</figcaption>
    </figure>
  );
}
