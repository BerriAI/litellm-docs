import React, {useEffect, useMemo, useRef, useState} from 'react';
import {seconds} from './format';
import {FAILURES} from './presets';
import {RunCard, cooling} from './Trace';
import styles from './styles.module.css';

// Runs a steady stream of requests through a fresh router on its own simulated clock, with
// outages scheduled per deployment, and draws what the router did over that time: one lane per
// deployment with the traffic it served, the attempts that failed on it, and when it sat in
// cooldown. Clicking a moment opens the trace of the request sent then.

const RATES = [1, 2, 5, 10];
const DURATIONS = [60, 120, 300];
const LABEL = 128;
const LANE = 64;
const GAP = 10;
const OUTCOME = 46;
const AXIS = 22;

function simulate(core, configJson, seed, model, teamId, {rate, duration, outages}) {
  const playground = new core.Playground(configJson, BigInt(seed));
  const requests = [];
  const cooldowns = {};
  let active = '';
  try {
    const step = 1 / rate;
    for (let at = 0; at < duration; at += step) {
      const now = playground.now();
      if (at > now) playground.advance(at - now);
      const t = playground.now();
      const failing = {};
      for (const outage of outages) {
        if (outage.fail && t >= outage.from && t < outage.to) failing[outage.id] = {fail: outage.fail};
      }
      const key = JSON.stringify(failing);
      if (key !== active) {
        playground.setBehaviour(key);
        active = key;
      }
      const before = cooling(playground);
      const run = JSON.parse(playground.send(JSON.stringify({model, team_id: teamId || undefined})));
      const attempts = run.trace
        .filter(item => item.kind === 'host' && item.call === 'invoke')
        .map(item => ({
          id: item.deployment,
          ok: item.answer === '200 OK',
          t: item.t,
        }));
      requests.push({t, attempts, before, ...run});
      for (const deployment of JSON.parse(playground.state()).deployments) {
        if (!deployment.cooldown) continue;
        const after = playground.now();
        const end = after + (deployment.cooldown.remaining ?? 0);
        // One span per cooldown the router set: a cooldown set again after expiring starts a new span.
        const spans = (cooldowns[deployment.id] ??= []);
        const since = deployment.cooldown.value.timestamp;
        const last = spans[spans.length - 1];
        if (last && last.since === since) last.end = end;
        else spans.push({since, start: after, end, status: deployment.cooldown.value.status_code});
      }
    }
  } finally {
    playground.free();
  }
  return {requests, cooldowns, duration, rate};
}

function useWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function Chart({sim, deployments, outages, onPick, picked}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState(null);
  const plot = width - LABEL - 18;
  const x = t => LABEL + (t / sim.duration) * plot;
  const bucket = sim.duration <= 60 ? 1 : sim.duration <= 120 ? 2 : 5;
  const buckets = Math.ceil(sim.duration / bucket);

  const {served, failed, outcome, peak, peakOutcome} = useMemo(() => {
    const zero = () => Array.from({length: buckets}, () => 0);
    const servedBy = {};
    const failedOn = {};
    const ok = zero();
    const bad = zero();
    for (const request of sim.requests) {
      const index = Math.min(buckets - 1, Math.floor(request.t / bucket));
      for (const attempt of request.attempts) {
        if (attempt.ok) (servedBy[attempt.id] ??= zero())[index] += 1;
        else (failedOn[attempt.id] ??= []).push(attempt);
      }
      (request.result.ok ? ok : bad)[index] += 1;
    }
    const all = Object.values(servedBy).flat();
    return {
      served: servedBy,
      failed: failedOn,
      outcome: {ok, bad},
      peak: Math.max(1, ...all),
      peakOutcome: Math.max(1, ...ok.map((value, i) => value + bad[i])),
    };
  }, [sim, bucket, buckets]);

  const lanesHeight = deployments.length * (LANE + GAP);
  const height = lanesHeight + OUTCOME + AXIS + 8;
  const ticks = [];
  const every = sim.duration <= 60 ? 10 : sim.duration <= 120 ? 20 : 60;
  for (let t = 0; t <= sim.duration; t += every) ticks.push(t);

  const nearest = t => {
    let best = null;
    for (const request of sim.requests) {
      if (!best || Math.abs(request.t - t) < Math.abs(best.t - t)) best = request;
    }
    return best;
  };

  const onMove = event => {
    const box = event.currentTarget.getBoundingClientRect();
    const t = ((event.clientX - box.left - LABEL) / plot) * sim.duration;
    setHover(t >= 0 && t <= sim.duration ? t : null);
  };

  const hoverInfo = useMemo(() => {
    if (hover == null) return null;
    const index = Math.min(buckets - 1, Math.floor(hover / bucket));
    return {
      index,
      start: index * bucket,
      rows: deployments.map(deployment => ({
        id: deployment.id,
        served: served[deployment.id]?.[index] ?? 0,
        failed: (failed[deployment.id] ?? []).filter(a => a.t >= index * bucket && a.t < (index + 1) * bucket).length,
        cooling: (sim.cooldowns[deployment.id] ?? []).some(span => hover >= span.start && hover < span.end),
      })),
      ok: outcome.ok[index],
      bad: outcome.bad[index],
    };
  }, [hover, bucket, buckets, deployments, served, failed, outcome, sim]);

  const barWidth = Math.max(1, plot / buckets - 2);

  return (
    <div ref={ref} className={styles.chartWrap}>
      <svg
        width={width}
        height={height}
        className={styles.chart}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onClick={() => hover != null && onPick(nearest(hover))}
        role="img"
        aria-label="Traffic, failures and cooldowns per deployment over simulated time">
        <defs>
          <pattern id="rp-outage" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" className={styles.hatch} />
          </pattern>
        </defs>

        {deployments.map((deployment, lane) => {
          const top = lane * (LANE + GAP);
          const base = top + LANE;
          return (
            <g key={deployment.id}>
              <text x={0} y={top + 16} className={styles.laneLabel}>
                {deployment.id}
              </text>
              <text x={0} y={top + 31} className={styles.laneSub}>
                {deployment.model_name}
              </text>
              <rect x={LABEL} y={top} width={plot} height={LANE} className={styles.laneBg} />
              {outages
                .filter(outage => outage.id === deployment.id && outage.fail)
                .map((outage, i) => (
                  <rect
                    key={i}
                    x={x(outage.from)}
                    y={top}
                    width={Math.max(0, x(Math.min(outage.to, sim.duration)) - x(outage.from))}
                    height={LANE}
                    fill="url(#rp-outage)"
                  />
                ))}
              {(sim.cooldowns[deployment.id] ?? []).map((span, i) => (
                <g key={i}>
                  <rect
                    x={x(span.start)}
                    y={top + 2}
                    width={Math.max(2, x(Math.min(span.end, sim.duration)) - x(span.start) - 2)}
                    height={10}
                    rx={3}
                    className={styles.coolBar}
                  />
                  {x(Math.min(span.end, sim.duration)) - x(span.start) > 90 && (
                    <text x={x(span.start) + 6} y={top + 10.5} className={styles.coolText}>
                      cooldown ({span.status})
                    </text>
                  )}
                </g>
              ))}
              {(served[deployment.id] ?? []).map((count, i) =>
                count ? (
                  <rect
                    key={i}
                    x={x(i * bucket) + 1}
                    y={base - ((LANE - 30) * count) / peak}
                    width={barWidth}
                    height={((LANE - 30) * count) / peak}
                    rx={Math.min(2, barWidth / 2)}
                    className={styles.servedBar}
                  />
                ) : null,
              )}
              {(failed[deployment.id] ?? []).map((attempt, i) => (
                <line
                  key={i}
                  x1={x(attempt.t)}
                  x2={x(attempt.t)}
                  y1={top + 16}
                  y2={top + 28}
                  className={styles.failTick}
                />
              ))}
            </g>
          );
        })}

        <g>
          <text x={0} y={lanesHeight + 16} className={styles.laneLabel}>
            requests
          </text>
          <text x={0} y={lanesHeight + 31} className={styles.laneSub}>
            served / failed
          </text>
          {outcome.ok.map((ok, i) => {
            const bad = outcome.bad[i];
            const base = lanesHeight + OUTCOME - 4;
            const scale = (OUTCOME - 8) / peakOutcome;
            return (
              <g key={i}>
                {ok > 0 && (
                  <rect
                    x={x(i * bucket) + 1}
                    y={base - ok * scale}
                    width={barWidth}
                    height={ok * scale}
                    className={styles.okBar}
                  />
                )}
                {bad > 0 && (
                  <rect
                    x={x(i * bucket) + 1}
                    y={base - ok * scale - bad * scale - (ok > 0 ? 2 : 0)}
                    width={barWidth}
                    height={bad * scale}
                    className={styles.badBar}
                  />
                )}
              </g>
            );
          })}
        </g>

        {ticks.map(t => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={lanesHeight + OUTCOME} className={styles.grid} />
            <text x={x(t)} y={height - 6} textAnchor="middle" className={styles.axisText}>
              {t}s
            </text>
          </g>
        ))}

        {picked && (
          <line x1={x(picked.t)} x2={x(picked.t)} y1={0} y2={lanesHeight + OUTCOME} className={styles.pickedLine} />
        )}
        {hover != null && (
          <line x1={x(hover)} x2={x(hover)} y1={0} y2={lanesHeight + OUTCOME} className={styles.crosshair} />
        )}
      </svg>

      {hoverInfo && (
        <div className={styles.tooltip} style={{left: Math.min(x(hover) + 12, width - 250), top: 4}} role="status">
          <strong>
            {hoverInfo.start}s to {hoverInfo.start + bucket}s
          </strong>
          {hoverInfo.rows.map(row => (
            <div key={row.id} className={styles.tipRow}>
              <code>{row.id}</code>
              <span>
                {row.served} served{row.failed ? `, ${row.failed} failed` : ''}
                {row.cooling ? ', cooling down' : ''}
              </span>
            </div>
          ))}
          <div className={styles.tipRow}>
            <span>requests</span>
            <span>
              {hoverInfo.ok} ok
              {hoverInfo.bad ? `, ${hoverInfo.bad} failed` : ''}
            </span>
          </div>
          <span className={styles.muted}>click to open the request sent then</span>
        </div>
      )}
    </div>
  );
}

export default function Timeline({core, configJson, seed, model, teamId, deployments, defaultOutages}) {
  const [rate, setRate] = useState(2);
  const [duration, setDuration] = useState(120);
  const [outages, setOutages] = useState(defaultOutages);
  const [sim, setSim] = useState(null);
  const [error, setError] = useState(null);
  const [picked, setPicked] = useState(null);

  useEffect(() => {
    setOutages(defaultOutages);
  }, [defaultOutages]);

  useEffect(() => {
    if (!core || !configJson) return;
    try {
      setSim(
        simulate(core, configJson, seed, model, teamId, {
          rate,
          duration,
          outages,
        }),
      );
      setError(null);
      setPicked(null);
    } catch (problem) {
      setError(String(problem.message ?? problem));
      setSim(null);
    }
  }, [core, configJson, seed, model, teamId, rate, duration, outages]);

  const change = (index, patch) =>
    setOutages(outages.map((outage, i) => (i === index ? {...outage, ...patch} : outage)));

  const totals = useMemo(() => {
    if (!sim) return null;
    const failed = sim.requests.filter(request => !request.result.ok).length;
    const retries = sim.requests.reduce((sum, request) => sum + (request.result.retries ?? 0), 0);
    const fallbacks = sim.requests.reduce((sum, request) => sum + (request.result.fallbacks ?? 0), 0);
    return {count: sim.requests.length, failed, retries, fallbacks};
  }, [sim]);

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h2>Over time</h2>
        {totals && (
          <span className={styles.muted}>
            {totals.count} requests, {totals.failed} failed, {totals.retries} retries, {totals.fallbacks} fallbacks
          </span>
        )}
      </div>

      <div className={styles.controls}>
        <label className={styles.inline}>
          traffic
          <select value={rate} onChange={event => setRate(Number(event.target.value))}>
            {RATES.map(value => (
              <option key={value} value={value}>
                {value} req/s
              </option>
            ))}
          </select>
        </label>
        <label className={styles.inline}>
          for
          <select value={duration} onChange={event => setDuration(Number(event.target.value))}>
            {DURATIONS.map(value => (
              <option key={value} value={value}>
                {value}s
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.outages}>
        {outages.map((outage, index) => (
          <div key={index} className={styles.controls}>
            <span>Outage:</span>
            <select
              className={styles.select}
              value={outage.id}
              onChange={event => change(index, {id: event.target.value})}
              aria-label="Deployment">
              {deployments.map(deployment => (
                <option key={deployment.id} value={deployment.id}>
                  {deployment.id}
                </option>
              ))}
            </select>
            <select
              className={styles.select}
              value={outage.fail}
              onChange={event => change(index, {fail: event.target.value})}
              aria-label="Raises">
              <option value="">off</option>
              {FAILURES.map(name => (
                <option key={name} value={name}>
                  raises {name}
                </option>
              ))}
            </select>
            <label className={styles.inline}>
              from
              <input
                type="number"
                min={0}
                value={outage.from}
                onChange={event => change(index, {from: Number(event.target.value) || 0})}
              />
              s
            </label>
            <label className={styles.inline}>
              to
              <input
                type="number"
                min={0}
                value={outage.to}
                onChange={event => change(index, {to: Number(event.target.value) || 0})}
              />
              s
            </label>
            <button type="button" onClick={() => setOutages(outages.filter((_, i) => i !== index))}>
              Remove
            </button>
          </div>
        ))}
        <div className={styles.controls}>
          <button
            type="button"
            disabled={deployments.length === 0}
            onClick={() =>
              setOutages([
                ...outages,
                {
                  id: deployments[0]?.id,
                  fail: 'RateLimitError',
                  from: 30,
                  to: 60,
                },
              ])
            }>
            Add outage
          </button>
        </div>
      </div>

      <div className={styles.legend}>
        <span>
          <i className={styles.keyServed} /> served
        </span>
        <span>
          <i className={styles.keyFail} /> failed attempt
        </span>
        <span>
          <i className={styles.keyCool} /> cooldown
        </span>
        <span>
          <i className={styles.keyOutage} /> scheduled outage
        </span>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {sim && deployments.length > 0 && (
        <Chart sim={sim} deployments={deployments} outages={outages} onPick={setPicked} picked={picked} />
      )}
      <p className={styles.muted}>
        Requests run one after another on the simulated clock, so concurrency and queuing are not modelled.
      </p>
      {picked && (
        <RunCard
          key={picked.t}
          run={{
            kind: 'single',
            n: `${sim.requests.indexOf(picked) + 1} at ${seconds(picked.t)}`,
            model,
            ...picked,
          }}
          deployments={deployments}
        />
      )}
    </section>
  );
}
