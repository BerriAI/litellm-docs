import type {AreaId, UnitId} from './areas';
import type {StageId} from './stages';

export type RcVersion = `v${number}.${number}.${number}-rc.${number}`;

// What one release moves: each stage maps to the units of each area that
// entered it, or `'*'` for the whole area.
export type Rollout = Partial<Record<StageId | 'done', {
  [Area in AreaId]?: readonly UnitId<Area>[] | '*';
}>>;

// What each release moved, newest first. Add a block at the top when a release
// changes how a unit runs; units not listed anywhere are still Python only.
//
// A release maps a stage to the units that entered it, grouped by area. A unit
// is its id inside the area, like `azure_ai` under `ocr` or `cloud/aws` under
// `auth`, and `'*'` names every unit in the area. Stages are the ids in
// stages.ts, plus `done` for a task, which has no stages and is simply finished.
// Versions are RC versions no newer than main.
export const ROLLOUTS: Partial<Record<RcVersion, Rollout>> = {
  'v1.107.0-rc.1': {
    rustOptIn: {
      messages: ['deepseek', 'vertex_ai'],
    },
  },
  'v1.106.0-rc.1': {
    rustOptIn: {
      auth: [
        'secret-managers/aws-secret-manager', 'secret-managers/aws-kms', 'secret-managers/azure-key-vault',
        'secret-managers/google-secret-manager', 'secret-managers/google-kms', 'secret-managers/hashicorp-vault',
        'secret-managers/cyberark',
      ],
    },
  },
  'v1.105.0-rc.1': {
    rustOptIn: {
      caching: ['local', 'redis'],
    },
    done: {
      scaffold: ['config'],
    },
  },
  'v1.104.0-rc.1': {
    rustRequired: {
      ocr: '*',
    },
    rustOptIn: {
      callbacks: ['logging'],
      messages: ['anthropic'],
    },
    done: {
      scaffold: ['async', 'tracing', 'model-catalog'],
      callbacks: ['cost'],
    },
  },
  'v1.103.0-rc.1': {
    rustRequired: {
      'long-tail': ['transcription/bedrock'],
    },
    done: {
      scaffold: ['host', 'http', 'streaming'],
    },
  },
  'v1.102.0-rc.1': {
    rustOptOut: {
      ocr: '*',
    },
    done: {
      auth: ['cloud/azure', 'cloud/gcp'],
    },
  },
  'v1.95.0-rc.1': {
    done: {
      auth: ['cloud/aws'],
    },
  },
  'v1.91.0-rc.1': {
    done: {
      scaffold: ['python-bridge'],
    },
  },
};
