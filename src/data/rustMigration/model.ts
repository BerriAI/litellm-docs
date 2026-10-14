import * as semver from 'semver';
import {AREAS} from './areas';
import type {Unit} from './areas';
import {fail} from './fail';
import {GOAL_DECLARATIONS} from './goals';
import {PLANS} from './plans';
import {PROVIDERS} from './providers';
import {CURRENT_VERSION, checkVersion} from './releases';
import {ROLLOUTS} from './rollouts';
import type {RcVersion, Rollout} from './rollouts';
import {STAGES} from './stages';
import type {Area, Feature, Goal, Group} from './types';

const DONE = 'done';
const DONE_STAGE = STAGES.length - 1;
const STAGE_INDEX = new Map<string, number>(STAGES.map((stage, index) => [stage.id, index]));

function checkUnique(id: string, children: {id: string}[]) {
  if (new Set(children.map(child => child.id)).size !== children.length) {
    fail(`${id} lists a unit twice`);
  }
}

// Builds a unit or group under `area`, keyed by its path of ids from the area.
function buildUnit(area: Area, parentId: string, parentPath: string[], unit: Unit): Feature | Group {
  const {id, text, task = false, weight = 1, units} = typeof unit === 'string' ? {id: unit, text: PROVIDERS[unit]} : unit;
  const key = `${parentId}/${id}`;
  const path = [...parentPath, text];
  if (!text) {
    fail(`${key} has no display name in PROVIDERS`);
  }
  if (!(weight > 0)) {
    fail(`${key} needs a positive weight`);
  }
  if (units) {
    const children = units.map(child => buildUnit(area, key, path, child));
    checkUnique(key, children);
    return {id: key, text, weight, children, features: children.flatMap(child => child.features)};
  }
  const feature: Feature = {id: key, text, weight, path, task, children: [], features: [], rollout: [], plan: [], area};
  feature.features.push(feature);
  return feature;
}

const areasById = new Map<string, Area>();
for (const declaration of AREAS) {
  if (areasById.has(declaration.id)) {
    fail(`duplicate area: ${declaration.id}`);
  }
  const area: Area = {
    id: declaration.id,
    text: declaration.text,
    weight: 1,
    groundwork: 'groundwork' in declaration && declaration.groundwork,
    children: [],
    features: [],
  };
  area.children = declaration.units.map(unit => buildUnit(area, area.id, [area.text], unit));
  checkUnique(area.id, area.children);
  area.features = area.children.flatMap(child => child.features);
  areasById.set(area.id, area);
}

// Every unit in every area, in declaration order.
export const FEATURES: Feature[] = [...areasById.values()].flatMap(area => area.features);
const featuresById = new Map(FEATURES.map(feature => [feature.id, feature]));

// The units a release names under one area, as features.
function unitsIn(version: string, areaId: string, names: readonly string[] | '*'): Feature[] {
  const area = areasById.get(areaId);
  if (!area) {
    fail(`${version} names unknown area: ${areaId}`);
  }
  if (names === '*') {
    return area.features;
  }
  return names.map(name => {
    const feature = featuresById.get(`${areaId}/${name}`);
    if (!feature) {
      fail(`${version} names unknown unit: ${areaId}/${name}`);
    }
    return feature;
  });
}

// Records one release's rollout as a step on each unit it names, under
// `steps`. The types already rule out unknown areas, units and stages; these
// checks cover what they can't see, like a task under a stage or a unit named
// twice in one release.
function record(version: RcVersion, rollout: Rollout, steps: 'rollout' | 'plan') {
  const moved = new Set<Feature>();
  for (const [stageId, areas] of Object.entries(rollout)) {
    if (stageId !== DONE && !STAGE_INDEX.has(stageId)) {
      fail(`${version} has unknown rollout stage: ${stageId}`);
    }
    for (const [areaId, names] of Object.entries(areas)) {
      for (const feature of unitsIn(version, areaId, names)) {
        if (feature.task !== (stageId === DONE)) {
          fail(`${feature.id} ${feature.task ? 'is a task and only takes done' : 'is not a task and needs a stage'} in ${version}`);
        }
        if (moved.has(feature)) {
          fail(`${feature.id} appears twice in ${version}`);
        }
        moved.add(feature);
        feature[steps].push({version, stage: feature.task ? DONE_STAGE : STAGE_INDEX.get(stageId)!});
      }
    }
  }
}

// Versions that moved something, oldest first.
export const ROLLOUT_VERSIONS = (Object.keys(ROLLOUTS) as RcVersion[]).sort(semver.compare);

for (const version of ROLLOUT_VERSIONS) {
  checkVersion(version);
  record(version, ROLLOUTS[version]!, 'rollout');
}

// Plans sit past the last published release, oldest first, and stop being
// plans the moment their RC ships.
PLANS.forEach((plan, index) => {
  if (semver.lte(plan.version, CURRENT_VERSION)) {
    fail(`${plan.version} is published; move what shipped into ROLLOUTS and drop its plan`);
  }
  if (index > 0 && semver.lte(plan.version, PLANS[index - 1].version)) {
    fail(`plans must be in release order: ${plan.version}`);
  }
  record(plan.version, plan.rollout, 'plan');
});

// Goals in declaration order, shaped like nodes so the page treats a goal as
// the root of its own tree. Each goal holds its own copy of an area, weighted
// by the points the goal gives it.
export const GOALS: Goal[] = GOAL_DECLARATIONS.map(({areas, ...goal}) => {
  const children = Object.entries(areas).map(([id, points]): Area => ({...areasById.get(id)!, weight: points!}));
  return {
    ...goal,
    points: children.reduce((sum, area) => sum + area.weight, 0),
    children,
    features: children.flatMap(area => area.features),
  };
});

for (const area of areasById.values()) {
  if (!GOALS.some(goal => goal.children.some(child => child.id === area.id))) {
    fail(`no goal covers ${area.id}`);
  }
}
