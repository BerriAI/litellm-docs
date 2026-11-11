import React, {useState} from 'react';
import {ERROR_CLASSES, PROFILE_PRESETS, presetProfile} from './profiles';
import {INCIDENT_KINDS, incidentLabel} from './simSession';
import styles from './Simulator.module.css';

// One deployment's behaviour profile: latency, errors, provider capacity and, while a run is live,
// incidents to layer on top. Shared with the config editor, which shows it compact.

const LIVE_INCIDENTS = ['outage', 'latency', 'capacity', 'flaky'];

function erf(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

// Attempt latency is lognormal from the median and p95, as the core samples it.
export function latencyShape(p50, p95) {
  const sigma = Math.max(1e-6, Math.log(Math.max(p95, p50) / Math.max(p50, 1e-6)) / 1.645);
  const cdf = ms => (ms <= 0 ? 0 : 0.5 * (1 + erf((Math.log(ms) - Math.log(p50)) / (sigma * Math.SQRT2))));
  return {cdf};
}

const fmt = ms => (ms < 1000 ? `${Math.round(ms)} ms` : `${+(ms / 1000).toFixed(1)} s`);

function NumberField({label, value, onChange, unit, width = 110, min = 0, step, placeholder}) {
  return (
    <label className={styles.field}>
      {label}
      <span className={styles.unitInput} style={{width}}>
        <input
          type="number"
          min={min}
          step={step}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
        />
        {unit && <span>{unit}</span>}
      </span>
    </label>
  );
}

function LatencyPlot({p50, p95, timeout}) {
  const width = 360;
  const height = 64;
  const {cdf} = latencyShape(p50, p95);
  let range = Math.max(p95 * 2.5, p50 * 4);
  const timeoutMs = timeout ? timeout * 1000 : null;
  const onScale = timeoutMs && timeoutMs <= range * 3;
  if (onScale) range = Math.max(range, timeoutMs * 1.15);
  const bins = 24;
  const mass = Array.from({length: bins}, (_, i) => cdf(((i + 1) * range) / bins) - cdf((i * range) / bins));
  const peak = Math.max(...mass, 1e-9);
  const step = width / bins;
  const past = timeoutMs ? 1 - cdf(timeoutMs) : 0;
  return (
    <div className={styles.plotWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} className={styles.plot} preserveAspectRatio="none" aria-hidden="true">
        {mass.map((value, i) => (
          <rect
            key={i}
            x={i * step + 1}
            width={step - 2}
            y={height - (value / peak) * (height - 6)}
            height={(value / peak) * (height - 6)}
            className={styles.plotBar}
          />
        ))}
        <line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} className={styles.plotAxis} />
      </svg>
      {onScale && (
        <div
          className={timeoutMs / range > 0.75 ? `${styles.timeoutMark} ${styles.timeoutLeft}` : styles.timeoutMark}
          style={{left: `${(timeoutMs / range) * 100}%`}}>
          <span>timeout {fmt(timeoutMs)}</span>
        </div>
      )}
      <div className={styles.plotCaption}>
        <span>0 s</span>
        <span>
          {!timeoutMs
            ? 'no router timeout set, so slow attempts just run long'
            : past >= 0.0005
              ? `about ${past >= 0.01 ? Math.round(past * 100) : (past * 100).toFixed(1)}% of attempts run past the router's timeout`
              : "attempts end well inside the router's timeout"}
        </span>
        <span>{fmt(range)}</span>
      </div>
    </div>
  );
}

export default function ProfileEditor({value, onChange, compact, timeout, onIncident}) {
  const [durations, setDurations] = useState(() =>
    Object.fromEntries(LIVE_INCIDENTS.map(kind => [kind, INCIDENT_KINDS[kind].duration])),
  );
  const profile = value ?? presetProfile('healthy');
  const edit = patch => onChange({...profile, ...patch, preset: 'custom'});
  const weights = ERROR_CLASSES.map(item => ({...item, weight: profile.errors?.[item.name] ?? 0}));
  const total = weights.reduce((sum, item) => sum + item.weight, 0);
  const setWeight = (name, weight) => edit({errors: {...profile.errors, [name]: Math.max(0, weight ?? 0)}});

  return (
    <div className={compact ? `${styles.profile} ${styles.compact}` : styles.profile}>
      <div className={styles.presetRow}>
        <span className={styles.muted}>Start from a profile:</span>
        {Object.entries(PROFILE_PRESETS).map(([key, preset]) => (
          <button
            key={key}
            type="button"
            className={profile.preset === key ? styles.chipOn : styles.chip}
            onClick={() => onChange(presetProfile(key))}>
            {preset.label}
          </button>
        ))}
        {!PROFILE_PRESETS[profile.preset] && <span className={styles.chipOn}>Custom</span>}
      </div>

      <div className={styles.sect}>
        <div className={styles.sectHead}>
          <span className={styles.cap}>LATENCY</span>
          <span className={styles.muted}>per attempt</span>
        </div>
        <div className={styles.latency}>
          <NumberField label="p50" unit="ms" value={profile.p50_ms} onChange={v => edit({p50_ms: v ?? 1})} />
          <NumberField label="p95" unit="ms" value={profile.p95_ms} onChange={v => edit({p95_ms: v ?? 1})} />
          <LatencyPlot p50={Math.max(1, profile.p50_ms)} p95={Math.max(1, profile.p95_ms)} timeout={timeout} />
        </div>
      </div>

      <div className={styles.sect}>
        <div className={styles.sectHead}>
          <span className={styles.cap}>ERRORS</span>
          <span className={styles.muted}>share of attempts</span>
        </div>
        <div className={styles.errors}>
          <div className={styles.errorRate}>
            <NumberField
              label="error rate"
              unit="%"
              width={92}
              step={0.5}
              value={+(profile.error_rate * 100).toFixed(2)}
              onChange={v => edit({error_rate: Math.min(100, v ?? 0) / 100})}
            />
            <div className={styles.mix} aria-label="Error class mix">
              {total > 0 &&
                weights
                  .filter(item => item.weight > 0)
                  .map(item => (
                    <span
                      key={item.name}
                      title={`${item.label}: ${Math.round((100 * item.weight) / total)}%`}
                      style={{width: `${(100 * item.weight) / total}%`, background: item.color}}
                    />
                  ))}
            </div>
          </div>
          <div className={styles.classes}>
            {weights.map(item => (
              <label
                key={item.name}
                className={item.weight > 0 ? styles.errorClass : `${styles.errorClass} ${styles.off}`}>
                <i style={{background: item.color}} />
                <span>{item.label}</span>
                <input
                  type="number"
                  min={0}
                  value={total > 0 ? Math.round((100 * item.weight) / total) : 0}
                  onChange={event => {
                    // Weights are kept as percentages of the mix; the rest keep their proportion.
                    const share = Math.min(100, Math.max(0, Number(event.target.value) || 0));
                    const others = total - item.weight;
                    const errors = {};
                    for (const other of weights) {
                      errors[other.name] =
                        other.name === item.name ? share : others > 0 ? ((100 - share) * other.weight) / others : 0;
                    }
                    edit({errors});
                  }}
                  aria-label={`${item.label} share`}
                />
                <span className={styles.muted}>%</span>
              </label>
            ))}
            {total === 0 && <span className={styles.muted}>pick a class for the failures</span>}
          </div>
        </div>
      </div>

      <div className={styles.sect}>
        <div className={styles.sectHead}>
          <span className={styles.cap}>CAPACITY</span>
          <span className={styles.muted}>provider side</span>
        </div>
        <div className={styles.capacity}>
          <NumberField
            label="requests per minute"
            width={130}
            value={profile.rpm_cap}
            placeholder="no cap"
            onChange={v => edit({rpm_cap: v || null})}
          />
          <NumberField
            label="tokens per minute"
            width={130}
            value={profile.tpm_cap}
            placeholder="no cap"
            onChange={v => edit({tpm_cap: v || null})}
          />
          <NumberField
            label="tokens per request"
            width={130}
            value={profile.tokens}
            onChange={v => edit({tokens: v || null})}
          />
          <span className={styles.muted}>
            Past either limit inside a minute, the provider answers 429 regardless of the error rate above.
          </span>
        </div>
      </div>

      {onIncident && (
        <div className={styles.sect}>
          <div className={styles.sectHead}>
            <span className={styles.cap}>INCIDENTS</span>
            <span className={styles.muted}>click while running</span>
          </div>
          <div className={styles.incidentButtons}>
            {LIVE_INCIDENTS.map(kind => (
              <span key={kind} className={styles.incidentButton}>
                <button type="button" onClick={() => onIncident(kind, durations[kind])}>
                  {incidentLabel(kind)}
                </button>
                <input
                  type="number"
                  min={1}
                  value={durations[kind]}
                  onChange={event => setDurations({...durations, [kind]: Math.max(1, Number(event.target.value) || 1)})}
                  aria-label={`${incidentLabel(kind)} duration in seconds`}
                />
                <span>s</span>
              </span>
            ))}
            <span className={styles.muted}>an incident layers on top of the profile and ends by itself</span>
          </div>
        </div>
      )}
    </div>
  );
}
