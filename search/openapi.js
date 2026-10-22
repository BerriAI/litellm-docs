const methods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

function resolveReference(spec, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Search requires a bundled OpenAPI reference: ${ref}`);
  const parts = decodeURIComponent(ref.slice(2)).split('/').map(part => part.replace(/~1/g, '/').replace(/~0/g, '~'));
  let value = spec;
  for (const part of parts) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, part)) throw new Error(`Missing OpenAPI reference: ${ref}`);
    value = value[part];
  }
  return value;
}

function dereference(spec, value, seen = new Set()) {
  if (!value?.$ref) return value;
  if (seen.has(value.$ref)) throw new Error(`Circular OpenAPI object reference: ${value.$ref}`);
  seen.add(value.$ref);
  const {$ref, ...siblings} = value;
  return {...dereference(spec, resolveReference(spec, $ref), seen), ...siblings};
}

// Keep each reachable definition once per operation. Recursive schemas retain
// their references without infinite expansion, depth limits, or lost fields.
function referencedDefinitions(spec, value) {
  const definitions = new Map();
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (typeof node.$ref === 'string' && !definitions.has(node.$ref)) {
      const definition = resolveReference(spec, node.$ref);
      definitions.set(node.$ref, definition);
      visit(definition);
    }
    Object.values(node).forEach(visit);
  }
  visit(value);
  return definitions;
}

function operationStructure(sections) {
  const first = sections[0];
  const headings = [...new Set(sections.map(section => section.heading))];
  return {title: first.title, metadata: {description: first.description},
    breadcrumbs: first.breadcrumb.split(' / '),
    outline: headings.map(title => ({level: 2, title, id: ''})), contents: headings};
}

function extractOpenAPI(spec) {
  if (!/^3\./.test(spec.openapi) || !spec.paths || typeof spec.paths !== 'object') throw new Error('Search requires an OpenAPI 3 document with paths');
  const documents = [], structure = {};
  for (const [path, rawItem] of Object.entries(spec.paths).sort(([a], [b]) => a.localeCompare(b))) {
    const item = dereference(spec, rawItem);
    for (const [method, operation] of Object.entries(item)) {
      if (!methods.has(method)) continue;
      if (!operation.operationId) throw new Error(`Missing OpenAPI operationId: ${method} ${path}`);
      const tag = operation.tags?.[0] || 'default';
      const url = `/api-reference/#/${encodeURIComponent(tag)}/${encodeURIComponent(operation.operationId)}`;
      if (structure[url]) throw new Error(`Duplicate OpenAPI operation URL: ${url}`);
      const title = `${method.toUpperCase()} ${path}`;
      const summary = operation.summary || title;
      const description = operation.description || summary;
      // Operation parameters override path-level parameters with the same name/location.
      const parameters = new Map();
      for (const raw of [...(item.parameters || []), ...(operation.parameters || [])]) {
        const parameter = dereference(spec, raw);
        parameters.set(`${parameter.in}:${parameter.name}`, parameter);
      }
      const security = operation.security ?? spec.security;
      const securitySchemes = {};
      for (const requirement of security || []) for (const name of Object.keys(requirement)) {
        if (!Object.hasOwn(spec.components?.securitySchemes || {}, name)) throw new Error(`Missing OpenAPI security scheme: ${name}`);
        securitySchemes[name] = spec.components.securitySchemes[name];
      }
      const {summary: _summary, description: _description, parameters: _parameters, requestBody, responses, ...details} = operation;
      const sections = [];
      const add = (heading, value) => {
        if (value === undefined) return;
        const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
        // Match guide passage sizes; read_docs reconstructs all chunks of this operation.
        for (let offset = 0; offset < text.length; offset += 2600) {
          const chunk = text.slice(offset, offset + 3000);
          sections.push({id: `${url}:${sections.length}`, url, title, heading, description: summary,
            keywords: [summary, ...(operation.tags || [])].join(' '),
            breadcrumb: `API reference / ${tag}`, category: 'API reference', type: 'docs', date: '', version: '',
            text: chunk, snippet: chunk.replace(/\s+/g, ' ').slice(0, 240)});
          if (offset + 3000 >= text.length) break;
        }
      };
      const effective = {...details, parameters: [...parameters.values()], requestBody, responses,
        security, securitySchemes, servers: operation.servers ?? item.servers ?? spec.servers};
      add(summary, [title, summary, item.summary, item.description, description].filter(Boolean).join('\n\n'));
      if (parameters.size) add('Parameters', effective.parameters);
      add('Request body', requestBody);
      add('Responses', responses);
      const {parameters: _effectiveParameters, requestBody: _body, responses: _responses, ...metadata} = effective;
      add('Operation details and authentication', metadata);
      for (const [ref, definition] of referencedDefinitions(spec, effective)) add(`Definition ${ref}`, definition);
      documents.push(...sections);
      structure[url] = operationStructure(sections);
    }
  }
  return {documents, structure};
}

module.exports = {extractOpenAPI, operationStructure};
