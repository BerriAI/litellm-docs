// A small JSON Schema validator for MCP tool inputs. It supports only the
// keywords the tools use, and a tool schema with any other keyword fails
// loudly at startup (see assertSupported), so a schema can never look
// stricter than what is enforced.

const KEYWORDS = new Set(['type', 'properties', 'required', 'additionalProperties', 'enum', 'minLength', 'maxLength',
  'pattern', 'minimum', 'maximum', 'items', 'maxItems', 'minItems', 'default', 'description', 'title']);

function assertSupported(schema, where = 'schema') {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new Error(`${where} must be an object`);
  for (const key of Object.keys(schema)) {
    if (!KEYWORDS.has(key)) throw new Error(`${where} uses unsupported keyword "${key}"`);
  }
  if (schema.type === 'object') {
    if (schema.additionalProperties !== false) throw new Error(`${where} must set additionalProperties: false`);
    for (const [name, child] of Object.entries(schema.properties || {})) assertSupported(child, `${where}.${name}`);
  }
  if (schema.items) assertSupported(schema.items, `${where}[]`);
}

const typeOf = (value) => {
  if (Array.isArray(value)) return 'array';
  if (value === null) return 'null';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
};
const article = (type) => (/^[aeiou]/.test(type) ? `an ${type}` : `a ${type}`);
const patterns = new Map();
const compiled = (pattern) => {
  if (!patterns.has(pattern)) patterns.set(pattern, new RegExp(pattern, 'u'));
  return patterns.get(pattern);
};
const matchesType = (type, value) => {
  const actual = typeOf(value);
  return type === actual || (type === 'number' && actual === 'integer');
};

// Returns {value} with defaults filled in, or {error} naming the first problem.
function validate(schema, value, path = 'arguments') {
  if (schema.type && !matchesType(schema.type, value)) return {error: `${path} must be ${article(schema.type)}`};
  if (schema.enum && !schema.enum.includes(value)) return {error: `${path} must be one of: ${schema.enum.join(', ')}`};
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) return {error: `${path} must be at least ${schema.minLength} characters`};
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return {error: `${path} must be at most ${schema.maxLength} characters`};
    if (schema.pattern && !compiled(schema.pattern).test(value)) return {error: `${path} has characters that are not allowed`};
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return {error: `${path} must be a finite number`};
    if (schema.minimum !== undefined && value < schema.minimum) return {error: `${path} must be at least ${schema.minimum}`};
    if (schema.maximum !== undefined && value > schema.maximum) return {error: `${path} must be at most ${schema.maximum}`};
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) return {error: `${path} needs at least ${schema.minItems} items`};
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return {error: `${path} takes at most ${schema.maxItems} items`};
    const items = [];
    for (let i = 0; i < value.length; i++) {
      const result = schema.items ? validate(schema.items, value[i], `${path}[${i}]`) : {value: value[i]};
      if (result.error) return result;
      items.push(result.value);
    }
    return {value: items};
  }
  if (schema.type === 'object') {
    const properties = schema.properties || {};
    const out = {};
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(properties, key)) return {error: `${path} has an unknown field "${key}"`};
    }
    for (const name of schema.required || []) {
      if (!Object.hasOwn(value, name)) return {error: `${path}.${name} is required`};
    }
    for (const [name, child] of Object.entries(properties)) {
      if (Object.hasOwn(value, name) && value[name] !== undefined) {
        const result = validate(child, value[name], `${path}.${name}`);
        if (result.error) return result;
        out[name] = result.value;
      } else if (child.default !== undefined) {
        out[name] = child.default;
      }
    }
    return {value: out};
  }
  return {value};
}

module.exports = {validate, assertSupported};
