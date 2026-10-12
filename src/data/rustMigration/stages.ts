interface Stage {
  id: string;
  label: string;
  description: string;
  switch?: {value: string; effect: string};
}

// Rollout stages in order, matching `Rollout` in litellm/rust_bridge/configuration.py.
// `switch` is the `LITELLM_RUST` value that flips a stage's default, for the
// two stages that honor it.
export const STAGES = [
  {id: 'pythonOnly', label: 'Python', description: 'Runs on Python.'},
  {
    id: 'rustOptIn',
    label: 'Opt-in',
    description: 'Python runs by default. Turn Rust on to try it, with Python as the fallback.',
    switch: {value: '1', effect: 'Run on Rust'},
  },
  {
    id: 'rustOptOut',
    label: 'Rust default',
    description: 'Rust runs by default, with Python as the fallback. Turn Rust off to stay on Python.',
    switch: {value: '0', effect: 'Stay on Python'},
  },
  {id: 'rustRequired', label: 'Rust only', description: 'Always runs on Rust. The Python path is gone and the switch has no effect.'},
] as const satisfies readonly Stage[];

export type StageId = (typeof STAGES)[number]['id'];
