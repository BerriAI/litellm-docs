// Behaviour profiles for the simulator: how a deployment answers when traffic runs on simulated
// time. A profile lives in the playground, not in the proxy config. Shared by the simulator and the
// config editor; the simulator passes them to the core's simulation API.

export const ERROR_CLASSES = [
  {name: 'RateLimitError', status: 429, label: '429 rate limit'},
  {name: 'InternalServerError', status: 500, label: '500 internal'},
  {name: 'ServiceUnavailableError', status: 503, label: '503 unavailable'},
  {name: 'ContextWindowExceededError', status: 400, label: '400 context window'},
  {name: 'ContentPolicyViolationError', status: 400, label: '400 content policy'},
];

// error_rate is the share of attempts that fail; errors weighs the classes those failures take.
// rpm_cap and tpm_cap are the provider's own limits, past which it answers 429.
export const PROFILE_PRESETS = {
  healthy: {
    label: 'Healthy',
    p50_ms: 600,
    p95_ms: 1500,
    error_rate: 0.005,
    errors: {InternalServerError: 1},
    rpm_cap: null,
    tpm_cap: null,
  },
  flaky: {
    label: 'Flaky',
    p50_ms: 700,
    p95_ms: 2000,
    error_rate: 0.08,
    errors: {InternalServerError: 2, ServiceUnavailableError: 1},
    rpm_cap: null,
    tpm_cap: null,
  },
  slow: {
    label: 'Slow tail',
    p50_ms: 1400,
    p95_ms: 6000,
    error_rate: 0.01,
    errors: {InternalServerError: 1},
    rpm_cap: null,
    tpm_cap: null,
  },
  limited: {
    label: 'Rate-limited',
    p50_ms: 600,
    p95_ms: 1500,
    error_rate: 0.005,
    errors: {InternalServerError: 1},
    rpm_cap: 60,
    tpm_cap: null,
  },
  down: {
    label: 'Down',
    p50_ms: 50,
    p95_ms: 80,
    error_rate: 1,
    errors: {ServiceUnavailableError: 1},
    rpm_cap: null,
    tpm_cap: null,
  },
};

export const defaultProfile = () => ({preset: 'healthy', ...PROFILE_PRESETS.healthy});

export function profileSummary(profile) {
  if (!profile) return 'healthy';
  const parts = [`p50 ${(profile.p50_ms / 1000).toFixed(1)} s`, `${+(profile.error_rate * 100).toFixed(1)}% errors`];
  if (profile.rpm_cap) parts.push(`cap ${profile.rpm_cap} rpm`);
  return parts.join(' · ');
}
