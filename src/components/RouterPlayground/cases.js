import yaml from 'js-yaml';
import {newKind} from './requests';

// Docs cases: one claim from a routing docs page, shown as a scenario. Config A is the page's starting
// point and config B makes the one change the page is about; both run on the same traffic, incidents
// and seed. A case opens from a short link, #case=<id>, so a docs page can point at it.

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
    title: 'Weights split traffic',
    page: '/docs/routing#weighted-deployments',
    claim: 'A deployment with weight 3 gets three times the traffic of one with weight 1.',
    watch: 'served by: about 50/50 in A, about 75/25 in B',
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
    title: 'rpm limits steer traffic',
    page: '/docs/routing#load-balancing',
    claim: 'Without weights, simple-shuffle splits by each deployment’s rpm.',
    watch: 'served by: about 50/50 in A, about 10/90 in B',
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
    title: 'order beats weight',
    page: '/docs/proxy/load_balancing#deployment-ordering-priority',
    claim: 'Deployments with order: 1 get every request while healthy; order: 2 only takes over when they fail.',
    watch: 'served by: about 50/50 in A; in B backup serves only during the outage',
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
    watch: 'success: A loses the calls that hit east until it cools down, B moves them to west',
    configA: `# Two regions of one model, no retries.\n${pair('east', 'west')}\nrouter_settings:\n  num_retries: 0\n`,
    patchB: {router_settings: {enable_weighted_failover: true}},
    incidents: [whole('east', 'outage', 30, 90)],
  },
  {
    id: 'retries',
    title: 'Retries absorb flaky errors',
    page: '/docs/routing#retries',
    claim: 'num_retries retries a failed call on another deployment, so a flaky one stops hurting clients.',
    watch: 'success: about 85% in A, about 99% in B; attempts per request go up',
    configA: `# No retries: every failure reaches the client.\n${pair('flaky', 'steady')}\nrouter_settings:\n  num_retries: 0\n`,
    patchB: {router_settings: {num_retries: 2}},
    incidents: [whole('flaky', 'flaky', 0, 120, 0.3)],
  },
  {
    id: 'retry-policy',
    title: 'Retries per error type',
    page: '/docs/routing#advanced-custom-retries-cooldowns-based-on-error-type',
    claim: 'retry_policy sets retries per error class, for example retrying only rate limits.',
    watch: 'success: A loses the 429s, B retries them onto the other deployment',
    configA: `# No retries. allowed_fails: 1000 keeps limited in rotation, so its 429s keep coming.\n${pair('limited', 'steady')}\nrouter_settings:\n  num_retries: 0\n  allowed_fails: 1000\n`,
    patchB: {router_settings: {retry_policy: {RateLimitErrorRetries: 2}}},
    incidents: [whole('limited', 'capacity', 30, 90, 0.2)],
  },
  {
    id: 'cooldown',
    title: 'Cooldown takes a broken deployment out',
    page: '/docs/routing#cooldowns',
    claim: 'After allowed_fails failures in a minute, a deployment cools down and gets no traffic for cooldown_time.',
    watch: 'attempts per request and p95 drop in B: requests stop trying the dead deployment first',
    configA: `# allowed_fails: 1000, so the broken deployment never cools down.\n${pair('broken', 'steady')}\nrouter_settings:\n  num_retries: 2\n  allowed_fails: 1000\n`,
    patchB: {router_settings: {allowed_fails: 3, cooldown_time: 30}},
    incidents: [whole('broken', 'outage', 30, 90)],
  },
  {
    id: 'cooldown-time',
    title: 'How long a cooldown lasts',
    page: '/docs/routing#cooldowns',
    claim: 'cooldown_time sets how long a cooled deployment sits out before the router tries it again.',
    watch: 'served by: B keeps traffic off flapping for longer; A goes back to it after 5 s',
    configA: `# A 5 s cooldown: the router tries flapping again quickly.\n${pair('flapping', 'steady')}\nrouter_settings:\n  num_retries: 2\n  allowed_fails: 3\n  cooldown_time: 5\n`,
    patchB: {router_settings: {cooldown_time: 60}},
    incidents: [whole('flapping', 'outage', 30, 45)],
  },
  {
    id: 'disable-cooldowns',
    title: 'Turning cooldowns off',
    page: '/docs/routing#cooldowns',
    claim: 'disable_cooldowns keeps every deployment in rotation, even one that is down.',
    watch: 'attempts per request and p95 rise in B: every pick of the dead deployment costs a retry',
    configA: `# Default cooldowns.\n${pair('broken', 'steady')}\nrouter_settings:\n  num_retries: 2\n`,
    patchB: {router_settings: {disable_cooldowns: true}},
    incidents: [whole('broken', 'outage', 30, 90)],
  },
  {
    id: 'allowed-fails-policy',
    title: 'Cooldown thresholds per error type',
    page: '/docs/proxy/health_check_routing#allowed_fails_policy-fields',
    claim: 'allowed_fails_policy sets how many failures of each error class a deployment takes before it cools down.',
    watch: 'attempts per request: A cools limited down after three 429s, B keeps it in rotation and retries more',
    configA: `# Three failures of any kind in a minute cool a deployment down.\n${pair('limited', 'steady')}\nrouter_settings:\n  num_retries: 2\n  allowed_fails: 3\n  cooldown_time: 30\n`,
    patchB: {router_settings: {allowed_fails_policy: {RateLimitErrorAllowedFails: 1000}}},
    incidents: [whole('limited', 'capacity', 30, 90, 0.5)],
  },
  {
    id: 'fallbacks',
    title: 'Fallbacks save a dead model group',
    page: '/docs/proxy/reliability#quick-start',
    claim: 'When every deployment of a group fails, fallbacks send the request to the next group.',
    watch: 'success: A fails during the outage, B stays near 100% through claude',
    configA: `# gpt-4o has no fallback.\n${GPT_AND_CLAUDE}`,
    patchB: {router_settings: {fallbacks: [{'gpt-4o': ['claude']}]}},
    incidents: [whole('openai', 'outage', 30, 90)],
  },
  {
    id: 'default-fallbacks',
    title: 'A catch-all fallback',
    page: '/docs/proxy/reliability#default-fallbacks',
    claim: 'default_fallbacks applies to every model group that has no fallback of its own.',
    watch: 'success: A fails during the outage, B stays near 100% through claude',
    configA: `# gpt-4o has no fallback.\n${GPT_AND_CLAUDE}`,
    patchB: {router_settings: {default_fallbacks: ['claude']}},
    incidents: [whole('openai', 'outage', 30, 90)],
  },
  {
    id: 'timeout-fallback',
    title: 'Timeouts, retries and fallbacks together',
    page: '/docs/proxy/reliability#fallbacks--retries--timeouts--cooldowns',
    claim: 'A timeout turns a slow call into a failure, so retries and fallbacks can take over.',
    watch: 'p95: A waits on the slow calls, B stops at the timeout and falls back to claude',
    configA: `# One retry, no timeout, no fallback.\n${GPT_AND_CLAUDE}\nrouter_settings:\n  num_retries: 1\n`,
    patchB: {router_settings: {timeout: 3, fallbacks: [{'gpt-4o': ['claude']}]}},
    incidents: [whole('openai', 'latency', 30, 90, 20)],
  },
  {
    id: 'per-model-timeout',
    title: 'A timeout for one slow deployment',
    page: '/docs/proxy/timeout#custom-timeouts--stream-timeouts-per-model',
    claim: 'A timeout in one deployment’s litellm_params cuts its slow calls short and retries elsewhere.',
    watch: 'p95: A waits on slow, B gives up on it at 3 s and retries on steady',
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
    watch: 'success by kind: long fails in A and succeeds in B; chat is the same in both',
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
      {label: 'chat', share: 4},
      {label: 'long', share: 1, mock: 'mock_testing_context_fallbacks'},
    ],
    incidents: [],
  },
  {
    id: 'content-policy-fallbacks',
    title: 'Blocked prompts move to another provider',
    page: '/docs/proxy/reliability#content-policy-violation-fallback',
    claim: 'content_policy_fallbacks sends a request one provider refuses to another provider.',
    watch: 'success by kind: flagged fails in A and succeeds in B; chat is the same in both',
    configA: `# No content policy fallback.\n${GPT_AND_CLAUDE}`,
    patchB: {router_settings: {content_policy_fallbacks: [{'gpt-4o': ['claude']}]}},
    kinds: [
      {label: 'chat', share: 4},
      {label: 'flagged', share: 1, mock: 'mock_testing_content_policy_fallbacks'},
    ],
    incidents: [],
  },
  {
    id: 'client-fallbacks',
    title: 'Fallbacks per request',
    page: '/docs/proxy/client_side_fallbacks',
    claim: 'A request can bring its own fallbacks, or turn the router’s off with disable_fallbacks.',
    watch: 'success by kind: client survives in both; plain survives only in B; opt-out fails in both',
    configA: `# The router has no fallbacks; the client kind sends fallbacks: [claude].\n${GPT_AND_CLAUDE}`,
    patchB: {router_settings: {fallbacks: [{'gpt-4o': ['claude']}]}},
    kinds: [
      {label: 'client', share: 1, fallbacks: ['claude']},
      {label: 'plain', share: 1},
      {label: 'opt-out', share: 1, disable_fallbacks: true},
    ],
    incidents: [whole('openai', 'outage', 30, 90)],
  },
  {
    id: 'max-fallbacks',
    title: 'Capping a fallback chain',
    page: '/docs/routing#router-general-settings',
    claim: 'max_fallbacks caps how many fallback groups one request may try.',
    watch: 'success: A reaches c, B stops after one hop to b',
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
    watch: 'served by: smart goes to openai in A and to anthropic in B, with no client change',
    configA: `# Clients ask for "smart".\n${GPT_AND_CLAUDE}\nrouter_settings:\n  model_group_alias:\n    smart: gpt-4o\n`,
    patchB: {router_settings: {model_group_alias: {smart: 'claude'}}},
    model: 'smart',
    incidents: [],
  },
  {
    id: 'team-deployment',
    title: 'A team gets its own deployment',
    page: '/docs/proxy/load_balancing#team-scoped-models-and-legacy-model_aliases',
    claim: 'A deployment with model_info.team_id serves that team under the public name, and nobody else.',
    watch: 'served by: in B every acme request goes to acme-azure and the rest stay on shared',
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
      {label: 'everyone', share: 1},
      {label: 'acme', share: 1, team_id: 'acme'},
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
    kinds: (found.kinds ?? [{label: 'chat', share: 1}]).map(kind => newKind(kind)),
    seed: found.seed ?? 7,
    profiles: {},
    duration: found.duration ?? 120,
    rate: found.rate ?? 3,
    incidents: found.incidents.map((item, index) => ({key: `${found.id}-${index}`, ...item})),
  };
}
