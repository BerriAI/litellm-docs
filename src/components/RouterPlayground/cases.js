import yaml from 'js-yaml';
import {newKind} from './requests';

// Docs cases: one claim from a routing docs page. Config A (Before) is the page's starting point and
// config B (After) makes the one change the page is about. A case opens from a short link,
// #case=<id>, in the live run with its traffic and incidents scheduled; the Scenario tab compares
// the two on the same seed.

// Two plain deployments of one model, the starting point of most cases.
const pair = (a, b) => `model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o
    model_info:
      id: ${a}
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
    model_info:
      id: ${b}
`;

const GPT_AND_CLAUDE = `model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
    model_info:
      id: openai
  - model_name: claude
    litellm_params:
      model: anthropic/claude-sonnet-4-5
    model_info:
      id: anthropic
`;

const whole = (row, kind, from, to, strength) => ({row, kind, from, to, ...(strength != null ? {strength} : {})});

export const CASES = [
  {
    id: 'weights',
    code: {before: 'no weights', after: 'weight: 3 on azure, weight: 1 on openai'},
    title: 'Weights split traffic',
    page: '/docs/routing#weighted-deployments',
    claim: 'A deployment with weight 3 gets three times the traffic of one with weight 1.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. Nothing in them asks for a particular deployment, so the router alone decides where each one goes.',
    before: 'Before: two deployments with no weights.',
    after: 'After: weight 3 on azure and weight 1 on openai.',
    watch: 'the bars in each lane: about even before, about 3 to 1 after',
    configA: `# Two deployments, no weights: simple-shuffle splits evenly.\n${pair('azure', 'openai')}`,
    configB: `# weight: 3 and weight: 1, so azure gets about 3 in 4 requests.
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o
      weight: 3
    model_info:
      id: azure
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      weight: 1
    model_info:
      id: openai
`,
    incidents: [],
  },
  {
    id: 'rpm-as-weight',
    code: {before: 'no rpm limits', after: 'rpm: 60 on small, rpm: 600 on big'},
    title: 'rpm limits steer traffic',
    page: '/docs/routing#load-balancing',
    claim: 'Without weights, simple-shuffle splits by each deployment’s rpm.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second, or 180 a minute in total. The request does not name a deployment; the router picks one.',
    before: 'Before: two deployments with no limits.',
    after: 'After: rpm 60 on small and rpm 600 on big, no weights.',
    watch: 'the bars: about even before; after, big serves about 9 in 10 and small\u2019s rpm bar stays near its limit',
    configA: `# No limits: an even split.\n${pair('small', 'big')}`,
    configB: `# rpm 60 and rpm 600 and no weights, so the split follows rpm.
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o
      rpm: 60
    model_info:
      id: small
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      rpm: 600
    model_info:
      id: big
`,
    incidents: [],
  },
  {
    id: 'order',
    code: {before: 'no order', after: 'order: 1 on primary, order: 2 on backup'},
    title: 'order beats weight',
    page: '/docs/proxy/load_balancing#deployment-ordering-priority',
    claim: 'Deployments with order: 1 get every request while healthy; order: 2 only takes over when they fail.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. They do not care which deployment answers, as long as one does.',
    before: 'Before: primary and backup share traffic.',
    after: 'After: primary has order 1 and backup order 2.',
    watch: 'backup\u2019s lane: busy all along before; after, it serves only while primary is down from 0:40 to 1:10',
    configA: `# No order: both deployments share traffic all the time.\n${pair('primary', 'backup')}\nrouter_settings:\n  num_retries: 2\n`,
    configB: `# order: 1 serves everything; order: 2 is the backup.
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o
      order: 1
    model_info:
      id: primary
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      order: 2
    model_info:
      id: backup

router_settings:
  num_retries: 2
`,
    incidents: [whole('primary', 'outage', 40, 70)],
  },
  {
    id: 'weighted-failover',
    title: 'Fail over inside the group',
    page: '/docs/routing#weighted-failover',
    claim: 'With enable_weighted_failover, a failed call is re-picked on a peer in the same group before any other fallback.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. A request is sent once; whether a failed call gets a second try depends only on the router.',
    before: 'Before: east and west, no retries.',
    after: 'After: enable_weighted_failover is on.',
    watch: 'success from 0:30, when east goes down: before, calls that land on east fail until it cools down; after, they move to west and none fail',
    configA: `# Two regions of one model, no retries.\n${pair('east', 'west')}\nrouter_settings:\n  num_retries: 0\n`,
    patchB: {router_settings: {enable_weighted_failover: true}},
    incidents: [whole('east', 'outage', 30, 90)],
  },
  {
    id: 'retries',
    title: 'Retries absorb flaky errors',
    page: '/docs/routing#retries',
    claim: 'num_retries retries a failed call on another deployment, so a flaky one stops hurting clients.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. About 3 in 10 calls that land on flaky fail with a server error.',
    before: 'Before: num_retries 0.',
    after: 'After: num_retries 2.',
    watch: 'success: about 85% before, about 100% after, with more attempts per request under More details',
    configA: `# No retries: every failure reaches the client.\n${pair('flaky', 'steady')}\nrouter_settings:\n  num_retries: 0\n`,
    patchB: {router_settings: {num_retries: 2}},
    incidents: [whole('flaky', 'flaky', 0, 120, 0.3)],
  },
  {
    id: 'retry-policy',
    title: 'Retries per error type',
    page: '/docs/routing#advanced-custom-retries-cooldowns-based-on-error-type',
    claim: 'retry_policy sets retries per error class, for example retrying only rate limits.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. From 0:30 some of the calls that land on limited are turned away with a rate limit error (429).',
    before: 'Before: no retries, and limited stays in rotation.',
    after: 'After: retry_policy retries rate limits twice.',
    watch: 'success while limited hits its rate limit from 0:30 to 1:30: it dips before and holds after',
    configA: `# No retries. allowed_fails: 1000 keeps limited in rotation, so its 429s keep coming.\n${pair('limited', 'steady')}\nrouter_settings:\n  num_retries: 0\n  allowed_fails: 1000\n`,
    patchB: {router_settings: {retry_policy: {RateLimitErrorRetries: 2}}},
    incidents: [whole('limited', 'capacity', 30, 90, 0.2)],
  },
  {
    id: 'cooldown',
    title: 'Cooldown takes a broken deployment out',
    page: '/docs/routing#cooldowns',
    claim: 'After allowed_fails failures in a minute, a deployment cools down and gets no traffic for cooldown_time.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. From 0:30 every call that lands on broken fails.',
    before: 'Before: allowed_fails 1000, so broken never cools down.',
    after: 'After: allowed_fails 3 and cooldown_time 30.',
    watch: 'broken\u2019s lane from 0:30: before, red failures keep coming and attempts per request rise; after, a cooldown mark and its lane goes quiet',
    configA: `# allowed_fails: 1000, so the broken deployment never cools down.\n${pair('broken', 'steady')}\nrouter_settings:\n  num_retries: 2\n  allowed_fails: 1000\n`,
    patchB: {router_settings: {allowed_fails: 3, cooldown_time: 30}},
    incidents: [whole('broken', 'outage', 30, 90)],
  },
  {
    id: 'cooldown-time',
    title: 'How long a cooldown lasts',
    page: '/docs/routing#cooldowns',
    claim: 'cooldown_time sets how long a cooled deployment sits out before the router tries it again.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. Every call that lands on flapping fails between 0:30 and 0:45, then it recovers.',
    before: 'Before: cooldown_time 5.',
    after: 'After: cooldown_time 60.',
    watch: 'flapping\u2019s lane after its outage ends at 0:45: before, traffic returns within seconds; after, it stays off until the cooldown ends',
    configA: `# A 5 s cooldown: the router tries flapping again quickly.\n${pair('flapping', 'steady')}\nrouter_settings:\n  num_retries: 2\n  allowed_fails: 3\n  cooldown_time: 5\n`,
    patchB: {router_settings: {cooldown_time: 60}},
    incidents: [whole('flapping', 'outage', 30, 45)],
  },
  {
    id: 'disable-cooldowns',
    title: 'Turning cooldowns off',
    page: '/docs/routing#cooldowns',
    claim: 'disable_cooldowns keeps every deployment in rotation, even one that is down.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. From 0:30 every call that lands on broken fails.',
    before: 'Before: default cooldowns.',
    after: 'After: disable_cooldowns is on.',
    watch: 'broken\u2019s lane from 0:30: before, it cools down and goes quiet; after, it keeps taking picks and every one costs a retry',
    configA: `# Default cooldowns.\n${pair('broken', 'steady')}\nrouter_settings:\n  num_retries: 2\n`,
    patchB: {router_settings: {disable_cooldowns: true}},
    incidents: [whole('broken', 'outage', 30, 90)],
  },
  {
    id: 'allowed-fails-policy',
    title: 'Cooldown thresholds per error type',
    page: '/docs/proxy/health_check_routing#allowed_fails_policy-fields',
    claim: 'allowed_fails_policy sets how many failures of each error class a deployment takes before it cools down.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. From 0:30 half the calls that land on limited are turned away with a rate limit error (429).',
    before: 'Before: three failures of any kind cool a deployment down.',
    after: 'After: rate limits get 1000 allowed fails.',
    watch: 'limited\u2019s lane from 0:30: before, its 429s cool it down; after, it stays in rotation and requests retry more',
    configA: `# Three failures of any kind in a minute cool a deployment down.\n${pair('limited', 'steady')}\nrouter_settings:\n  num_retries: 2\n  allowed_fails: 3\n  cooldown_time: 30\n`,
    patchB: {router_settings: {allowed_fails_policy: {RateLimitErrorAllowedFails: 1000}}},
    incidents: [whole('limited', 'capacity', 30, 90, 0.5)],
  },
  {
    id: 'fallbacks',
    title: 'Fallbacks save a dead model group',
    page: '/docs/proxy/reliability#quick-start',
    claim: 'When every deployment of a group fails, fallbacks send the request to the next group.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. They ask for gpt-4o by name and say nothing about what to do if it fails.',
    before: 'Before: gpt-4o has no fallback.',
    after: 'After: gpt-4o falls back to claude.',
    watch: 'success while openai is down from 0:30 to 1:30: it falls to 0% before; after, anthropic\u2019s lane picks the traffic up',
    configA: `# gpt-4o has no fallback.\n${GPT_AND_CLAUDE}`,
    patchB: {router_settings: {fallbacks: [{'gpt-4o': ['claude']}]}},
    incidents: [whole('openai', 'outage', 30, 90)],
  },
  {
    id: 'default-fallbacks',
    title: 'A catch-all fallback',
    page: '/docs/proxy/reliability#default-fallbacks',
    claim: 'default_fallbacks applies to every model group that has no fallback of its own.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. They ask for gpt-4o by name and say nothing about what to do if it fails.',
    before: 'Before: no fallbacks at all.',
    after: 'After: default_fallbacks is [claude].',
    watch: 'success while openai is down from 0:30 to 1:30: it falls to 0% before; after, anthropic\u2019s lane picks the traffic up',
    configA: `# gpt-4o has no fallback.\n${GPT_AND_CLAUDE}`,
    patchB: {router_settings: {default_fallbacks: ['claude']}},
    incidents: [whole('openai', 'outage', 30, 90)],
  },
  {
    id: 'timeout-fallback',
    title: 'Timeouts, retries and fallbacks together',
    page: '/docs/proxy/reliability#fallbacks--retries--timeouts--cooldowns',
    claim: 'A timeout turns a slow call into a failure, so retries and fallbacks can take over.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. The client waits as long as it takes; from 0:30 openai answers 20 times slower than usual.',
    before: 'Before: one retry, no timeout, no fallback.',
    after: 'After: timeout 3 and a fallback to claude.',
    watch: 'p95 under More details while openai is 20 times slower from 0:30: it climbs past 20 s before and stays under 10 s after',
    configA: `# One retry, no timeout, no fallback.\n${GPT_AND_CLAUDE}\nrouter_settings:\n  num_retries: 1\n`,
    patchB: {router_settings: {timeout: 3, fallbacks: [{'gpt-4o': ['claude']}]}},
    incidents: [whole('openai', 'latency', 30, 90, 20)],
  },
  {
    id: 'per-model-timeout',
    code: {before: 'no timeout', after: 'timeout: 3 on slow'},
    title: 'A timeout for one slow deployment',
    page: '/docs/proxy/timeout#custom-timeouts--stream-timeouts-per-model',
    claim: 'A timeout in one deployment’s litellm_params cuts its slow calls short and retries elsewhere.',
    request: 'Ordinary chat requests for gpt-4o, about 3 a second. From 0:30 calls that land on slow take 20 times longer than usual.',
    before: 'Before: no timeout.',
    after: 'After: slow has its own timeout of 3 s.',
    watch: 'p95 under More details while slow is 20 times slower from 0:30: it climbs before and stays low after, as calls move to steady',
    configA: `# No timeout: slow calls run to the end.\n${pair('slow', 'steady')}\nrouter_settings:\n  num_retries: 2\n`,
    configB: `# timeout: 3 on slow only.
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o
      timeout: 3
    model_info:
      id: slow
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
    model_info:
      id: steady

router_settings:
  num_retries: 2
`,
    incidents: [whole('slow', 'latency', 30, 90, 20)],
  },
  {
    id: 'context-window-fallbacks',
    title: 'Long prompts move to a bigger model',
    page: '/docs/proxy/reliability#context-window-exceeded-fallback',
    claim: 'context_window_fallbacks sends a request that is too long for one model to a model with a bigger window.',
    before: 'Before: no context window fallback.',
    after: 'After: gpt-4o falls back to gpt-4.1 on context window errors.',
    watch: 'the long kind: every long request fails before; after, gpt-4.1\u2019s lane serves them and chat is unchanged',
    configA: `# No context window fallback.
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
    model_info:
      id: gpt-4o
  - model_name: gpt-4.1
    litellm_params:
      model: openai/gpt-4.1
    model_info:
      id: gpt-4.1
`,
    patchB: {router_settings: {context_window_fallbacks: [{'gpt-4o': ['gpt-4.1']}]}},
    kinds: [
      {label: 'chat', share: 4, description: 'A normal-length chat request for gpt-4o. Four in five requests are this kind.'},
      {label: 'long', share: 1, mock: 'mock_testing_context_fallbacks', description: 'A request with a prompt too long for gpt-4o, so gpt-4o rejects it with a context window error. One in five requests.'},
    ],
    incidents: [],
  },
  {
    id: 'content-policy-fallbacks',
    title: 'Blocked prompts move to another provider',
    page: '/docs/proxy/reliability#content-policy-violation-fallback',
    claim: 'content_policy_fallbacks sends a request one provider refuses to another provider.',
    before: 'Before: no content policy fallback.',
    after: 'After: gpt-4o falls back to claude on content policy errors.',
    watch: 'the flagged kind: every flagged request fails before; after, anthropic\u2019s lane serves them and chat is unchanged',
    configA: `# No content policy fallback.\n${GPT_AND_CLAUDE}`,
    patchB: {router_settings: {content_policy_fallbacks: [{'gpt-4o': ['claude']}]}},
    kinds: [
      {label: 'chat', share: 4, description: 'An ordinary chat request for gpt-4o that every provider accepts. Four in five requests.'},
      {label: 'flagged', share: 1, mock: 'mock_testing_content_policy_fallbacks', description: 'A request that openai refuses under its content policy, while anthropic would answer it. One in five requests.'},
    ],
    incidents: [],
  },
  {
    id: 'client-fallbacks',
    title: 'Fallbacks per request',
    page: '/docs/proxy/client_side_fallbacks',
    claim: 'A request can bring its own fallbacks, or turn the router’s off with disable_fallbacks.',
    before: 'Before: the router has no fallbacks; the client kind sends its own.',
    after: 'After: the router falls back to claude too.',
    watch: 'while openai is down from 0:30: before, only client requests survive; after, plain survives too, and opt-out fails in both',
    configA: `# The router has no fallbacks; the client kind sends fallbacks: [claude].\n${GPT_AND_CLAUDE}`,
    patchB: {router_settings: {fallbacks: [{'gpt-4o': ['claude']}]}},
    kinds: [
      {label: 'client', share: 1, fallbacks: ['claude'], description: 'A request that brings its own fallback list in the body: if gpt-4o fails, try claude.'},
      {label: 'plain', share: 1, description: 'An ordinary request for gpt-4o with no fallback settings of its own, so it gets whatever the router config says.'},
      {label: 'opt-out', share: 1, disable_fallbacks: true, description: 'A request that sends disable_fallbacks: true, so it never falls back, whatever the config says.'},
    ],
    incidents: [whole('openai', 'outage', 30, 90)],
  },
  {
    id: 'max-fallbacks',
    title: 'Capping a fallback chain',
    page: '/docs/routing#router-general-settings',
    claim: 'max_fallbacks caps how many fallback groups one request may try.',
    request: 'Ordinary chat requests for model group a, about 3 a second. They only ever ask for a; reaching b or c is up to the fallbacks.',
    before: 'Before: a falls back to b, and b to c.',
    after: 'After: max_fallbacks 1.',
    watch: 'while a and b are down from 0:30: before, c\u2019s lane picks up the traffic; after, requests stop at b and fail',
    configA: `# a falls back to b, and b falls back to c.
model_list:
  - model_name: a
    litellm_params:
      model: openai/gpt-4o
    model_info:
      id: a
  - model_name: b
    litellm_params:
      model: azure/gpt-4o
    model_info:
      id: b
  - model_name: c
    litellm_params:
      model: anthropic/claude-sonnet-4-5
    model_info:
      id: c

router_settings:
  fallbacks:
    - a: [b]
    - b: [c]
`,
    patchB: {router_settings: {max_fallbacks: 1}},
    model: 'a',
    incidents: [whole('a', 'outage', 30, 90), whole('b', 'outage', 30, 90)],
  },
  {
    id: 'alias',
    title: 'Moving an alias moves the traffic',
    page: '/docs/proxy/load_balancing#router-settings-on-config---routing_strategy-model_group_alias',
    claim: 'model_group_alias maps a public name onto a model group, so clients keep their name when the target changes.',
    request: 'Ordinary chat requests for the name smart, about 3 a second. The client never changes what it asks for; only the config does.',
    before: 'Before: the alias smart points at gpt-4o.',
    after: 'After: the alias smart points at claude.',
    watch: 'the lanes: openai serves everything before, anthropic after, and the clients still ask for smart',
    configA: `# Clients ask for "smart".\n${GPT_AND_CLAUDE}\nrouter_settings:\n  model_group_alias:\n    smart: gpt-4o\n`,
    patchB: {router_settings: {model_group_alias: {smart: 'claude'}}},
    model: 'smart',
    incidents: [],
  },
  {
    id: 'team-deployment',
    code: {before: 'one shared deployment', after: 'acme-azure with team_id: acme'},
    title: 'A team gets its own deployment',
    page: '/docs/proxy/load_balancing#team-scoped-models-and-legacy-model_aliases',
    claim: 'A deployment with model_info.team_id serves that team under the public name, and nobody else.',
    before: 'Before: everyone shares one deployment.',
    after: 'After: team acme has its own deployment under the same name.',
    watch: 'the lanes: shared serves both kinds before; after, acme\u2019s requests move to acme-azure',
    configA: `# Everyone shares one deployment. teams: stands in for the proxy's team records.
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
    model_info:
      id: shared

teams:
  - team_id: acme
`,
    configB: `# acme brings its own deployment under the public name gpt-4o.
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
    model_info:
      id: shared
  - model_name: acme-gpt-4o
    litellm_params:
      model: azure/acme-gpt-4o
    model_info:
      id: acme-azure
      team_id: acme
      team_public_model_name: gpt-4o

teams:
  - team_id: acme
`,
    kinds: [
      {label: 'everyone', share: 1, description: 'A request for gpt-4o from a key with no team.'},
      {label: 'acme', share: 1, team_id: 'acme', description: 'A request for gpt-4o from a key that belongs to team acme. It asks for the same name as everyone else.'},
    ],
    incidents: [],
  },
];

// Deep-merges a router_settings patch into a config, for cases whose B is A plus one setting.
function patched(text, patch) {
  const config = yaml.load(text);
  for (const [key, value] of Object.entries(patch)) {
    config[key] = value && typeof value === 'object' && !Array.isArray(value) ? {...config[key], ...value} : value;
  }
  const comment = Object.entries(patch)
    .flatMap(([key, value]) => (key === 'router_settings' ? Object.keys(value) : [key]))
    .join(', ');
  return `# Config A with ${comment} changed.\n${yaml.dump(config, {lineWidth: 100})}`;
}

// The one setting a case changes, as a short line per side for its Before and After cards. Cases
// whose After is a whole config name theirs in `code`; the rest are config A plus router_settings.
const flow = value => yaml.dump(value, {flowLevel: 0, lineWidth: -1}).trim();

export function caseCode(found) {
  if (found.code) return found.code;
  const settings = yaml.load(found.configA)?.router_settings ?? {};
  const changed = Object.entries(found.patchB?.router_settings ?? {});
  const line = pick => changed.map(([key, value]) => `${key}: ${pick(key, value)}`).join(', ');
  return {
    before: line(key => (settings[key] === undefined ? 'unset' : flow(settings[key]))),
    after: line((key, value) => flow(value)),
  };
}

export const caseById = id => CASES.find(item => item.id === id) ?? null;

// A case as the scenario a #scenario= link carries, plus the case itself for the header.
export function caseScenario(id) {
  const found = caseById(id);
  if (!found) return null;
  const configB = found.configB ?? patched(found.configA, found.patchB);
  return {
    v: 1,
    case: found.id,
    config: found.configA,
    configB,
    model: found.model ?? 'gpt-4o',
    kinds: (found.kinds ?? [{label: 'chat', share: 1, description: found.request}]).map(kind => newKind(kind)),
    seed: found.seed ?? 7,
    profiles: {},
    duration: found.duration ?? 120,
    rate: found.rate ?? 3,
    incidents: found.incidents.map((item, index) => ({key: `${found.id}-${index}`, ...item})),
  };
}
