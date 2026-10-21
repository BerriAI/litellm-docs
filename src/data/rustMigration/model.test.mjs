import assert from 'node:assert/strict';
import test from 'node:test';
import {CATALOG} from './catalog.ts';
import {isoDay} from './check.ts';
import {CURRENT_VERSION, GOALS, RELEASES, changesBetween, levelAt, progressAt, timelineFor} from './index.ts';
import {buildModel} from './model.ts';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// A minimal component of work, with steps given as [version, level index].
function componentOf(items) {
  const component = {id: 'component', text: 'Component', work: []};
  component.work = items.map(({id, size = 1, steps}) => ({
    id: `component/${id}`,
    text: id,
    size,
    component,
    shipped: steps.map(([version, level]) => ({version, level})),
    planned: [],
  }));
  component.size = component.work.reduce((sum, work) => sum + work.size, 0);
  return component;
}

const latestDay = RELEASES.at(-1).date;
function afterLatest(days) {
  const date = new Date(latestDay);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const plan = (id, days, levels) => ({id, label: ['e2e'], date: afterLatest(days), description: 'An intermediate goal', ...levels});

// The page's catalog with changes of its own, built apart from the page's model.
const withPlans = plans => buildModel({...CATALOG, plans});
const withComponent = component => buildModel({
  ...CATALOG,
  components: [...CATALOG.components, component],
  goals: CATALOG.goals.map(goal => ({...goal, components: [...goal.components, component.id]})),
});

test('days are UTC calendar days, and anything else fails', () => {
  assert.equal(isoDay('2026-10-13T23:59:59-02:00', 'x'), '2026-10-14');
  assert.equal(isoDay('2026-10-13', 'x'), '2026-10-13');
  assert.throws(() => isoDay('Oct 13', 'x'));
  assert.throws(() => isoDay('2026-13-45', 'x'));
});

test('each goal has one latest release, then plans in date order, all as days', () => {
  for (const goal of GOALS) {
    const points = timelineFor(goal);
    const latest = points.findIndex(point => point.kind === 'latest');
    assert.equal(points.filter(point => point.kind === 'latest').length, 1);
    assert.ok(points.slice(0, latest).every(point => point.kind === 'release'));
    assert.ok(points.slice(latest + 1).every(point => point.kind === 'plan' && point.label));
    points.forEach((point, index) => {
      assert.match(point.date, DAY);
      if (index > latest) assert.ok(point.date > points[index - 1].date);
    });
    assert.ok(goal.endsOn > points.at(-1).date);
  }
});

test('progress weighs each piece of work by its size, at 0.8 when partial and 1 when done', () => {
  const component = componentOf([
    {id: 'big', size: 3, steps: [['v1.0.0-rc.1', 1], ['v1.1.0-rc.1', 2]]},
    {id: 'small', size: 1, steps: [['v1.1.0-rc.1', 1]]},
  ]);
  assert.equal(progressAt(component, 'v0.9.0-rc.1'), 0);
  assert.ok(Math.abs(progressAt(component, 'v1.0.0-rc.1') - 60) < 1e-10);
  assert.ok(Math.abs(progressAt(component, 'v1.1.0-rc.1') - 95) < 1e-10);
});

test('a change names the level its work left only when it all left the same one', () => {
  const component = componentOf([
    {id: 'a', steps: [['v1.0.0-rc.1', 1], ['v1.1.0-rc.1', 2]]},
    {id: 'b', steps: [['v1.0.0-rc.1', 1], ['v1.1.0-rc.1', 2]]},
    {id: 'c', steps: [['v1.1.0-rc.1', 2]]},
  ]);
  const [mixed] = changesBetween(component, 'v1.1.0-rc.1', 'v1.0.0-rc.1');
  assert.equal(mixed.level, 'done');
  assert.equal(mixed.from, null);
  assert.equal(mixed.whole, true);
  const [same] = changesBetween({work: component.work.slice(0, 2)}, 'v1.1.0-rc.1', 'v1.0.0-rc.1');
  assert.equal(same.from, 'partial');
  assert.equal(same.whole, false);
  // The first point on a timeline has nothing before it.
  const [first] = changesBetween(component, 'v1.0.0-rc.1', null);
  assert.equal(first.from, null);
});

test('plans add partial and done work by day without touching releases', () => {
  const {goals, plans} = withPlans([
    plan('dispatch-partial', 7, {partial: {deploy: ['dispatch']}}),
    plan('deploy-done', 14, {done: {deploy: '*'}}),
  ]);
  const [goal] = goals;
  const deploy = goal.components.find(component => component.id === 'deploy');
  const dispatch = deploy.work.find(work => work.id === 'deploy/dispatch');
  assert.equal(progressAt(goal, CURRENT_VERSION), progressAt(GOALS[0], CURRENT_VERSION));
  assert.ok(Math.abs(progressAt(dispatch, plans[0]) - 80) < 1e-10);
  assert.equal(progressAt(deploy, plans[1]), 100);
  const points = timelineFor(goal, plans);
  assert.deepEqual(points.filter(point => point.kind !== 'plan'), timelineFor(GOALS[0]).filter(point => point.kind !== 'plan'));
  assert.deepEqual(points.slice(-2), plans.map(point => ({...point, percent: progressAt(goal, point)})));
  assert.ok(points.at(-1).percent > points.at(-2).percent);
  const changes = changesBetween(goal, plans[1], plans[0]);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].level, 'done');
  assert.equal(changes[0].whole, true);
  assert.equal(changes[0].from, null);
});

test('plans never count unpublished releases, move work back, or repeat a level it reached', () => {
  const work = {
    shipped: [{version: CURRENT_VERSION, level: 1}, {version: 'v999.0.0-rc.1', level: 2}],
    planned: [{id: 'later', date: afterLatest(14), level: 1}],
  };
  assert.equal(levelAt(work, {kind: 'plan', date: afterLatest(7)}), 1);
  assert.equal(levelAt(work, {kind: 'plan', date: afterLatest(14)}), 1);
  assert.equal(levelAt(work, CURRENT_VERSION), 1);
  const {goals, plans} = withPlans([plan('already-there', 7, {done: {core: ['python-bridge']}})]);
  const latest = timelineFor(goals[0], plans).find(point => point.kind === 'latest');
  assert.deepEqual(changesBetween(goals[0], plans[0], latest), []);
});

test('plans need unique ids, labels, later days and known work', () => {
  const valid = plan('first', 7, {partial: {deploy: ['image']}});
  assert.throws(() => withPlans([{...valid, id: ' '}]), /unique nonempty ids/);
  assert.throws(() => withPlans([valid, {...valid, date: afterLatest(14)}]), /unique nonempty ids/);
  assert.throws(() => withPlans([{...valid, label: []}]), /needs a label/);
  assert.throws(() => withPlans([{...valid, date: latestDay}]), /needs a day after/);
  assert.throws(() => withPlans([valid, {...valid, id: 'second'}]), /needs a day after/);
  assert.throws(() => withPlans([{...valid, date: 'invalid'}]), /invalid date/);
  assert.throws(() => withPlans([{...valid, partial: {deploy: ['unknown']}}]), /unknown work/);
  assert.throws(() => withPlans([{...valid, done: {deploy: ['image']}}]), /appears twice/);
});

test('work needs a name, a positive size, and partial no later than done', () => {
  const component = work => ({id: 'extra', text: 'Extra', work: [work]});
  assert.doesNotThrow(() => withComponent(component({id: 'anthropic', size: 1})));
  assert.throws(() => withComponent(component({id: 'unknown', size: 1})), /no text/);
  assert.throws(() => withComponent(component({id: 'x', text: 'X', size: 0})), /positive size/);
  assert.throws(() => withComponent(component({id: 'x', text: 'X', size: 1, partial: 'v1.105.0-rc.1', done: 'v1.104.0-rc.1'})), /before it is partial/);
  assert.throws(() => withComponent(component({id: 'x', text: 'X', size: 1, done: '1.104.0'})), /RC semver/);
  assert.throws(() => buildModel({...CATALOG, components: [...CATALOG.components, component({id: 'x', text: 'X', size: 1})]}), /no goal covers extra/);
});
