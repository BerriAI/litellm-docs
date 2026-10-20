import type {IsoDay, TimelinePoint} from '../../data/rustMigration';

// One elapsed-time scale for releases, plans, and the goal. Label layout must
// never change a point's position or reserve a fixed amount of time for plans.
export function createTimeScale(startDate: IsoDay, endDate: IsoDay, left: number, right: number): (date: IsoDay) => number {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error('The migration timeline needs valid dates and a goal after its start.');
  }
  return (date: IsoDay) => left + ((Date.parse(date) - start) / (end - start)) * (right - left);
}

export const LABEL_ROW_HEIGHT = 48;
const LABEL_GAP = 12;
const MAX_SHIFT = 48;

// Rough width of an axis label: an 11px name over a 10px date.
export const labelWidth = (name: string, date: string): number => Math.max(name.length * 6.4, date.length * 5.8);

// One axis label to place: `anchor` is its date's x, and priority 2 marks a
// label that must show, 1 one that is worth showing, and 0 the rest.
export interface LabelItem {
  key: number;
  anchor: number;
  width: number;
  priority: 0 | 1 | 2;
}

export interface PlacedLabel extends LabelItem {
  x: number;
  row: number;
}

interface Run {
  labels: LabelItem[];
  width: number;
  // The sum of each label's ideal left edge, less its offset in the run.
  ideal: number;
  left?: number;
}

// Slide the labels of one row apart, centering each run of touching labels on
// their dates so none strays further than it must.
function spread(row: LabelItem[], min: number, max: number): (LabelItem & {x: number})[] {
  const runs: Run[] = [];
  for (const label of [...row].sort((a, b) => a.anchor - b.anchor)) {
    let run: Run = {labels: [label], width: label.width, ideal: label.anchor - label.width / 2};
    for (;;) {
      run.left = Math.max(min, Math.min(run.ideal / run.labels.length, max - run.width));
      const previous = runs.at(-1);
      if (!previous || previous.left! + previous.width + LABEL_GAP <= run.left) break;
      runs.pop();
      const offset = previous.width + LABEL_GAP;
      run = {
        labels: [...previous.labels, ...run.labels],
        width: offset + run.width,
        ideal: previous.ideal + run.ideal - offset * run.labels.length,
      };
    }
    runs.push(run);
  }
  return runs.flatMap(({labels, left = 0}) => labels.map(label => {
    const x = left + label.width / 2;
    left += label.width + LABEL_GAP;
    return {...label, x};
  }));
}

// Required labels (the first release, today, and plans) may slide a little
// along the axis, then drop to another row. Optional release labels only fill
// free space in the first row, whose right end belongs to the goal. Dots never
// move; a guide joins each label to its date.
export function layoutTimelineLabels(items: LabelItem[], goalLeft: number, width: number): {labels: Map<number, PlacedLabel>; rowCount: number} {
  const rows: PlacedLabel[][] = [];
  // Later required labels never sit above earlier ones, so rows read in date order.
  let firstRow = 0;
  const order = [...items].sort((a, b) => b.priority - a.priority || a.anchor - b.anchor);
  for (const item of order) {
    const required = item.priority === 2;
    for (let row = required ? firstRow : 0; row === 0 || (required && row <= rows.length); row += 1) {
      const max = row === 0 ? goalLeft - LABEL_GAP : width - 8;
      const placed = spread([...(rows[row] ?? []), item], 8, max);
      const before = new Map((rows[row] ?? []).map(label => [label.key, label.x]));
      // A run wider than the row overflows its right end, which on the first row is the goal's.
      const fits = placed.every(label => Math.abs(label.x - label.anchor) <= (label.priority === 2 ? MAX_SHIFT : 0.5)
        && label.x + label.width / 2 <= max + 0.5
        && (required || label.key === item.key || Math.abs(label.x - before.get(label.key)!) < 0.5));
      if (fits || row === rows.length) {
        rows[row] = placed.map(label => ({...label, row}));
        if (required) firstRow = row;
        break;
      }
    }
  }
  const labels = new Map(rows.flat().map(label => [label.key, label]));
  return {labels, rowCount: Math.max(rows.length, 1)};
}

// Plan callouts stack upward when their dots crowd; the dots keep their date.
export function layoutTimelineValues(
  points: TimelinePoint[],
  x: (index: number) => number,
  y: (percent: number) => number,
): Map<number, {x: number; y: number}> {
  const values = new Map<number, {x: number; y: number}>();
  points.forEach((point, index) => {
    if (point.kind !== 'plan') return;
    const cx = x(index);
    let cy = y(point.percent) - 12;
    while ([...values.values()].some(other => Math.abs(cx - other.x) < 40 && Math.abs(cy - other.y) < 18)) {
      cy -= 18;
    }
    values.set(index, {x: cx, y: cy});
  });
  return values;
}

// The first of every month strictly inside the timeline, as gridlines that
// make the stretch before the goal read as calendar time.
export function monthTicks(startDate: IsoDay, endDate: IsoDay): IsoDay[] {
  const start = Date.parse(startDate);
  const end = Date.parse(endDate);
  const ticks: IsoDay[] = [];
  const cursor = new Date(start);
  cursor.setUTCDate(1);
  cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  while (cursor.getTime() < end) {
    ticks.push(cursor.toISOString().slice(0, 10) as IsoDay);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return ticks;
}
