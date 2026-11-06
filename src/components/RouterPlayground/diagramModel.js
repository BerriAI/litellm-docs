// Folds one router call's trace into the states the state diagram draws, one per step.
//
// Everything comes from the core: its events, the host calls it made, the random draws it took
// and the routing cache after each step. Two things are worked out here from those: the pick
// frame's stages (the group, minus deployments in cooldown, then the lowest `order` tier, the
// same filters the core's native path runs) and simple-shuffle's shares (its weight source and
// normalisation). Each pick is checked against what the core selected, and a mismatch is shown.

// One field of a RouterEvent's Debug text: `deployment_id: "a"`, `status: Some(429)`.
export function field(detail, name) {
  const match = new RegExp(`\\b${name}: (?:Some\\()?("([^"]*)"|[^,)}\\s]+)`).exec(detail ?? '');
  if (!match) return undefined;
  return match[2] ?? match[1];
}

// Health of every deployment as the routing cache holds it after a step.
export function healthFrom(cache, deployments) {
  const health = {};
  for (const deployment of deployments)
    health[deployment.id] = {fails: 0, minuteFails: 0, minuteSuccesses: 0, rpm: 0, tpm: 0, cooldown: null};
  for (const entry of cache ?? []) {
    const key = entry.key;
    let match = /^deployment:(.+):cooldown$/.exec(key);
    if (match && health[match[1]]) {
      health[match[1]].cooldown = {status: entry.value?.status_code, left: entry.ttl};
      continue;
    }
    match = /^deployment:(.+?):allowed_fails(?::.*)?$/.exec(key);
    if (match && health[match[1]]) {
      health[match[1]].fails += Number(entry.value) || 0;
      continue;
    }
    // The failure-ratio rule's per-minute counters, used when allowed_fails is not set.
    match = /^(.+):(fails|successes)$/.exec(key);
    if (match && health[match[1]]) {
      health[match[1]][match[2] === 'fails' ? 'minuteFails' : 'minuteSuccesses'] += Number(entry.value) || 0;
      continue;
    }
    match = /^global_router:(.+?):.*:(rpm|tpm):[^:]+$/.exec(key);
    if (match && health[match[1]]) health[match[1]][match[2]] += Number(entry.value) || 0;
  }
  return health;
}

// simple-shuffle's weights: `weight`, else `rpm`, else `tpm`, each normalised by its largest,
// else uniform. Returns each candidate's share of the roll.
export function shuffleShares(candidates) {
  for (const source of ['weight', 'rpm', 'tpm']) {
    const weights = candidates.map(deployment => Number(deployment[source]) || 0);
    const largest = Math.max(0, ...weights);
    if (largest <= 0) continue;
    const normalised = weights.map(weight => weight / largest);
    const total = normalised.reduce((sum, weight) => sum + weight, 0);
    return {
      source,
      shares: candidates.map((deployment, i) => ({
        id: deployment.id,
        weight: weights[i],
        share: normalised[i] / total,
      })),
    };
  }
  return {
    source: 'uniform',
    shares: candidates.map(deployment => ({id: deployment.id, weight: 1, share: 1 / candidates.length})),
  };
}

function pickStages(group, deployments, health) {
  const members = deployments.filter(deployment => deployment.model_name === group);
  const stages = [{name: `resolve ${group}`, removed: [], left: members}];
  const cooling = members.filter(deployment => health[deployment.id]?.cooldown);
  let left = members.filter(deployment => !health[deployment.id]?.cooldown);
  stages.push({name: 'drop cooling down', removed: cooling.map(deployment => deployment.id), left});
  const orders = left.map(deployment => deployment.order).filter(order => order != null);
  if (orders.length) {
    const lowest = Math.min(...orders);
    const dropped = left.filter(deployment => deployment.order !== lowest);
    left = left.filter(deployment => deployment.order === lowest);
    stages.push({
      name: 'keep lowest order tier',
      removed: dropped.map(deployment => deployment.id),
      left,
      tier: lowest,
    });
  } else {
    stages.push({name: 'keep lowest order tier', removed: [], left});
  }
  return {stages, candidates: left};
}

const CAUSE = {
  ContextWindowExceeded: 'context window',
  ContentPolicyViolation: 'content policy',
};

const clone = value => JSON.parse(JSON.stringify(value));

export function fold(run, info) {
  const deployments = info.deployments;
  const byId = Object.fromEntries(deployments.map(deployment => [deployment.id, deployment]));
  const call = {model: run.model, status: 'running', note: null};
  const levels = [
    {
      scope: '0',
      group: run.model,
      retry: 0,
      max: info.settings.num_retries,
      depth: 0,
      cause: null,
      error: null,
      status: 'running',
      attempts: [],
    },
  ];
  let pick = null;
  let attempt = null;
  let roll = null;
  let attemptCount = 0;
  const served = {};
  const touched = new Set([run.model]);
  let lastCache = [];
  const states = [];
  const level = () => [...levels].reverse().find(item => item.status === 'running') ?? levels[levels.length - 1];

  for (const step of run.trace) {
    if (step.kind === 'random') {
      roll = step.value;
      continue;
    }
    lastCache = step.cache ?? lastCache;
    const current = level();
    const at = `level:${current.scope}`;
    let edge = {orbit: at};
    let text = '';
    let host = null;

    if (step.kind === 'host') {
      host = step.call;
      if (step.call === 'invoke') {
        const ok = step.answer === '200 OK';
        if (attempt) attempt.answer = step.answer;
        edge = {from: 'attempt-dep', to: `dep:${step.deployment}`, tone: ok ? 'ok' : 'fail', back: true};
        text = `The host sends the attempt to ${step.deployment}, which answers ${step.answer}.`;
      } else if (step.call === 'sleep') {
        edge = {from: at, to: 'host:sleep', tone: 'neutral'};
        text = `The router asks the host to wait ${step.seconds.toFixed(2)}s before the next try.`;
      } else if (step.call === 'allow_fallback') {
        edge = {from: at, to: 'host:allow_fallback', tone: 'hop'};
        text = `The router asks the host whether this request may fall back to ${step.target}. It may.`;
      } else {
        edge = {from: at, to: 'host:select', tone: 'neutral'};
        text = `The router asks the host to run ${step.stage}.`;
      }
    } else {
      const detail = step.detail;
      switch (step.event) {
        case 'RetriesOpened':
          current.max = Number(field(detail, 'max_retries'));
          text = `The router opens a retry budget of ${current.max} for ${current.group}.`;
          break;
        case 'PickStarted': {
          if (attempt) {
            current.attempts.push(attempt);
            attempt = null;
          }
          const group = field(detail, 'model') ?? current.group;
          touched.add(group);
          const health = healthFrom(lastCache, deployments);
          pick = {group, ...pickStages(group, deployments, health), open: true};
          edge = {from: at, to: `group:${group}`, tone: 'neutral'};
          text = `The router starts a pick in ${group}: ${pick.candidates.length} of ${pick.stages[0].left.length} deployments are left after the filters.`;
          break;
        }
        case 'Selected': {
          const id = field(detail, 'deployment_id');
          const group = field(detail, 'model_group');
          touched.add(group);
          if (pick && pick.group !== group) {
            pick = {group, ...pickStages(group, deployments, healthFrom(lastCache, deployments)), open: true};
          }
          const candidates = pick?.candidates ?? [];
          const strategy = {...shuffleShares(candidates), roll: candidates.length > 1 ? roll : null, picked: id};
          strategy.agrees = candidates.some(deployment => deployment.id === id);
          attemptCount += 1;
          attempt = {n: attemptCount, id, answer: null, strategy, open: true};
          if (pick) pick.open = false;
          edge = {from: `group:${group}`, to: `dep:${id}`, tone: 'pick'};
          text =
            candidates.length > 1 && roll != null
              ? `simple-shuffle rolls ${roll.toFixed(2)} and lands in ${id}'s share. The attempt frame now points at it.`
              : `simple-shuffle has one candidate, ${id}, so there is nothing to roll.`;
          roll = null;
          break;
        }
        case 'AttemptFailed': {
          const id = field(detail, 'deployment_id');
          const error = `${field(detail, 'kind')} ${field(detail, 'status') ?? ''}`.trim();
          current.error = error;
          if (attempt) {
            attempt.error = error;
            attempt.open = false;
          }
          edge = {from: `dep:${id}`, to: 'attempt', tone: 'fail'};
          text = `The attempt on ${id} failed with ${error}. The router counts it against ${id}.`;
          break;
        }
        case 'CooldownSet': {
          const id = field(detail, 'deployment_id');
          edge = {from: 'attempt', to: `dep:${id}`, tone: 'warn'};
          text = `${id} has failed too often, so the router cools it down for ${field(detail, 'cooldown')}. Picks skip it until then.`;
          break;
        }
        case 'Retry':
          current.retry = Number(field(detail, 'retry'));
          text = `Retry ${current.retry} of ${current.max} in ${current.group}.`;
          break;
        case 'Succeeded': {
          const id = field(detail, 'deployment_id');
          served[id] = true;
          if (attempt) attempt.open = false;
          current.status = 'returned';
          edge = {from: `dep:${id}`, to: 'attempt', tone: 'ok'};
          text = `${id} answered, and ${current.scope === '0' ? 'the call' : `level ${current.scope}`} returns its response.`;
          if (current.scope === '0') call.status = 'returned';
          break;
        }
        case 'FallingBack':
          if (attempt) {
            current.attempts.push(attempt);
            attempt = null;
          }
          pick = null;
          current.status = 'falling back';
          text = `${current.group} has no tries left, so the router looks for a fallback.`;
          break;
        case 'Fallback': {
          const to = field(detail, 'to');
          const scope = field(detail, 'scope');
          const kind = /^(\w+)/.exec(current.error ?? '')?.[1];
          touched.add(to);
          levels.push({
            scope,
            group: to,
            retry: 0,
            max: info.settings.num_retries,
            depth: Number(field(detail, 'depth')),
            maxFallbacks: Number(field(detail, 'max_fallbacks')),
            cause: CAUSE[kind] ?? 'generic',
            hop: `${field(detail, 'from')} → ${to}`,
            error: null,
            status: 'running',
            attempts: [],
          });
          edge = {from: at, to: `level:${scope}`, tone: 'hop'};
          text = `The router falls back from ${field(detail, 'from')} to ${to} and opens a new level frame for it.`;
          break;
        }
        case 'FallbackDone': {
          const scope = field(detail, 'scope');
          const parent = levels.find(item => item.scope === field(detail, 'parent'));
          const child = levels.find(item => item.scope === scope);
          const succeeded = field(detail, 'succeeded') === 'true';
          if (attempt && child) {
            child.attempts.push(attempt);
            attempt = null;
          }
          if (parent) parent.status = succeeded ? 'returned' : 'failed';
          if (succeeded && parent?.scope === '0') call.status = 'returned';
          edge = {from: `level:${scope}`, to: parent ? `level:${parent.scope}` : at, tone: succeeded ? 'ok' : 'fail'};
          text = succeeded
            ? `The fallback to ${field(detail, 'to')} succeeded, and its response becomes the answer to the original call.`
            : `The fallback to ${field(detail, 'to')} failed too.`;
          break;
        }
        case 'PickFailed':
          current.error = 'no deployment to pick';
          edge = {orbit: at, tone: 'fail'};
          text = `No deployment in ${current.group} could be picked.`;
          break;
        case 'LevelFailed':
          current.status = 'failed';
          edge = {orbit: at, tone: 'fail'};
          text = `${current.group} failed and has nothing left to try.`;
          break;
        case 'FallbacksFailed':
          call.status = 'failed';
          levels[0].status = 'failed';
          edge = {orbit: 'call', tone: 'fail'};
          text = 'There is no fallback left, so the call raises its last error.';
          break;
        case 'RetryBudget':
          text = `The retry budget for ${current.group} is ${field(detail, 'max_retries')}.`;
          break;
        case 'RetryLogged':
          text = `The router records the failure for its retry policy (${field(detail, 'cause')}).`;
          break;
        default:
          text = step.event;
      }
    }

    states.push({
      label: step.kind === 'host' ? `host.${step.call}` : step.event,
      t: step.t,
      text,
      edge,
      host,
      call: {...call},
      levels: clone(levels),
      pick: pick ? clone(pick) : null,
      attempt: attempt ? clone(attempt) : null,
      health: healthFrom(lastCache, deployments),
      served: {...served},
      touched: [...touched],
      byId,
    });
  }
  return states;
}
