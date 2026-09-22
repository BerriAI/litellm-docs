import releaseSnapshot from './rustMigrationReleases.json';

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

export const MAIN_MIGRATION_VERSION = releaseSnapshot.main.version;

export const MIGRATION_RELEASES = [...releaseSnapshot.published, releaseSnapshot.main];

export const MIGRATION_VERSIONS = MIGRATION_RELEASES.map(release => release.version);

export const MIGRATION_MILESTONES = [
  {
    id: 'core-chat-routes',
    label: 'Core Chat Routes',
    endsOn: '2026-12-31',
    disabled: false,
  },
  {
    id: 'remaining-routes',
    label: 'Remaining Routes',
    endsOn: '2027-04-30',
    disabled: true,
  },
];

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
        introducedIn: 'v1.102.0-rc.1',
      },
      {
        id: 'ocr-other-providers',
        label: 'Other providers',
        status: 'building',
        introducedIn: MAIN_MIGRATION_VERSION,
      },
    ],
  },
  {
    id: 'messages',
    group: 'Routes',
    label: 'Messages',
    variants: [
      {
        id: 'messages-anthropic',
        label: 'Anthropic',
        status: 'preview',
        introducedIn: MAIN_MIGRATION_VERSION,
      },
      {
        id: 'messages-bedrock',
        label: 'Bedrock',
        status: 'building',
        introducedIn: null,
        requires: ['auth-aws'],
      },
      {
        id: 'messages-vertex',
        label: 'Vertex AI',
        status: 'python',
        introducedIn: null,
        requires: ['auth-gcp'],
      },
      {id: 'messages-openai-adapter', label: 'OpenAI adapter', status: 'python', introducedIn: null},
    ],
  },
  {
    id: 'chat-completions',
    group: 'Routes',
    label: 'Chat completions',
    variants: [
      {id: 'chat-openai', label: 'OpenAI', status: 'python', introducedIn: null},
      {id: 'chat-anthropic-adapter', label: 'Anthropic adapter', status: 'python', introducedIn: null},
    ],
  },
  {
    id: 'token-counter',
    group: 'Routes',
    label: 'Token counter',
    variants: [
      {
        id: 'tokens-tiktoken',
        label: 'Tiktoken',
        status: 'preview',
        introducedIn: MAIN_MIGRATION_VERSION,
      },
      {id: 'tokens-hugging-face', label: 'Hugging Face', status: 'python', introducedIn: null},
    ],
  },
  {
    id: 'auth',
    group: 'Foundations',
    label: 'Auth',
    variants: [
      {id: 'auth-aws', label: 'AWS', status: 'python', introducedIn: null},
      {id: 'auth-gcp', label: 'GCP', status: 'python', introducedIn: null},
    ],
  },
  {
    id: 'cache',
    group: 'Foundations',
    label: 'Cache',
    variants: [
      {id: 'cache-redis', label: 'Redis', status: 'python', introducedIn: null},
      {id: 'cache-in-memory', label: 'In-memory', status: 'python', introducedIn: null},
    ],
  },
  {
    id: 'secret-manager',
    group: 'Foundations',
    label: 'Secret manager',
    variants: [
      {id: 'secrets-aws', label: 'AWS', status: 'python', introducedIn: null},
      {id: 'secrets-gcp', label: 'GCP', status: 'python', introducedIn: null},
    ],
  },
  {
    id: 'sql-manager',
    group: 'Foundations',
    label: 'SQL manager',
    variants: [
      {id: 'sql-postgres', label: 'PostgreSQL', status: 'python', introducedIn: null},
    ],
  },
];
