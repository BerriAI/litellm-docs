import type {ComponentDeclaration, IsoDay, RouteId, TermId} from './shared';

// Every piece of work in the move to a Rust gateway, grouped by component, and
// the goals and plans over it. This is the only file to edit when work ships.
// model.ts builds the tree the page draws from it and fails the build when it
// drifts out of shape. Percentages are always derived, never entered.
//
// Progress is size-weighted: a piece of work counts 0.8 of its size once it is
// `partial` and all of it once it is `done`, as LEVELS in shared.ts describes.
// When work ships, add `partial` or `done` with its RC. Never change or remove
// one that is already there.
//
// Sizes are rough engineer-weeks and only matter relative to each other.
export const COMPONENTS = [
  {
    // Gets the gateway in front of Python at all: everything a request needs
    // before any component behind it matters.
    id: 'deploy',
    text: 'Deployment',
    work: [
      {id: 'image', text: 'Gateway binary in the Docker image', size: 2},
      {id: 'forward', text: 'Forward unserved requests to Python', size: 1},
      {id: 'dispatch', text: 'Dispatch crate and gap table', size: 3},
      {id: 'plans', text: 'Per model group plans at config load', size: 2},
      {id: 'layers', text: 'Identify, dispatch and admit layers', size: 2},
    ],
  },
  {
    id: 'core',
    text: 'Rust core',
    work: [
      {id: 'python-bridge', text: 'Python bridge', size: 1, done: 'v1.91.0-rc.1'},
      {id: 'host', text: 'Python host calls', size: 1, done: 'v1.103.0-rc.1'},
      {id: 'http', text: 'HTTP client', size: 1, done: 'v1.103.0-rc.1'},
      {id: 'streaming', text: 'Streaming', size: 1, done: 'v1.103.0-rc.1'},
      {id: 'async', text: 'Async bridge', size: 1, done: 'v1.104.0-rc.1'},
      {id: 'tracing', text: 'Tracing', size: 1, done: 'v1.104.0-rc.1'},
      {id: 'model-catalog', text: 'Model catalog', size: 1, done: 'v1.104.0-rc.1'},
      {id: 'config', text: 'Config parsing', size: 1, done: 'v1.105.0-rc.1'},
    ],
  },
  {
    // The providers that speak Messages natively. The first provider of a route
    // sets the pattern, so each one after it is a small piece of work.
    id: 'messages',
    text: 'Messages translation',
    work: [
      {id: 'anthropic', size: 2, partial: 'v1.104.0-rc.1'},
      {id: 'deepseek', size: 0.5, partial: 'v1.107.0-rc.1'},
      {id: 'vertex_ai', size: 0.5, partial: 'v1.107.0-rc.1'},
      {id: 'bedrock', size: 0.5, partial: 'v1.104.0-rc.1'},
      {id: 'bedrock_mantle', size: 0.5, partial: 'v1.107.0-rc.1'},
      {id: 'azure_ai', size: 0.5, partial: 'v1.94.0-rc.1'},
      {id: 'minimax', size: 0.5, partial: 'v1.107.0-rc.1'},
      {id: 'github_copilot', size: 0.5},
      {id: 'tencent', size: 0.5, partial: 'v1.107.0-rc.1'},
      {id: 'edenai', size: 0.5, partial: 'v1.107.0-rc.1'},
      {id: 'openai_like', size: 0.5},
    ],
  },
  {
    // The providers that speak Chat completions natively.
    id: 'chat-completions',
    text: 'Chat completions translation',
    work: [
      {id: 'openai', size: 2},
      {id: 'azure', size: 0.25},
      {id: 'anthropic', size: 0.25, partial: 'v1.99.0-rc.1'},
      {id: 'bedrock', size: 0.25, partial: 'v1.99.0-rc.1'},
      {id: 'vertex_ai', size: 0.25},
      {id: 'gemini', size: 0.25},
      {id: 'azure_ai', size: 0.25},
      {id: 'mistral', size: 0.25},
      {id: 'cohere', size: 0.25},
      {id: 'groq', size: 0.25},
      {id: 'xai', size: 0.25},
      {id: 'deepseek', size: 0.25},
      {id: 'together_ai', size: 0.25},
      {id: 'fireworks_ai', size: 0.25},
      {id: 'openrouter', size: 0.25},
      {id: 'databricks', size: 0.25},
      {id: 'watsonx', size: 0.25},
      {id: 'perplexity', size: 0.25},
      {id: 'deepinfra', size: 0.25},
      {id: 'cerebras', size: 0.25},
      {id: 'nvidia_nim', size: 0.25},
      {id: 'sagemaker', size: 0.25},
      {id: 'huggingface', size: 0.25},
      {id: 'replicate', size: 0.25},
      {id: 'ai21', size: 1},
      {id: 'sambanova', size: 0.25},
      {id: 'nebius', size: 0.25},
      {id: 'novita', size: 0.25},
      {id: 'hyperbolic', size: 0.25},
      {id: 'baseten', size: 0.25},
      {id: 'moonshot', size: 0.25},
      {id: 'dashscope', size: 0.25},
      {id: 'volcengine', size: 0.25},
      {id: 'minimax', size: 0.25},
      {id: 'github_copilot', size: 0.25},
      {id: 'snowflake', size: 0.25},
      {id: 'oci', size: 0.25},
      {id: 'vercel_ai_gateway', size: 0.25},
      {id: 'lm_studio', size: 0.25},
      {id: 'ollama', size: 0.25},
      {id: 'hosted_vllm', size: 0.25},
      {id: 'openai_like', size: 0.25, partial: 'v1.105.0-rc.1'},
    ],
  },
  {
    // The providers that speak Responses natively.
    id: 'responses',
    text: 'Responses translation',
    work: [
      {id: 'openai', size: 2, partial: 'v1.95.0-rc.1'},
      {id: 'azure', size: 0.25},
      {id: 'azure_ai', size: 0.25},
      {id: 'bedrock', size: 0.25},
      {id: 'bedrock_mantle', size: 0.25},
      {id: 'xai', size: 0.25},
      {id: 'openrouter', size: 0.25, partial: 'v1.107.0-rc.1'},
      {id: 'databricks', size: 0.25},
      {id: 'fireworks_ai', size: 0.25},
      {id: 'perplexity', size: 0.25},
      {id: 'github_copilot', size: 0.25},
      {id: 'chatgpt', size: 0.25},
      {id: 'hosted_vllm', size: 0.25},
      {id: 'volcengine', size: 0.25},
      {id: 'edenai', size: 0.25},
      {id: 'manus', size: 0.25},
      {id: 'sail', size: 0.25},
      {id: 'litellm_proxy', size: 0.25},
      {id: 'openai_like', size: 0.25},
    ],
  },
  {
    // The Python-only request features each route's detectors find, which keep
    // a request on Python until Rust serves them (BerriAI/litellm#46714). The
    // response cache and pre-request hooks are counted under cache and logging.
    id: 'features',
    text: 'Python-only request features',
    work: [
      {id: 'mock', text: 'Mock responses', size: 0.5},
      {id: 'mcp-tools', text: 'Proxy MCP tools', size: 3},
      {id: 'caller-client', text: 'Caller HTTP clients', size: 0.5},
      {id: 'timeouts', text: 'Request, stream and phase timeouts', size: 1},
      {id: 'agentic-loop', text: 'Agentic loop hooks', size: 2},
      {id: 'tls', text: 'TLS security level and curves', size: 1},
      {id: 'modify-params', text: 'modify_params rewrites', size: 1},
      {id: 'cache-control-injection', text: 'Prompt cache breakpoint injection', size: 1},
      {id: 'workload-identity', text: 'Anthropic workload identity tokens', size: 1},
      {id: 'thinking-retry', text: 'Thinking signature retry', size: 1},
      {id: 'stream-cost', text: 'Cost in streamed usage', size: 0.5},
      {id: 'websearch', text: 'Web search interception', size: 2},
      {id: 'interceptors', text: 'Messages interceptors', size: 2},
      {id: 'safeguards', text: 'Safeguards classifier', size: 2},
      {id: 'drop-params', text: 'drop_params', size: 1, partial: 'v1.104.0-rc.1'},
      {id: 'extra-body', text: 'Extra body fields', size: 0.5},
      {id: 'prompt-management', text: 'Prompt management', size: 2},
      {id: 'param-gating', text: 'Model param gating', size: 2},
      {id: 'chat-streaming', text: 'Chat completions streaming', size: 1},
      {id: 'model-list', text: 'Per-call model_list', size: 1},
      {id: 'alias-map', text: 'model_alias_map', size: 0.5},
      {id: 'text-format', text: 'text_format parsing', size: 1},
      {id: 'chat-bridge', text: 'Responses through Chat completions', size: 2},
      {id: 'response-ids', text: 'Deployment and encoded item ids', size: 2},
      {id: 'input-rewrite', text: 'Responses input rewrites', size: 1},
      {id: 'provider-affinity', text: 'Provider affinity header', size: 1},
      {id: 'managed-ids', text: 'Managed file and vector store ids', size: 2},
      {id: 'tool-mapping', text: 'Cache marks, tool search and tool schema repair', size: 2},
      {id: 'client-headers', text: 'Forwarded client headers', size: 0.5},
      {id: 'deployment-hook', text: 'Sync deployment hook', size: 0.5},
    ],
  },
  {
    // db.md: Rust owns the SQL, both hosts run the same text.
    id: 'db',
    text: 'DB access',
    work: [
      {id: 'registry', text: 'Query registry and Python codegen', size: 3},
      {id: 'executor', text: 'Python runtime and PrismaExecutor', size: 2},
      {id: 'ci', text: 'Schema and codegen checks in CI', size: 1},
      {id: 'gateway-queries', text: 'Key, end user and spend queries', size: 2},
    ],
  },
  {
    // db.md phases 3 to 6: moving the rest of Python onto the shared queries.
    // It deletes Python code rather than moving routes, so only All APIs counts it.
    id: 'prisma',
    text: 'Python off Prisma',
    work: [
      {id: 'raw-sql', text: 'Raw SQL sites on shared queries', size: 4},
      {id: 'orm', text: 'ORM calls on shared queries', size: 6},
      {id: 'asyncpg', text: 'asyncpg executor, Prisma client removed', size: 2},
      {id: 'migrations', text: 'Migrations off Prisma', size: 3},
    ],
  },
  {
    id: 'auth',
    text: 'Auth and secrets',
    work: [
      {id: 'aws', text: 'AWS auth', size: 1, done: 'v1.95.0-rc.1'},
      {id: 'azure', text: 'Azure auth', size: 1, done: 'v1.102.0-rc.1'},
      {id: 'gcp', text: 'Google Cloud auth', size: 1, done: 'v1.102.0-rc.1'},
      {id: 'secret-managers', text: 'Secret managers', size: 2, partial: 'v1.106.0-rc.1'},
      {id: 'key-lookup', text: 'Virtual key lookup and cache', size: 2, partial: 'v1.105.0-rc.1'},
      {id: 'invalidation', text: 'Key cache invalidation across hosts', size: 1},
      {id: 'authorization', text: 'Shared authorization crate', size: 3, partial: 'v1.105.0-rc.1'},
      {id: 'jwt', text: 'JWT auth', size: 2},
    ],
  },
  {
    id: 'budgets',
    text: 'Budgets and rate limits',
    work: [
      {id: 'scripts', text: 'Shared rate limit scripts and key naming', size: 3},
      {id: 'budgets', text: 'Budget checks', size: 2},
    ],
  },
  {
    id: 'spend',
    text: 'Spend tracking',
    work: [
      {id: 'cost', text: 'Cost calculation', size: 1, done: 'v1.104.0-rc.1'},
      {id: 'buffer', text: 'Spend writes through the shared Redis buffer', size: 2},
    ],
  },
  {
    id: 'router',
    text: 'Router',
    work: [
      {id: 'strategies', text: 'Shared routing strategy crate', size: 3},
      {id: 'health', text: 'Cooldown and health state', size: 2},
      {id: 'fallbacks', text: 'Retries and fallbacks', size: 2},
      {id: 'db-models', text: 'Models stored in DB', size: 1},
    ],
  },
  {
    id: 'logging',
    text: 'Logging and callbacks',
    work: [
      {id: 'logging', text: 'Logging callbacks', size: 1, partial: 'v1.104.0-rc.1'},
      {id: 'payload', text: 'Shared logging payload', size: 4},
      {id: 'prometheus', text: 'Prometheus', size: 2},
      {id: 'exporters', text: 'S3 and other exporters', size: 1},
      {id: 'hooks', text: 'Hook pipeline contract', size: 3, partial: 'v1.105.0-rc.1'},
      {id: 'custom-callbacks', text: 'Custom Python callbacks forwarded to Python', size: 1},
    ],
  },
  {
    // caching.md: native cache, gateway only, legacy Python cache frozen.
    id: 'cache',
    text: 'Response cache',
    work: [
      {id: 'backends', text: 'In-memory and Redis backends', size: 2, partial: 'v1.105.0-rc.1'},
      {id: 'compat', text: 'Python compatibility paths removed', size: 1, done: 'v1.106.0-rc.1'},
      {id: 'wiring', text: 'Cache built from config in the gateway', size: 2},
      {id: 'gaps', text: 'Cache gaps in dispatch', size: 1},
      {id: 'accounting', text: 'Cache hits in spend and logs', size: 1, partial: 'v1.105.0-rc.1'},
      {id: 'routes', text: 'Chat and Responses caching', size: 2, partial: 'v1.105.0-rc.1'},
      {id: 'other-backends', text: 'Other storage backends', size: 2, partial: 'v1.104.0-rc.1'},
      {id: 'management', text: 'Cache management endpoints', size: 1},
    ],
  },
  {
    id: 'config',
    text: 'Config',
    work: [
      {id: 'db-config', text: 'Config stored in DB', size: 2},
    ],
  },
] as const satisfies readonly ComponentDeclaration[];

export type ComponentId = (typeof COMPONENTS)[number]['id'];

// A piece of work's id inside its component, like `dispatch` under `deploy`.
export type WorkId<C extends ComponentId> = Extract<(typeof COMPONENTS)[number], {id: C}>['work'][number]['id'];

// Work named by component, or `'*'` for all of a component.
export type WorkSet = {[C in ComponentId]?: readonly WorkId<C>[] | '*'};

export interface GoalDeclaration {
  id: string;
  text: string;
  endsOn: IsoDay;
  // The components the goal covers, in the order the page lists them.
  components: readonly ComponentId[];
  // Describes the scope in the goal picker instead of listing it.
  summary?: string;
  // Listed in the goal picker but not selectable yet.
  disabled?: boolean;
}

// An intermediate milestone past the latest release, and the work it expects
// to reach each level by its day. Naming work that already got there is no change.
export interface PlanDeclaration {
  id: string;
  date: IsoDay;
  // Terms from TERMS, shown joined under `route`, like `/messages` over `e2e, simple`.
  label: readonly TermId[];
  route?: RouteId;
  description?: string;
  partial?: WorkSet;
  done?: WorkSet;
}

const ALL_COMPONENTS = COMPONENTS.map(component => component.id);
const MAJOR_API_COMPONENTS = ALL_COMPONENTS.filter(id => id !== 'prisma');

export const GOALS: readonly GoalDeclaration[] = [
  {
    // The default: the major chat routes on Rust end to end, on the gateway
    // and in the SDK.
    id: 'major-apis',
    text: 'Major APIs',
    endsOn: '2026-12-31',
    summary: 'Messages, Chat completions and Responses on the Rust gateway and SDK',
    components: MAJOR_API_COMPONENTS,
  },
  {
    // Almost all Python replaced, every route on Rust. Not scoped yet beyond
    // Major APIs plus moving Python off Prisma.
    id: 'all-apis',
    text: 'All APIs',
    endsOn: '2027-06-30',
    components: ALL_COMPONENTS,
    summary: 'Every route on Rust and almost all Python replaced',
    disabled: true,
  },
];

// Oldest first, one per day, the first after the latest release. The timeline
// draws each as a grey dot. When its work ships, record the RCs above and drop
// or revise the plan.
export const PLANS: readonly PlanDeclaration[] = [
  {
    // The first route on Rust end to end, for the simplest requests: Anthropic
    // Messages for a virtual key with nothing else on it. The deploy, key
    // checks and spend it needs are real; budgets, callbacks, fallbacks, cache
    // and other providers are gap rows that forward to Python. Authorization
    // only checks model access, so it lands partial. Budgets, routing, the
    // logging payload and cache wiring that the next plan finishes ship opt-in
    // in the RCs before it, so they land partial here too.
    id: 'messages-simple',
    date: '2026-11-07',
    route: 'messages',
    label: ['e2e', 'simple'],
    description: 'Anthropic Messages on Rust end to end for virtual keys with no budgets, callbacks or cache. Every other request forwards to Python.',
    partial: {
      auth: ['authorization'],
      budgets: '*',
      router: ['strategies', 'health'],
      logging: ['payload', 'hooks'],
      cache: ['wiring', 'gaps'],
    },
    done: {
      deploy: '*',
      db: '*',
      auth: ['key-lookup', 'invalidation'],
      spend: ['buffer'],
      messages: ['anthropic'],
    },
  },
  {
    // Every Messages request on Rust: each gap row the first plan forwarded is
    // now served. The shared pieces built for it are new, so they land partial
    // and reach done by the goal, once Chat completions and Responses run on
    // them too. Authorization, JWT and the providers only Messages uses are done.
    id: 'messages-all',
    date: '2026-11-21',
    route: 'messages',
    label: ['e2e', 'all'],
    description: 'Every Messages request on Rust end to end, with budgets, routing, callbacks and cache. Chat completions and Responses reuse all of it.',
    partial: {
      budgets: '*',
      router: '*',
      logging: '*',
      cache: ['compat', 'wiring', 'gaps', 'accounting', 'backends', 'other-backends'],
      config: '*',
      features: [
        'mock', 'mcp-tools', 'caller-client', 'timeouts', 'agentic-loop', 'tls', 'modify-params', 'cache-control-injection',
        'workload-identity', 'thinking-retry', 'stream-cost', 'websearch', 'interceptors', 'safeguards',
      ],
    },
    done: {
      auth: ['authorization', 'jwt'],
      messages: ['deepseek', 'vertex_ai', 'bedrock', 'bedrock_mantle', 'azure_ai', 'minimax', 'github_copilot', 'tencent', 'edenai', 'openai_like'],
    },
  },
];

export const CATALOG = {components: COMPONENTS, goals: GOALS, plans: PLANS};
