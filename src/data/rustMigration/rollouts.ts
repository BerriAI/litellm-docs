import type {AreaId, UnitId} from './areas';
import type {StageId} from './stages';

export type RcVersion = `v${number}.${number}.${number}-rc.${number}`;

// A stage maps to the units of each area that entered it, or `'*'` for the whole area.
export type Rollouts = Partial<Record<RcVersion, Partial<Record<StageId | 'done', {
  [Area in AreaId]?: readonly UnitId<Area>[] | '*';
}>>>>;

// What each release moved, newest first. Add a block at the top when a release
// changes how a unit runs; units not listed anywhere are still Python only.
//
// A release maps a stage to the units that entered it, grouped by area. A unit
// is its id inside the area, like `azure_ai` under `ocr` or `auth/aws` under
// `foundation`, and `'*'` names every unit in the area. Stages are the ids in
// stages.ts, plus `done` for a task, which has no stages and is simply finished.
// Versions are RC versions no newer than main.
export const ROLLOUTS: Rollouts = {
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
