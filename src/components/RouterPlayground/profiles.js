// Behaviour profiles for the simulator: how a deployment answers when traffic runs on simulated
// time. A profile lives in the playground, not in the proxy config. Shared by the simulator and the
// config editor; the simulator passes them to the core's simulation API.

export const ERROR_CLASSES = [
  {name: 'RateLimitError', status: 429, label: '429 rate limit', color: '#c2410c'},
  {name: 'InternalServerError', status: 500, label: '500 internal', color: '#b91c1c'},
  {name: 'ServiceUnavailableError', status: 503, label: '503 unavailable', color: '#7f1d1d'},
  {name: 'ContextWindowExceededError', status: 400, label: '400 context window', color: '#6d28d9'},
  {name: 'ContentPolicyViolationError', status: 400, label: '400 content policy', color: '#0f766e'},
];

// error_rate is the share of attempts that fail; errors weighs the classes those failures take.
// rpm_cap and tpm_cap are the provider's own limits, past which it answers 429; tokens is what one
// request uses toward tpm_cap.
export const PROFILE_PRESETS = {
  healthy: {
    label: 'Healthy',
    p50_ms: 600,
    p95_ms: 1500,
    error_rate: 0.005,
    errors: {InternalServerError: 1},
    rpm_cap: null,
    tpm_cap: null,
    tokens: 1000,
  },
  flaky: {
    label: 'Flaky',
    p50_ms: 700,
    p95_ms: 2000,
    error_rate: 0.08,
    errors: {InternalServerError: 2, ServiceUnavailableError: 1},
    rpm_cap: null,
    tpm_cap: null,
    tokens: 1000,
  },
  slow: {
    label: 'Slow tail',
    p50_ms: 1400,
    p95_ms: 6000,
    error_rate: 0.01,
    errors: {InternalServerError: 1},
    rpm_cap: null,
    tpm_cap: null,
    tokens: 1000,
  },
  limited: {
    label: 'Rate-limited',
    p50_ms: 600,
    p95_ms: 1500,
    error_rate: 0.005,
    errors: {InternalServerError: 1},
    rpm_cap: 60,
    tpm_cap: null,
    tokens: 1000,
  },
  down: {
    label: 'Down',
    p50_ms: 50,
    p95_ms: 80,
    error_rate: 1,
    errors: {ServiceUnavailableError: 1},
    rpm_cap: null,
    tpm_cap: null,
    tokens: 1000,
  },
};

export function presetProfile(name) {
  const {label, ...profile} = PROFILE_PRESETS[name];
  return {preset: name, ...profile, errors: {...profile.errors}};
}

export const defaultProfile = () => presetProfile('healthy');

export const profileLabel = profile => PROFILE_PRESETS[profile?.preset]?.label ?? (profile ? 'Custom' : 'Healthy');

const secondsText = ms => (ms < 1000 ? `${Math.round(ms)} ms` : `${+(ms / 1000).toFixed(1)} s`);

export function profileSummary(profile) {
  if (!profile) return 'healthy';
  const parts = [
    `p50 ${secondsText(profile.p50_ms)}`,
    `p95 ${secondsText(profile.p95_ms)}`,
    `${+(profile.error_rate * 100).toFixed(1)}% errors`,
  ];
  if (profile.rpm_cap) parts.push(`cap ${profile.rpm_cap} rpm`);
  if (profile.tpm_cap) parts.push(`cap ${profile.tpm_cap} tpm`);
  return parts.join(' · ');
}
