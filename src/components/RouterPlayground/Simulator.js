import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import ConfigModal from './ConfigModal';
import ce from './ConfigEditor.module.css';
import Panel from './Panel';
import {profileLabel, profileSummary} from './profiles';
import {
  MOCKS,
  SESSIONS_READY,
  SESSIONS_SOON,
  affinityConfigured,
  coreRequests,
  expectedRpm,
  groupRate,
  metadataOf,
  unservedModels,
  newKind,
} from './requests';
import Scenario from './Scenario';
import {KindSwatch, kindActive, kindColour, useKindSlots} from './SimKinds';
import {INCIDENT_KINDS, coreIncident, coreProfiles, incidentLabel, openSession} from './simSession';
import {RunCard} from './Trace';
import styles from './Simulator.module.css';

// The simulator: behaviour profiles per deployment, a live run of steady traffic through the router
// core on simulated time with incidents you click in, and scripted scenarios that compare two configs.

const SPEEDS = [1, 10, 60];
const WINDOW = 120;
const LEAD = 100;
const BIN = 2;
const LANE = 132;
const HALF = 66;
const LABEL = 260;
const SURGE = {factor: 5, duration: 20};
const LANE_INCIDENTS = ['outage', 'latency', 'capacity', 'flaky'];

export const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const secs = value => (value >= 10 ? `${Math.round(value)} s` : `${+value.toFixed(1)} s`);

export function timeoutsOf(config, deployments) {
  const fallback = config?.router_settings?.timeout ?? config?.litellm_settings?.request_timeout ?? null;
  const byId = {};
  (config?.model_list ?? []).forEach((item, index) => {
    const id = String(item.model_info?.id ?? deployments?.[index]?.id ?? index);
    byId[id] = item.litellm_params?.timeout ?? fallback;
  });
  return byId;
}

function useWidth(fallback) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.round(entry.contentRect.width))));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

const quantile = (values, q) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};

function emptyStore() {
  return {
    now: 0,
    bins: {},
    spans: {},
    marks: [],
    numbered: 0,
    incidents: [],
    surge: null,
    lastFallback: -Infinity,
    servedBy: new Map(),
    kindOf: new Map(),
    pending: new Map(),
    totals: {requests: 0, ok: 0, attempts: 0, fallbacks: 0, maxInFlight: 0, inFlight: 0},
    durations: [],
    deployments: [],
    kinds: {},
    sessions: new Map(),
  };
}

const SESSIONS_KEPT = 400;

// Per kind of request and per session, for the tables under the mix.
function absorbMix(store, request) {
  const label = request.kind ?? 'request';
  const kind = (store.kinds[label] ??= {requests: 0, ok: 0, attempts: 0, fallbacks: 0, durations: []});
  kind.requests += 1;
  if (request.ok) kind.ok += 1;
  kind.attempts += request.attempts?.length || 1 + (request.retries ?? 0);
  kind.fallbacks += request.fallbacks ?? 0;
  kind.durations.push(request.end - request.start);
  if (kind.durations.length > 1000) kind.durations.shift();
  if (!request.session) return;
  let session = store.sessions.get(request.session);
  if (!session) {
    session = {kind: label, requests: 0, failed: 0, moves: 0, last: null, served: {}};
    store.sessions.set(request.session, session);
    if (store.sessions.size > SESSIONS_KEPT) store.sessions.delete(store.sessions.keys().next().value);
  }
  session.requests += 1;
  if (!request.ok || !request.deployment) {
    session.failed += 1;
    return;
  }
  if (session.last && session.last !== request.deployment) session.moves += 1;
  session.last = request.deployment;
  session.served[request.deployment] = (session.served[request.deployment] ?? 0) + 1;
}

function binOf(store, id, t) {
  const lane = (store.bins[id] ??= new Map());
  const index = Math.floor(t / BIN);
  let bin = lane.get(index);
  if (!bin) {
    bin = {served: 0, viaFallback: 0, ids: [], failed: [], latency: [], kinds: {}};
    lane.set(index, bin);
  }
  return bin;
}

// Folds one advance() frame into what the lanes draw and the marks list numbers.
function absorb(store, frame, dt) {
  store.now = frame.now;
  for (const request of frame.completed) {
    const totals = store.totals;
    totals.requests += 1;
    totals.attempts += request.attempts?.length || 1 + (request.retries ?? 0);
    totals.fallbacks += request.fallbacks ?? 0;
    if (request.ok) totals.ok += 1;
    absorbMix(store, request);
    const label = request.kind ?? 'request';
    store.kindOf.set(request.id, label);
    if (store.kindOf.size > 4000) store.kindOf.delete(store.kindOf.keys().next().value);
    store.durations.push(request.end - request.start);
    if (store.durations.length > 2000) store.durations.splice(0, store.durations.length - 2000);
    for (const attempt of request.attempts ?? []) {
      const bin = binOf(store, attempt.deployment, attempt.end);
      bin.latency.push(attempt.end - attempt.start);
      if (attempt.answer === '200 OK' || attempt.status === 200) continue;
      bin.failed.push({t: attempt.end, request: request.id, kind: label});
    }
    if (store.pending.has(request.id)) {
      store.pending.get(request.id).lane = request.deployment;
      store.pending.delete(request.id);
    }
    store.servedBy.set(request.id, request.deployment);
    if (store.servedBy.size > 4000) store.servedBy.delete(store.servedBy.keys().next().value);
    if (request.ok && request.deployment) {
      const bin = binOf(store, request.deployment, request.end);
      bin.served += 1;
      if (request.fallbacks > 0) bin.viaFallback += 1;
      bin.ids.push(request.id);
      if (bin.ids.length > 40) bin.ids.shift();
      const slice = (bin.kinds[label] ??= {served: 0, fallback: 0, last: null});
      slice.served += 1;
      if (request.fallbacks > 0) slice.fallback += 1;
      slice.last = request.id;
    }
  }
  store.totals.inFlight = frame.in_flight;
  store.totals.maxInFlight = Math.max(store.totals.maxInFlight, frame.in_flight);

  for (const mark of frame.marks ?? []) {
    if (mark.kind === 'cooldown' && mark.deployment) {
      const spans = (store.spans[mark.deployment] ??= []);
      const last = spans[spans.length - 1];
      const to = mark.t + (mark.seconds ?? 0);
      if (last && last.to >= mark.t - 1e-6) {
        last.to = Math.max(last.to, to);
        continue;
      }
      const cooling = frame.deployments.find(item => item.id === mark.deployment)?.cooling;
      spans.push({from: mark.t, to, status: cooling?.status ?? null});
      store.numbered += 1;
      store.marks.push({n: store.numbered, t: mark.t, kind: 'cooldown', lane: mark.deployment, request: mark.request});
    } else if (mark.kind === 'fallback') {
      const first = mark.t - store.lastFallback > 30;
      store.lastFallback = mark.t;
      if (!first) continue;
      store.numbered += 1;
      const entry = {
        n: store.numbered,
        t: mark.t,
        kind: 'fallback',
        from: mark.from,
        to: mark.to,
        request: mark.request,
      };
      entry.lane = store.servedBy.get(mark.request) ?? null;
      if (!entry.lane) store.pending.set(mark.request, entry);
      store.marks.push(entry);
    }
  }
  for (const deployment of frame.deployments) {
    if (!deployment.cooling) continue;
    const spans = (store.spans[deployment.id] ??= []);
    const last = spans[spans.length - 1];
    const end = frame.now + (deployment.cooling.remaining ?? 0);
    if (last && last.to >= frame.now - dt - 1e-6) {
      last.to = Math.max(last.to, end);
      last.status = last.status ?? deployment.cooling.status ?? null;
    } else {
      spans.push({from: frame.now, to: end, status: deployment.cooling.status ?? null});
    }
  }
  store.deployments = frame.deployments;
  // Keep only what the window can still show.
  const oldest = Math.floor((frame.now - WINDOW - 10) / BIN);
  for (const lane of Object.values(store.bins)) {
    for (const index of lane.keys()) {
      if (index < oldest) lane.delete(index);
      else break;
    }
  }
}

function markText(mark, store, info) {
  const deployment = info.deployments.find(item => item.id === mark.lane);
  if (mark.kind === 'incident') {
    return `${incidentLabel(mark.incident.kind, mark.incident.strength)} on ${mark.lane} for ${secs(
      mark.incident.to - mark.incident.from,
    )}.`;
  }
  if (mark.kind === 'surge') return `Traffic surges ×${SURGE.factor} for ${SURGE.duration} s.`;
  if (mark.kind === 'cooldown') {
    const span = (store.spans[mark.lane] ?? []).find(item => Math.abs(item.from - mark.t) < 1e-6);
    const ends = span && span.to <= store.now ? ` for ${secs(span.to - span.from)}` : '';
    const status = span?.status ? ` after a ${span.status}` : '';
    return `${mark.lane} goes into cooldown${status}${ends}; ${deployment?.model_name ?? 'its group'} skips it meanwhile.`;
  }
  const served = info.deployments.find(item => item.id === mark.lane);
  const hop =
    mark.from && mark.from === mark.to
      ? `within ${mark.from}`
      : mark.from && mark.to
        ? `from ${mark.from} to ${mark.to}`
        : 'to the next model group';
  return served
    ? `Requests start falling back ${hop}; this one is served by ${served.id}.`
    : `Requests start falling back ${hop}.`;
}

// One incident button per lane. The button fires the lane's current kind; the caret beside it
// picks another kind and fires it, which also makes it the button's kind.
function IncidentButton({id, onIncident}) {
  const [kind, setKind] = useState('outage');
  const label = kind => (kind === 'outage' ? 'Outage' : kind === 'flaky' ? 'Flaky' : incidentLabel(kind));
  return (
    <div className={styles.incidentSplit}>
      <button type="button" onClick={() => onIncident(id, kind)}>
        Trigger {label(kind).toLowerCase()}
      </button>
      <span className={styles.incidentCaret}>
        <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <select
          aria-label={`Incident kind for ${id}`}
          value=""
          onChange={event => {
            const next = event.target.value;
            if (!next) return;
            setKind(next);
            onIncident(id, next);
          }}>
          <option value="" disabled>
            Start an incident
          </option>
          {LANE_INCIDENTS.map(item => (
            <option key={item} value={item}>
              {label(item)}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}

// How much of a deployment's rpm or tpm limit this minute has used: the router's limit from the
// config when it has one, else the provider cap from its behaviour profile.
function usageLimits(deployment, profile, live) {
  const limits = [];
  for (const metric of ['rpm', 'tpm']) {
    const router = Number(deployment[metric]) > 0 ? Number(deployment[metric]) : null;
    const provider = Number(profile?.[`${metric}_cap`]) > 0 ? Number(profile[`${metric}_cap`]) : null;
    if (router) limits.push({metric, limit: router, used: Number(live?.[metric]) || 0, who: 'router limit'});
    else if (provider) limits.push({metric, limit: provider, used: Number(live?.provider?.[metric]) || 0, who: 'provider cap'});
  }
  return limits;
}

function UsageBars({limits}) {
  if (!limits.length) return null;
  return (
    <div className={styles.usageBars}>
      {limits.map(({metric, limit, used, who}) => {
        const fill = Math.min(1, used / limit);
        const tone = fill >= 0.9 ? styles.usageHot : fill >= 0.7 ? styles.usageWarm : styles.usageOk;
        const text = `${metric} ${Math.round(used).toLocaleString()} of ${limit.toLocaleString()} this minute (${who})`;
        return (
          <span key={metric} className={styles.usageBar} title={text} aria-label={text} role="img">
            <i className={tone} style={{height: `${fill * 100}%`}} />
            <b>{metric[0]}</b>
          </span>
        );
      })}
    </div>
  );
}

function Lanes({store, info, profiles, timeouts, slots, active, onPick, onIncident, onSelect, onMark}) {
  const [detailed, setDetailed] = useState(false);
  const [ref, width] = useWidth(1080);
  const plot = Math.max(200, width - LABEL);
  const now = store.now;
  const start = Math.max(0, now - LEAD);
  const x = t => ((t - start) / WINDOW) * plot;
  const ticks = [];
  for (let t = Math.ceil(start / 20) * 20; t <= start + WINDOW; t += 20) ticks.push(t);

  const timeoutValues = Object.values(timeouts).filter(Boolean);
  const timeout = timeoutValues.length ? Math.max(...timeoutValues) : null;
  const latencyMax = timeout
    ? timeout * 1.25
    : Math.max(2, ...Object.values(profiles).map(profile => (profile.p95_ms / 1000) * 2.5));
  const latY = seconds => 62 - (Math.min(seconds, latencyMax) / latencyMax) * 54;

  let peak = 4;
  const firstBin = Math.floor(start / BIN);
  const lastBin = Math.floor((start + WINDOW) / BIN);
  for (const lane of Object.values(store.bins)) {
    for (const [index, bin] of lane) if (index >= firstBin && index <= lastBin) peak = Math.max(peak, bin.served);
  }
  const barWidth = Math.max(2, (BIN / WINDOW) * plot - 3);
  const unit = (LANE - HALF - 14) / peak;
  const order = [...slots.keys()];
  const stackOf = bin => [
    ...order.filter(label => bin.kinds[label]),
    ...Object.keys(bin.kinds).filter(label => !slots.has(label)),
  ];

  return (
    <div ref={ref} className={styles.lanes}>
      <svg width={0} height={0} style={{position: 'absolute'}} aria-hidden="true">
        <defs>
          <pattern id="sim-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" className={styles.hatch} />
          </pattern>
          <pattern id="sim-fallback" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="4" className={styles.fallbackStripe} />
          </pattern>
        </defs>
      </svg>
      <div className={styles.laneHeader}>
        <div className={styles.laneHeaderLabel} style={{width: LABEL}}>
          <span className={styles.cap}>DEPLOYMENT</span>
          <label className={styles.detailToggle}>
            <input type="checkbox" checked={detailed} onChange={event => setDetailed(event.target.checked)} />
            detailed
          </label>
        </div>
        <div className={styles.axis}>
          {ticks.map(t => (
            <span key={t} style={{left: x(t)}}>
              {t} s
            </span>
          ))}
          {store.marks
            .filter(mark => mark.kind === 'surge' && mark.t >= start)
            .map(mark => (
              <button
                key={mark.n}
                type="button"
                className={styles.markBadge}
                style={{left: x(mark.t) - 10, top: 4}}
                onClick={() => onMark(mark)}>
                {mark.n}
              </button>
            ))}
        </div>
      </div>
      {info.deployments.map(deployment => {
        const profile = profiles[deployment.id];
        const live = store.deployments.find(item => item.id === deployment.id);
        const bins = [...(store.bins[deployment.id] ?? new Map())].filter(
          ([index]) => index >= firstBin && index <= lastBin,
        );
        let path = '';
        let pen = false;
        let previous = null;
        for (const [index, bin] of bins.sort((a, b) => a[0] - b[0])) {
          const p95 = quantile(bin.latency, 0.95);
          if (p95 == null) continue;
          pen = previous != null && index - previous <= 3;
          path += `${pen ? 'L' : 'M'}${x((index + 0.5) * BIN).toFixed(1)} ${latY(p95).toFixed(1)} `;
          previous = index;
        }
        // One mark per pixel; with kinds picked, theirs win the pixel over the dimmed ones.
        const ticksFailed = [];
        const seen = new Set();
        const failures = bins.flatMap(([, bin]) => bin.failed);
        if (active.size) failures.sort((a, b) => kindActive(active, b.kind) - kindActive(active, a.kind));
        for (const failure of failures) {
          const px = Math.round(x(failure.t));
          if (failure.t > now || seen.has(px)) continue;
          seen.add(px);
          ticksFailed.push({...failure, px});
        }
        const laneTimeout = timeouts[deployment.id];
        return (
          <div key={deployment.id} className={styles.lane}>
            <div className={styles.laneLabel} style={{width: LABEL}}>
              <div className={styles.laneName}>
                <UsageBars limits={usageLimits(deployment, profile, live)} />
                <span className={styles.mono}>{deployment.id}</span>
                <button
                  type="button"
                  className={styles.chip}
                  title="Edit this deployment's behaviour in the config"
                  onClick={() => onSelect(deployment.id)}>
                  {profileLabel(profile)}
                </button>
                {live?.cooling && (
                  <span className={styles.coolingTag}>cooling {secs(live.cooling.remaining ?? 0)}</span>
                )}
              </div>
              {detailed && (
                <span className={styles.laneStat}>
                  {deployment.model_name} · {profileSummary(profile)}
                </span>
              )}
              <div className={styles.laneButtons}>
                <IncidentButton id={deployment.id} onIncident={onIncident} />
              </div>
            </div>
            <svg
              width={plot}
              height={LANE}
              className={styles.laneSvg}
              role="img"
              aria-label={`Lane for ${deployment.id}`}>
              {store.incidents
                .filter(incident => incident.id === deployment.id && incident.to > start && incident.from <= now)
                .map(incident => {
                  const x0 = Math.max(0, x(incident.from));
                  const x1 = x(Math.min(incident.to, now));
                  return (
                    <g key={incident.key}>
                      <rect
                        x={x0}
                        y={0.5}
                        width={Math.max(1, x1 - x0)}
                        height={HALF - 1}
                        fill="url(#sim-hatch)"
                        className={styles.incidentSpan}
                      />
                      {x1 - x0 > 60 && (
                        <text x={x0 + 6} y={14} className={styles.incidentText}>
                          {incidentLabel(incident.kind, incident.strength).toLowerCase()}
                        </text>
                      )}
                    </g>
                  );
                })}
              {(store.spans[deployment.id] ?? [])
                .filter(span => span.to > start)
                .map((span, i) => {
                  const x0 = Math.max(0, x(span.from));
                  const x1 = x(Math.min(span.to, now));
                  return (
                    <g key={i}>
                      <rect
                        x={x0}
                        y={HALF}
                        width={Math.max(1, x1 - x0)}
                        height={LANE - HALF - 8}
                        className={styles.coolSpan}
                      />
                      {x1 - x0 > 90 && (
                        <text x={x1 - 6} y={HALF + 13} textAnchor="end" className={styles.coolText}>
                          cooldown {secs(Math.min(span.to, now) - span.from)}
                        </text>
                      )}
                    </g>
                  );
                })}
              <line x1={0} x2={plot} y1={HALF} y2={HALF} className={styles.midLine} />
              {laneTimeout && laneTimeout <= latencyMax && (
                <>
                  <line x1={0} x2={plot} y1={latY(laneTimeout)} y2={latY(laneTimeout)} className={styles.timeoutLine} />
                  <text x={plot - 6} y={latY(laneTimeout) - 3} textAnchor="end" className={styles.timeoutText}>
                    timeout {secs(laneTimeout)}
                  </text>
                </>
              )}
              <path d={path} className={styles.latLine} />
              {bins.map(([index, bin]) => {
                if (!bin.served) return null;
                const bx = x(index * BIN) + 1.5;
                let top = LANE - 8;
                // A stack per bin, one segment per kind; the part served by a fallback is striped.
                return (
                  <g key={index}>
                    {stackOf(bin).map(label => {
                      const slice = bin.kinds[label];
                      const h = slice.served * unit;
                      const striped = slice.fallback * unit;
                      top -= h;
                      return (
                        <g
                          key={label}
                          className={kindActive(active, label) ? styles.seg : `${styles.seg} ${styles.dim}`}
                          style={{fill: kindColour(slots.get(label))}}
                          onClick={() => onPick(slice.last)}>
                          <rect x={bx} y={top} width={barWidth} height={h} />
                          {striped > 0 && (
                            <rect x={bx} y={top} width={barWidth} height={striped} fill="url(#sim-fallback)" />
                          )}
                          <title>
                            {slice.served} {label} served at {index * BIN} to {(index + 1) * BIN} s
                            {slice.fallback ? `, ${slice.fallback} by fallback` : ''}; click to open one
                          </title>
                        </g>
                      );
                    })}
                  </g>
                );
              })}
              {ticksFailed.map(failure => (
                <g
                  key={failure.px}
                  className={kindActive(active, failure.kind) ? styles.tick : `${styles.tick} ${styles.dim}`}
                  onClick={() => onPick(failure.request)}>
                  <line x1={failure.px} x2={failure.px} y1={HALF + 10} y2={LANE - 8} className={styles.failTick} />
                  <path
                    d={`M${failure.px - 3.5} ${HALF + 3.5}l7 7m0 -7l-7 7`}
                    className={styles.failCross}
                    style={{stroke: kindColour(slots.get(failure.kind))}}
                  />
                  <rect x={failure.px - 5} y={HALF + 1} width={10} height={LANE - HALF - 9} className={styles.hit} />
                  <title>
                    failed {failure.kind} attempt at {failure.t.toFixed(1)} s; click to open its request
                  </title>
                </g>
              ))}
              <text x={6} y={HALF - 4} className={styles.laneHint}>
                p95 latency
              </text>
              <text x={6} y={HALF + 12} className={styles.laneHint}>
                served per {BIN} s
              </text>
              <line x1={x(now)} x2={x(now)} y1={0} y2={LANE} className={styles.playhead} />
              {store.marks
                .filter(mark => mark.lane === deployment.id && mark.t >= start)
                .map(mark => (
                  <g
                    key={mark.n}
                    className={styles.mark}
                    transform={`translate(${x(mark.t)}, ${mark.kind === 'incident' ? 30 : mark.kind === 'cooldown' ? 96 : 40})`}
                    onClick={() => onMark(mark)}>
                    <circle r={10} />
                    <text y={4} textAnchor="middle">
                      {mark.n}
                    </text>
                  </g>
                ))}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function Kpis({store, timeout, seed, onSeed}) {
  const [open, setOpen] = useState(false);
  const {totals} = store;
  const p95 = quantile(store.durations, 0.95);
  const slow = p95 != null && timeout && p95 > timeout;
  const main = [
    ['success', totals.requests ? `${((100 * totals.ok) / totals.requests).toFixed(1)}%` : 'none yet'],
    ['in flight now', String(totals.inFlight), null, `most ${totals.maxInFlight}`],
    ['requests', String(totals.requests)],
  ];
  const more = [
    ['p95 end to end', p95 == null ? 'none yet' : secs(p95), slow ? 'bad' : null],
    ['attempts per request', totals.requests ? (totals.attempts / totals.requests).toFixed(2) : 'none yet'],
    ['fallbacks', String(totals.fallbacks), totals.fallbacks ? 'hop' : null],
  ];
  const cell = ([label, value, tone, sub]) => (
    <div key={label} className={styles.kpi}>
      <span className={styles.muted}>{label}</span>
      <span className={`${styles.kpiValue} ${tone ? styles[tone] : ''}`}>{value}</span>
      {sub && <span className={styles.kpiSub}>{sub}</span>}
    </div>
  );
  return (
    <div className={styles.kpiBox}>
      <div className={styles.kpis}>
        {main.map(cell)}
        <button
          type="button"
          className={`${styles.kpiMore} ${slow && !open ? styles.bad : ''}`}
          aria-expanded={open}
          onClick={() => setOpen(value => !value)}>
          More details {open ? '\u25B4' : '\u25BE'}
        </button>
      </div>
      {open && (
        <div className={`${styles.kpis} ${styles.kpisMore}`}>
          {more.map(cell)}
          <label className={styles.kpi} title="Samples come from the seed, so the same seed replays the same run">
            <span className={styles.muted}>seed</span>
            <input
              className={styles.seed}
              type="number"
              min={0}
              value={seed}
              onChange={event => onSeed(Number(event.target.value) || 0)}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function NumberField({value, onChange, placeholder, min = 0, step = 1, label, width, disabled, className}) {
  return (
    <input
      type="number"
      className={className ?? styles.mixNum}
      style={width ? {width} : undefined}
      aria-label={label}
      min={min}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      value={value ?? ''}
      onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
    />
  );
}

// The kinds of request the run sends, as one badge per kind beside the label. A badge opens that
// kind's settings: its share of arrivals and the fields the router core reads.
function RequestMix({kinds, onKinds, model, info, slots}) {
  const [openKey, setOpenKey] = useState(null);
  const total = kinds.reduce((sum, kind) => sum + (Number(kind.share) || 0), 0) || 1;
  const percent = kind => Math.round((100 * (Number(kind.share) || 0)) / total);
  const opened = kinds.find(kind => kind.key === openKey);
  const add = () => {
    const kind = newKind({label: `kind${kinds.length + 1}`});
    onKinds([...kinds, kind]);
    setOpenKey(kind.key);
  };
  return (
    <div className={styles.mixRow} role="group" aria-label="Request mix">
      <span className={styles.cap}>Request mix</span>
      {kinds.map(kind => (
        <button
          key={kind.key}
          type="button"
          className={styles.mixBadge}
          onClick={() => setOpenKey(kind.key)}
          aria-label={`${kind.label || 'request'}, ${percent(kind)}% of requests: open its settings`}>
          <KindSwatch slot={slots.get(kind.label || 'request')} />
          {kind.label || 'request'}
          {kinds.length > 1 && <span className={styles.muted}>{percent(kind)}%</span>}
        </button>
      ))}
      <button type="button" className={styles.mixAdd} onClick={add}>
        + Add
      </button>
      {opened && (
        <KindSettings
          kind={opened}
          percent={percent(opened)}
          slot={slots.get(opened.label || 'request')}
          canRemove={kinds.length > 1}
          model={model}
          info={info}
          onChange={fields => onKinds(kinds.map(kind => (kind.key === opened.key ? {...kind, ...fields} : kind)))}
          onRemove={() => {
            onKinds(kinds.filter(kind => kind.key !== opened.key));
            setOpenKey(null);
          }}
          onClose={() => setOpenKey(null)}
        />
      )}
    </div>
  );
}

function KindSettings({kind, percent, canRemove, model, info, onChange, onRemove, onClose}) {
  const groups = [...new Set(info.deployments.map(item => item.model_name))];
  const metadata = metadataOf(kind);
  const label = kind.label || 'request';
  return (
    <div className={ce.root}>
      <ConfigModal
        cap="Kind of request"
        title={label}
        sub={`${percent}% of requests`}
        label={`Settings for the ${label} requests`}
        onClose={onClose}
        foot={
          <>
            <button type="button" className={ce.danger} disabled={!canRemove} onClick={onRemove}>
              Remove kind
            </button>
            <span className={ce.spacer} />
            <button type="button" className={ce.primary} onClick={onClose}>
              Done
            </button>
          </>
        }>
        <div className={ce.fields2}>
          <KindField label="name">
            <input
              className={ce.input}
              value={kind.label}
              onChange={event => onChange({label: event.target.value.replace(/\s+/g, '-')})}
            />
          </KindField>
          <KindField label="share" hint="relative weight among the kinds">
            <NumberField
              className={ce.input}
              label={`Share of ${label}`}
              value={kind.share}
              step={0.5}
              onChange={value => onChange({share: value ?? 0})}
            />
          </KindField>
          <KindField label="model" hint="model group the request asks for">
            <input
              className={ce.input}
              list="mix-models"
              value={kind.model}
              placeholder={`${model} (top)`}
              onChange={event => onChange({model: event.target.value.trim()})}
            />
          </KindField>
          <KindField label="team" hint="team_id, for team model aliases">
            <input
              className={ce.input}
              placeholder="none"
              value={kind.team_id}
              onChange={event => onChange({team_id: event.target.value.trim()})}
            />
          </KindField>
          <KindField label="tokens" hint="counted against tpm">
            <NumberField
              className={ce.input}
              label={`Tokens of ${label}`}
              value={kind.tokens}
              placeholder="profile"
              step={100}
              onChange={value => onChange({tokens: value})}
            />
          </KindField>
          <KindField label="num_retries" hint="overrides the router's">
            <NumberField
              className={ce.input}
              label={`num_retries of ${label}`}
              value={kind.num_retries}
              placeholder="router's"
              onChange={value => onChange({num_retries: value})}
            />
          </KindField>
          <KindField label="mock_testing" hint="forces a fallback path">
            <select className={ce.input} value={kind.mock} onChange={event => onChange({mock: event.target.value})}>
              {MOCKS.map(mock => (
                <option key={mock.value} value={mock.value}>
                  {mock.label}
                </option>
              ))}
            </select>
          </KindField>
          <KindField label="fallbacks">
            <label className={styles.mixCheck}>
              <input
                type="checkbox"
                checked={!kind.disable_fallbacks}
                onChange={event => onChange({disable_fallbacks: !event.target.checked})}
              />
              {kind.disable_fallbacks ? 'off for this kind' : 'on'}
            </label>
          </KindField>
          <KindField
            label={`sessions${SESSIONS_READY ? '' : ' (next week)'}`}
            hint={SESSIONS_READY ? 'session ids drawn from a pool this size' : SESSIONS_SOON}>
            <NumberField
              className={ce.input}
              label={`Sessions of ${label}`}
              value={kind.sessions || null}
              placeholder="none"
              disabled={!SESSIONS_READY}
              onChange={value => onChange({sessions: value ?? 0})}
            />
          </KindField>
        </div>
        <div className={ce.modalSection}>
          <KindField label="metadata" hint="goes in the body as is and shows in the trace">
            <input
              className={metadata.ok ? ce.input : `${ce.input} ${styles.mixBad}`}
              placeholder='none, or a JSON object such as {"tags": ["x"]}'
              value={kind.metadata}
              onChange={event => onChange({metadata: event.target.value})}
            />
            {!metadata.ok && <span className={styles.mixError}>{metadata.error}; not sent until it parses</span>}
          </KindField>
        </div>
        <datalist id="mix-models">
          {groups.map(group => (
            <option key={group} value={group} />
          ))}
        </datalist>
      </ConfigModal>
    </div>
  );
}

function KindField({label, hint, children}) {
  return (
    <label className={ce.field}>
      {label}
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function MixResults({store, slots, active, onToggle}) {
  const order = [...slots.keys()];
  const rank = label => (order.includes(label) ? order.indexOf(label) : order.length);
  const kinds = Object.entries(store.kinds).sort((a, b) => rank(a[0]) - rank(b[0]));
  const sessions = [...store.sessions.entries()].sort((a, b) => b[1].requests - a[1].requests).slice(0, 8);
  const moved = [...store.sessions.values()].filter(session => session.moves > 0).length;
  if (!kinds.length) return <p className={styles.muted}>Play the run to see each kind of request and session.</p>;
  return (
    <div className={styles.mixResults}>
      <table className={styles.mixTable}>
        <thead>
          <tr>
            <th>kind</th>
            <th>requests</th>
            <th>success</th>
            <th>p95</th>
            <th>attempts each</th>
            <th>fallbacks</th>
          </tr>
        </thead>
        <tbody>
          {kinds.map(([label, kind]) => {
            const p95 = quantile(kind.durations, 0.95);
            return (
              <tr
                key={label}
                className={kindActive(active, label) ? styles.kindRow : `${styles.kindRow} ${styles.dimRow}`}
                onClick={() => onToggle(label)}
                title="Click to highlight this kind in the lanes">
                <td className={styles.mono}>
                  <span className={styles.kindCell}>
                    <KindSwatch slot={slots.get(label)} />
                    {label}
                  </span>
                </td>
                <td>{kind.requests}</td>
                <td>{((100 * kind.ok) / kind.requests).toFixed(1)}%</td>
                <td>{p95 == null ? '' : secs(p95)}</td>
                <td>{(kind.attempts / kind.requests).toFixed(2)}</td>
                <td>{kind.fallbacks}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!SESSIONS_READY && <p className={`${styles.muted} ${styles.soon}`}>{SESSIONS_SOON}</p>}
      {SESSIONS_READY && sessions.length > 0 && (
        <div>
          <table className={styles.mixTable}>
            <thead>
              <tr>
                <th>busiest sessions</th>
                <th>requests</th>
                <th>served by</th>
                <th>moves</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map(([id, session]) => (
                <tr key={id}>
                  <td className={styles.mono}>{id}</td>
                  <td>
                    {session.requests}
                    {session.failed ? <span className={styles.muted}> ({session.failed} failed)</span> : null}
                  </td>
                  <td className={styles.mono}>
                    {Object.entries(session.served)
                      .sort((a, b) => b[1] - a[1])
                      .map(([deployment, count]) => `${deployment} ${count}`)
                      .join(' · ')}
                  </td>
                  <td>{session.moves}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={styles.muted}>
            {moved} of {store.sessions.size} sessions seen so far moved between deployments at least once.
          </p>
        </div>
      )}
    </div>
  );
}

function LiveRun({
  core,
  configJson,
  seed,
  onSeed,
  model,
  initialRate,
  kinds,
  onKinds,
  info,
  profiles,
  timeouts,
  onSelect,
  handle,
  scheduled,
  autoplay,
}) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const [rate, setRate] = useState(initialRate ?? 3);
  const [, setFrame] = useState(0);
  const [picked, setPicked] = useState(null);
  const [error, setError] = useState(null);
  const [generation, setGeneration] = useState(0);
  const [picks, setPicks] = useState(() => new Set());
  const slots = useKindSlots(kinds);
  const unserved = useMemo(
    () => unservedModels(core, configJson, seed, kinds, model),
    [core, configJson, seed, kinds, model],
  );
  const active = new Set([...picks].filter(label => slots.has(label)));
  const toggleKind = label =>
    setPicks(previous => {
      const next = new Set([...previous].filter(item => slots.has(item)));
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  const session = useRef(null);
  const store = useRef(emptyStore());
  const latest = useRef({profiles, rate, speed, info, kinds, scheduled, autoplay});
  latest.current = {profiles, rate, speed, info, kinds, scheduled, autoplay};

  useEffect(() => {
    if (!core || !configJson || !info) return undefined;
    store.current = emptyStore();
    setPicked(null);
    // A docs case brings incidents on a schedule; each gets its mark when the run reaches it.
    const planned = (latest.current.scheduled ?? [])
      .filter(item => info.deployments.some(deployment => deployment.id === item.row))
      .map(item => ({...item, id: item.row}));
    store.current.scheduled = planned;
    try {
      const next = openSession(core, configJson, seed);
      next.start({
        model,
        rate: latest.current.rate,
        requests: coreRequests(latest.current.kinds, model),
        profiles: coreProfiles(latest.current.profiles),
        incidents: planned.map(item =>
          coreIncident(
            item,
            latest.current.profiles[item.id],
            expectedRpm(
              info,
              item.id,
              groupRate(
                latest.current.kinds,
                model,
                info.deployments.find(deployment => deployment.id === item.id)?.model_name,
                latest.current.rate,
              ),
            ),
          ),
        ),
        trace_last: 2000,
      });
      session.current = next;
      setError(null);
      if (latest.current.autoplay) setPlaying(true);
    } catch (problem) {
      session.current = null;
      setError(String(problem.message ?? problem));
    }
    setFrame(n => n + 1);
    return () => {
      session.current?.stop();
      session.current = null;
    };
  }, [core, configJson, seed, model, info, generation]);

  const profilesKey = JSON.stringify(profiles);
  useEffect(() => {
    if (session.current) session.current.set({profiles: coreProfiles(profiles)});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesKey]);

  // A preset brings its own traffic rate.
  useEffect(() => {
    if (initialRate) changeRate(initialRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRate]);

  const requestsKey = JSON.stringify(coreRequests(kinds, model));
  useEffect(() => {
    if (session.current) session.current.set({requests: JSON.parse(requestsKey)});
  }, [requestsKey]);

  const step = useCallback(seconds => {
    const current = session.current;
    if (!current) return;
    const data = store.current;
    try {
      let left = seconds;
      while (left > 1e-9) {
        let chunk = left;
        if (data.surge && data.surge.until > data.now && data.surge.until < data.now + chunk) {
          chunk = data.surge.until - data.now;
        }
        absorb(data, current.advance(chunk), chunk);
        left -= chunk;
        while (data.scheduled?.length && data.scheduled[0].from <= data.now) {
          const incident = data.scheduled.shift();
          data.incidents.push(incident);
          data.numbered += 1;
          data.marks.push({n: data.numbered, t: incident.from, kind: 'incident', lane: incident.id, incident});
        }
        if (data.surge && data.now >= data.surge.until - 1e-9) {
          data.surge = null;
          current.set({rate: latest.current.rate});
        }
      }
    } catch (problem) {
      setError(String(problem.message ?? problem));
      setPlaying(false);
    }
    setFrame(n => n + 1);
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    let last = null;
    let handle;
    const loop = time => {
      if (last != null) step((Math.min(100, time - last) / 1000) * latest.current.speed);
      last = time;
      handle = requestAnimationFrame(loop);
    };
    handle = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(handle);
  }, [playing, step]);

  const changeRate = value => {
    setRate(value);
    const data = store.current;
    session.current?.set({rate: data.surge ? value * SURGE.factor : value});
  };

  const surge = () => {
    const data = store.current;
    if (!session.current || data.surge) return;
    data.surge = {from: data.now, until: data.now + SURGE.duration};
    session.current.set({rate: rate * SURGE.factor});
    data.numbered += 1;
    data.marks.push({n: data.numbered, t: data.now, kind: 'surge', lane: null});
    setFrame(n => n + 1);
  };

  const addIncident = (id, kind, duration) => {
    const data = store.current;
    if (!session.current) return;
    const kindInfo = INCIDENT_KINDS[kind];
    const incident = {
      key: `live-${data.incidents.length + 1}`,
      id,
      kind,
      strength: kindInfo.strength ?? null,
      from: data.now,
      to: data.now + (duration ?? kindInfo.duration),
    };
    session.current.set({
      incidents_add: [
        coreIncident(
          incident,
          profiles[id],
          expectedRpm(info, id, groupRate(kinds, model, info.deployments.find(item => item.id === id)?.model_name, rate)),
        ),
      ],
    });
    data.incidents.push(incident);
    data.numbered += 1;
    data.marks.push({n: data.numbered, t: data.now, kind: 'incident', lane: id, incident});
    setFrame(n => n + 1);
  };

  handle.current = addIncident;

  const pick = id => {
    if (id == null || !session.current) return;
    const run = session.current.trace(id);
    const kind = store.current.kindOf.get(id) ?? null;
    setPicked(run ? {id, run, kind} : {id, kind, missing: true});
  };

  const data = store.current;
  const groupTimeout = Math.max(0, ...Object.values(timeouts).filter(Boolean)) || null;
  const marks = data.marks.slice(-8);

  return (
    <>
      <div className={styles.toolbar}>
        <button type="button" className={styles.play} onClick={() => setPlaying(!playing)} disabled={!session.current}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button type="button" onClick={() => setGeneration(n => n + 1)}>
          Reset
        </button>
        <div className={styles.segmented} role="group" aria-label="Speed">
          {SPEEDS.map(value => (
            <button key={value} type="button" aria-pressed={speed === value} onClick={() => setSpeed(value)}>
              {value}×
            </button>
          ))}
        </div>
        <span className={styles.clockText}>t = {clock(data.now)}</span>
        <span className={styles.divider} />
        <label className={styles.slider}>
          <span className={styles.muted}>traffic</span>
          <input
            type="range"
            min={0.5}
            max={20}
            step={0.5}
            value={rate}
            onChange={event => changeRate(Number(event.target.value))}
          />
          <span className={styles.mono}>{data.surge ? `${rate * SURGE.factor} req/s` : `${rate} req/s`}</span>
        </label>
        <button type="button" className={styles.small} onClick={surge} disabled={!!data.surge}>
          {data.surge
            ? `Surging, ${Math.ceil(data.surge.until - data.now)} s left`
            : `Surge ×${SURGE.factor} for ${SURGE.duration} s`}
        </button>
      </div>

      <RequestMix kinds={kinds} onKinds={onKinds} model={model} info={info} slots={slots} />

      <Kpis store={data} timeout={groupTimeout} seed={seed} onSeed={onSeed} />
      {unserved.map(({model: name, team_id: team}) => (
        <p key={`${team ?? ''}/${name}`} className={styles.error}>
          No deployment serves the model <code>{name}</code>
          {team ? (
            <>
              {' '}
              for team <code>{team}</code>
            </>
          ) : null}
          , so its requests fail. Pick one of {[...new Set(info.deployments.map(item => item.model_name))].join(', ')}.
        </p>
      ))}
      {error && <p className={styles.error}>{error}</p>}
      <Lanes
        store={data}
        info={info}
        profiles={profiles}
        timeouts={timeouts}
        slots={slots}
        active={active}
        onPick={pick}
        onIncident={(id, kind) => addIncident(id, kind)}
        onSelect={onSelect}
        onMark={mark => pick(mark.request)}
      />

      <div className={styles.under}>
        <div className={styles.legend}>
          <span>
            <i className={styles.keyServed} /> served{slots.size > 1 ? ', coloured by kind' : ''}
          </span>
          <span>
            <i className={styles.keyFallback} /> served by fallback
          </span>
          <span>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={styles.keyCross}>
              <path d="M1.5 1.5l7 7m0 -7l-7 7" />
            </svg>{' '}
            failed attempt
          </span>
          <span>
            <i className={styles.keyCool} /> cooldown
          </span>
          <span>
            <i className={styles.keyIncident} /> incident
          </span>
          <span>
            <i className={styles.keyLatency} /> p95 latency
          </span>
        </div>
        <span className={styles.underHint}>Click a bar or a cross to open that request below.</span>
      </div>

      {picked && (
        <SimPicked picked={picked} slots={slots} model={model} info={info} onClose={() => setPicked(null)} />
      )}

      <Panel
        id="sim-by-kind"
        sub
        defaultOpen={false}
        title="By kind and session"
        folded={Object.keys(data.kinds).length ? `${Object.keys(data.kinds).length} kinds so far` : null}>
        <MixResults store={data} slots={slots} active={active} onToggle={toggleKind} />
      </Panel>

      {marks.length > 0 && (
        <Panel id="sim-happened" sub title="What happened" folded={`${data.marks.length} marks`}>
        <div className={styles.happened}>
          {marks.map(mark => (
            <button
              key={mark.n}
              type="button"
              className={styles.happenedRow}
              disabled={mark.request == null}
              onClick={() => pick(mark.request)}>
              <span className={styles.n}>{mark.n}</span>
              <span className={styles.mono}>{clock(mark.t)}</span>
              <span>{markText(mark, data, info)}</span>
            </button>
          ))}
        </div>
        </Panel>
      )}
    </>
  );
}

// The request picked in the lanes, opened right under them: its trace and state diagram, until closed.
function SimPicked({picked, slots, model, info, onClose}) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.scrollIntoView?.({block: 'nearest', behavior: 'smooth'});
  }, [picked.id]);
  return (
    <div ref={ref} className={styles.picked} aria-label={`Request ${picked.id}`} role="region">
      <div className={styles.pickedHead}>
        <span className={styles.cap}>Request {picked.id}</span>
        {picked.kind && (
          <span className={styles.pickedKind}>
            <KindSwatch slot={slots.get(picked.kind)} />
            {picked.kind}
          </span>
        )}
        <span className={styles.spacer} />
        <button type="button" className={styles.pickedClose} onClick={onClose} aria-label="Close this request">
          Close
        </button>
      </div>
      {picked.missing ? (
        <p className={styles.muted}>This request is older than the traces the run keeps, so it cannot be opened.</p>
      ) : (
        <RunCard
          key={picked.id}
          run={{
            kind: 'single',
            n: `${picked.id} at ${clock(picked.run.trace[0]?.t ?? 0)}`,
            ...picked.run,
            model: picked.run.model ?? model,
          }}
          info={info}
        />
      )}
    </div>
  );
}

// The docs case bar: the linked case's title and text, with no way to browse to the others. A case opens in the live run with its config, traffic and incidents;
// Before and After swap in the config the docs section changes, and the run starts over.
function CaseBar({docsCase, side, onSide}) {
  // Only a case link shows the bar; the playground opened directly has none.
  if (!docsCase) return null;
  return (
    <div className={styles.caseBar}>
      <div className={styles.caseTitle}>
        <span className={styles.cap}>DOCS CASE</span>
        <strong>{docsCase.title}</strong>
      </div>
      <div className={styles.segmented} role="group" aria-label="Before or after">
        {[
          ['before', 'Before'],
          ['after', 'After'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={side === value}
            onClick={() => onSide(value)}>
            {label}
          </button>
        ))}
      </div>
      <div className={styles.caseText}>
        <span>
          {docsCase.claim} <a href={docsCase.page}>Read it in the docs</a>
        </span>
        <span className={styles.muted}>
          {side === 'after' ? docsCase.after : docsCase.before} Watch {docsCase.watch}.
        </span>
      </div>
    </div>
  );
}

export default function Simulator({
  core,
  configJson,
  configText,
  seed,
  onSeed,
  model,
  rate,
  kinds,
  onKinds,
  info,
  profiles,
  onEditDeployment,
  defaultIncidents,
  initialScenario,
  docsCase,
  caseSide,
  onCaseSide,
}) {
  const [tab, setTab] = useState(initialScenario && !docsCase ? 'scenario' : 'live');
  const liveIncident = useRef(null);
  const config = useMemo(() => (configJson ? JSON.parse(configJson) : null), [configJson]);
  const timeouts = useMemo(() => timeoutsOf(config, info?.deployments), [config, info]);
  const affinity = useMemo(() => !SESSIONS_READY && affinityConfigured(config), [config]);

  if (!info) return null;

  return (
    <>
      <Panel
        id="sim-run"
        className={styles.panel}
        headClassName={styles.panelHead}
        title="Simulator"
        folded={tab === 'live' ? 'live run keeps running while folded' : 'scenario and compare'}
        extra={
          <div className={styles.tabs} role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'live'} onClick={() => setTab('live')}>
              Live run
            </button>
            <button type="button" role="tab" aria-selected={tab === 'scenario'} onClick={() => setTab('scenario')}>
              Scenario and compare
            </button>
          </div>
        }>
        {affinity && (
          <div className={styles.affinityWarn} role="note">
            <b>!</b>
            <span>
              This config turns on session affinity (<code>optional_pre_call_checks</code>). The playground does not run
              it yet, so sessions are not sticky here. It comes to the Rust router next week.
            </span>
          </div>
        )}
        <CaseBar docsCase={docsCase} side={caseSide} onSide={onCaseSide} />
        {tab === 'live' ? (
          <LiveRun
            scheduled={docsCase ? initialScenario?.incidents : undefined}
            autoplay={Boolean(docsCase)}
            handle={liveIncident}
            core={core}
            configJson={configJson}
            seed={seed}
            onSeed={onSeed}
            model={model}
            initialRate={rate}
            kinds={kinds}
            onKinds={onKinds}
            info={info}
            profiles={profiles}
            timeouts={timeouts}
            onSelect={onEditDeployment}
          />
        ) : (
          <Scenario
            core={core}
            configJson={configJson}
            configText={configText}
            config={config}
            seed={seed}
            model={model}
            kinds={kinds}
            info={info}
            profiles={profiles}
            defaultIncidents={defaultIncidents}
            initialScenario={initialScenario}
          />
        )}
      </Panel>
    </>
  );
}
