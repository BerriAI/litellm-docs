import YAML, {isCollection, isMap, isScalar, isSeq, LineCounter} from 'yaml';

// The YAML text is the source of truth. The form reads plain values from it and writes back
// through these helpers, which patch one node of the parsed document so comments, key order and
// keys the form does not know survive. A scalar edit splices only that value's characters.

export const SETTINGS_KEYS = [
  'routing_strategy',
  'num_retries',
  'retry_after',
  'retry_policy',
  'timeout',
  'allowed_fails',
  'cooldown_time',
  'disable_cooldowns',
  'fallbacks',
  'context_window_fallbacks',
  'content_policy_fallbacks',
  'default_fallbacks',
  'max_fallbacks',
];

const PARAM_KEYS = ['model', 'weight', 'order', 'rpm', 'tpm', 'tags', 'mock_response'];
const INFO_KEYS = ['id', 'order'];
const SECTIONS = ['router_settings', 'litellm_settings'];

export function parseYaml(text) {
  const lineCounter = new LineCounter();
  const doc = YAML.parseDocument(text, {lineCounter, prettyErrors: false, uniqueKeys: false});
  if (doc.errors.length) {
    const first = doc.errors[0];
    const {line, col} = lineCounter.linePos(first.pos[0]);
    const message = first.message.split('\n')[0].replace(/ at line \d+, column \d+:?$/, '');
    return {doc, data: null, lineCounter, error: {line, col, message}};
  }
  const data = doc.toJS() ?? {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    return {doc, data: null, lineCounter, error: {line: 1, col: 1, message: 'The config needs to be a mapping.'}};
  }
  return {doc, data, lineCounter, error: null};
}

function formatOptions(text) {
  return {flowCollectionPadding: false, lineWidth: 0, indentSeq: !/^\S[^\n]*:\n- /m.test(text)};
}

function scalarText(node, value) {
  if (typeof value === 'string') {
    if (node.type === 'QUOTE_DOUBLE') return JSON.stringify(value);
    if (node.type === 'QUOTE_SINGLE') return `'${value.replace(/'/g, "''")}'`;
  }
  const text = YAML.stringify(value, {lineWidth: 0}).replace(/\n$/, '');
  return text.includes('\n') ? null : text;
}

const isPlain = value => value == null || ['string', 'number', 'boolean'].includes(typeof value);

// Writes `value` at `path`; undefined deletes it. Missing parents are created as block maps.
export function setIn(text, path, value) {
  const {doc, error} = parseYaml(text);
  if (error) return text;
  if (value === undefined) {
    if (!doc.hasIn(path)) return text;
    doc.deleteIn(path);
    return doc.toString(formatOptions(text));
  }
  const node = doc.getIn(path, true);
  if (isScalar(node) && isPlain(value) && value !== null && node.range) {
    const replacement = scalarText(node, value);
    if (replacement != null) {
      const [start, end] = node.range;
      return text.slice(0, start) + replacement + text.slice(end);
    }
  }
  const created = doc.createNode(value);
  if (isCollection(node) && isCollection(created) && node.flow) created.flow = true;
  if (isSeq(created) && created.items.every(isScalar) && !isCollection(node)) created.flow = true;
  doc.setIn(path, created);
  return doc.toString(formatOptions(text));
}

export function appendIn(text, path, value) {
  const {doc, error} = parseYaml(text);
  if (error) return text;
  const created = doc.createNode(value);
  flowLeaves(created);
  const seq = doc.getIn(path, true);
  if (isSeq(seq)) seq.items.push(created);
  else doc.setIn(path, doc.createNode([created]));
  return doc.toString(formatOptions(text));
}

function flowLeaves(node) {
  if (isSeq(node) && node.items.every(isScalar)) node.flow = true;
  else if (isCollection(node)) node.items.forEach(item => flowLeaves(isMap(node) ? item.value : item));
}

// Where a router setting lives: the core reads top-level keys, then litellm_settings, then
// router_settings, the later winning. A new key goes into router_settings.
export function settingPaths(data, key) {
  const found = [];
  if (data && key in data) found.push([key]);
  for (const section of [...SECTIONS].reverse()) {
    if (data?.[section] && typeof data[section] === 'object' && key in data[section]) found.push([section, key]);
  }
  return found;
}

export function settingValue(data, key) {
  for (const section of SECTIONS) {
    const block = data?.[section];
    if (block && typeof block === 'object' && key in block) return block[key];
  }
  return data?.[key];
}

export function setSetting(text, data, key, value) {
  const paths = settingPaths(data, key);
  if (value === undefined) return paths.reduce((next, path) => setIn(next, path, undefined), text);
  const target = paths.length ? paths[paths.length - 1] : ['router_settings', key];
  return setIn(text, target, value);
}

// A fallback map as the form edits it: keyed entries in order. Other entries stay as written.
export function fallbackEntries(data, key) {
  const list = settingValue(data, key);
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const [from] = Object.keys(entry);
    if (from == null) return [];
    const targets = Array.isArray(entry[from]) ? entry[from].filter(item => typeof item === 'string') : [];
    return [{from, to: targets, index}];
  });
}

export function setFallbacks(text, data, key, from, targets) {
  if (key === 'default_fallbacks') return setSetting(text, data, key, targets.length ? targets : undefined);
  const paths = settingPaths(data, key);
  const path = paths.length ? paths[paths.length - 1] : ['router_settings', key];
  const list = settingValue(data, key);
  const entry = fallbackEntries(data, key).find(item => item.from === from);
  if (entry) {
    if (targets.length) return setIn(text, [...path, entry.index, from], targets);
    const remaining = Array.isArray(list) ? list.length - 1 : 0;
    return setIn(text, remaining ? [...path, entry.index] : path, undefined);
  }
  if (!targets.length) return text;
  return appendIn(text, path, {[from]: targets});
}

export function deploymentValue(entry, field) {
  if (field === 'id') return entry?.model_info?.id;
  if (field === 'model_name') return entry?.model_name;
  if (field === 'order' && entry?.litellm_params?.order == null && entry?.model_info?.order != null) {
    return entry.model_info.order;
  }
  return entry?.litellm_params?.[field];
}

export function deploymentPath(entry, index, field) {
  if (field === 'id') return ['model_list', index, 'model_info', 'id'];
  if (field === 'model_name') return ['model_list', index, 'model_name'];
  if (field === 'order' && entry?.litellm_params?.order == null && entry?.model_info?.order != null) {
    return ['model_list', index, 'model_info', 'order'];
  }
  return ['model_list', index, 'litellm_params', field];
}

const short = value => {
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.length > 48 ? `${text.slice(0, 45)}...` : text;
};

// Keys the form does not edit, with the 1-based lines they span, so both views can mark them.
export function keptKeys(doc, lineCounter) {
  const kept = [];
  const lines = pair => {
    const start = pair.key?.range?.[0];
    const end = pair.value?.range?.[1] ?? pair.key?.range?.[1];
    if (start == null) return [];
    const first = lineCounter.linePos(start).line;
    let last = lineCounter.linePos(Math.max(start, end - 1)).line;
    if (last < first) last = first;
    return Array.from({length: last - first + 1}, (_, i) => first + i);
  };
  const add = (label, pair) =>
    kept.push({label, value: short(pair.value?.toJSON?.() ?? pair.value), lines: lines(pair)});
  const root = doc.contents;
  if (!isMap(root)) return kept;
  for (const pair of root.items) {
    const key = String(pair.key?.value ?? pair.key);
    if (key === 'model_list' && isSeq(pair.value)) {
      const grouped = {};
      pair.value.items.forEach(item => {
        if (!isMap(item)) return;
        for (const inner of item.items) {
          const name = String(inner.key?.value);
          const known =
            name === 'model_name'
              ? null
              : name === 'litellm_params'
                ? PARAM_KEYS
                : name === 'model_info'
                  ? INFO_KEYS
                  : [];
          if (known === null) continue;
          if (!isMap(inner.value) || !known.length) {
            (grouped[name] ??= []).push(inner);
            continue;
          }
          for (const leaf of inner.value.items) {
            const leafName = String(leaf.key?.value);
            if (!known.includes(leafName)) (grouped[`${name}.${leafName}`] ??= []).push(leaf);
          }
        }
      });
      for (const [name, pairs] of Object.entries(grouped)) {
        kept.push({
          label: name,
          value:
            pairs.length === 1 ? short(pairs[0].value?.toJSON?.() ?? pairs[0].value) : `on ${pairs.length} deployments`,
          lines: pairs.flatMap(lines),
        });
      }
    } else if (SECTIONS.includes(key) && isMap(pair.value)) {
      for (const inner of pair.value.items) {
        if (!SETTINGS_KEYS.includes(String(inner.key?.value))) add(String(inner.key?.value), inner);
      }
    } else if (key !== 'model_list' && !SETTINGS_KEYS.includes(key)) {
      add(key, pair);
    }
  }
  return kept;
}

// The 1-based lines that differ between two texts, counted in `after`.
export function changedLines(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) {
    tail += 1;
  }
  return Array.from({length: Math.max(0, b.length - tail - head)}, (_, i) => head + i + 1);
}

// How one router setting reads in the YAML, for previews.
export function snippet(key, value) {
  const doc = new YAML.Document({router_settings: {[key]: value ?? []}});
  flowLeaves(doc.contents);
  return doc.toString({flowCollectionPadding: false, lineWidth: 0});
}
