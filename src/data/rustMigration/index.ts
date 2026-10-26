import * as semver from 'semver';
import {CATALOG} from './catalog';
import {buildModel} from './model';
import {CURRENT_VERSION, RELEASES} from './releases';
import {LEVELS} from './shared';
import type {Change, Component, Goal, LevelId, PlanPoint, Point, ReachedLevel, TimelinePoint, Work} from './shared';

export {LEVELS, ROUTES, TERMS} from './shared';
export type {Change, Component, Goal, IsoDay, LevelId, PlanPoint, Point, Release, TimelinePoint, Work} from './shared';
export {CURRENT_VERSION, MAIN_VERSION, RELEASES} from './releases';

export const {components: COMPONENTS, goals: GOALS, plans: PLANS} = buildModel(CATALOG);

export const levelId = (level: number): LevelId => LEVELS[level].id;

export const levelLabel = (id: LevelId): string => LEVELS.find(level => level.id === id)!.label;

// Where to read the migration: a release version, or a point on a timeline.
// A plan reads as what shipped by the latest release plus every plan up to
// its day, so plans never count unpublished RCs and never move work back.
type At = string | Point;

const highest = (steps: {level: number}[], floor: number) => steps.reduce((level, step) => Math.max(level, step.level), floor);

// The level a piece of work had reached, as an index into LEVELS.
export function levelAt(work: Pick<Work, 'shipped' | 'planned'>, at: At): number {
  if (typeof at === 'string') {
    return highest(work.shipped.filter(step => semver.lte(step.version, at)), 0);
  }
  if (at.kind !== 'plan') {
    return levelAt(work, at.version);
  }
  return highest(work.planned.filter(step => step.date <= at.date), levelAt(work, CURRENT_VERSION));
}

// The level a piece of work reached exactly at `at`, or -1.
function levelReachedAt(work: Work, at: At): number {
  if (typeof at === 'string' || at.kind !== 'plan') {
    const version = typeof at === 'string' ? at : at.version;
    return highest(work.shipped.filter(step => step.version === version), -1);
  }
  return highest(work.planned.filter(step => step.id === at.id), -1);
}

// A node's progress as an unrounded percent: each piece of work counts its
// level's score times its size. Round only for display, so values never round twice.
export function progressAt(node: Goal | Component | Work, at: At): number {
  const work = 'work' in node ? node.work : [node];
  const total = work.reduce((sum, item) => sum + item.size, 0);
  return (work.reduce((sum, item) => sum + item.size * LEVELS[levelAt(item, at)].score, 0) / total) * 100;
}

// A node's progress in points of its size, like 11.8 of 82.
export const pointsAt = (node: Goal | Component | Work, at: At): number => (progressAt(node, at) * node.size) / 100;

// What `at` moved for `goal` since `previous`, the point before it on the
// timeline, one change per component and level. Work a plan names that already
// got there did not move. The first point has nothing before it, so nothing
// says where its work came from.
export function changesBetween(goal: Pick<Goal, 'work'>, at: At, previous: At | null): Change[] {
  const before = (work: Work) => (previous === null ? -1 : levelAt(work, previous));
  const changes = new Map<string, Change & {froms: Set<LevelId>}>();
  for (const work of goal.work) {
    const level = levelReachedAt(work, at);
    if (level <= before(work)) {
      continue;
    }
    const id = levelId(level) as ReachedLevel;
    const key = `${work.component.id}:${id}`;
    const change = changes.get(key) ?? {key, component: work.component, level: id, from: null, work: [], whole: false, froms: new Set()};
    change.work.push(work);
    if (previous !== null) {
      change.froms.add(levelId(before(work)));
    }
    changes.set(key, change);
  }
  return [...changes.values()].map(({froms, ...change}) => ({
    ...change,
    from: froms.size === 1 ? [...froms][0] : null,
    whole: change.work.length > 1 && change.work.length === change.component.work.length,
  }));
}

// A goal's progress at every published release, the last of which is the
// latest, then where the plans should take it.
export function timelineFor(goal: Goal, plans: readonly PlanPoint[] = PLANS): TimelinePoint[] {
  const points: Point[] = [
    ...RELEASES.map(({version, date}): Point => ({kind: version === CURRENT_VERSION ? 'latest' : 'release', key: version, version, date})),
    ...plans,
  ];
  return points.map(point => ({...point, percent: progressAt(goal, point)}));
}
