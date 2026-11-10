import {deploymentValue, fallbackEntries, settingValue} from './configDoc';

// Checks drawn on the form, limited to what the router core really does, written as what will
// happen. Nothing here blocks the config; only YAML that does not parse does.

export const FALLBACK_MAPS = [
  {key: 'fallbacks', label: 'generic', tab: 'fallbacks · generic'},
  {key: 'context_window_fallbacks', label: 'context window', tab: 'context_window_fallbacks'},
  {key: 'content_policy_fallbacks', label: 'content policy', tab: 'content_policy_fallbacks'},
  {key: 'default_fallbacks', label: 'default', tab: 'default_fallbacks'},
];

export const PYTHON_STRATEGIES = ['least-busy', 'usage-based-routing-v2', 'latency-based-routing'];

const hasOrder = entry => deploymentValue(entry, 'order') != null;

export function groupsOf(data) {
  const groups = new Map();
  (Array.isArray(data?.model_list) ? data.model_list : []).forEach((entry, index) => {
    const name = entry?.model_name == null ? '' : String(entry.model_name);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({entry: entry ?? {}, index});
  });
  return groups;
}

export function fallbackTargets(data, key) {
  if (key === 'default_fallbacks') {
    const list = settingValue(data, key);
    return Array.isArray(list) ? [{from: '*', to: list.filter(item => typeof item === 'string')}] : [];
  }
  return fallbackEntries(data, key);
}

export function validate(data) {
  const issues = [];
  if (!data) return issues;
  const groups = groupsOf(data);

  for (const [group, members] of groups) {
    const ordered = members.filter(member => hasOrder(member.entry));
    if (!ordered.length || ordered.length === members.length) continue;
    const next = Math.max(...ordered.map(member => Number(deploymentValue(member.entry, 'order')) || 0)) + 1;
    for (const member of members.filter(item => !hasOrder(item.entry))) {
      const id = deploymentValue(member.entry, 'id') ?? `deployment ${member.index + 1}`;
      issues.push({
        level: 'warn',
        group,
        index: member.index,
        field: 'order',
        id,
        next,
        message: `Other deployments in ${group} set order, and the router keeps only the lowest tier among healthy candidates. ${id} has no order, so it is skipped while any of them is healthy.`,
      });
    }
  }

  const seen = new Map();
  (data.model_list ?? []).forEach((entry, index) => {
    const id = deploymentValue(entry, 'id');
    if (id == null) return;
    if (seen.has(String(id))) {
      issues.push({
        level: 'err',
        group: entry?.model_name,
        index,
        field: 'id',
        id,
        message: `Another deployment already has id ${id}. The router tracks cooldowns and usage by id, so the two share them, and a behaviour profile applies to both.`,
      });
    } else {
      seen.set(String(id), index);
    }
    if (!entry?.litellm_params?.model) {
      issues.push({
        level: 'err',
        group: entry?.model_name,
        index,
        field: 'model',
        id,
        message: `${id} has no litellm_params.model, so the router cannot build it.`,
      });
    }
  });

  for (const map of FALLBACK_MAPS) {
    for (const {from, to} of fallbackTargets(data, map.key)) {
      const missing = to.filter(target => !groups.has(target));
      if (!missing.length) continue;
      const names = missing.join(' or ');
      issues.push({
        level: 'err',
        map: map.key,
        from,
        targets: missing,
        message: `No model group is named ${names}. Requests that fall back to ${missing.length > 1 ? 'them' : 'it'} will fail at that hop. Pick an existing group or add one.`,
      });
    }
  }

  const strategy = settingValue(data, 'routing_strategy');
  if (strategy != null && strategy !== 'simple-shuffle') {
    issues.push({
      level: 'info',
      setting: 'routing_strategy',
      message: `The config asks for ${strategy}. It still runs in Python, so the playground runs nothing until it is changed to simple-shuffle.`,
    });
  }
  return issues;
}

// simple-shuffle's split inside one order tier: weight, else rpm, else tpm, else even.
export function shares(members) {
  const tiers = new Map();
  const anyOrder = members.some(member => hasOrder(member.entry));
  for (const member of members) {
    const tier = anyOrder ? (hasOrder(member.entry) ? Number(deploymentValue(member.entry, 'order')) : null) : 0;
    if (tier == null) continue;
    if (!tiers.has(tier)) tiers.set(tier, []);
    tiers.get(tier).push(member);
  }
  const result = {};
  let metric = null;
  for (const tier of tiers.values()) {
    const by = ['weight', 'rpm', 'tpm'].find(key =>
      tier.some(member => Number(member.entry?.litellm_params?.[key]) > 0),
    );
    metric = metric ?? by ?? null;
    const values = tier.map(member => (by ? Math.max(0, Number(member.entry.litellm_params[by]) || 0) : 1));
    const total = values.reduce((sum, value) => sum + value, 0) || 1;
    tier.forEach((member, i) => {
      result[member.index] = values[i] / total;
    });
  }
  return {shares: result, metric, ordered: anyOrder};
}
