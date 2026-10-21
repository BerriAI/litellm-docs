import assert from 'node:assert/strict';
import test from 'node:test';
import {GOALS, timelineFor} from '../../data/rustMigration/index.ts';
import {createTimeScale, labelWidth, layoutTimelineLabels, layoutTimelineValues, monthTicks} from './timeline.ts';

// Disabled goals are listed in the picker but never drawn.
const DRAWN_GOALS = GOALS.filter(goal => !goal.disabled);

test('every interval uses the same elapsed-time scale for each goal and viewport', () => {
  for (const goal of DRAWN_GOALS) {
    const points = timelineFor(goal);
    for (const width of [280, 368, 560, 920, 1200]) {
      const x = createTimeScale(points[0].date, goal.endsOn, 40, width - 20);
      const dates = [...points.map(point => point.date), goal.endsOn];
      const pixelsPerMs = (width - 60) / (Date.parse(goal.endsOn) - Date.parse(dates[0]));
      for (let index = 1; index < dates.length; index += 1) {
        const expectedGap = (Date.parse(dates[index]) - Date.parse(dates[index - 1])) * pixelsPerMs;
        assert.ok(Math.abs(x(dates[index]) - x(dates[index - 1]) - expectedGap) < 1e-9);
      }
    }
  }
});

test('equal time intervals have equal widths regardless of release density', () => {
  const x = createTimeScale('2026-09-01', '2026-12-31', 48, 880);
  assert.ok(Math.abs((x('2026-10-15') - x('2026-10-08')) - (x('2026-10-22') - x('2026-10-15'))) < 1e-9);
  // Regression: Oct 24 to Dec 31 must have more room than Oct 8 to Oct 13.
  assert.ok(x('2026-12-31') - x('2026-10-24') > x('2026-10-13') - x('2026-10-08'));
  assert.equal(x('2026-09-01'), 48);
  assert.equal(x('2026-12-31'), 880);
  assert.throws(() => createTimeScale('invalid', '2026-12-31', 48, 880));
  assert.throws(() => createTimeScale('2026-12-31', '2026-09-01', 48, 880));
});

test('crowded dates keep the first release, today, plans, and goal readable without shifting dots', () => {
  for (const goal of DRAWN_GOALS) {
    const points = timelineFor(goal);
    for (const width of [280, 368, 560, 920, 1200]) {
      const dateX = createTimeScale(points[0].date, goal.endsOn, 40, width - 20);
      const x = index => dateX(points[index].date);
      const before = points.map((point, index) => x(index));
      const goalLeft = width - 20 - labelWidth('Goal', 'Dec 31');
      const items = points.map((point, index) => ({
        key: index,
        anchor: x(index),
        width: labelWidth(point.label ?? '1.106 rc2', point.kind === 'latest' ? 'Oct 13 · latest' : 'Oct 17'),
        priority: index === 0 || point.kind !== 'release' ? 2 : index % 2,
      }));
      const {labels, rowCount} = layoutTimelineLabels(items, goalLeft, width);
      items.forEach(item => {
        if (item.priority === 2) assert.ok(labels.has(item.key));
      });
      const placed = [...labels.values()];
      placed.forEach((label, index) => {
        assert.ok(label.x - label.width / 2 >= 0 && label.x + label.width / 2 <= width);
        assert.ok(label.row > 0 || label.x + label.width / 2 <= goalLeft);
        assert.ok(Math.abs(label.x - label.anchor) <= (label.priority === 2 ? 48 : 0.5));
        assert.ok(label.row < rowCount);
        placed.slice(index + 1).forEach(other => {
          if (label.row === other.row) assert.ok(Math.abs(label.x - other.x) >= (label.width + other.width) / 2);
        });
      });
      // Sliding labels apart before stacking them keeps the axis two rows deep
      // on a phone and up.
      if (width >= 368) assert.ok(rowCount <= 2);
      assert.deepEqual(points.map((point, index) => x(index)), before);
      const values = [...layoutTimelineValues(points, x, percent => 200 - percent * 2).values()];
      values.forEach((value, index) => values.slice(index + 1).forEach(other => {
        assert.ok(Math.abs(value.x - other.x) >= 40 || Math.abs(value.y - other.y) >= 18);
      }));
    }
  }
});

test('month gridlines fall strictly inside the timeline', () => {
  assert.deepEqual(monthTicks('2026-09-13', '2026-12-31'), ['2026-10-01', '2026-11-01', '2026-12-01']);
  assert.deepEqual(monthTicks('2026-09-01', '2026-11-01'), ['2026-10-01']);
});
