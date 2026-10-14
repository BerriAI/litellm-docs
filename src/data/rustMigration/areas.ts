import type {ProviderId} from './providers';

// Each area of work and its units. A string unit is a litellm provider id from
// PROVIDERS; work that is not a provider names itself as `{id, text}`. How much
// an area counts lives with the goals in goals.ts.
//
// Units in an area split its share evenly. A group counts as one unit among
// its siblings unless it sets `weight`, so nine secret managers together weigh
// the same as JWT auth beside them.
//
// Messages and Responses list the providers that speak that API natively. Every
// other provider reaches those APIs through an adapter, which `adapters` counts
// once per pair of formats rather than once per provider.
//
// An area marked `groundwork: true` holds shared work rather than API and
// provider pairs, so views about what a request runs on leave it out. Its
// units count only once they run natively in Rust. A Rust route calling back
// into Python's cache or callbacks works, but it is not migrated.
//
// A unit with its own `units` is a group that only collects the units beneath
// it. Units roll out through STAGES by default. A unit marked `task: true` has
// no rollout of its own and is simply done or not, like the cloud auth that
// many providers and APIs share.
export interface UnitDeclaration {
  id: string;
  text: string;
  task?: boolean;
  weight?: number;
  units?: readonly Unit[];
}

export type Unit = ProviderId | UnitDeclaration;

interface AreaDeclaration {
  id: string;
  text: string;
  groundwork?: boolean;
  units: readonly Unit[];
}

export const AREAS = [
  {
    id: 'scaffold',
    text: 'Scaffold',
    groundwork: true,
    units: [
      {id: 'python-bridge', text: 'Python bridge', task: true},
      {id: 'host', text: 'Python host calls', task: true},
      {id: 'async', text: 'Async bridge', task: true},
      {id: 'http', text: 'HTTP client', task: true},
      {id: 'streaming', text: 'Streaming', task: true},
      {id: 'config', text: 'Config', task: true},
      {id: 'tracing', text: 'Tracing', task: true},
      {id: 'model-catalog', text: 'Model catalog', task: true},
    ],
  },
  {
    id: 'ocr',
    text: 'OCR',
    units: ['mistral', 'azure_ai', 'azure_ai/doc-intelligence', 'vertex_ai', 'cohere', 'reducto', 'aws_textract'],
  },
  {
    id: 'messages',
    text: 'Messages',
    units: [
      'anthropic', 'bedrock', 'bedrock_mantle', 'vertex_ai', 'azure_ai', 'deepseek', 'minimax', 'github_copilot',
      'tencent', 'edenai', 'openai_like',
    ],
  },
  {
    id: 'responses',
    text: 'Responses',
    units: [
      'openai', 'azure', 'azure_ai', 'bedrock', 'bedrock_mantle', 'xai', 'openrouter', 'databricks', 'fireworks_ai',
      'perplexity', 'github_copilot', 'chatgpt', 'hosted_vllm', 'volcengine', 'edenai', 'manus', 'sail',
      'litellm_proxy', 'openai_like',
    ],
  },
  {
    id: 'chat-completions',
    text: 'Chat completions',
    units: [
      'openai', 'azure', 'anthropic', 'bedrock', 'vertex_ai', 'gemini', 'azure_ai', 'mistral', 'cohere', 'groq',
      'xai', 'deepseek', 'together_ai', 'fireworks_ai', 'openrouter', 'databricks', 'watsonx', 'perplexity',
      'deepinfra', 'cerebras', 'nvidia_nim', 'sagemaker', 'huggingface', 'replicate', 'ai21', 'sambanova', 'nebius',
      'novita', 'hyperbolic', 'baseten', 'moonshot', 'dashscope', 'volcengine', 'minimax', 'github_copilot',
      'snowflake', 'oci', 'vercel_ai_gateway', 'lm_studio', 'ollama', 'hosted_vllm', 'openai_like',
    ],
  },
  {
    // One unit per pair of formats litellm translates between, so a provider
    // without a native API still serves it. Chat to Messages is left out
    // because provider chat configs, like Anthropic's, already speak Messages.
    id: 'adapters',
    text: 'Adapters',
    units: [
      // litellm/llms/anthropic/pass_through/adapters
      {id: 'messages-to-chat', text: 'Messages over Chat completions'},
      // litellm/llms/anthropic/pass_through/responses_adapters
      {id: 'messages-to-responses', text: 'Messages over Responses'},
      // litellm/responses/litellm_completion_transformation
      {id: 'responses-to-chat', text: 'Responses over Chat completions'},
      // litellm/completion_extras/litellm_responses_transformation
      {id: 'chat-to-responses', text: 'Chat completions over Responses'},
    ],
  },
  {
    id: 'router',
    text: 'Router',
    groundwork: true,
    units: [
      {id: 'model-groups', text: 'Model groups and aliases'},
      {id: 'strategies', text: 'Routing strategies'},
      {id: 'retries', text: 'Retries'},
      {id: 'fallbacks', text: 'Fallbacks'},
      {id: 'cooldowns', text: 'Cooldowns'},
      {id: 'rate-limits', text: 'TPM and RPM limits'},
    ],
  },
  {
    id: 'gateway',
    text: 'Gateway',
    groundwork: true,
    units: [
      {id: 'server', text: 'Proxy server'},
      {id: 'config', text: 'Proxy config and settings'},
      {id: 'master-key', text: 'Master key'},
      {id: 'inference-routes', text: 'Inference routes'},
      {id: 'pass-through', text: 'Pass-through endpoints'},
      {id: 'health', text: 'Health checks'},
    ],
  },
  {
    id: 'callbacks',
    text: 'Critical-path callbacks',
    groundwork: true,
    units: [
      {id: 'logging', text: 'Logging'},
      {id: 'cost', text: 'Cost tracking', task: true},
      {id: 'request-hooks', text: 'Request hooks'},
      {id: 'response-hooks', text: 'Response hooks'},
    ],
  },
  {
    id: 'caching',
    text: 'Caching',
    groundwork: true,
    units: [
      {id: 'local', text: 'In-memory'},
      {id: 'redis', text: 'Redis'},
      {id: 'redis-semantic', text: 'Redis semantic'},
      {id: 'valkey-semantic', text: 'Valkey semantic'},
      {id: 'qdrant-semantic', text: 'Qdrant semantic'},
      {id: 's3', text: 'S3'},
      {id: 'gcs', text: 'Google Cloud Storage'},
      {id: 'azure-blob', text: 'Azure Blob Storage'},
      {id: 'disk', text: 'Disk'},
    ],
  },
  {
    id: 'auth',
    text: 'Auth and secrets',
    groundwork: true,
    units: [
      {
        id: 'cloud',
        text: 'Cloud auth',
        units: [
          {id: 'aws', text: 'AWS', task: true},
          {id: 'azure', text: 'Azure', task: true},
          {id: 'gcp', text: 'Google Cloud', task: true},
        ],
      },
      {
        id: 'secret-managers',
        text: 'Secret managers',
        units: [
          {id: 'aws-secret-manager', text: 'AWS Secrets Manager'},
          {id: 'aws-kms', text: 'AWS KMS'},
          {id: 'azure-key-vault', text: 'Azure Key Vault'},
          {id: 'google-secret-manager', text: 'Google Secret Manager'},
          {id: 'google-kms', text: 'Google KMS'},
          {id: 'hashicorp-vault', text: 'HashiCorp Vault'},
          {id: 'cyberark', text: 'CyberArk'},
          {id: 'local', text: 'Environment variables'},
          {id: 'custom', text: 'Custom'},
        ],
      },
      {id: 'virtual-keys', text: 'Virtual key checks'},
      {id: 'jwt', text: 'JWT auth'},
      {id: 'sso', text: 'SSO'},
    ],
  },
  {
    id: 'endpoints',
    text: 'Non-DB endpoints',
    groundwork: true,
    units: [
      {id: 'mcp', text: 'MCP gateway'},
      {id: 'ui', text: 'Admin UI'},
      {id: 'models', text: 'Model list and info'},
      {id: 'utility', text: 'Utility endpoints'},
    ],
  },
  {
    id: 'extensions',
    text: 'Extension points',
    groundwork: true,
    units: [
      {id: 'guardrails', text: 'Guardrails'},
      {id: 'custom-hooks', text: 'Custom proxy hooks'},
      {id: 'policies', text: 'Policy engine'},
      {id: 'prompts', text: 'Prompt management'},
    ],
  },
  {
    id: 'database',
    text: 'Database',
    groundwork: true,
    units: [
      {id: 'keys', text: 'Virtual keys'},
      {id: 'teams', text: 'Teams and users'},
      {id: 'orgs', text: 'Organizations'},
      {id: 'budgets', text: 'Budgets and limits'},
      {id: 'spend', text: 'Spend logs'},
      {id: 'models', text: 'Models stored in DB'},
      {id: 'management', text: 'Management endpoints'},
    ],
  },
  {
    id: 'observability',
    text: 'Observability callbacks',
    groundwork: true,
    units: [
      {id: 'otel', text: 'OpenTelemetry'},
      {id: 'langfuse', text: 'Langfuse'},
      {id: 'datadog', text: 'Datadog'},
      {id: 'prometheus', text: 'Prometheus'},
      {id: 'bucket-logging', text: 'S3 and GCS logging'},
    ],
  },
  {
    id: 'performance',
    text: 'Perf and benchmarks',
    groundwork: true,
    units: [
      {id: 'optimization', text: 'Perf improvement', task: true},
      {id: 'benchmark', text: 'Benchmark publishing', task: true},
    ],
  },
  {
    id: 'testing',
    text: 'Test harness and CI',
    groundwork: true,
    units: [
      {id: 'harness', text: 'Test harness', task: true},
      {id: 'ci', text: 'CI updates', task: true},
    ],
  },
  {
    // Deciding what stays on Python, then moving the rest. Each API counts by
    // its own weight inside the area.
    id: 'long-tail',
    text: 'Long tail',
    units: [
      {
        id: 'embeddings',
        text: 'Embeddings',
        weight: 6,
        units: [
          'openai', 'azure', 'azure_ai', 'bedrock', 'vertex_ai', 'gemini', 'cohere', 'mistral', 'voyage', 'jina_ai',
          'huggingface', 'sagemaker', 'watsonx', 'databricks', 'fireworks_ai', 'together_ai', 'nvidia_nim',
          'snowflake', 'oci', 'ollama', 'hosted_vllm', 'infinity', 'openrouter', 'openai_like',
        ],
      },
      {
        id: 'transcription',
        text: 'Audio transcription',
        weight: 2,
        units: [
          'openai', 'azure', 'bedrock', 'deepgram', 'elevenlabs', 'mistral', 'xai', 'watsonx', 'soniox',
          'nvidia_riva', 'hosted_vllm',
        ],
      },
      {
        id: 'speech',
        text: 'Speech and realtime',
        weight: 4,
        units: ['openai', 'azure', 'vertex_ai', 'gemini', 'elevenlabs', 'xai'],
      },
      {
        id: 'images',
        text: 'Images',
        weight: 3,
        units: ['openai', 'azure', 'vertex_ai', 'gemini', 'bedrock', 'xai', 'recraft', 'openai_like'],
      },
      {
        id: 'batches',
        text: 'Batches and files',
        weight: 4,
        units: ['openai', 'azure', 'anthropic', 'bedrock', 'vertex_ai'],
      },
      {
        id: 'rerank',
        text: 'Rerank',
        weight: 2,
        units: ['cohere', 'jina_ai', 'voyage', 'bedrock', 'together_ai', 'hosted_vllm'],
      },
      {
        id: 'token-counter',
        text: 'Token counter',
        weight: 2,
        units: [{id: 'tiktoken', text: 'Tiktoken'}, {id: 'huggingface', text: 'Hugging Face'}],
      },
    ],
  },
] as const satisfies readonly AreaDeclaration[];

export type AreaId = (typeof AREAS)[number]['id'];

// The ids of the units at the bottom of a tree, each relative to `Prefix`.
type LeafIds<Unit, Prefix extends string = ''> = Unit extends string
  ? Join<Prefix, Unit>
  : Unit extends {id: infer Id extends string; units: readonly (infer Child)[]}
    ? LeafIds<Child, Join<Prefix, Id>>
    : Unit extends {id: infer Id extends string}
      ? Join<Prefix, Id>
      : never;

type Join<Prefix extends string, Id extends string> = Prefix extends '' ? Id : `${Prefix}/${Id}`;

// A unit's id inside its area, like `azure_ai` under `ocr` or `cloud/aws` under `auth`.
export type UnitId<Area extends AreaId> = LeafIds<Extract<(typeof AREAS)[number], {id: Area}>['units'][number]>;
