import * as semver from 'semver';
import {PLANS} from './plans';
import {CURRENT_VERSION, RELEASES} from './releases';
import {STAGES, kindOf} from './stages';
import type {StageKind} from './stages';
import type {Change, ChangeSummary, Feature, Goal, Group, TimelinePoint} from './types';

export {STAGES, PLANS, kindOf};
export {labelOf} from './stages';
export type {StageKind} from './stages';
export type {IsoDay} from './days';
export type {Plan} from './plans';
export type {Area, Change, ChangeSummary, Feature, Goal, Group, Release, TimelinePoint} from './types';
export {CURRENT_VERSION, RELEASES};
export {LATEST_STABLE_VERSION, MAIN_VERSION, RC_RELEASES, STABLE_RELEASES} from './releases';
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
      const kind = kindOf(feature, stage);
      const key = `${feature.area.id}:${kind}`;
      const change = changes.get(key) ?? {key, area: feature.area, kind, features: []};
      change.features.push(feature);
      changes.set(key, change);
    }
  }
  return [...changes.values()];
}

// What `version` moved for `goal` since `previous`, the point before it on the
// timeline. The first point has no previous one, so nothing says where it came from.
export function changesBetween(goal: Goal, version: string, previous: string | null, projected = false): ChangeSummary[] {
  return changesIn(version, goal.features, projected).map(change => {
    const before = new Set<StageKind>(previous === null
      ? []
      : change.features.map(feature => STAGES[stageAt(feature, previous, projected)].id));
    return {
      ...change,
      from: change.kind !== 'done' && before.size === 1 ? [...before][0] : null,
      wholeArea: !change.area.groundwork && change.features.length > 1 && change.features.length === change.area.features.length,
    };
  });
}

// A goal's progress at every published release, the last of which is the
// latest, then where the plans should take it.
export function timelineFor(goal: Goal): TimelinePoint[] {
  return [
    ...RELEASES.map(({version, date}): TimelinePoint => ({
      kind: version === CURRENT_VERSION ? 'latest' : 'release',
      version,
      date,
      percent: progressAt(goal, version),
    })),
    ...PLANS.map(({version, date, label}): TimelinePoint => ({
      kind: 'plan',
      version,
      date,
      label,
      percent: progressAt(goal, version, true),
    })),
  ];
}
