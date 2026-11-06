// The traffic mix the simulator sends: kinds of request, each with a share of arrivals and the
// fields the router core reads from a request. Shared by the live run, scenarios and presets.

export const MOCKS = [
  {value: '', label: 'none'},
  {value: 'mock_testing_fallbacks', label: 'fallbacks (500)'},
  {value: 'mock_testing_context_fallbacks', label: 'context window (400)'},
  {value: 'mock_testing_content_policy_fallbacks', label: 'content policy (400)'},
  {value: 'mock_testing_rate_limit_error', label: 'rate limit (429)'},
];

let counter = 0;

export function newKind(fields = {}) {
  counter += 1;
  return {
    key: `kind-${Date.now().toString(36)}-${counter}`,
    label: 'chat',
    share: 1,
    model: '',
    sessions: 0,
    team_id: '',
    tokens: null,
    num_retries: null,
    disable_fallbacks: false,
    mock: '',
    metadata: '',
    ...fields,
  };
}

export const defaultKinds = () => [newKind({label: 'chat'})];

// Extra metadata as the editor holds it: JSON text, which may not parse yet.
export function metadataOf(kind) {
  if (!kind.metadata?.trim()) return {ok: true, value: null};
  try {
    const value = JSON.parse(kind.metadata);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {ok: false, error: 'metadata must be a JSON object'};
    return {ok: true, value};
  } catch (error) {
    return {ok: false, error: String(error.message ?? error)};
  }
}

// One kind's request body as the router sees it, before the core adds a session id.
export function kindBody(kind, model) {
  const body = {model: kind.model || model};
  if (kind.team_id) body.team_id = kind.team_id;
  if (kind.num_retries != null && kind.num_retries !== '') body.num_retries = Number(kind.num_retries);
  if (kind.disable_fallbacks) body.disable_fallbacks = true;
  if (kind.mock) body[kind.mock] = true;
  const metadata = metadataOf(kind);
  if (metadata.ok && metadata.value) body.metadata = metadata.value;
  return body;
}

// The mix as the core's spec takes it.
export function coreRequests(kinds, model) {
  return (kinds ?? [])
    .filter(kind => Number(kind.share) > 0)
    .map(kind => ({
      label: kind.label || 'request',
      weight: Number(kind.share),
      body: kindBody(kind, model),
      sessions: Math.max(0, Math.round(Number(kind.sessions) || 0)),
      ...(kind.tokens ? {tokens: Number(kind.tokens)} : {}),
    }));
}

// Requests per second that reach one model group, out of `rate` overall.
export function groupRate(kinds, model, group, rate) {
  const mix = coreRequests(kinds, model);
  if (!mix.length) return group === model ? rate : 0;
  const total = mix.reduce((sum, kind) => sum + kind.weight, 0) || 1;
  return (rate * mix.filter(kind => kind.body.model === group).reduce((sum, kind) => sum + kind.weight, 0)) / total;
}

// The models the mix sends to, for the warning when none of them is served.
export const mixModels = (kinds, model) => [...new Set(coreRequests(kinds, model).map(kind => kind.body.model))];

// Requests per minute a deployment normally gets, for "capacity to a fifth" when it has no cap.
// `rate` is what reaches its model group, per second.
export function expectedRpm(info, id, rate) {
  const deployment = info.deployments.find(item => item.id === id);
  const group = info.deployments.filter(item => item.model_name === deployment?.model_name);
  const weight = item => item.weight ?? 1;
  const total = group.reduce((sum, item) => sum + weight(item), 0) || 1;
  return rate * 60 * (deployment ? weight(deployment) / total : 1);
}
