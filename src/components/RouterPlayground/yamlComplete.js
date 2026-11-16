import {ERROR_CLASSES} from './profiles';
import {FALLBACK_MAPS} from './validate';

// Autocomplete for the config YAML. It reads where the caret sits (which keys it is nested under
// and whether it is on a key or a value) and offers what fits there. router_settings keys come
// from the router core's own config types (`Playground.configFields()`), so they match what the
// core reads. Deployment keys are the ones LitellmParams and ModelInfo name in the core; serde's
// flatten hides those from the same trick, so they are listed here.

const TOP = ['model_list', 'router_settings', 'litellm_settings', 'general_settings', 'teams'];
const TEAM = ['team_id', 'router_settings'];
const ENTRY = ['model_name', 'litellm_params', 'model_info'];
const LITELLM_PARAMS = [
  'model',
  'mock_response',
  'weight',
  'order',
  'rpm',
  'tpm',
  'timeout',
  'stream_timeout',
  'max_retries',
  'api_key',
  'api_base',
  'api_version',
  'custom_llm_provider',
  'tags',
  'tag_regex',
  'max_parallel_requests',
  'organization',
  'drop_params',
  'itpm',
  'otpm',
];
const MODEL_INFO = [
  'id',
  'base_model',
  'mode',
  'max_input_tokens',
  'team_id',
  'team_public_model_name',
  'access_groups',
  'cooldown_time',
  'allowed_fails',
  'allowed_fails_policy',
];
const BOOLEAN = new Set([
  'disable_cooldowns',
  'enable_pre_call_checks',
  'enable_health_check_routing',
  'enable_weighted_failover',
  'drop_params',
  'fallback_on_unsupported_params',
]);
const NESTED = new Set([
  'model_list',
  'teams',
  'router_settings',
  'litellm_settings',
  'general_settings',
  'litellm_params',
  'model_info',
  'retry_policy',
  'allowed_fails_policy',
  'model_group_retry_policy',
  'model_alias_map',
  'model_group_alias',
  ...FALLBACK_MAPS.map(map => map.key),
]);
const LISTS = new Set(['model_list', 'teams', ...FALLBACK_MAPS.map(map => map.key)]);
const RETRY_KEYS = [
  'BadRequestErrorRetries',
  'AuthenticationErrorRetries',
  'TimeoutErrorRetries',
  'RateLimitErrorRetries',
  'ContentPolicyViolationErrorRetries',
  'InternalServerErrorRetries',
];

// Where a key on this line starts: past its indent and any list dashes.
const indentOf = line => line.match(/^(\s*(?:-\s+)*)/)[1].length;

// The keys the caret line is nested under, outermost first.
function pathAt(lines, row) {
  const path = [];
  let indent = indentOf(lines[row]);
  for (let i = row - 1; i >= 0 && indent > 0; i -= 1) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const at = indentOf(line);
    if (at >= indent) continue;
    const key = line.slice(at).match(/^([^\s:#][^:#]*?)\s*:\s*(#.*)?$/);
    if (key) path.unshift(key[1]);
    indent = at;
  }
  return path;
}

function keysFor(path, ctx) {
  const last = path.at(-1);
  if (!path.length) return TOP;
  if (last === 'router_settings') return ctx.settings;
  if (last === 'model_list') return ENTRY;
  if (last === 'teams') return TEAM;
  if (last === 'litellm_params') return LITELLM_PARAMS;
  if (last === 'model_info') return MODEL_INFO;
  if (last === 'retry_policy' || path.at(-2) === 'model_group_retry_policy') return RETRY_KEYS;
  if (FALLBACK_MAPS.some(map => map.key === last) || last === 'model_group_retry_policy') return ctx.groups;
  return [];
}

function valuesFor(key, ctx) {
  if (key === 'routing_strategy') return ['simple-shuffle'];
  if (BOOLEAN.has(key)) return ['true', 'false'];
  if (key === 'model_name') return ctx.groups;
  if (key === 'mock_response') return ERROR_CLASSES.map(error => `litellm.${error.name}`);
  if (key === 'default_fallbacks') return ctx.groups.map(group => `[${group}]`);
  return [];
}

// What to offer at `caret` in `text`: `{from, to, row, column, items: [{label, insert, detail}]}`,
// or null. `force` (Ctrl+Space) offers even before a letter is typed.
export function complete(text, caret, ctx, force = false) {
  const before = text.slice(0, caret);
  const row = before.split('\n').length - 1;
  const lines = text.split('\n');
  const line = lines[row];
  const start = before.lastIndexOf('\n') + 1;
  const column = caret - start;
  const head = line.slice(0, column);
  const word = head.match(/[\w.\-/]*$/)[0];
  if (!word && !force) return null;
  const from = caret - word.length;
  const tail = line.slice(column).match(/^[\w.\-/]*/)[0];
  const to = caret + tail.length;
  const prefix = head.slice(0, head.length - word.length);
  const lower = word.toLowerCase();
  const matches = list =>
    list
      .filter(item => item.toLowerCase().includes(lower) && item !== word)
      .sort((a, b) => Number(!a.toLowerCase().startsWith(lower)) - Number(!b.toLowerCase().startsWith(lower)));

  let items = [];
  const keyed = prefix.match(/^\s*(?:-\s+)*([^\s:#][^:#]*?)\s*:\s*(\[[^\]]*)?$/);
  if (/^\s*(?:-\s+)*$/.test(prefix)) {
    const path = pathAt(lines, row);
    const last = path.at(-1);
    const inFallbacks = FALLBACK_MAPS.some(map => map.key === last) && last !== 'default_fallbacks';
    items = matches(keysFor(path, ctx)).map(key => ({
      label: key,
      insert: inFallbacks ? `${key}: [` : NESTED.has(key) ? `${key}:\n${' '.repeat(indentOf(line) + 2)}${LISTS.has(key) ? '- ' : ''}` : `${key}: `,
      detail: last === 'router_settings' ? 'router core' : inFallbacks ? 'model group' : '',
    }));
  } else if (keyed && keyed[2] != null) {
    // Inside a fallback chain's brackets: model groups.
    items = matches(ctx.groups).map(group => ({label: group, insert: group, detail: 'model group'}));
  } else if (keyed) {
    items = matches(valuesFor(keyed[1], ctx)).map(value => ({label: value, insert: value, detail: ''}));
  }
  if (!items.length) return null;
  return {from, to, row, column: column - word.length, items: items.slice(0, 12)};
}
