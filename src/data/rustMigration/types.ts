import type {IsoDay} from './days';
import type {RcVersion} from './rollouts';
import type {StageKind} from './stages';

// The page model is a tree. Every node below a goal has a `weight` among its
// siblings, and its progress is the weighted mean of its children's, down to
// units, which score the stage they reached. `features` lists the units at or
// beneath a node.

// One move of a unit, where `stage` indexes STAGES and a finished task counts
// as the last stage.
export interface RolloutStep {
  version: RcVersion;
  stage: number;
}

export interface Feature {
  id: string;
  text: string;
  weight: number;
  // Display names from the area down to the unit, like `['OCR', 'Mistral']`.
  path: string[];
  task: boolean;
  children: [];
  features: Feature[];
  // What shipped, oldest first, and what the team plans next, kept apart so
  // views that know nothing of plans only ever see what shipped.
  rollout: RolloutStep[];
  plan: RolloutStep[];
  area: Area;
}

export interface Group {
  id: string;
  text: string;
  weight: number;
  children: (Feature | Group)[];
  features: Feature[];
}

// An area's `weight` is its points in the goal it sits under; areas.ts holds
// one shared copy of each area with a weight of 1.
export interface Area extends Group {
  groundwork: boolean;
}

export interface Goal {
  id: string;
  text: string;
  endsOn: IsoDay;
  summary?: string;
  // The sum of its areas' points.
  points: number;
  children: Area[];
  features: Feature[];
}

export interface Release {
  version: string;
  date: IsoDay;
}

// One area entering one stage together, like six OCR providers going Rust
// default. Finished tasks are their own change even beside units going Rust only.
export interface Change {
  key: string;
  area: Area;
  kind: StageKind;
  features: Feature[];
}

// A change as a goal's timeline describes it: the stage its units left when
// they all left the same one, and whether they are the whole of a real area.
export interface ChangeSummary extends Change {
  from: StageKind | null;
  wholeArea: boolean;
}

interface PointBase {
  version: string;
  date: IsoDay;
  // Unrounded, like progressAt.
  percent: number;
}

// One dot on a goal's timeline: a published release, the latest one, or a plan.
export type TimelinePoint =
  | (PointBase & {kind: 'release' | 'latest'})
  | (PointBase & {kind: 'plan'; label: string});
