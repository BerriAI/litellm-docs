import {coreRequests, expectedRpm, groupRate, mixModels} from './requests';
import {defaultProfile} from './profiles';
import {coreIncident, coreProfiles, openSession} from './simSession';

// One scripted run of a scenario on one config, start to finish, on simulated time. Kept apart from
// the Scenario component so a docs case can be checked outside the page.

const DRAIN = 60;
const SPARK_BIN = 10;

function tally(list, keyOf) {
  const counts = {};
  for (const item of list) counts[keyOf(item)] = (counts[keyOf(item)] ?? 0) + 1;
  return counts;
}

function kindsOf(requests) {
  const kinds = {};
  for (const request of requests) {
    const label = request.kind ?? 'request';
    if (!kinds[label]) kinds[label] = {requests: 0, ok: 0};
    const entry = kinds[label];
    entry.requests += 1;
    if (request.ok) entry.ok += 1;
  }
  return kinds;
}

export function runScenario(core, configJson, seed, {model, kinds, rate, duration, profiles: given, incidents}) {
  const probe = new core.Playground(configJson, BigInt(seed));
  const info = JSON.parse(probe.describe());
  probe.free();
  const profiles = Object.fromEntries(
    info.deployments.map(item => [item.id, given?.[item.id] ?? defaultProfile()]),
  );
  const session = openSession(core, configJson, seed);
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
    servedBy: tally(ok, request => request.deployment),
    byKind: kindsOf(requests),
  };
}
