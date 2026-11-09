const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createIndex} = require('./engine');
const {answerQuestion} = require('./answer');
const {tools, createDocumentationTools} = require('./tools');
const {getTracing} = require('./tracing');

const docs = [
  {id: 'irrelevant', title: 'Project Management UI', heading: '', url: '/docs/proxy/ui_project_management', text: 'Manage projects on this UI page.'},
  {id: 'decisions', title: '/v1/decisions and /v1/systemone', heading: 'Supported providers', url: '/docs/decisions#supported-providers',
    text: 'vLLM uses hosted_vllm/<served-model-name>. api_base is required; HOSTED_VLLM_API_KEY is optional. vLLM supports choice questions only.'},
  {id: 'gemini', title: 'Gemini reasoning', heading: '', url: '/docs/providers/gemini', text: 'Gemini supports reasoning and deployment options.'},
  {id: 'pi', title: 'Lite-Harness SDK and Pi AI', heading: 'Supported harnesses', url: '/blog/lite-harness-sdk', text: 'The announcement mentions Pi AI but does not document its harness selection string.'},
];
const config = {apiKey: 'test-agent-secret', baseUrl: 'https://gateway.example.com'};
const corpus = {index: createIndex(docs), documents: new Map(docs.map(doc => [doc.id, doc]))};
const toolCall = (id, name, args) => ({id, type: 'function', function: {name, arguments: JSON.stringify(args)}});
const toolResponse = calls => Response.json({choices: [{finish_reason: 'tool_calls', message: {content: null, tool_calls: calls}}]});
const answer = text => Response.json({choices: [{finish_reason: 'stop', message: {content: text}}]});

test('agent can inspect an irrelevant result, batch new searches, read evidence, then answer', async () => {
  let calls = 0;
  const events = [];
  const result = await answerQuestion({...corpus, config, question: 'How do I register a decision model on vLLM?',
    onEvent: (event, data) => events.push({event, data}), fetchImpl: async (_url, request) => {
      const body = JSON.parse(request.body);
      switch (calls++) {
        case 0:
          assert.equal(body.tool_choice, 'required');
          assert.equal(body.stream, undefined);
          return toolResponse([toolCall('s1', 'search_docs', {queries: ['Project Management UI']})]);
        case 1:
          assert.ok(body.messages.at(-1).content.includes('Project Management UI'));
          return toolResponse([toolCall('s2', 'search_docs', {queries: ['decision vllm', 'decision models']})]);
        case 2: {
          const results = JSON.parse(body.messages.at(-1).content).results;
          assert.deepEqual(results.map(result => result.query), ['decision vllm', 'decision models']);
          assert.ok(results[0].matches.some(match => match.url.startsWith('/docs/decisions')));
          return toolResponse([toolCall('r1', 'read_docs', {passage_ids: ['decisions']})]);
        }
        case 3:
          assert.ok(body.messages.at(-1).content.includes('choice questions only'));
          return toolResponse([toolCall('finish', 'finish_research', {})]);
        case 4:
          assert.equal(body.tools, undefined);
          const evidence = JSON.parse(body.messages[1].content[0].text).documentation;
          assert.ok(evidence.some(passage => passage.text.includes('choice questions only')));
          assert.ok(!JSON.stringify(body).includes('Project Management UI'));
          assert.ok(!JSON.stringify(body).includes('Gemini reasoning'));
          return answer('Use hosted_vllm/<served-model-name>; api_base is required and the key is optional. Choice questions only. [1]');
        default: assert.fail('Unexpected model call');
      }
    }});
  assert.equal(calls, 5);
  assert.equal(result.body.sources[0].url, '/docs/decisions#supported-providers');
  assert.equal(result.body.sources.length, 1);
  assert.ok(events.some(event => event.event === 'sources'));
});

test('the agent can search, read, search again and read before one final answer', async () => {
  const steps = [
    toolResponse([toolCall('s1', 'search_docs', {queries: ['Pi AI']})]),
    toolResponse([toolCall('r1', 'read_docs', {passage_ids: ['pi']})]),
    toolResponse([toolCall('s2', 'search_docs', {queries: ['decision vllm', 'Gemini']})]),
    toolResponse([toolCall('r2', 'read_docs', {passage_ids: ['decisions']})]),
    toolResponse([toolCall('f', 'finish_research', {})]),
    answer('Pi is mentioned in Lite-Harness. vLLM supports choice questions. [1][2]'),
  ];
  let calls = 0;
  const result = await answerQuestion({...corpus, config, question: 'Compare Pi and decision vllm support', fetchImpl: async (_url, request) => {
    const body = JSON.parse(request.body);
    if (calls === 3) {
      const results = JSON.parse(body.messages.at(-1).content).results;
      assert.deepEqual(results.map(group => group.query), ['decision vllm', 'Gemini']);
      assert.equal(Object.keys(results[0].matches[0])[0], 'title');
    }
    return steps[calls++];
  }});
  assert.equal(calls, 6);
  assert.equal(result.body.sources.length, 2);
});

test('search results do not become citations until the agent reads them; unrelated pages stay out', async () => {
  const tool = createDocumentationTools({...corpus, config, tracing: getTracing(config)});
  const found = await tool.execute(toolCall('s', 'search_docs', {queries: ['Pi AI', 'Gemini']}));
  assert.equal(found.results.length, 2);
  assert.equal(tool.sources.size, 0);
  const read = await tool.execute(toolCall('r', 'read_docs', {passage_ids: ['pi']}));
  assert.equal(read.passages.length, 1);
  assert.equal(read.passages[0].title, 'Lite-Harness SDK and Pi AI');
  assert.ok(!JSON.stringify(read).includes('Gemini'));
  assert.deepEqual([...tool.sources.values()].map(source => source.url), ['/blog/lite-harness-sdk']);
});

test('tools reject undiscovered IDs, arbitrary URLs, malformed arguments and oversized batches', async () => {
  const tool = createDocumentationTools({...corpus, tracing: getTracing(config)});
  for (const call of [
    toolCall('a', 'read_docs', {passage_ids: ['decisions']}),
    toolCall('b', 'read_docs', {passage_ids: ['https://private.example/secret']}),
    toolCall('c', 'search_docs', {queries: Array(4).fill('vllm')}),
    toolCall('d', 'search_docs', {queries: ['vllm'], url: 'https://private.example'}),
    {id: 'e', function: {name: 'search_docs', arguments: '{'}},
  ]) assert.ok((await tool.execute(call)).error);
  assert.equal(tool.sources.size, 0);
});

test('repeated tool requests stop at the round limit and get a final answer without tools', async () => {
  let calls = 0;
  await answerQuestion({...corpus, config, question: 'Pi AI', fetchImpl: async (_url, request) => {
    const body = JSON.parse(request.body); calls++;
    if (calls <= 8) return toolResponse([toolCall(`s${calls}`, 'search_docs', {queries: ['Pi AI']})]);
    assert.equal(body.tools, undefined);
    return answer('I could not verify the Pi selection string.');
  }});
  assert.equal(calls, 9);
});

test('all tool names are fixed and only retrieve local documentation', () => {
  assert.deepEqual(tools.map(tool => tool.function.name), ['search_docs', 'read_docs']);
  assert.ok(tools.every(tool => tool.function.parameters.additionalProperties === false));
});

test('an invalid final citation fails once without replacing the streamed answer', async () => {
  const responses = [
    toolResponse([toolCall('s', 'search_docs', {queries: ['Pi AI']})]),
    toolResponse([toolCall('r', 'read_docs', {passage_ids: ['pi']})]),
    toolResponse([toolCall('f', 'finish_research', {})]),
    answer('The Pi selector is not documented. [9]'),
  ];
  let calls = 0;
  const events = [];
  await assert.rejects(answerQuestion({...corpus, config, question: 'Pi AI',
    onEvent: (event, data) => events.push({event, data}),
    fetchImpl: async () => {assert.ok(calls < responses.length); return responses[calls++];},
  }), /Invalid documentation citation/);
  assert.equal(calls, 4);
  assert.ok(!events.some(({event}) => event === 'answer-start'));
  assert.equal(events.filter(({event}) => event === 'answer-delta').map(({data}) => data.text).join(''), 'The Pi selector is not documented. [9]');
});

test('page reads include all indexed link destinations and keep stable source numbers', async () => {
  const linked = {...docs[1], links: [{title: 'Public reference', url: '/api-reference/'},
    ...Array.from({length: 40}, (_, i) => ({title: `Related ${i}`, url: `/docs/related-${i}`}))]};
  const documents = new Map([[linked.id, linked], ['pi', docs[3]]]);
  const tool = createDocumentationTools({index: createIndex([...documents.values()]), documents, tracing: getTracing(config)});
  const found = await tool.execute(toolCall('s', 'search_docs', {queries: ['decision vllm', 'Pi AI']}));
  assert.equal(found.results[0].matches[0].passages[0].links[0].url, '/api-reference/');
  assert.equal(tool.sources.size, 0);
  const first = await tool.execute(toolCall('r', 'read_docs', {passage_ids: ['decisions']}));
  assert.equal(first.passages[0].links.length, linked.links.length);
  assert.equal(first.passages[0].links[0].source, 2);
  const second = await tool.execute(toolCall('r2', 'read_docs', {passage_ids: ['pi']}));
  assert.equal(second.passages[0].source, linked.links.length + 2);
  assert.equal(second.passages[0].text, docs[3].text);
  assert.equal(second.unavailable.length, 0);
});

test('reading a page includes the requested evidence, remaining chunks, and request examples', async () => {
  const parts = [
    {...docs[1], id: 'part1'},
    {...docs[1], id: 'part2', text: 'A recent vLLM build is required.'},
    {...docs[1], id: 'example', url: '/docs/decisions#request', heading: '/v1/decisions', text: 'A choice request has a choices array.'},
  ];
  const documents = new Map(parts.map(doc => [doc.id, doc]));
  const tool = createDocumentationTools({index: createIndex(parts), documents, tracing: getTracing(config)});
  await tool.execute(toolCall('s', 'search_docs', {queries: ['decision vllm']}));
  const first = await tool.execute(toolCall('r1', 'read_docs', {passage_ids: ['part1']}));
  assert.equal(first.passages.length, 3);
  assert.equal(first.passages[1].text, parts[1].text);
  assert.equal(tool.sources.size, 3);
  assert.equal(first.passages[2].text, parts[2].text);
});

test('long pages and later reads reach the final answer without truncation', async () => {
  const longPage = Array.from({length: 40}, (_, i) => ({...docs[1], id: `part-${i}`,
    text: `Section ${i}: ${'vLLM decision model evidence. '.repeat(125)} End of section ${i}.`,
  }));
  const laterPage = {...docs[3], text: `${'Pi integration evidence. '.repeat(1000)} Final setup example.`};
  const complete = [...longPage, laterPage];
  const responses = [
    toolResponse([toolCall('s', 'search_docs', {queries: ['decision vllm', 'Pi AI']})]),
    toolResponse([toolCall('r1', 'read_docs', {passage_ids: ['part-0']})]),
    toolResponse([toolCall('r2', 'read_docs', {passage_ids: ['pi']})]),
    toolResponse([toolCall('f', 'finish_research', {})]),
    answer('Both complete examples are available. [40][41]'),
  ];
  let calls = 0;
  const result = await answerQuestion({config, question: 'Compare decision vllm and Pi AI setup',
    index: createIndex(complete), documents: new Map(complete.map(doc => [doc.id, doc])),
    fetchImpl: async (_url, request) => {
      const body = JSON.parse(request.body);
      if (calls === 2 || calls === 3) {
        const read = JSON.parse(body.messages.at(-1).content);
        assert.deepEqual(read.passages.map(doc => doc.text), (calls === 2 ? longPage : [laterPage]).map(doc => doc.text));
        assert.deepEqual(read.unavailable, []);
      }
      if (calls === 4) {
        const evidence = JSON.parse(body.messages[1].content[0].text).documentation;
        assert.deepEqual(evidence.map(doc => doc.text), complete.map(doc => doc.text));
      }
      return responses[calls++];
    }});
  assert.equal(calls, 5);
  assert.deepEqual(result.body.sources.map(source => source.id), [40, 41]);
});
