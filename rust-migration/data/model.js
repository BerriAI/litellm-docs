import {AREAS} from './areas';
import {fail} from './fail';
import {GOAL_DECLARATIONS} from './goals';
import {PROVIDERS} from './providers';
import {MAIN_VERSION, checkVersion, estimateReleaseDate} from './releases';
import {ROLLOUTS} from './rollouts';
import {STAGES} from './stages';
import {compareVersions, isNewer} from '../versions';

const DONE = 'done';
const DONE_STAGE = STAGES.length - 1;
const STAGE_INDEX = new Map(STAGES.map((stage, index) => [stage.id, index]));

const areasById = new Map();

function group(id, text, children) {
  if (new Set(children.map(child => child.id)).size !== children.length) {
    fail(`${id} lists a unit twice`);
  }
  return {id, text, children, features: children.flatMap(child => child.features)};
}

function buildUnit(parentId, parentPath, unit) {
  const {id, text, task = false, units} =
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
  const feature = {id: key, text, path, task, children: [], rollout: [], planned: []};
  feature.features = [feature];
  return feature;
}

for (const area of AREAS) {
  if (areasById.has(area.id)) {
    fail(`duplicate area: ${area.id}`);
  }
  const units = area.units.map(unit => buildUnit(area.id, [area.text], unit));
  const node = {...group(area.id, area.text, units), groundwork: 'groundwork' in area ? area.groundwork : false};
  node.features.forEach(feature => {
    feature.area = node;
  });
  areasById.set(area.id, node);
}

// Every unit in every area, in declaration order.
export const FEATURES = [...areasById.values()].flatMap(area => area.features);
const featuresById = new Map(FEATURES.map(feature => [feature.id, feature]));

// Versions with a rollout, oldest first.
export const ROLLOUT_VERSIONS = Object.keys(ROLLOUTS).sort(compareVersions);

// The units a release names under one area, as features.
function unitsIn(version, areaId, names) {
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

// Turns a release-by-release table into each unit's own steps. The checks cover
// what the data shape can't see, like a task under a stage or a unit named twice
// in one release. `record(feature, version, stage)` receives each step.
function applyReleases(table, versions, record) {
  for (const version of versions) {
    const moved = new Set();
    for (const [stageId, areas] of Object.entries(table[version] ?? {})) {
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
          record(feature, version, feature.task ? DONE_STAGE : STAGE_INDEX.get(stageId));
        }
      }
    }
  }
}

ROLLOUT_VERSIONS.forEach(checkVersion);
const PAST_VERSIONS = ROLLOUT_VERSIONS.filter(version => !isNewer(version, MAIN_VERSION));
const FUTURE_VERSIONS = ROLLOUT_VERSIONS.filter(version => isNewer(version, MAIN_VERSION));
applyReleases(ROLLOUTS, PAST_VERSIONS, (feature, version, stage) => feature.rollout.push({version, stage}));

// Releases newer than main are projections, kept apart in `feature.planned`.
// There is nothing to expire: once main reaches a projected version it is no
// longer newer, so it counts as history. A projected step that would not move
// its unit forward is skipped.
const plannedVersions = new Set();
applyReleases(ROLLOUTS, FUTURE_VERSIONS, (feature, version, stage) => {
  const latest = (feature.planned.at(-1) ?? feature.rollout.at(-1))?.stage ?? 0;
  if (stage > latest) {
    feature.planned.push({version, stage});
    plannedVersions.add(version);
  }
});

// Projected releases where something moves, oldest first, each with an
// estimated ship date.
export const PLAN_RELEASES = FUTURE_VERSIONS
  .filter(version => plannedVersions.has(version))
  .map(version => ({version, date: estimateReleaseDate(version)}));

// Goals in declaration order, shaped like nodes so the page treats a goal as
// the root of its own tree.
const goalsById = new Map();
for (const {scope, ...goal} of GOAL_DECLARATIONS) {
  const children = new Set(scope.flatMap(id => {
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
export const GOALS = [...goalsById.values()];

for (const area of areasById.values()) {
  if (!GOALS.some(goal => goal.children.includes(area))) {
    fail(`no goal's scope includes ${area.id}`);
  }
}
