interface Stage {
  id: string;
  label: string;
  score: number;
  description: string;
  switch?: {value: string; effect: string};
}

// Rollout stages in order, matching `Rollout` in litellm/rust_bridge/configuration.py.
// `score` is what a unit at that stage counts toward progress: nothing until
// someone can turn it on, 0.8 once they can, and the last 0.2 once it runs by
// default. A finished task scores 1. `switch` is the `LITELLM_RUST` value that
// flips a stage's default, for the two stages that honor it.
export const STAGES = [
  {id: 'pythonOnly', label: 'Python', score: 0, description: 'Runs on Python.'},
  {
    id: 'rustOptIn',
    label: 'Opt-in',
    score: 0.8,
    description: 'Python runs by default. Turn Rust on to try it, with Python as the fallback.',
    switch: {value: '1', effect: 'Run on Rust'},
  },
  {
    id: 'rustOptOut',
    label: 'Rust default',
    score: 1,
    description: 'Rust runs by default, with Python as the fallback. Turn Rust off to stay on Python.',
    switch: {value: '0', effect: 'Stay on Python'},
  },
  {id: 'rustRequired', label: 'Rust only', score: 1, description: 'Always runs on Rust. The Python path is gone and the switch has no effect.'},
] as const satisfies readonly Stage[];

export type StageId = (typeof STAGES)[number]['id'];

// A stage as it reads: its id, or `done` for a finished task, which counts as
// the last stage but has no rollout of its own.
export type StageKind = StageId | 'done';

export const kindOf = (feature: {task: boolean}, stage: number): StageKind => (feature.task ? 'done' : STAGES[stage].id);

export const labelOf = (kind: StageKind): string => (kind === 'done' ? 'Done' : STAGES.find(stage => stage.id === kind)!.label);
