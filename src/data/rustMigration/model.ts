import * as semver from 'semver';
import type {GoalDeclaration, PlanDeclaration, WorkSet} from './catalog';
import {fail, isoDay} from './check';
import {RELEASES, checkVersion} from './releases';
import {LEVELS, PROVIDERS} from './shared';
import type {Component, ComponentDeclaration, Goal, PlanPoint, ProviderId, ReachedLevel, Work} from './shared';

const LEVEL_INDEX = new Map<string, number>(LEVELS.map((level, index) => [level.id, index]));
const REACHED: readonly ReachedLevel[] = ['partial', 'done'];

// What model.ts reads, which catalog.ts satisfies with every id typed.
export interface CatalogInput {
  components: readonly ComponentDeclaration[];
  goals: readonly GoalDeclaration[];
  plans: readonly PlanDeclaration[];
}

export interface Model {
  // Every component in catalog order, each with its work in order.
  components: Component[];
  // Goals in catalog order, shaped like nodes so the page treats a goal as the
  // root of its own tree.
  goals: Goal[];
  plans: PlanPoint[];
}

// Builds the model from catalog.ts. Every call returns a fresh tree, so a test
// can build one with its own plans without touching the page's.
export function buildModel(catalog: CatalogInput): Model {
  const componentsById = new Map<string, Component>();
  for (const declaration of catalog.components) {
    if (componentsById.has(declaration.id)) {
      fail(`duplicate component: ${declaration.id}`);
    }
    const component: Component = {id: declaration.id, text: declaration.text, size: 0, work: []};
    for (const item of declaration.work) {
      const id = `${component.id}/${item.id}`;
      const text = item.text ?? PROVIDERS[item.id as ProviderId];
      if (!text) {
        fail(`${id} has no text and is not a provider id`);
      }
      if (component.work.some(work => work.id === id)) {
        fail(`${component.id} lists ${item.id} twice`);
      }
      if (!(item.size > 0)) {
        fail(`${id} needs a positive size`);
      }
      const work: Work = {id, text, size: item.size, component, shipped: [], planned: []};
      for (const level of REACHED) {
        const version = item[level];
        if (version !== undefined) {
          checkVersion(version);
          work.shipped.push({version, level: LEVEL_INDEX.get(level)!});
        }
      }
      if (item.partial && item.done && semver.gt(item.partial, item.done)) {
        fail(`${id} is done in ${item.done}, before it is partial in ${item.partial}`);
      }
      component.work.push(work);
    }
    if (component.work.length === 0) {
      fail(`${component.id} has no work`);
    }
    component.size = component.work.reduce((sum, work) => sum + work.size, 0);
    componentsById.set(component.id, component);
  }

  // The work a plan names under each component.
  function workIn(where: string, set: WorkSet): Work[] {
    return Object.entries(set).flatMap(([componentId, names]) => {
      const component = componentsById.get(componentId);
      if (!component) {
        fail(`${where} names unknown component: ${componentId}`);
      }
      if (names === '*') {
        return component.work;
      }
      return names.map(name => {
        const work = component.work.find(candidate => candidate.id === `${componentId}/${name}`);
        if (!work) {
          fail(`${where} names unknown work: ${componentId}/${name}`);
        }
        return work;
      });
    });
  }

  // Plans sit past the latest release, oldest first, one per day, since the
  // timeline draws and orders them by date.
  const planIds = new Set<string>();
  let after = RELEASES.at(-1)!.date;
  const plans = catalog.plans.map((plan): PlanPoint => {
    const {id, date, label, route, description} = plan;
    if (!id.trim() || planIds.has(id)) {
      fail(`plans need unique nonempty ids: ${id}`);
    }
    planIds.add(id);
    if (label.length === 0) {
      fail(`${id} needs a label`);
    }
    if (isoDay(date, id) !== date || date <= after) {
      fail(`${id} needs a day after ${after}: ${date}`);
    }
    after = date;
    const moved = new Set<Work>();
    for (const level of REACHED) {
      for (const work of workIn(id, plan[level] ?? {})) {
        if (moved.has(work)) {
          fail(`${work.id} appears twice in ${id}`);
        }
        moved.add(work);
        work.planned.push({id, date, level: LEVEL_INDEX.get(level)!});
      }
    }
    return {kind: 'plan', key: `plan:${id}`, id, date, label: label.join(', '), terms: [...label], route, description};
  });

  const goals = catalog.goals.map(({components: ids, ...goal}): Goal => {
    if (isoDay(goal.endsOn, goal.id) !== goal.endsOn || goal.endsOn <= after) {
      fail(`${goal.id} needs to end after ${after}: ${goal.endsOn}`);
    }
    if (new Set(ids).size !== ids.length) {
      fail(`${goal.id} lists a component twice`);
    }
    const components = ids.map(id => {
      const component = componentsById.get(id);
      if (!component) {
        fail(`${goal.id} names unknown component: ${id}`);
      }
      return component;
    });
    return {
      ...goal,
      size: components.reduce((sum, component) => sum + component.size, 0),
      components,
      work: components.flatMap(component => component.work),
    };
  });

  for (const component of componentsById.values()) {
    if (!goals.some(goal => goal.components.includes(component))) {
      fail(`no goal covers ${component.id}`);
    }
  }

  return {components: [...componentsById.values()], goals, plans};
}
