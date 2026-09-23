import * as semver from 'semver';
import releaseSnapshot from './rustMigrationReleases.json';

// Rollout stages in order, matching `Rollout` in litellm/rust_bridge/configuration.py.
export const STAGES = [
  {id: 'pythonOnly', label: 'Python'},
  {id: 'rustOptIn', label: 'Opt-in'},
  {id: 'rustOptOut', label: 'Rust default'},
  {id: 'rustRequired', label: 'Rust only'},
];

// Goals are milestones over the work below. `scope` lists the areas a goal
// covers, and may name an earlier goal to include all of its scope. The optional
// `summary` describes the scope in the goal picker instead of listing it.
const GOAL_DECLARATIONS = [
  {
    id: 'major-apis',
    text: 'Major APIs',
    endsOn: '2026-12-31',
    scope: ['chat-completions', 'messages', 'responses', 'auth'],
    summary: 'Chat completions, Messages, Responses',
  },
  {
    id: 'all-apis',
    text: 'All APIs',
    endsOn: '2027-04-30',
    scope: ['major-apis', 'embeddings', 'transcription', 'ocr', 'token-counter', 'mcp'],
    summary: 'Major APIs, Embeddings, OCR, MCP, and many more',
  },
];

// Display names for the litellm provider ids the areas below list.
const PROVIDERS = {
  'anthropic': 'Anthropic',
  'assemblyai': 'AssemblyAI',
  'aws_textract': 'AWS Textract',
  'azure': 'Azure OpenAI',
  'azure_ai': 'Azure AI',
  'azure_ai/doc-intelligence': 'Azure Document Intelligence',
  'bedrock': 'Bedrock',
  'cerebras': 'Cerebras',
  'cohere': 'Cohere',
  'databricks': 'Databricks',
  'deepgram': 'Deepgram',
  'deepinfra': 'DeepInfra',
  'deepseek': 'DeepSeek',
  'elevenlabs': 'ElevenLabs',
  'fireworks_ai': 'Fireworks AI',
  'gemini': 'Gemini',
  'github_copilot': 'GitHub Copilot',
  'groq': 'Groq',
  'hosted_vllm': 'vLLM',
  'huggingface': 'Hugging Face',
  'infinity': 'Infinity',
  'jina_ai': 'Jina AI',
  'minimax': 'MiniMax',
  'mistral': 'Mistral',
  'nvidia_nim': 'NVIDIA NIM',
  'nvidia_riva': 'NVIDIA Riva',
  'oci': 'Oracle OCI',
  'ollama': 'Ollama',
  'openai': 'OpenAI',
  'openai_like': 'OpenAI-compatible',
  'openrouter': 'OpenRouter',
  'perplexity': 'Perplexity',
  'reducto': 'Reducto',
  'sagemaker': 'SageMaker',
  'snowflake': 'Snowflake',
  'soniox': 'Soniox',
  'together_ai': 'Together AI',
  'vertex_ai': 'Vertex AI',
  'voyage': 'Voyage AI',
  'watsonx': 'watsonx',
  'xai': 'xAI',
};

// Each area of work and its units, where a unit is one provider an API must
// serve from Rust. A string unit is a litellm provider id from PROVIDERS; work
// that is not a provider names itself as `{id, text}`. Provider lists follow
// what litellm serves for each API today, with OpenAI-compatible endpoints
// standing in for the long tail that shares one implementation.
const AREAS = [
  {
    id: 'chat-completions',
    text: 'Chat completions',
    units: [
      'openai', 'azure', 'anthropic', 'bedrock', 'vertex_ai', 'gemini', 'azure_ai', 'mistral', 'cohere', 'groq',
      'xai', 'deepseek', 'together_ai', 'fireworks_ai', 'openrouter', 'databricks', 'watsonx', 'perplexity',
      'deepinfra', 'cerebras', 'nvidia_nim', 'sagemaker', 'ollama', 'hosted_vllm', 'openai_like',
    ],
  },
  {
    id: 'messages',
    text: 'Messages',
    units: [
      'anthropic', 'bedrock', 'vertex_ai', 'azure_ai', 'github_copilot', 'deepseek', 'minimax', 'openai', 'azure',
      'gemini', 'mistral', 'groq', 'xai', 'together_ai', 'fireworks_ai', 'openrouter', 'databricks', 'ollama',
      'hosted_vllm', 'openai_like',
    ],
  },
  {
    id: 'responses',
    text: 'Responses',
    units: [
      'openai', 'azure', 'azure_ai', 'anthropic', 'bedrock', 'vertex_ai', 'gemini', 'xai', 'mistral', 'groq',
      'deepseek', 'together_ai', 'fireworks_ai', 'openrouter', 'databricks', 'perplexity', 'github_copilot',
      'ollama', 'hosted_vllm', 'openai_like',
    ],
  },
  {
    id: 'auth',
    text: 'Provider auth',
    units: [{id: 'aws', text: 'AWS'}, {id: 'azure', text: 'Azure'}, {id: 'gcp', text: 'Google Cloud'}],
  },
  {
    id: 'embeddings',
    text: 'Embeddings',
    units: [
      'openai', 'azure', 'azure_ai', 'bedrock', 'vertex_ai', 'gemini', 'cohere', 'mistral', 'voyage', 'jina_ai',
      'huggingface', 'sagemaker', 'watsonx', 'databricks', 'fireworks_ai', 'together_ai', 'nvidia_nim',
      'snowflake', 'oci', 'ollama', 'hosted_vllm', 'infinity', 'openrouter', 'openai_like',
    ],
  },
  {
    id: 'transcription',
    text: 'Audio transcription',
    units: [
      'openai', 'azure', 'bedrock', 'deepgram', 'elevenlabs', 'mistral', 'xai', 'watsonx', 'soniox', 'nvidia_riva',
      'hosted_vllm',
    ],
  },
  {
    id: 'ocr',
    text: 'OCR',
    units: ['mistral', 'azure_ai', 'azure_ai/doc-intelligence', 'vertex_ai', 'cohere', 'reducto', 'aws_textract'],
  },
  {
    id: 'token-counter',
    text: 'Token counter',
    units: [{id: 'tiktoken', text: 'Tiktoken'}, {id: 'huggingface', text: 'Hugging Face'}],
  },
  {
    id: 'mcp',
    text: 'MCP',
    units: [{id: 'gateway', text: 'MCP gateway'}],
  },
];

// Rollout history for every unit that has left Python, keyed by `area/unit`.
// Each entry maps a release to the stage the unit entered there; units not
// listed are still Python only.
const ROLLOUTS = {
  'messages/anthropic': {'v1.103.0-rc.2': 'rustOptIn'},
  'messages/azure_ai': {'v1.94.0-rc.1': 'rustOptIn'},
  'transcription/bedrock': {'v1.103.0-rc.1': 'rustRequired'},
  'ocr/mistral': {'v1.102.0-rc.1': 'rustOptOut'},
  'ocr/azure_ai': {'v1.102.0-rc.1': 'rustOptOut'},
  'ocr/azure_ai/doc-intelligence': {'v1.102.0-rc.1': 'rustOptOut'},
  'ocr/vertex_ai': {'v1.102.0-rc.1': 'rustOptOut'},
  'ocr/cohere': {'v1.102.0-rc.1': 'rustOptOut'},
  'ocr/reducto': {'v1.102.0-rc.1': 'rustOptOut'},
  'ocr/aws_textract': {'v1.103.0-rc.1': 'rustRequired'},
  'token-counter/tiktoken': {'v1.103.0-rc.2': 'rustOptIn'},
};

// Releases worth calling out next to the blog posts; only add ones that changed
// what runs on Rust. The date is kept here because the release snapshot only
// holds the latest releases.
export const RELEASE_NOTES = [
  {
    version: 'v1.102.0-rc.1',
    releasedOn: '2026-09-13',
    changes: ['OCR runs on Rust by default for every provider except AWS Textract, with the Python implementation kept as a fallback.'],
  },
  {
    version: 'v1.103.0-rc.1',
    releasedOn: '2026-09-20',
    changes: ['AWS Textract OCR and Bedrock audio transcription run on Rust only.'],
  },
];

// Everything below derives the page model from the declarations above and
// fails the build when they drift out of shape.

function fail(message) {
  throw new Error(`Rust migration: ${message}`);
}

// Every release on the timeline, oldest first, ending with the upcoming one on main.
export const RELEASES = [
  ...releaseSnapshot.published.map(release => ({version: release.version, date: release.releasedAt, isMain: false})),
  {version: releaseSnapshot.main.version, date: releaseSnapshot.main.plannedFor, isMain: true},
].sort((left, right) => semver.compare(left.version, right.version));

export const MAIN_VERSION = releaseSnapshot.main.version;

function checkVersion(version) {
  if (semver.valid(version) === null || semver.prerelease(version)?.[0] !== 'rc') {
    fail(`versions must be RC semver versions: ${version}`);
  }
  if (semver.gt(version, MAIN_VERSION)) {
    fail(`${version} is newer than main (${MAIN_VERSION})`);
  }
}

if (RELEASES.length < 10) {
  fail('the timeline needs at least 10 RC versions');
}
RELEASES.forEach(release => checkVersion(release.version));
if (!RELEASES.at(-1).isMain) {
  fail(`main (${MAIN_VERSION}) must be newer than every published release`);
}

RELEASE_NOTES.forEach(note => checkVersion(note.version));

const STAGE_INDEX = new Map(STAGES.map((stage, index) => [stage.id, index]));

function parseRollout(id, rollout) {
  return Object.entries(rollout)
    .map(([version, stage]) => {
      checkVersion(version);
      if (!STAGE_INDEX.has(stage)) {
        fail(`${id} has unknown rollout stage: ${stage}`);
      }
      return {version, stage: STAGE_INDEX.get(stage)};
    })
    .sort((left, right) => semver.compare(left.version, right.version));
}

// The page model is a tree of nodes with `text` and `children`. `features`
// lists the units at or beneath a node, which are all that count toward its
// progress, and a unit's `rollout` holds `{version, stage}` steps, oldest
// first, where `stage` indexes STAGES.
const areasById = new Map();
const unusedRollouts = new Set(Object.keys(ROLLOUTS));
for (const area of AREAS) {
  if (areasById.has(area.id)) {
    fail(`duplicate area: ${area.id}`);
  }
  const units = area.units.map(unit => {
    const {id, text} = typeof unit === 'string' ? {id: unit, text: PROVIDERS[unit]} : unit;
    const key = `${area.id}/${id}`;
    if (!text) {
      fail(`${key} has no display name in PROVIDERS`);
    }
    unusedRollouts.delete(key);
    const node = {id: key, text, children: [], rollout: parseRollout(key, ROLLOUTS[key] ?? {})};
    node.features = [node];
    return node;
  });
  if (new Set(units.map(unit => unit.id)).size !== units.length) {
    fail(`${area.id} lists a unit twice`);
  }
  areasById.set(area.id, {id: area.id, text: area.text, children: units, features: units});
}
if (unusedRollouts.size > 0) {
  fail(`rollouts name units no area lists: ${[...unusedRollouts].join(', ')}`);
}

// Goals in declaration order, shaped like nodes so the page treats a goal as
// the root of its own tree.
const goalsById = new Map();
for (const {scope, ...goal} of GOAL_DECLARATIONS) {
  const children = new Set(scope.flatMap(id => {
    if (goalsById.has(id)) {
      return goalsById.get(id).children;
    }
    if (!areasById.has(id)) {
      fail(`goal ${goal.id} has unknown scope: ${id}`);
    }
    return [areasById.get(id)];
  }));
  const features = [...children].flatMap(child => child.features);
  goalsById.set(goal.id, {...goal, children: [...children], features});
}
export const GOALS = [...goalsById.values()];

for (const area of areasById.values()) {
  if (!GOALS.some(goal => goal.children.includes(area))) {
    fail(`no goal's scope includes ${area.id}`);
  }
}

// The stage a feature was at in `version`, as an index into STAGES.
export function stageAt(feature, version) {
  return feature.rollout.findLast(step => semver.lte(step.version, version))?.stage ?? 0;
}

// How far a node's features had climbed the rollout stages at `version`, as a
// percent. Rust only everywhere is 100%.
export function progressAt(node, version) {
  const score = node.features.reduce((sum, feature) => sum + stageAt(feature, version), 0);
  return Math.round((score / (node.features.length * (STAGES.length - 1))) * 100);
}
