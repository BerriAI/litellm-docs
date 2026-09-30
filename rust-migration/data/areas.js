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
export const AREAS = [
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
      {id: 'adapter', text: 'Chat completions to Responses adapter'},
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
