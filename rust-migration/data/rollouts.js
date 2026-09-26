// What each release moved, newest first. Add a block at the top when a release
// changes how a unit runs; units not listed anywhere are still Python only.
//
// A release maps a stage to the units that entered it, grouped by area. A unit
// is its id inside the area, like `azure_ai` under `ocr` or `auth/aws` under
// `foundation`, and `'*'` names every unit in the area. Stages are the ids in
// stages.js, plus `done` for a task, which has no stages and is simply finished.
// Versions are RC versions. One newer than main is a projection: the pages show
// it as a grey dot with an estimated date until main reaches it, and it needs no
// cleanup after that. Projections stack on what is already true, so a step that
// would not move a unit forward is ignored.
export const ROLLOUTS = {
  'v1.109.0-rc.1': {
    rustRequired: {
      messages: ['adapter'],
    },
  },
  'v1.108.0-rc.1': {
    rustRequired: {
      responses: ['openai'],
      'chat-completions': ['openai'],
    },
  },
  'v1.107.0-rc.1': {
    rustRequired: {
      messages: ['anthropic'],
    },
    rustOptOut: {
      messages: ['adapter'],
    },
  },
  'v1.106.0-rc.1': {
    rustOptOut: {
      responses: ['openai'],
      'chat-completions': ['openai'],
    },
    rustOptIn: {
      messages: ['adapter'],
      responses: [
        'azure', 'azure_ai', 'anthropic', 'bedrock', 'vertex_ai', 'gemini', 'xai', 'mistral', 'groq',
        'deepseek', 'together_ai', 'fireworks_ai', 'openrouter', 'databricks', 'perplexity',
        'github_copilot', 'ollama', 'hosted_vllm', 'openai_like',
      ],
      'chat-completions': [
        'azure', 'anthropic', 'bedrock', 'vertex_ai', 'gemini', 'azure_ai', 'mistral', 'cohere', 'groq',
        'xai', 'deepseek', 'together_ai', 'fireworks_ai', 'openrouter', 'databricks', 'watsonx',
        'perplexity', 'deepinfra', 'cerebras', 'nvidia_nim', 'sagemaker', 'ollama', 'hosted_vllm',
        'openai_like',
      ],
    },
  },
  'v1.105.0-rc.1': {
    rustOptOut: {
      messages: ['anthropic'],
    },
    rustOptIn: {
      messages: [
        'bedrock', 'vertex_ai', 'azure_ai', 'github_copilot', 'deepseek', 'minimax', 'openai', 'azure',
        'gemini', 'mistral', 'groq', 'xai', 'together_ai', 'fireworks_ai', 'openrouter', 'databricks',
        'ollama', 'hosted_vllm', 'openai_like',
      ],
      responses: ['openai'],
      'chat-completions': ['openai'],
    },
  },
  'v1.104.0-rc.1': {
    rustRequired: {
      ocr: '*',
    },
    rustOptIn: {
      foundation: ['logging'],
      messages: ['anthropic'],
    },
  },
  'v1.103.0-rc.1': {
    done: {
      foundation: ['http'],
    },
  },
  'v1.102.0-rc.1': {
    rustOptOut: {
      ocr: '*',
    },
    done: {
      foundation: ['auth/azure', 'auth/gcp'],
    },
  },
  'v1.95.0-rc.1': {
    done: {
      foundation: ['auth/aws'],
    },
  },
};
