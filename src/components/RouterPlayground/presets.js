import {presetProfile} from './profiles';
import {newKind} from './requests';

// Starting configs. Each preset is a proxy config.yaml fragment, the model to send, and the
// outages the simulator offers as a scenario. A preset may also bring behaviour profiles and a
// request mix for the simulator.

const TUTORIAL = `# The model list from "Route your first requests".
# A mock_response that names an exception makes every attempt raise it.
model_list:
  - model_name: chat
    litellm_params:
      model: openai/gpt-4o-mini
      mock_response: hi from a
    model_info:
      id: a
  - model_name: chat
    litellm_params:
      model: openai/gpt-4o-mini
      mock_response: hi from b
    model_info:
      id: b
  - model_name: backup
    litellm_params:
      model: openai/gpt-4o-mini
      mock_response: hi from backup
    model_info:
      id: c

router_settings:
  num_retries: 1
  fallbacks:
    - chat: [backup]
`;

const WEIGHTS = `# simple-shuffle picks by weight, then rpm, then tpm.
# Send 100 requests and compare the split with the weights.
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o
      weight: 3
    model_info:
      id: azure-eastus
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      weight: 1
    model_info:
      id: openai

router_settings:
  num_retries: 2
`;

const ORDER = `# order: 1 serves every request while it is healthy.
# Break primary and the router moves down to order 2.
model_list:
  - model_name: claude
    litellm_params:
      model: anthropic/claude-sonnet-4-5
      order: 1
    model_info:
      id: primary
  - model_name: claude
    litellm_params:
      model: bedrock/anthropic.claude-sonnet-4-5
      order: 2
    model_info:
      id: secondary

router_settings:
  num_retries: 2
  allowed_fails: 1
`;

const PRODUCTION = `# Four model groups across five providers, the way a busy proxy runs them.
# gpt-4o balances three deployments by weight, claude-sonnet steps down
# order tiers, and fallbacks, context window fallbacks and content policy
# fallbacks chain the groups together.
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o
      weight: 3
      rpm: 600
    model_info:
      id: azure-eastus
  - model_name: gpt-4o
    litellm_params:
      model: azure/gpt-4o
      weight: 2
      rpm: 400
    model_info:
      id: azure-westus
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      weight: 1
      tpm: 2000000
    model_info:
      id: openai-gpt-4o
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-5
      order: 1
    model_info:
      id: anthropic
  - model_name: claude-sonnet
    litellm_params:
      model: bedrock/anthropic.claude-sonnet-4-5
      order: 2
    model_info:
      id: bedrock-claude
  - model_name: claude-sonnet
    litellm_params:
      model: vertex_ai/claude-sonnet-4-5
      order: 2
    model_info:
      id: vertex-claude
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
    model_info:
      id: openai-mini
  - model_name: gemini-long
    litellm_params:
      model: vertex_ai/gemini-2.5-pro
    model_info:
      id: vertex-gemini

router_settings:
  routing_strategy: simple-shuffle
  num_retries: 2
  timeout: 20
  allowed_fails: 3
  fallbacks:
    - gpt-4o: [claude-sonnet, gpt-4o-mini]
    - claude-sonnet: [gpt-4o]
  context_window_fallbacks:
    - gpt-4o: [gemini-long]
  content_policy_fallbacks:
    - claude-sonnet: [gpt-4o]
`;

const tuned = (name, fields) => ({...presetProfile(name), ...fields, preset: 'custom'});

export const PRESETS = [
  {
    id: 'tutorial',
    label: 'Tutorial',
    config: TUTORIAL,
    model: 'chat',
    outages: [
      {id: 'a', fail: 'RateLimitError', from: 20, to: 50},
      {id: 'b', fail: 'RateLimitError', from: 35, to: 80},
    ],
  },
  {
    id: 'weights',
    label: 'Weighted load balancing',
    config: WEIGHTS,
    model: 'gpt-4o',
    outages: [{id: 'azure-eastus', fail: 'RateLimitError', from: 30, to: 70}],
  },
  {
    id: 'production',
    label: 'Production mix',
    config: PRODUCTION,
    model: 'gpt-4o',
    outages: [
      {id: 'azure-eastus', fail: 'RateLimitError', from: 30, to: 90},
      {id: 'anthropic', fail: 'InternalServerError', from: 60, to: 120},
    ],
    rate: 8,
    profiles: {
      'azure-eastus': tuned('limited', {rpm_cap: 120, tokens: 1500}),
      'azure-westus': presetProfile('healthy'),
      'openai-gpt-4o': presetProfile('flaky'),
      anthropic: tuned('healthy', {p50_ms: 900, p95_ms: 2600}),
      'bedrock-claude': presetProfile('slow'),
      'vertex-claude': presetProfile('healthy'),
      'openai-mini': tuned('healthy', {p50_ms: 300, p95_ms: 800}),
      'vertex-gemini': tuned('slow', {p50_ms: 2500, p95_ms: 8000, tokens: 60000, tpm_cap: 4000000}),
    },
    requests: () => [
      newKind({label: 'chat', share: 6, model: 'gpt-4o', sessions: 40, tokens: 1200}),
      newKind({
        label: 'agent',
        share: 2,
        model: 'claude-sonnet',
        sessions: 8,
        tokens: 4000,
        num_retries: 3,
        metadata: '{"tags": ["agent"]}',
      }),
      newKind({label: 'long-context', share: 1, model: 'gpt-4o', tokens: 60000, mock: 'mock_testing_context_fallbacks'}),
      newKind({
        label: 'batch',
        share: 1,
        model: 'gpt-4o-mini',
        team_id: 'batch-team',
        num_retries: 0,
        disable_fallbacks: true,
        metadata: '{"tags": ["batch"]}',
      }),
    ],
  },
  {
    id: 'order',
    label: 'Priority with order',
    config: ORDER,
    model: 'claude',
    outages: [{id: 'primary', fail: 'InternalServerError', from: 20, to: 75}],
  },
];

export const FAILURES = [
  'RateLimitError',
  'InternalServerError',
  'ServiceUnavailableError',
  'Timeout',
  'ContextWindowExceededError',
  'ContentPolicyViolationError',
  'AuthenticationError',
  'BadRequestError',
];
