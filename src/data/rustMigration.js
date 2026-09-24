import * as semver from 'semver';
import releaseSnapshot from './rustMigrationReleases.json';

// Rollout stages in order, matching `Rollout` in litellm/rust_bridge/configuration.py.
// `switch` is the `LITELLM_RUST` value that flips a stage's default, for the
// two stages that honor it.
export const STAGES = [
  {id: 'pythonOnly', label: 'Python', description: 'Runs on Python.'},
  {
    id: 'rustOptIn',
    label: 'Opt-in',
    description: 'Python runs by default. Turn Rust on to try it, with Python as the fallback.',
    switch: {value: '1', effect: 'Run on Rust'},
  },
  {
    id: 'rustOptOut',
    label: 'Rust default',
    description: 'Rust runs by default, with Python as the fallback. Turn Rust off to stay on Python.',
    switch: {value: '0', effect: 'Stay on Python'},
  },
  {id: 'rustRequired', label: 'Rust only', description: 'Always runs on Rust. The Python path is gone and the switch has no effect.'},
];

// Goals are milestones over the work below. `scope` lists the areas a goal
// covers, and may name an earlier goal to include all of its scope. The optional
// `summary` describes the scope in the goal picker instead of listing it.
const GOAL_DECLARATIONS = [
  {
    id: 'major-apis',
    text: 'Major APIs',
    endsOn: '2026-12-31',
    scope: ['foundation', 'messages', 'responses', 'chat-completions'],
    summary: 'Messages, Responses, Chat completions',
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
//
// An area marked `groundwork: true` holds shared work rather than API and
// provider pairs, so views about what a request runs on leave it out.
//
// A unit with its own `units` is a group that only collects the units beneath
// it. Units roll out through STAGES by default. A unit marked `task: true` has
// no rollout of its own and is simply done or not, like the cloud auth that
// many providers and APIs share.
const AREAS = [
  {
    id: 'foundation',
    text: 'Foundation',
    groundwork: true,
    units: [
      {
        id: 'auth',
        text: 'Auth',
        units: [
          {id: 'aws', text: 'AWS', task: true},
          {id: 'azure', text: 'Azure', task: true},
          {id: 'gcp', text: 'Google Cloud', task: true},
        ],
      },
      {id: 'http', text: 'HTTP client', task: true},
      {id: 'streaming', text: 'Streaming', task: true},
      {id: 'model-catalog', text: 'Model catalog', task: true},
      {id: 'cost', text: 'Cost tracking', task: true},
      {id: 'logging', text: 'Logging'},
      {
        id: 'caching',
        text: 'Caching',
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
      {id: 'callbacks', text: 'Callbacks'},
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
    id: 'chat-completions',
    text: 'Chat completions',
    units: [
      'openai', 'azure', 'anthropic', 'bedrock', 'vertex_ai', 'gemini', 'azure_ai', 'mistral', 'cohere', 'groq',
      'xai', 'deepseek', 'together_ai', 'fireworks_ai', 'openrouter', 'databricks', 'watsonx', 'perplexity',
      'deepinfra', 'cerebras', 'nvidia_nim', 'sagemaker', 'ollama', 'hosted_vllm', 'openai_like',
    ],
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
// Each entry lists the steps the unit took, oldest first: the release and the
// stage it entered there. A task has no stages, so its one step only names the
// release it was done in.
// Units not listed are still Python only.
const ROLLOUTS = {
  'foundation/auth/aws': [{version: 'v1.95.0-rc.1'}],
  'foundation/auth/azure': [{version: 'v1.102.0-rc.1'}],
  'foundation/auth/gcp': [{version: 'v1.102.0-rc.1'}],
  'foundation/http': [{version: 'v1.103.0-rc.1'}],
  'foundation/logging': [{version: 'v1.104.0-rc.1', stage: 'rustOptIn'}],
  'messages/anthropic': [{version: 'v1.104.0-rc.1', stage: 'rustOptIn'}],
  'messages/azure_ai': [{version: 'v1.104.0-rc.1', stage: 'rustOptIn'}],
  'transcription/bedrock': [{version: 'v1.103.0-rc.1', stage: 'rustRequired'}],
  'ocr/mistral': [{version: 'v1.102.0-rc.1', stage: 'rustOptOut'}],
  'ocr/azure_ai': [{version: 'v1.102.0-rc.1', stage: 'rustOptOut'}],
  'ocr/azure_ai/doc-intelligence': [{version: 'v1.102.0-rc.1', stage: 'rustOptOut'}],
  'ocr/vertex_ai': [{version: 'v1.102.0-rc.1', stage: 'rustOptOut'}],
  'ocr/cohere': [{version: 'v1.102.0-rc.1', stage: 'rustOptOut'}],
  'ocr/reducto': [{version: 'v1.102.0-rc.1', stage: 'rustOptOut'}],
  'ocr/aws_textract': [{version: 'v1.103.0-rc.1', stage: 'rustRequired'}],
  'token-counter/tiktoken': [{version: 'v1.104.0-rc.1', stage: 'rustOptIn'}],
};

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

// Stable releases, oldest first. A stable release carries the rollouts of the
// RCs it was cut from, which semver ordering already gives: v1.102.1 sorts
// after v1.102.0-rc.2 and before v1.103.0-rc.1.
export const STABLE_RELEASES = releaseSnapshot.stable
  .map(release => ({version: release.version, date: release.releasedAt}))
  .sort((left, right) => semver.compare(left.version, right.version));

export const LATEST_STABLE_VERSION = STABLE_RELEASES.at(-1)?.version;

// Every published RC in the snapshot, oldest first. The timeline above only
// keeps the latest few; this is the full list readers pick their version from.
export const RC_RELEASES = releaseSnapshot.candidates
  .map(release => ({version: release.version, date: release.releasedAt}))
  .sort((left, right) => semver.compare(left.version, right.version));

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

const STAGE_INDEX = new Map(STAGES.map((stage, index) => [stage.id, index]));

// Steps come out as `{version, stage}`, where `stage` indexes STAGES and a
// finished task counts as the last stage.
function parseRollout(id, steps = [], task) {
  if (!Array.isArray(steps)) {
    fail(`${id} rollout must list its steps`);
  }
  if (task && steps.length > 1) {
    fail(`${id} is a task, so it has one step at most`);
  }
  const parsed = steps.map(({version, stage}) => {
    checkVersion(version);
    if (task !== (stage === undefined)) {
      fail(`${id} ${task ? 'is a task and takes no stage' : `needs a stage in ${version}`}`);
    }
    if (!task && !STAGE_INDEX.has(stage)) {
      fail(`${id} has unknown rollout stage: ${stage}`);
    }
    return {version, stage: task ? STAGES.length - 1 : STAGE_INDEX.get(stage)};
  });
  parsed.forEach((step, index) => {
    if (index > 0 && semver.lte(step.version, parsed[index - 1].version)) {
      fail(`${id} steps must be in release order`);
    }
  });
  return parsed;
}

// The page model is a tree of nodes with `text` and `children`. `features`
// lists the units at or beneath a node, which are all that count toward its
// progress, and a unit's `rollout` holds `{version, stage}` steps, oldest
// first, where `stage` indexes STAGES.
const areasById = new Map();
const unusedRollouts = new Set(Object.keys(ROLLOUTS));

function group(id, text, children) {
  if (new Set(children.map(child => child.id)).size !== children.length) {
    fail(`${id} lists a unit twice`);
  }
  return {id, text, children, features: children.flatMap(child => child.features)};
}

// `path` holds the display names from the area down to the unit, like
// `['OCR', 'Mistral']`, so a unit can be named outside its tree.
function buildUnit(parentId, parentPath, unit) {
  const {id, text, task = false, units} = typeof unit === 'string' ? {id: unit, text: PROVIDERS[unit]} : unit;
  const key = `${parentId}/${id}`;
  const path = [...parentPath, text];
  if (!text) {
    fail(`${key} has no display name in PROVIDERS`);
  }
  if (units) {
    return group(key, text, units.map(child => buildUnit(key, path, child)));
  }
  unusedRollouts.delete(key);
  const node = {id: key, text, path, task, children: [], rollout: parseRollout(key, ROLLOUTS[key], task)};
  node.features = [node];
  return node;
}

for (const area of AREAS) {
  if (areasById.has(area.id)) {
    fail(`duplicate area: ${area.id}`);
  }
  const units = area.units.map(unit => buildUnit(area.id, [area.text], unit));
  const node = {...group(area.id, area.text, units), groundwork: area.groundwork ?? false};
  node.features.forEach(feature => {
    feature.area = node;
  });
  areasById.set(area.id, node);
}
if (unusedRollouts.size > 0) {
  fail(`rollouts name units no area lists: ${[...unusedRollouts].join(', ')}`);
}

// Every unit in every area, in declaration order. Each one links back to its
// area as `area`.
export const FEATURES = [...areasById.values()].flatMap(area => area.features);

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
