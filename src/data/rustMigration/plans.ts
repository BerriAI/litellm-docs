import type {RcVersion, Rollout} from './rollouts';

export interface Plan {
  version: RcVersion;
  date: string;
  label: string;
  summary: string;
  rollout: Rollout;
}

// What the team expects the next releases to move, shaped like a ROLLOUTS
// entry. The timeline draws each plan as a grey dot past the last published
// release. Once a planned RC is published the build fails, so move what
// actually shipped into ROLLOUTS and drop the plan here.
export const PLANS: Plan[] = [
  {
    version: 'v1.107.0-rc.1',
    date: '2026-10-17',
    label: 'This week',
    summary: 'Native Messages and Responses, opt-in',
    rollout: {
      rustOptIn: {
        messages: '*',
        responses: '*',
      },
    },
  },
  {
    version: 'v1.108.0-rc.1',
    date: '2026-10-24',
    label: 'Next week',
    summary: 'Messages on Rust by default, with perf work, a published benchmark, and a test harness in CI',
    rollout: {
      rustOptOut: {
        messages: '*',
      },
      done: {
        performance: '*',
        testing: '*',
      },
    },
  },
];
