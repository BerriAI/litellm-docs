import * as semver from 'semver';
import {STAGES} from './stages';
import type {Change, Feature, Goal, Group} from './types';

export {STAGES};
export {PLANS} from './plans';
export type {Plan} from './plans';
export type {Area, Change, Feature, Goal, Group, Release} from './types';
export {
  CURRENT_VERSION,
  LATEST_STABLE_VERSION,
  MAIN_VERSION,
  RC_RELEASES,
  RELEASES,
  STABLE_RELEASES,
} from './releases';
export {FEATURES, GOALS, ROLLOUT_VERSIONS} from './model';

// The steps that count: shipped ones, plus planned ones when `projected`.
const stepsOf = (feature: Feature, projected: boolean) =>
  (projected ? [...feature.rollout, ...feature.plan] : feature.rollout);

// The stage a feature was at in `version`, as an index into STAGES. With
// `projected`, a planned release reads as if it shipped as planned.
export function stageAt(feature: Feature, version: string, projected = false): number {
  return stepsOf(feature, projected)
    .filter(step => semver.lte(step.version, version))
    .reduce((stage, step) => Math.max(stage, step.stage), 0);
}

// How far a node had come at `version`, from 0 to 1. A unit scores its stage,
// and anything above it is the weighted mean of its children.
function scoreAt(node: Goal | Group | Feature, version: string, projected: boolean): number {
  if ('rollout' in node) {
    return STAGES[stageAt(node, version, projected)].score;
  }
  const children: (Group | Feature)[] = node.children;
  const total = children.reduce((sum, child) => sum + child.weight, 0);
  return children.reduce((sum, child) => sum + child.weight * scoreAt(child, version, projected), 0) / total;
}

// A node's progress at `version` as an unrounded percent, where 100 is
// everything on Rust by default. Round only for display, so values never round twice.
export function progressAt(node: Goal | Group | Feature, version: string, projected = false): number {
  return scoreAt(node, version, projected) * 100;
}

// What `version` moved among `features`, one change per area and stage, so six
// providers entering the same stage together read as one change.
export function changesIn(version: string, features: Feature[], projected = false): Change[] {
  const changes = new Map<string, Change>();
  for (const feature of features) {
    const stage = stepsOf(feature, projected)
      .filter(step => step.version === version)
      .reduce((highest, step) => Math.max(highest, step.stage), -1);
    if (stage >= 0) {
      const key = `${feature.area.id}:${stage}`;
      const change = changes.get(key) ?? {key, area: feature.area, stage, features: []};
      change.features.push(feature);
      changes.set(key, change);
    }
  }
  return [...changes.values()];
}
