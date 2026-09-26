import {isNotNewer} from '../versions';
import {STAGES} from './stages';

export {STAGES};
export {
  LATEST_STABLE_VERSION,
  MAIN_VERSION,
  RC_RELEASES,
  RELEASES,
  STABLE_RELEASES,
} from './releases';
export {FEATURES, GOALS, PLAN_RELEASES, ROLLOUT_VERSIONS} from './model';

// The shapes below are built in model.js. A feature is one unit of work:
// `{id, text, path, task, rollout, area, features: [itself]}`. A `rollout` holds
// `{version, stage}` steps, oldest first, with future ones in `planned`, where `stage` indexes STAGES and a
// finished task counts as the last stage. Areas and goals are nodes with
// `text`, `children` and `features`, the units at or beneath them.

// The stage a feature was at in `version`, as an index into STAGES. With
// `planned`, the plan's steps count too, so a future version reads as intended.
export function stageAt(feature, version, {planned = false} = {}) {
  const steps = planned ? [...feature.rollout, ...feature.planned] : feature.rollout;
  return steps.findLast(step => isNotNewer(step.version, version))?.stage ?? 0;
}

// How far a node's features had climbed the rollout stages at `version`, as a
// percent. Rust only everywhere is 100%.
export function progressAt(node, version, options) {
  const score = node.features.reduce((sum, feature) => sum + stageAt(feature, version, options), 0);
  return Math.round((score / (node.features.length * (STAGES.length - 1))) * 100);
}

// What `version` moved among `features`, one change per area and stage, so six
// providers entering the same stage together read as one change.
// Each change is `{key, area, stage, features}`.
export function changesIn(version, features, {planned = false} = {}) {
  const changes = new Map();
  for (const feature of features) {
    const steps = planned ? feature.planned : feature.rollout;
    const step = steps.find(candidate => candidate.version === version);
    if (step) {
      const key = `${feature.area.id}:${step.stage}`;
      const change = changes.get(key) ?? {key, area: feature.area, stage: step.stage, features: []};
      change.features.push(feature);
      changes.set(key, change);
    }
  }
  return [...changes.values()];
}
