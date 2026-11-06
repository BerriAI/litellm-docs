// The simulator's door into the core: a session runs traffic through its own fresh router on simulated
// time with the core's incremental API (simStart, simAdvance, simSet, simTrace, simStop), and the
// helpers here turn the editor's profiles and incidents into what that API takes.

export const INCIDENT_KINDS = {
  outage: {label: 'Outage', short: 'outage', duration: 30, strengths: [null]},
  latency: {label: 'Latency', short: 'latency', duration: 30, strength: 10, strengths: [2, 5, 10, 20]},
  capacity: {label: 'Capacity', short: 'capacity', duration: 60, strength: 0.2, strengths: [0.5, 0.2, 0.1]},
  flaky: {label: 'Flaky', short: 'flaky', duration: 60, strength: 0.3, strengths: [0.1, 0.3, 0.6, 1]},
  surge: {label: 'Traffic surge', short: 'surge', duration: 20, strength: 5, strengths: [2, 3, 5, 10]},
};

const FRACTIONS = {0.5: '½', 0.2: '⅕', 0.1: '⅒'};

export function strengthLabel(kind, strength) {
  if (kind === 'outage') return '';
  if (kind === 'capacity') return FRACTIONS[strength] ?? `×${strength}`;
  if (kind === 'flaky') return `${Math.round(strength * 100)}%`;
  return `×${strength}`;
}

export function incidentLabel(kind, strength) {
  const info = INCIDENT_KINDS[kind];
  const value = strengthLabel(kind, strength ?? info.strength);
  return value ? `${info.label} ${value}` : info.label;
}

// A profile as the core takes it. The editor keeps a preset name and nulls the core does not need.
export function coreProfile(profile) {
  const errors = Object.fromEntries(Object.entries(profile.errors ?? {}).filter(([, weight]) => weight > 0));
  return {
    p50_ms: Math.max(1, profile.p50_ms),
    p95_ms: Math.max(profile.p50_ms, profile.p95_ms),
    error_rate: Math.min(1, Math.max(0, profile.error_rate)),
    errors: Object.keys(errors).length ? errors : {InternalServerError: 1},
    rpm_cap: profile.rpm_cap || null,
    tpm_cap: profile.tpm_cap || null,
    tokens: profile.tokens || undefined,
  };
}

export const coreProfiles = profiles =>
  Object.fromEntries(Object.entries(profiles).map(([id, profile]) => [id, coreProfile(profile)]));

// What a scheduled incident changes, for a deployment with this profile under this much traffic.
export function coreIncident(incident, profile, expectedRpm) {
  const base = {key: incident.key, id: incident.id, from: incident.from};
  if (incident.to != null && Number.isFinite(incident.to)) base.to = incident.to;
  const strength = incident.strength ?? INCIDENT_KINDS[incident.kind].strength;
  if (incident.kind === 'outage') return {...base, outage: true};
  if (incident.kind === 'latency') return {...base, latency_factor: strength};
  if (incident.kind === 'flaky') return {...base, error_rate: strength};
  const rpm = profile?.rpm_cap || Math.max(1, expectedRpm);
  const change = {...base, rpm_cap: Math.max(1, Math.round(rpm * strength))};
  if (profile?.tpm_cap) change.tpm_cap = Math.max(1, Math.round(profile.tpm_cap * strength));
  return change;
}

export function openSession(core, configJson, seed) {
  const playground = new core.Playground(configJson, BigInt(seed));
  let model = '';
  let running = false;
  return {
    start(spec) {
      model = spec.model;
      playground.simStart(JSON.stringify(spec));
      running = true;
    },
    now: () => playground.now(),
    advance: seconds => JSON.parse(playground.simAdvance(seconds)),
    set: change => playground.simSet(JSON.stringify(change)),
    trace(id) {
      const run = JSON.parse(playground.simTrace(id));
      return run && {...run, model: run.model ?? model};
    },
    stop() {
      try {
        if (running) playground.simStop();
      } finally {
        running = false;
        playground.free();
      }
    },
  };
}
