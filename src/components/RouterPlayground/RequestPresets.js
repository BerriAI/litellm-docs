import {newSingle, singleBody} from './requests';

// Request presets: a request body and how each provider answers for that request alone. The host
// takes per-request answers through Playground.setBehaviour, which replaces each deployment's
// mock_response until it is cleared. Presets are worked out by asking the core: a throwaway router
// built from the same config shows which group a request reaches and whether its fallbacks fire.

export const OUTCOMES = [
  {value: '', label: 'as configured'},
  {value: 'ok', label: '200 OK'},
  {value: 'slow', label: '200 OK after 5s', latency: 5000},
  {value: '429', label: '429 rate limit', fail: 'RateLimitError'},
  {value: '500', label: '500 server error', fail: 'InternalServerError'},
  {value: '503', label: '503 unavailable', fail: 'ServiceUnavailableError'},
  {value: 'timeout', label: 'timeout', fail: 'Timeout', timeout: true},
  {value: 'context', label: '400 context window exceeded', fail: 'ContextWindowExceededError'},
  {value: 'content', label: '400 content policy', fail: 'ContentPolicyViolationError'},
  {value: '401', label: '401 bad API key', fail: 'AuthenticationError'},
];

const outcomeOf = value => OUTCOMES.find(item => item.value === value);

// The request timeout a config sets, in seconds, for how long a timed out attempt takes.
export function configTimeout(config) {
  const value = Number(config?.router_settings?.timeout ?? config?.litellm_settings?.request_timeout);
  return value > 0 ? value : 10;
}

// What setBehaviour takes: one entry per deployment that does not answer as configured.
export function behaviourOf(responses, timeout = 10) {
  const behaviour = {};
  for (const [id, response] of Object.entries(responses ?? {})) {
    const outcome = outcomeOf(response?.outcome);
    if (!outcome?.value) continue;
    const entry = {};
    if (outcome.fail) entry.fail = outcome.fail;
    if (outcome.latency) entry.latency_ms = outcome.latency;
    if (outcome.timeout) entry.latency_ms = Math.round(timeout * 1000);
    if (response.once && outcome.fail) entry.times = 1;
    behaviour[id] = entry;
  }
  return behaviour;
}

// "a 429 once, b 500" for the trace header.
export function responsesText(responses) {
  return Object.entries(responses ?? {})
    .filter(([, response]) => outcomeOf(response?.outcome)?.value)
    .map(([id, response]) => `${id} ${outcomeOf(response.outcome).label}${response.once ? ' once' : ''}`)
    .join(', ');
}

function probe(core, configJson, seed, body, behaviour) {
  let playground;
  try {
    playground = new core.Playground(configJson, BigInt(seed));
    playground.setBehaviour(JSON.stringify(behaviour));
    return JSON.parse(playground.send(JSON.stringify(body)));
  } catch {
    return null;
  } finally {
    playground?.free();
  }
}

const every = (ids, outcome, once = false) => Object.fromEntries(ids.map(id => [id, {outcome, once}]));
const fellBack = run => Boolean(run?.result?.ok && run.result.fallbacks > 0);

// What the request does on a fresh router with these answers, as the core runs it.
function expect(run) {
  const result = run?.result;
  if (!result) return '';
  if (!result.ok) return 'On a fresh router the request fails.';
  if (result.fallbacks > 0) return `On a fresh router it falls back to ${result.model_group} and ${result.deployment} serves it.`;
  if (result.retries > 0) return `On a fresh router ${result.deployment} serves it after ${result.retries === 1 ? 'a retry' : `${result.retries} retries`}.`;
  return `On a fresh router ${result.deployment} serves it.`;
}

function listOf(ids) {
  if (ids.length <= 1) return ids[0] ?? '';
  return `${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

// The presets for one config and model. Each has a key, a label, a sentence on what it does, the
// fields it sets on the single request and the providers' answers.
export function requestPresets({core, configJson, seed, model, info}) {
  const normal = {
    key: 'normal',
    label: 'Normal request',
    text: 'Every provider answers the way the config says.',
    single: {},
    responses: {},
  };
  if (!core || !configJson || !info) return [normal];
  let config = null;
  try {
    config = JSON.parse(configJson);
  } catch {
    return [normal];
  }
  const body = singleBody(newSingle(), model);
  const first = probe(core, configJson, seed, body, {});
  const tried = first?.trace?.find(step => step.kind === 'host' && step.call === 'invoke')?.deployment;
  const group = info.deployments.find(item => item.id === tried)?.model_name;
  const ids = info.deployments.filter(item => item.model_name === group).map(item => item.id);
  if (!ids.length) return [normal];
  const who = ids.length === 1 ? ids[0] : `The ${group} deployments (${listOf(ids)})`;
  const timeout = configTimeout(config);
  const verb = word => (ids.length === 1 ? `${word}s` : word);
  const their = ids.length === 1 ? 'its' : 'their';
  const arrow = run => (fellBack(run) ? ' → fallback' : '');
  const make = (key, label, text, responses) => {
    const run = probe(core, configJson, seed, body, behaviourOf(responses, timeout));
    return {key, label: label(run), text: `${text} ${expect(run)}`, single: {}, responses, run};
  };
  const presets = [
    normal,
    make(
      'ratelimit',
      () => 'Provider rate-limits (429)',
      `${who} ${verb('answer')} 429 on ${their} first attempt only.`,
      every(ids, '429', true)
    ),
    make('down', run => `Provider down (500)${arrow(run)}`, `${who} ${verb('answer')} 500 on every attempt.`, every(ids, '500')),
    make(
      'timeout',
      () => 'Timeout',
      `${who} ${verb('take')} ${timeout}s on every attempt and ${ids.length === 1 ? 'times' : 'time'} out on the first.`,
      every(ids, 'timeout', true)
    ),
    make(
      'context',
      run => `Context window exceeded${arrow(run)}`,
      `${who} ${verb('reject')} the prompt as too long (400).`,
      every(ids, 'context')
    ),
  ];
  const content = make(
    'content',
    () => 'Content policy → fallback',
    `${who} ${verb('refuse')} on content policy (400).`,
    every(ids, 'content')
  );
  if (fellBack(content.run)) presets.push(content);
  if (fellBack(presets[2].run))
    presets.push(
      make(
        'alldown',
        () => 'Every provider down',
        'Every deployment answers 500, fallbacks included.',
        every(
          info.deployments.map(item => item.id),
          '500'
        )
      )
    );
  const teams = (Array.isArray(config.teams) ? config.teams : []).filter(team => team?.team_id).slice(0, 2);
  for (const team of teams)
    presets.push({
      key: `team-${team.team_id}`,
      label: `As team ${team.team_id}`,
      text: `Sent with team_id ${team.team_id}, so that team's router_settings and deployments apply.`,
      single: {team_id: String(team.team_id)},
      responses: {},
    });
  return presets;
}
