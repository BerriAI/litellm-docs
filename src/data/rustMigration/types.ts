import type {RcVersion} from './rollouts';

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
  endsOn: string;
  summary?: string;
  // The sum of its areas' points.
  points: number;
  children: Area[];
  features: Feature[];
}

export interface Release {
  version: string;
  date: string;
}

// One area entering one stage together, like six OCR providers going Rust default.
export interface Change {
  key: string;
  area: Area;
  stage: number;
  features: Feature[];
}
