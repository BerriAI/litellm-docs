import assert from 'node:assert/strict';
import test from 'node:test';
import {isoDay} from './days.ts';
import {GOALS, changesBetween, changesIn, timelineFor} from './index.ts';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// A minimal area of units, with steps given as [version, stage index].
function areaOf(units) {
  const area = {id: 'area', text: 'Area', groundwork: false, features: []};
  area.features = units.map(({id, task = false, steps}) => ({
    id: `area/${id}`,
    path: ['Area', id],
    task,
    area,
    rollout: steps.map(([version, stage]) => ({version, stage})),
    plan: [],
  }));
  return area;
}

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

test('a task finishing and a unit going Rust only in one release are separate changes', () => {
  const area = areaOf([
    {id: 'task', task: true, steps: [['v1.1.0-rc.1', 3]]},
    {id: 'unit', steps: [['v1.1.0-rc.1', 3]]},
  ]);
  const changes = changesIn('v1.1.0-rc.1', area.features);
  assert.deepEqual(changes.map(change => change.kind).sort(), ['done', 'rustRequired']);
});

test('a change names where its units came from only when they all came from one stage', () => {
  const area = areaOf([
    {id: 'a', steps: [['v1.0.0-rc.1', 1], ['v1.1.0-rc.1', 2]]},
    {id: 'b', steps: [['v1.0.0-rc.1', 1], ['v1.1.0-rc.1', 2]]},
    {id: 'c', steps: [['v1.1.0-rc.1', 2]]},
  ]);
  const goal = {features: area.features};
  const [mixed] = changesBetween(goal, 'v1.1.0-rc.1', 'v1.0.0-rc.1');
  assert.equal(mixed.from, null);
  assert.equal(mixed.wholeArea, true);
  const [same] = changesBetween({features: area.features.slice(0, 2)}, 'v1.1.0-rc.1', 'v1.0.0-rc.1');
  assert.equal(same.from, 'rustOptIn');
  assert.equal(same.wholeArea, false);
  // The first point on a timeline has nothing before it.
  const [first] = changesBetween(goal, 'v1.0.0-rc.1', null);
  assert.equal(first.from, null);
});
