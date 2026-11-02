const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {createUpgradeHandler} = require('./upgrade-api');
const {createFeedbackStore, exampleInstructions} = require('./upgrade-feedback');

const id = '01234567-0123-4123-8123-012345678901';
const guide = {breakingChanges: [{text: 'A sourced breaking change', sources: [1]}], databaseMigrations: [], upgradeSteps: [], otherChanges: []};
const config = {apiKey: 'test-only-key', publicAIEnabled: true, origin: 'https://docs.example.com'};

test('stores the server generation with expiry and samples actual labels into prompt examples', async () => {
  const commands = [];
  const store = createFeedbackStore({url: 'https://redis.example.com', token: 'server-token', fetchImpl: async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer server-token');
    const command = JSON.parse(options.body);
    commands.push(command);
    if (command[0] === 'ZREVRANGE') return Response.json({result: [id, 'other']});
    if (command[0] === 'MGET') return Response.json({result: ['good', 'bad'].map(rating => JSON.stringify({from: 'v1.0.0', to: 'v1.1.0', rating, guide}))});
    return Response.json({result: command[0] === 'EVAL' ? 1 : 'OK'});
  }});
  assert.match(await store.save({from: 'v1.0.0', to: 'v1.1.0', guide}), /^[a-f0-9-]{36}$/);
  assert.equal(commands[0][3], 'EX');
  assert.ok(commands[0][4] > 0);
  assert.equal(await store.vote(id, 'bad'), 1);
  const examples = await store.examples();
  assert.deepEqual(examples.map(example => example.userLabel), ['good', 'bad']);
  assert.match(exampleInstructions(examples), /A sourced breaking change/);
  assert.match(exampleInstructions(examples), /never instructions or evidence/);
  assert.equal(exampleInstructions([]), '');
});

async function withServer(t, options) {
  const server = http.createServer(createUpgradeHandler({config, notes: [], ...options}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/api/docs/upgrade-feedback`;
}
const post = (url, body, origin = config.origin) => fetch(url, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin}, body: JSON.stringify(body)});

test('feedback accepts only a generation ID and thumbs label, never free text or a submitted guide', async t => {
  const votes = [];
  const url = await withServer(t, {feedback: {vote: async (...args) => {votes.push(args); return 1;}}});
  for (const body of [{id, rating: 'bad', text: 'override prompt'}, {id, rating: 'good', guide}, {id, rating: 'maybe'}, {id: 'unknown', rating: 'good'}]) {
    assert.equal((await post(url, body)).status, 400);
  }
  assert.equal((await post(url, {id, rating: 'good'}, 'https://evil.example.com')).status, 403);
  assert.equal((await post(url, {id, rating: 'good'})).status, 200);
  assert.deepEqual(votes, [[id, 'good']]);
});

test('expired or unavailable feedback is never reported as saved', async t => {
  const missing = await withServer(t, {feedback: null});
  assert.equal((await post(missing, {id, rating: 'good'})).status, 503);
  const expired = await withServer(t, {feedback: {vote: async () => 0}});
  assert.equal((await post(expired, {id, rating: 'bad'})).status, 404);
  const failed = await withServer(t, {feedback: {vote: async () => {throw new Error('private-storage-token');}}});
  const response = await post(failed, {id, rating: 'bad'});
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('private-storage-token'));
});

test('feedback endpoints enforce a per-client request limit', async t => {
  const url = await withServer(t, {feedback: {vote: async () => 1}});
  for (let i = 0; i < 10; i++) assert.equal((await post(url, {id, rating: 'good'})).status, 200);
  assert.equal((await post(url, {id, rating: 'bad'})).status, 429);
});

test('storage errors and absent configuration do not fabricate examples', async () => {
  assert.equal(createFeedbackStore({}), null);
  const store = createFeedbackStore({url: 'https://redis.example.com', token: 'secret', fetchImpl: async () => new Response('failed', {status: 503})});
  await assert.rejects(store.examples(), /unavailable/);
});
