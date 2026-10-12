import * as semver from 'semver';
import {AREAS} from './areas';
import type {AreaId} from './areas';
import {fail} from './fail';
import {GOAL_DECLARATIONS} from './goals';
import {PROVIDERS} from './providers';
import type {ProviderId} from './providers';
import {checkVersion} from './releases';
import {ROLLOUTS} from './rollouts';
import type {RcVersion} from './rollouts';
import {STAGES} from './stages';
import type {Area, Feature, Goal, Group} from './types';

const DONE = 'done';
const DONE_STAGE = STAGES.length - 1;
const STAGE_INDEX = new Map<string, number>(STAGES.map((stage, index) => [stage.id, index]));

interface UnitDeclaration {
  id: string;
  text: string;
  task?: boolean;
  units?: readonly (ProviderId | UnitDeclaration)[];
}

const areasById = new Map<string, Area>();

function group(id: string, text: string, children: (Feature | Group)[]): Group {
  if (new Set(children.map(child => child.id)).size !== children.length) {
    fail(`${id} lists a unit twice`);
  }
  return {id, text, children, features: children.flatMap(child => child.features)};
}

function buildUnit(parentId: string, parentPath: string[], unit: ProviderId | UnitDeclaration): Feature | Group {
  const {id, text, task = false, units}: UnitDeclaration =
    typeof unit === 'string' ? {id: unit, text: PROVIDERS[unit]} : unit;
  const key = `${parentId}/${id}`;
  const path = [...parentPath, text];
  if (!text) {
    fail(`${key} has no display name in PROVIDERS`);
  }
  if (units) {
    return group(key, text, units.map(child => buildUnit(key, path, child)));
  }
  // `area` is filled in once the area exists, right below.
  const feature = {id: key, text, path, task, children: [], rollout: []} as unknown as Feature;
  feature.features = [feature];
  return feature;
}

for (const area of AREAS) {
  if (areasById.has(area.id)) {
    fail(`duplicate area: ${area.id}`);
  }
  const units = area.units.map(unit => buildUnit(area.id, [area.text], unit));
  const node: Area = {...group(area.id, area.text, units), groundwork: 'groundwork' in area ? area.groundwork : false};
  node.features.forEach(feature => {
    feature.area = node;
  });
  areasById.set(area.id, node);
}

// Every unit in every area, in declaration order.
export const FEATURES: Feature[] = [...areasById.values()].flatMap(area => area.features);
const featuresById = new Map(FEATURES.map(feature => [feature.id, feature]));

// Versions with a rollout, oldest first.
export const ROLLOUT_VERSIONS = (Object.keys(ROLLOUTS) as RcVersion[]).sort(semver.compare);

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

// Turns the per-release history into each unit's own steps. The types already
// rule out unknown areas, units and stages; these checks cover what they can't
// see, like a task under a stage or a unit named twice in one release.
for (const version of ROLLOUT_VERSIONS) {
  checkVersion(version);
  const moved = new Set<Feature>();
  for (const [stageId, areas] of Object.entries(ROLLOUTS[version] ?? {})) {
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
        feature.rollout.push({version, stage: feature.task ? DONE_STAGE : STAGE_INDEX.get(stageId)!});
      }
    }
  }
}

// Goals in declaration order, shaped like nodes so the page treats a goal as
// the root of its own tree.
const goalsById = new Map<string, Goal>();
for (const {scope, ...goal} of GOAL_DECLARATIONS) {
  const children = new Set<Area>(scope.flatMap(id => {
    const earlier = goalsById.get(id);
    if (earlier) {
      return earlier.children;
    }
    const area = areasById.get(id);
    if (!area) {
      fail(`goal ${goal.id} has unknown scope: ${id}`);
    }
    return [area];
  }));
  const features = [...children].flatMap(child => child.features);
  goalsById.set(goal.id, {...goal, children: [...children], features});
}
export const GOALS: Goal[] = [...goalsById.values()];

for (const area of areasById.values()) {
  if (!GOALS.some(goal => goal.children.includes(area))) {
    fail(`no goal's scope includes ${area.id}`);
  }
}
