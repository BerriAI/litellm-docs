export const MIGRATION_STATUSES = {
  python: {
    label: 'Python',
    description: 'This support unit still runs on Python.',
  },
  building: {
    label: 'In progress',
    description: 'The Rust implementation is being built or validated.',
  },
  preview: {
    label: 'Rust preview',
    description: 'Rust is available behind an opt-in setting.',
  },
  default: {
    label: 'Rust default',
    description: 'Rust handles this support unit by default with a Python fallback.',
  },
  rustOnly: {
    label: 'Rust only',
    description: 'This support unit requires the Rust implementation.',
  },
};

export const MIGRATION_PURPOSES = [
  {
    id: 'ocr',
    group: 'Routes',
    label: 'OCR',
    variants: [
      {
        id: 'ocr-mistral',
        label: 'Mistral',
        status: 'default',
        release: {
          date: '2026-09-13',
          version: 'v1.102.0-rc.1',
        },
      },
      {id: 'ocr-other-providers', label: 'Other providers', status: 'building'},
    ],
  },
  {
    id: 'messages',
    group: 'Routes',
    label: 'Messages',
    variants: [
      {id: 'messages-anthropic', label: 'Anthropic', status: 'preview'},
      {id: 'messages-bedrock', label: 'Bedrock', status: 'building', requires: ['auth-aws']},
      {id: 'messages-vertex', label: 'Vertex AI', status: 'python', requires: ['auth-gcp']},
      {id: 'messages-openai-adapter', label: 'OpenAI adapter', status: 'python'},
    ],
  },
  {
    id: 'chat-completions',
    group: 'Routes',
    label: 'Chat completions',
    variants: [
      {id: 'chat-openai', label: 'OpenAI', status: 'python'},
      {id: 'chat-anthropic-adapter', label: 'Anthropic adapter', status: 'python'},
    ],
  },
  {
    id: 'token-counter',
    group: 'Routes',
    label: 'Token counter',
    variants: [
      {id: 'tokens-tiktoken', label: 'Tiktoken', status: 'python'},
      {id: 'tokens-hugging-face', label: 'Hugging Face', status: 'python'},
    ],
  },
  {
    id: 'auth',
    group: 'Foundations',
    label: 'Auth',
    variants: [
      {id: 'auth-aws', label: 'AWS', status: 'python'},
      {id: 'auth-gcp', label: 'GCP', status: 'python'},
    ],
  },
  {
    id: 'cache',
    group: 'Foundations',
    label: 'Cache',
    variants: [
      {id: 'cache-redis', label: 'Redis', status: 'python'},
      {id: 'cache-in-memory', label: 'In-memory', status: 'python'},
    ],
  },
  {
    id: 'secret-manager',
    group: 'Foundations',
    label: 'Secret manager',
    variants: [
      {id: 'secrets-aws', label: 'AWS', status: 'python'},
      {id: 'secrets-gcp', label: 'GCP', status: 'python'},
    ],
  },
  {
    id: 'sql-manager',
    group: 'Foundations',
    label: 'SQL manager',
    variants: [
      {id: 'sql-postgres', label: 'PostgreSQL', status: 'python'},
    ],
  },
];

export const MIGRATION_START = {
  date: '2026-06-22',
  version: 'Migration announced',
};
