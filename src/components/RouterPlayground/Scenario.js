import React, {useEffect, useMemo, useRef, useState} from 'react';
import {parseConfig} from './core';
import {coreRequests, expectedRpm, groupRate, mixModels} from './requests';
import {INCIDENT_KINDS, coreIncident, coreProfiles, incidentLabel, openSession, strengthLabel} from './simSession';
import styles from './Simulator.module.css';

// A scripted scenario: incidents laid out on a timeline ahead of time, run on two router configs with
// the same seed, side by side. A scenario is plain data, so it travels in the page's URL hash.

const DURATIONS = [120, 300, 600];
const PALETTE = ['outage', 'latency', 'capacity', 'flaky', 'surge'];
const DRAIN = 60;
const SPARK_BIN = 10;

const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const secs = value => (value >= 10 ? `${Math.round(value)} s` : `${+value.toFixed(1)} s`);

function templates(info, model, defaultIncidents) {
  const group = info.deployments.filter(item => item.model_name === model);
  const first = (group[0] ?? info.deployments[0])?.id;
  const second = (group[1] ?? group[0] ?? info.deployments[0])?.id;
  const list = {
    'Region slowdown': [{row: first, kind: 'latency', from: 40, to: 70, strength: 10}],
    'Provider rate limit': [{row: second, kind: 'capacity', from: 100, to: 160, strength: 0.2}],
    'Hard outage': [{row: first, kind: 'outage', from: 150, to: 170}],
    'Traffic surge': [{row: 'traffic', kind: 'surge', from: 200, to: 230, strength: 5}],
  };
  list['All four'] = Object.values(list).flat();
  const outages = (defaultIncidents ?? [])
    .filter(item => info.deployments.some(deployment => deployment.id === item.id))
    .map(item => ({row: item.id, kind: 'outage', from: item.from, to: item.to}));
  if (outages.length) list["The preset's outages"] = outages;
  for (const name of Object.keys(list)) {
    list[name] = list[name].map((item, index) => ({key: `${name}-${index}`, ...item}));
  }
  return list;
}

// The URL hash carries the whole scenario: both configs, profiles, seed, traffic and incidents.
export function scenarioLink(scenario) {
  const bytes = new TextEncoder().encode(JSON.stringify({v: 1, ...scenario}));
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  const encoded = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${window.location.origin}${window.location.pathname}#scenario=${encoded}`;
}

export function readScenarioLink() {
  if (typeof window === 'undefined') return null;
  const found = /#scenario=([A-Za-z0-9_-]+)/.exec(window.location.hash);
  if (!found) return null;
  try {
    const binary = atob(found[1].replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0))));
    return parsed?.v === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function runScenario(core, configJson, seed, {model, kinds, rate, duration, profiles, incidents}) {
  const session = openSession(core, configJson, seed);
  const probe = new core.Playground(configJson, BigInt(seed));
  const info = JSON.parse(probe.describe());
  probe.free();
  const rpmOf = id => {
    const deployment = info.deployments.find(item => item.id === id);
    return expectedRpm(info, id, groupRate(kinds, model, deployment?.model_name, rate));
  };
  const served = new Set(mixModels(kinds, model));
  const surges = incidents.filter(item => item.row === 'traffic');
  const rateAt = t =>
    surges.reduce((value, item) => (t >= item.from && t < item.to ? value * (item.strength ?? 5) : value), rate);
  const requests = [];
  let unhealthy = 0;
  try {
    session.start({
      model,
      rate,
      duration,
      requests: coreRequests(kinds, model),
      profiles: coreProfiles(profiles),
      incidents: incidents
        .filter(item => item.row !== 'traffic' && info.deployments.some(deployment => deployment.id === item.row))
        .map(item => coreIncident({...item, id: item.row}, profiles[item.row], rpmOf(item.row))),
      trace_last: 0,
    });
    let current = rate;
    for (let t = 0; t < duration + DRAIN; t += 1) {
      const next = rateAt(t);
      if (next !== current) {
        session.set({rate: next});
        current = next;
      }
      const frame = session.advance(1);
      requests.push(...frame.completed.filter(request => request.start < duration));
      const mine = frame.deployments.filter(item => served.has(item.model_name));
      if (t < duration && mine.length && mine.every(item => item.cooling)) unhealthy += 1;
    }
  } finally {
    session.stop();
  }
  const count = requests.length || 1;
  const ok = requests.filter(request => request.ok);
  const durations = requests.map(request => request.end - request.start).sort((a, b) => a - b);
  const spark = [];
  for (let from = 0; from < duration; from += SPARK_BIN) {
    const inBin = requests.filter(request => request.start >= from && request.start < from + SPARK_BIN);
    spark.push(inBin.length ? inBin.filter(request => request.ok).length / inBin.length : null);
  }
  return {
    requests: requests.length,
    success: ok.length / count,
    p95: durations.length ? durations[Math.min(durations.length - 1, Math.floor(0.95 * durations.length))] : null,
    attempts: requests.reduce((sum, request) => sum + (request.attempts?.length || 1 + request.retries), 0) / count,
    viaFallback: ok.filter(request => request.fallbacks > 0).length,
    unhealthy,
    spark,
  };
}

function settingsSummary(config) {
  const settings = config?.router_settings ?? {};
  const parts = [`num_retries ${settings.num_retries ?? 0}`];
  if (settings.timeout != null) parts.push(`timeout ${settings.timeout} s`);
  if (settings.allowed_fails != null) parts.push(`allowed_fails ${settings.allowed_fails}`);
  if (settings.cooldown_time != null) parts.push(`cooldown ${settings.cooldown_time} s`);
  const fallbacks = (settings.fallbacks ?? []).flatMap(item =>
    Object.entries(item).map(([from, to]) => `${from} → ${[].concat(to).join(', ')}`),
  );
  parts.push(fallbacks.length ? `fallbacks ${fallbacks.join('; ')}` : 'no fallbacks');
  return parts.join(' · ');
}

function Sparkline({spark, duration, incidents, tone}) {
  const width = 560;
  const height = 70;
  const step = width / Math.max(1, spark.length);
  let path = '';
  let pen = false;
  spark.forEach((value, i) => {
    if (value == null) {
      pen = false;
      return;
    }
    path += `${pen ? 'L' : 'M'}${(i * step + step / 2).toFixed(1)} ${(6 + (1 - value) * 58).toFixed(1)} `;
    pen = true;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={styles.spark} role="img">
      <title>Success rate per {SPARK_BIN} s over the run</title>
      {incidents.map(item => (
        <rect
          key={item.key}
          x={(item.from / duration) * width}
          width={Math.max(1, ((item.to - item.from) / duration) * width)}
          y={0}
          height={height}
          className={styles.sparkIncident}
        />
      ))}
      <line x1={0} x2={width} y1={6} y2={6} className={styles.sparkTop} />
      <line x1={0} x2={width} y1={64} y2={64} className={styles.sparkTop} />
      <path d={path} className={tone === 'b' ? styles.sparkB : styles.sparkA} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Block({item, duration, selected, onSelect, onChange, rowWidth}) {
  const drag = useRef(null);
  const left = (item.from / duration) * 100;
  const width = ((item.to - item.from) / duration) * 100;
  const down = (event, mode) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = {mode, x: event.clientX, from: item.from, to: item.to, moved: false};
  };
  const move = event => {
    const state = drag.current;
    if (!state) return;
    const delta = Math.round(((event.clientX - state.x) / rowWidth()) * duration);
    if (Math.abs(event.clientX - state.x) > 3) state.moved = true;
    if (!state.moved) return;
    if (state.mode === 'move') {
      const length = state.to - state.from;
      const from = Math.min(duration - length, Math.max(0, state.from + delta));
      onChange({from, to: from + length});
    } else if (state.mode === 'start') {
      onChange({from: Math.min(state.to - 1, Math.max(0, state.from + delta))});
    } else {
      onChange({to: Math.max(state.from + 1, Math.min(duration, state.to + delta))});
    }
  };
  const up = () => {
    if (drag.current && !drag.current.moved) onSelect();
    drag.current = null;
  };
  const name = incidentLabel(item.kind, item.strength).toLowerCase();
  const label = `${name} · ${secs(item.to - item.from)}`;
  const value = strengthLabel(item.kind, item.strength);
  const compact = {
    outage: 'down',
    latency: `lat ${value}`,
    capacity: `cap ${value}`,
    flaky: value,
    surge: `surge ${value}`,
  }[item.kind];
  return (
    <div
      className={selected ? `${styles.block} ${styles.blockOn}` : styles.block}
      style={{left: `${left}%`, width: `${width}%`}}
      title={label}
      onPointerDown={event => down(event, 'move')}
      onPointerMove={move}
      onPointerUp={up}
      onClick={event => event.stopPropagation()}
      role="button"
      tabIndex={0}
      onKeyDown={event => event.key === 'Enter' && onSelect()}>
      <span className={styles.edge} onPointerDown={event => down(event, 'start')} />
      <span className={styles.blockText}>{width < 16 ? compact : label}</span>
      <span className={`${styles.edge} ${styles.edgeEnd}`} onPointerDown={event => down(event, 'end')} />
    </div>
  );
}

export default function Scenario({
  core,
  configJson,
  configText,
  config,
  seed,
  model,
  kinds,
  info,
  profiles,
  defaultIncidents,
  initialScenario,
}) {
  const rowsKey = `${model}|${info.deployments.map(item => `${item.id}:${item.model_name}`).join(',')}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const choices = useMemo(() => templates(info, model, defaultIncidents), [rowsKey, defaultIncidents]);
  const [template, setTemplate] = useState(initialScenario ? null : 'Region slowdown');
  const [incidents, setIncidents] = useState(() => initialScenario?.incidents ?? choices['Region slowdown']);
  const [duration, setDuration] = useState(initialScenario?.duration ?? 300);
  const [rate, setRate] = useState(initialScenario?.rate ?? 3);
  const [configB, setConfigB] = useState(initialScenario?.configB ?? null);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragKind, setDragKind] = useState(null);
  const rowsRef = useRef(null);
  const firstChoices = useRef(choices);

  // A new config brings new rows, so a chosen template is laid out again on them.
  useEffect(() => {
    if (firstChoices.current === choices) return;
    firstChoices.current = choices;
    const name = choices[template] ? template : 'Region slowdown';
    setTemplate(name);
    setIncidents(choices[name]);
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choices]);

  const textB = configB ?? configText;
  const parsedB = useMemo(() => {
    try {
      return {config: parseConfig(textB), error: null};
    } catch (error) {
      return {config: null, error: String(error.message ?? error)};
    }
  }, [textB]);

  const rows = ['traffic', ...info.deployments.map(item => item.id)];
  const rowWidth = () => rowsRef.current?.querySelector('[data-track]')?.getBoundingClientRect().width || 600;

  const choose = name => {
    setTemplate(name);
    setIncidents(choices[name]);
    setSelected(null);
  };

  const add = (row, kind, from) => {
    const info_ = INCIDENT_KINDS[kind];
    const start = Math.max(0, Math.min(duration - 5, Math.round(from)));
    const item = {
      key: `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      row,
      kind,
      from: start,
      to: Math.min(duration, start + info_.duration),
      strength: info_.strength ?? null,
    };
    setIncidents([...incidents, item]);
    setSelected(item.key);
    setTemplate(null);
  };

  const fits = (row, kind) => (row === 'traffic') === (kind === 'surge');

  const change = (key, patch) => {
    setIncidents(incidents.map(item => (item.key === key ? {...item, ...patch} : item)));
    setTemplate(null);
  };

  const incidentsKey = JSON.stringify(incidents);
  const profilesKey = JSON.stringify(profiles);
  const kindsKey = JSON.stringify(coreRequests(kinds, model));
  useEffect(() => {
    if (!core || !configJson) return undefined;
    setRunning(true);
    const timer = setTimeout(() => {
      const spec = {model, kinds, rate, duration, profiles, incidents};
      const one = json => {
        try {
          return runScenario(core, json, seed, spec);
        } catch (error) {
          return {error: String(error.message ?? error)};
        }
      };
      const a = one(configJson);
      const b = parsedB.config ? one(JSON.stringify(parsedB.config)) : {error: parsedB.error};
      setResults({a, b});
      setRunning(false);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [core, configJson, parsedB, seed, model, rate, duration, incidentsKey, profilesKey, kindsKey]);

  const copy = async () => {
    const url = scenarioLink({
      config: configText,
      configB: textB,
      model,
      kinds,
      seed,
      profiles,
      duration,
      rate,
      incidents,
    });
    window.history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied('Link copied');
    } catch {
      setCopied('Link is in the address bar');
    }
    setTimeout(() => setCopied(false), 2500);
  };

  const picked = incidents.find(item => item.key === selected);
  const ticks = [];
  for (let t = 0; t <= duration; t += duration > 300 ? 120 : 60) ticks.push(t);
  const metric = (result, fn) => (result?.error ? 'error' : result ? fn(result) : '…');
  const rowsData = [
    ['success', r => `${(r.success * 100).toFixed(1)}%`],
    ['p95 end to end', r => (r.p95 == null ? 'none' : secs(r.p95))],
    ['attempts per request', r => r.attempts.toFixed(2)],
    ['requests served by a fallback', r => String(r.viaFallback)],
    [`time with no healthy ${model} deployment`, r => secs(r.unhealthy)],
    ['requests', r => String(r.requests)],
  ];

  return (
    <div className={styles.scenario}>
      <div className={styles.scenarioBar}>
        <span className={styles.cap}>SCENARIO</span>
        {Object.keys(choices).map(name => (
          <button
            key={name}
            type="button"
            className={template === name ? styles.chipOn : styles.chip}
            onClick={() => choose(name)}>
            {name}
          </button>
        ))}
        <div className={styles.runControls}>
          <label className={styles.slider}>
            <select
              value={duration}
              onChange={event => setDuration(Number(event.target.value))}
              aria-label="Run length">
              {DURATIONS.map(value => (
                <option key={value} value={value}>
                  {value / 60} minutes
                </option>
              ))}
            </select>
          </label>
          <label className={styles.slider}>
            <input
              className={styles.seed}
              type="number"
              min={0.5}
              max={50}
              step={0.5}
              value={rate}
              onChange={event => setRate(Math.max(0.5, Number(event.target.value) || 0.5))}
              aria-label="Requests per second"
            />
            <span className={styles.muted}>req/s · seed {seed}</span>
          </label>
          <button type="button" onClick={copy}>
            {copied || 'Copy link to this scenario'}
          </button>
        </div>
      </div>

      <div className={styles.scenarioMain}>
        <div className={styles.palette}>
          <span className={styles.cap}>DRAG ONTO A ROW</span>
          {PALETTE.map(kind => (
            <button
              key={kind}
              type="button"
              draggable
              className={styles.paletteItem}
              onDragStart={event => {
                event.dataTransfer.setData('text/plain', kind);
                event.dataTransfer.effectAllowed = 'copy';
                setDragKind(kind);
              }}
              onDragEnd={() => setDragKind(null)}
              onClick={() => add(kind === 'surge' ? 'traffic' : rows[1], kind, duration / 4)}>
              {incidentLabel(kind)}
            </button>
          ))}
          <span className={styles.paletteHint}>
            Drag edges to change length; click a block to set its strength. Clicking an item adds it to the first row
            that takes it.
          </span>
        </div>

        <div className={styles.track} ref={rowsRef}>
          <div className={styles.trackHead}>
            <div className={styles.trackName}>
              <span className={styles.cap}>ROW</span>
            </div>
            <div className={styles.trackAxis}>
              {ticks.map(t => (
                <span key={t} style={{left: `${(t / duration) * 100}%`}}>
                  {clock(t)}
                </span>
              ))}
            </div>
          </div>
          {rows.map(row => {
            const items = incidents.filter(item => item.row === row);
            const accepts = dragKind && fits(row, dragKind);
            return (
              <div key={row} className={styles.trackRow}>
                <div className={row === 'traffic' ? `${styles.trackName} ${styles.trackTraffic}` : styles.trackName}>
                  {row}
                </div>
                <div
                  className={accepts ? `${styles.trackLane} ${styles.trackDrop}` : styles.trackLane}
                  data-track
                  onDragOver={event => {
                    if (accepts) event.preventDefault();
                  }}
                  onDrop={event => {
                    event.preventDefault();
                    const kind = event.dataTransfer.getData('text/plain') || dragKind;
                    if (!kind || !fits(row, kind)) return;
                    const box = event.currentTarget.getBoundingClientRect();
                    add(row, kind, ((event.clientX - box.left) / box.width) * duration);
                    setDragKind(null);
                  }}
                  onClick={() => setSelected(null)}>
                  {row === 'traffic' && <div className={styles.baseline} />}
                  {items.length === 0 && row !== 'traffic' && <span className={styles.trackEmpty}>no incidents</span>}
                  {items.map(item => (
                    <Block
                      key={item.key}
                      item={item}
                      duration={duration}
                      selected={item.key === selected}
                      onSelect={() => setSelected(item.key)}
                      onChange={patch => change(item.key, patch)}
                      rowWidth={rowWidth}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          {picked && (
            <div className={styles.blockEditor}>
              <strong>{incidentLabel(picked.kind, picked.strength)}</strong>
              <span className={styles.muted}>
                on {picked.row} from {clock(picked.from)} to {clock(picked.to)}
              </span>
              {INCIDENT_KINDS[picked.kind].strengths[0] != null && (
                <span className={styles.strengths}>
                  strength
                  {INCIDENT_KINDS[picked.kind].strengths.map(value => (
                    <button
                      key={value}
                      type="button"
                      className={picked.strength === value ? styles.chipOn : styles.chip}
                      onClick={() => change(picked.key, {strength: value})}>
                      {strengthLabel(picked.kind, value)}
                    </button>
                  ))}
                </span>
              )}
              <span className={styles.spacer} />
              <button
                type="button"
                onClick={() => {
                  setIncidents(incidents.filter(item => item.key !== picked.key));
                  setSelected(null);
                  setTemplate(null);
                }}>
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.compare}>
        {[
          ['A', config, results?.a, null, 'a'],
          ['B', parsedB.config, results?.b, parsedB.error, 'b'],
        ].map(([name, parsed, result, parseError, tone]) => (
          <div key={name} className={styles.compareCard}>
            <div className={styles.compareHead}>
              <span className={styles.compareName}>{name}</span>
              <span className={styles.mono}>{parsed ? settingsSummary(parsed) : 'config does not parse'}</span>
              <span className={styles.spacer} />
              {name === 'A' ? (
                <span className={styles.muted}>the config above</span>
              ) : (
                <button type="button" className={styles.linkButton} onClick={() => setEditing(editing ? null : 'b')}>
                  {editing ? 'done' : 'edit config'}
                </button>
              )}
            </div>
            {name === 'B' && editing && (
              <>
                <textarea
                  className={styles.configB}
                  spellCheck={false}
                  value={textB}
                  onChange={event => setConfigB(event.target.value)}
                  aria-label="Config B as YAML"
                />
                <div className={styles.compareTools}>
                  <span className={styles.muted}>B starts as a copy of A; edit it here.</span>
                  <button type="button" className={styles.linkButton} onClick={() => setConfigB(null)}>
                    reset to A
                  </button>
                </div>
              </>
            )}
            {parseError && <p className={styles.error}>{parseError}</p>}
            <span className={styles.muted}>success rate over the run{running ? ', running…' : ''}</span>
            {result?.spark ? (
              <Sparkline
                spark={result.spark}
                duration={duration}
                incidents={incidents.filter(item => item.row !== 'traffic' || item.kind === 'surge')}
                tone={tone}
              />
            ) : (
              <div className={styles.sparkEmpty}>{result?.error ?? 'running'}</div>
            )}
          </div>
        ))}
      </div>

      <div className={styles.compareFoot}>
        <div className={styles.metrics}>
          <span className={styles.cap}>SAME SCENARIO, SAME SEED</span>
          <span className={styles.cap}>A</span>
          <span className={styles.cap}>B</span>
          {rowsData.map(([label, fn]) => (
            <React.Fragment key={label}>
              <span>{label}</span>
              <span className={styles.mono}>{metric(results?.a, fn)}</span>
              <span className={styles.mono}>{metric(results?.b, fn)}</span>
            </React.Fragment>
          ))}
        </div>
        <div className={styles.footNotes}>
          <div className={styles.note}>
            Both runs use the same profiles, incidents, traffic and seed, so any difference comes from the router
            config.
          </div>
          <div className={styles.note}>
            A scenario is plain data (configs, profiles, incidents, traffic, seed), so a docs page can link to one and
            the reader lands on a run that makes the page's point.
          </div>
        </div>
      </div>
    </div>
  );
}
