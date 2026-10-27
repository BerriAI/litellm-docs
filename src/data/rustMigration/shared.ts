// Types and data the catalog and the model both build on. Nothing here names a
// piece of work; that all lives in catalog.ts.

// A calendar day in UTC, like `2026-10-13`. Every date on the page is drawn
// and read at this precision, so a release and a plan on the same day line up.
export type IsoDay = `${number}-${number}-${number}`;

export type RcVersion = `v${number}.${number}.${number}-rc.${number}`;

// How far a piece of work has come, in order. It scores how confident we are
// in the work itself, not whether anything uses it yet: groundwork that is
// finished and trusted, but waits for something above it like the gateway
// deploy, is done.
export const LEVELS = [
  {id: 'none', label: 'Not started', score: 0, description: 'Not in any release yet.'},
  {
    id: 'partial',
    label: 'Partial',
    score: 0.8,
    description: 'In a release, but incomplete or not yet trusted, so it usually ships opt-in.',
  },
  {
    id: 'done',
    label: 'Done',
    score: 1,
    description: 'Complete and trusted, whether or not it runs by default or anything uses it yet.',
  },
] as const satisfies readonly {id: string; label: string; score: number; description: string}[];

export type LevelId = (typeof LEVELS)[number]['id'];

// The levels a release or plan can move work to.
export type ReachedLevel = Exclude<LevelId, 'none'>;

// The API routes, by the path the page shows them with.
export const ROUTES = {
  messages: '/messages',
  chat: '/chat/completions',
  responses: '/responses',
} as const;

export type RouteId = keyof typeof ROUTES;

// The words a plan's label is made of, each with what it means, so the page
// can explain one when it is hovered.
export const TERMS = {
  e2e: {
    name: 'End to end',
    description: 'The route runs on Rust with everything a request passes through, like key checks and spend, not only the translation.',
  },
  simple: {
    name: 'Simple requests',
    description: 'Only requests that use nothing Rust lacks yet. Every other request forwards to Python.',
  },
  all: {
    name: 'All requests',
    description: 'Every request on the route, with nothing forwarded to Python.',
  },
} as const satisfies Record<string, {name: string; description: string}>;

export type TermId = keyof typeof TERMS;

// Display names for litellm provider ids, so per-provider work can name itself
// by id alone.
export const PROVIDERS = {
  'ai21': 'AI21',
  'anthropic': 'Anthropic',
  'assemblyai': 'AssemblyAI',
  'aws_textract': 'AWS Textract',
  'azure': 'Azure OpenAI',
  'azure_ai': 'Azure AI',
  'azure_ai/doc-intelligence': 'Azure Document Intelligence',
  'baseten': 'Baseten',
  'bedrock': 'Bedrock',
  'bedrock_mantle': 'Bedrock Mantle',
  'cerebras': 'Cerebras',
  'chatgpt': 'ChatGPT',
  'cohere': 'Cohere',
  'dashscope': 'DashScope',
  'databricks': 'Databricks',
  'deepgram': 'Deepgram',
  'deepinfra': 'DeepInfra',
  'deepseek': 'DeepSeek',
  'edenai': 'Eden AI',
  'elevenlabs': 'ElevenLabs',
  'fireworks_ai': 'Fireworks AI',
  'gemini': 'Gemini',
  'github_copilot': 'GitHub Copilot',
  'groq': 'Groq',
  'hosted_vllm': 'vLLM',
  'huggingface': 'Hugging Face',
  'hyperbolic': 'Hyperbolic',
  'infinity': 'Infinity',
  'jina_ai': 'Jina AI',
  'litellm_proxy': 'LiteLLM Proxy',
  'lm_studio': 'LM Studio',
  'manus': 'Manus',
  'minimax': 'MiniMax',
  'mistral': 'Mistral',
  'moonshot': 'Moonshot AI',
  'nebius': 'Nebius',
  'novita': 'Novita AI',
  'nvidia_nim': 'NVIDIA NIM',
  'nvidia_riva': 'NVIDIA Riva',
  'oci': 'Oracle OCI',
  'ollama': 'Ollama',
  'openai': 'OpenAI',
  'openai_like': 'OpenAI-compatible',
  'openrouter': 'OpenRouter',
  'perplexity': 'Perplexity',
  'recraft': 'Recraft',
  'reducto': 'Reducto',
  'replicate': 'Replicate',
  'sagemaker': 'SageMaker',
  'sail': 'Sail',
  'sambanova': 'SambaNova',
  'snowflake': 'Snowflake',
  'soniox': 'Soniox',
  'tencent': 'Tencent',
  'together_ai': 'Together AI',
  'vercel_ai_gateway': 'Vercel AI Gateway',
  'vertex_ai': 'Vertex AI',
  'volcengine': 'Volcengine',
  'voyage': 'Voyage AI',
  'watsonx': 'watsonx',
  'xai': 'xAI',
} as const;

export type ProviderId = keyof typeof PROVIDERS;

// The shapes catalog.ts is written in.

// One piece of work. `size` is rough engineer-weeks. `partial` and `done` are
// the RCs it reached each level in, and are only ever added, never edited, so
// the timeline keeps its history. Work for one provider names itself by its
// provider id and takes its display name from PROVIDERS.
export type WorkDeclaration = ({id: ProviderId; text?: string} | {id: string; text: string}) & {
  size: number;
  partial?: RcVersion;
  done?: RcVersion;
};

export interface ComponentDeclaration {
  id: string;
  text: string;
  work: readonly WorkDeclaration[];
}

// The model model.ts builds from the catalog. Every node has a `size`, the sum
// of the work beneath it, and its progress is the size-weighted mean of the
// levels that work reached.

// One move of a piece of work, where `level` indexes LEVELS.
export interface ReleaseStep {
  version: RcVersion;
  level: number;
}

export interface PlanStep {
  id: string;
  date: IsoDay;
  level: number;
}

export interface Work {
  // `<component>/<work>`, like `deploy/dispatch`.
  id: string;
  text: string;
  size: number;
  component: Component;
  // What shipped, oldest first, and what the plans expect next, kept apart so
  // views that know nothing of plans only ever see what shipped.
  shipped: ReleaseStep[];
  planned: PlanStep[];
}

export interface Component {
  id: string;
  text: string;
  size: number;
  work: Work[];
}

export interface Goal {
  id: string;
  text: string;
  endsOn: IsoDay;
  summary?: string;
  disabled?: boolean;
  size: number;
  components: Component[];
  work: Work[];
}

export interface Release {
  version: string;
  date: IsoDay;
}

// A place on a goal's timeline: a published release, the latest one, or a
// plan. `key` is unique across all three.
export type Point =
  | {kind: 'release' | 'latest'; key: string; version: string; date: IsoDay}
  | {kind: 'plan'; key: string; id: string; date: IsoDay; label: string; terms: TermId[]; route?: RouteId; description?: string};

export type PlanPoint = Extract<Point, {kind: 'plan'}>;

// A point with the goal's progress there, unrounded like progressAt.
export type TimelinePoint = Point & {percent: number};

// The work in one component that reached one level together, as a goal's
// timeline describes it: the level it left when it all left the same one,
// and whether it is the whole component.
export interface Change {
  key: string;
  component: Component;
  level: ReachedLevel;
  from: LevelId | null;
  work: Work[];
  whole: boolean;
}
