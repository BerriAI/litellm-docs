import type {RcVersion} from './rollouts';

// The page model is a tree of nodes with `text` and `children`. `features`
// lists the units at or beneath a node, which are all that count toward its
// progress. A unit's `rollout` holds `{version, stage}` steps, oldest first,
// where `stage` indexes STAGES and a finished task counts as the last stage.

export interface RolloutStep {
  version: RcVersion;
  stage: number;
}

export interface Feature {
  id: string;
  text: string;
  // Display names from the area down to the unit, like `['OCR', 'Mistral']`.
  path: string[];
  task: boolean;
  children: [];
  features: Feature[];
  rollout: RolloutStep[];
  area: Area;
}

export interface Group {
  id: string;
  text: string;
  children: (Feature | Group)[];
  features: Feature[];
}

export interface Area extends Group {
  groundwork: boolean;
}

export interface Goal {
  id: string;
  text: string;
  endsOn: string;
  summary?: string;
  children: Area[];
  features: Feature[];
}

export interface Release {
  version: string;
  date: string;
  isMain: boolean;
}

// One area entering one stage together, like six OCR providers going Rust default.
export interface Change {
  key: string;
  area: Area;
  stage: number;
  features: Feature[];
}
