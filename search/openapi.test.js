const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {extractOpenAPI} = require('./openapi');
const {contentPage} = require('./content');
const {createIndex, loadIndex, search} = require('./engine');
const {createDocumentationTools} = require('./tools');
const {createReranker} = require('./rerank');
const {getTracing} = require('./tracing');
const {buildSearchIndex} = require('../plugins/docs-search');
const {loadRerankCorpus} = require('./runtime');

const ref = name => ({$ref: `#/components/schemas/${name}`});
const spec = {
  openapi: '3.1.0', security: [{BearerAuth: []}], servers: [{url: 'https://proxy.example'}],
  paths: {
    '/key/{key}/reset_spend': {
      parameters: [{name: 'key', in: 'path', required: true, schema: {type: 'string'}},
        {name: 'mode', in: 'query', schema: {enum: ['old-mode']}}],
      post: {operationId: 'reset_key_spend', tags: ['key management'], summary: 'Reset key spend',
        parameters: [{name: 'mode', in: 'query', schema: {enum: ['current-mode']}}],
        requestBody: {required: true, content: {'application/json': {schema: ref('ResetSpendRequest')}}},
        responses: {'200': {description: 'Updated spend', content: {'application/json': {schema: ref('Result')}}}}},
      get: {operationId: 'inspect_reset', tags: ['key management'], summary: 'Inspect reset', security: [],
        description: 'Inspection-only details must stay separate.', responses: {'200': {description: 'Inspection'}}},
    },
  },
  components: {securitySchemes: {BearerAuth: {type: 'http', scheme: 'bearer'}}, schemas: {
    ResetSpendRequest: {type: 'object', required: ['reset_to'], properties: {reset_to: {type: 'number'}, nested: ref('Nested')}},
    Nested: {type: 'object', description: 'Schema evidence. '.repeat(400) + 'Last schema field remains readable.',
      properties: {parent: ref('ResetSpendRequest'), again: ref('Nested'), escaped: ref('A~1B~0C')}},
    'A/B~C': {type: 'string', enum: ['escaped-pointer-value']},
    Result: {type: 'object', properties: {spend: {type: 'number'}}},
  }},
};
const operation = '/api-reference/#/key%20management/reset_key_spend';
const inspection = '/api-reference/#/key%20management/inspect_reset';
const call = (name, args) => ({id: name, function: {name, arguments: JSON.stringify(args)}});

test('OpenAPI preserves inherited settings, overrides, schemas and recursive definitions', () => {
  const {documents, structure} = extractOpenAPI(spec);
  assert.deepEqual(Object.keys(structure), [operation, inspection]);
  const sections = documents.filter(doc => doc.url === operation);
  const text = sections.map(doc => doc.text).join('\n');
  assert.match(text, /reset_to/);
  assert.match(text, /Last schema field remains readable/);
  assert.match(text, /escaped-pointer-value/);
  assert.match(text, /current-mode/);
  assert.doesNotMatch(text, /old-mode|Inspection-only/);
  assert.match(text, /"in": "path"/);
  assert.match(text, /"scheme": "bearer"/);
  assert.match(text, /https:\/\/proxy.example/);
  assert.equal(sections.filter(doc => doc.heading === 'Definition #/components/schemas/ResetSpendRequest').length, 1);
  assert.ok(new Set(documents.map(doc => doc.id)).size === documents.length);
  const publicDetails = documents.find(doc => doc.url === inspection && doc.heading === 'Operation details and authentication').text;
  assert.deepEqual(JSON.parse(publicDetails).security, []);
  assert.deepEqual(JSON.parse(publicDetails).securitySchemes, {});
});

test('unsupported or missing API definitions fail instead of producing partial evidence', () => {
  for (const reference of ['#/components/schemas/Missing', 'https://example.com/schema.json']) {
    const broken = structuredClone(spec);
    broken.components.schemas.Nested.properties.parent = {$ref: reference};
    assert.throws(() => extractOpenAPI(broken), /OpenAPI reference/);
  }
  assert.throws(() => extractOpenAPI({}), /OpenAPI 3/);
});

test('shared search keeps Swagger operations separate through serialization and full reads', async () => {
  const {documents} = extractOpenAPI(spec);
  const index = loadIndex(JSON.stringify(createIndex(documents)));
  assert.equal(contentPage('/docs/proxy/users#budgets'), '/docs/proxy/users');
  assert.equal(contentPage(operation), operation);
  assert.equal(search(index, 'reset key spend')[0].url, operation);
  assert.equal(search(index, 'inspect reset')[0].url, inspection);
  const tool = createDocumentationTools({index, documents: new Map(documents.map(doc => [doc.id, doc])), tracing: getTracing({})});
  const found = await tool.execute(call('search_docs', {queries: ['reset key spend']}));
  const hit = found.results[0].matches.find(match => match.url === operation);
  const read = await tool.execute(call('read_docs', {passage_ids: [hit.passages[0].passage_id]}));
  assert.equal(read.passages.length, documents.filter(doc => doc.url === operation).length);
  assert.ok(read.passages.every(passage => passage.url === operation));
  assert.match(JSON.stringify(read), /Last schema field remains readable/);
  assert.doesNotMatch(JSON.stringify(read), /Inspection-only/);
});

test('the published spec exposes targeted key reset and the internal user spend field', () => {
  const published = require('../static/openapi.json');
  const {documents, structure} = extractOpenAPI(published);
  const operations = Object.values(published.paths).flatMap(item => Object.values(item).filter(value => value.operationId));
  assert.equal(Object.keys(structure).length, operations.length);
  const reset = documents.filter(doc => doc.title === 'POST /key/{key}/reset_spend');
  const update = documents.filter(doc => doc.title === 'POST /user/update');
  assert.ok(reset.some(doc => doc.heading === 'Request body'));
  assert.ok(reset.some(doc => /"reset_to"/.test(doc.text)));
  assert.ok(update.some(doc => /"spend"/.test(doc.text)));
  assert.ok(update.some(doc => /"max_budget"/.test(doc.text)));
});

test('build outputs and reranking include isolated API operation evidence', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'openapi-search-'));
  t.after(() => fs.rm(directory, {recursive: true, force: true}));
  await fs.writeFile(path.join(directory, 'openapi.json'), JSON.stringify(spec));
  await buildSearchIndex({outDir: directory, pages: new Map()});
  const corpus = await loadRerankCorpus(directory);
  assert.deepEqual(Object.keys(corpus.pageStructure), [operation, inspection]);
  let checked = 0;
  const ranker = createReranker({...corpus, config: {baseUrl: 'https://gateway.example', apiKey: 'test'}, fetchImpl: async (_, options) => {
    const body = JSON.parse(options.body);
    for (const question of Object.values(body.questions)) {
      const evidence = JSON.parse(question.instructions.split('Page evidence:\n')[1]);
      assert.equal(evidence.title, corpus.pageStructure[contentPage(evidence.url)].title);
      if (evidence.url === operation) {
        assert.match(JSON.stringify(evidence), /reset_to/);
        assert.doesNotMatch(JSON.stringify(evidence), /Inspection-only/);
        checked++;
      }
    }
    return Response.json({answers: Object.fromEntries(Object.keys(body.questions).map(key => [key, {type: 'noul', noul: 0.8}]))});
  }});
  await ranker.rerank('reset key spend');
  assert.equal(checked, 1);
  await fs.rm(path.join(directory, 'openapi.json'));
  await assert.rejects(buildSearchIndex({outDir: directory, pages: new Map()}), /ENOENT/);
});
