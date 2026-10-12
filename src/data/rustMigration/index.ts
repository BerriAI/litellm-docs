import * as semver from 'semver';
import {STAGES} from './stages';
import type {Change, Feature} from './types';

export {STAGES};
export type {Change, Feature, Release} from './types';
export {
  LATEST_STABLE_VERSION,
  MAIN_VERSION,
  RC_RELEASES,
  RELEASES,
  STABLE_RELEASES,
} from './releases';
export {FEATURES, GOALS, ROLLOUT_VERSIONS} from './model';

// The stage a feature was at in `version`, as an index into STAGES.
export function stageAt(feature: Feature, version: string): number {
  return feature.rollout.findLast(step => semver.lte(step.version, version))?.stage ?? 0;
}

// How far a node's features had climbed the rollout stages at `version`, as a
// percent. Rust only everywhere is 100%.
export function progressAt(node: {features: Feature[]}, version: string): number {
  const score = node.features.reduce((sum, feature) => sum + stageAt(feature, version), 0);
  return Math.round((score / (node.features.length * (STAGES.length - 1))) * 100);
}

// What `version` moved among `features`, one change per area and stage, so six
// providers entering the same stage together read as one change.
export function changesIn(version: string, features: Feature[]): Change[] {
  const changes = new Map<string, Change>();
  for (const feature of features) {
    const step = feature.rollout.find(candidate => candidate.version === version);
    if (step) {
      const key = `${feature.area.id}:${step.stage}`;
      const change = changes.get(key) ?? {key, area: feature.area, stage: step.stage, features: []};
      change.features.push(feature);
      changes.set(key, change);
    }
  }
  return [...changes.values()];
}
