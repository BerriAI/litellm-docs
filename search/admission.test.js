const {test} = require('node:test');
const assert = require('node:assert/strict');
const {Readable} = require('node:stream');
const {MAX_BYTES, MAX_QUESTION, inputError, visitorIdentity, createVisitorLimiter} = require('./admission');
const {readBody} = require('./api');

const config = {origin: 'https://docs.example.com', apiKey: 'fake-signing-secret'};
const request = cookie => ({headers: {cookie}});

test('visitor cookies expire, reject tampering and use no caller-provided identity', () => {
  const now = 1800000000000;
  const visitor = visitorIdentity(request(), config, now);
  assert.match(visitor.cookie, /^__Host-docs-ai=/);
  assert.match(visitor.cookie, /HttpOnly; SameSite=Strict; Max-Age=86400; Secure$/);
  assert.ok(!visitor.cookie.includes(config.apiKey));
  const cookie = visitor.cookie.split(';')[0];
  assert.equal(visitorIdentity(request(cookie), config, now + 1000).id, visitor.id);
  assert.notEqual(visitorIdentity(request(cookie.slice(0, -1) + '!'), config, now).id, visitor.id);
  assert.notEqual(visitorIdentity(request(cookie), config, now + 86400000).id, visitor.id);
  assert.notEqual(visitorIdentity(request(cookie), {...config, apiKey: 'another-fake-secret'}, now).id, visitor.id);
  assert.match(visitorIdentity(request(), {...config, origin: 'http://localhost:3000'}, now).cookie, /^docs-ai-local=/);
});

test('visitor allowance is 20 per minute, three simultaneous, with idempotent release', async () => {
  let now = 0;
  const admit = createVisitorLimiter({now: () => now, env: {}});
  const pending = await Promise.all([admit('a'), admit('a'), admit('a')]);
  assert.deepEqual(await admit('a'), {retryAfter: 3});
  pending.forEach(value => {value.release(); value.release();});
  for (let i = 3; i < 20; i++) (await admit('a')).release();
  assert.deepEqual(await admit('a'), {retryAfter: 60});
  (await admit('b')).release();
  now = 60000;
  (await admit('a')).release();
});

test('shared visitor checks span instances and receive only a trusted host and opaque visitor ID', async () => {
  let calls = 0;
  const options = {env: {VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'docs.example.com'}, checkRateLimit: async (id, request) => {
    assert.equal(id, 'docs-ai-visitor');
    assert.equal(request.rateLimitKey, 'same-visitor');
    assert.deepEqual([...request.headers], [['host', 'docs.example.com']]);
    assert.equal(request.timeout, 1000);
    return {rateLimited: ++calls > 20};
  }};
  for (let i = 0; i < 20; i++) (await createVisitorLimiter(options)('same-visitor')).release();
  assert.deepEqual(await createVisitorLimiter(options)('same-visitor'), {retryAfter: 60});
});

test('shared check outages preserve local limits and log a fixed warning once per minute', async () => {
  let warnings = 0;
  const admit = createVisitorLimiter({now: () => 0, env: {VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'docs.example.com'},
    checkRateLimit: async () => {throw new Error('sensitive diagnostic');},
    warn: message => {warnings++; assert.ok(!message.includes('sensitive diagnostic'));}});
  for (let i = 0; i < 20; i++) (await admit('a')).release();
  assert.deepEqual(await admit('a'), {retryAfter: 60});
  assert.equal(warnings, 1);
  let checked = false;
  (await createVisitorLimiter({env: {VERCEL: '1', VERCEL_PROJECT_PRODUCTION_URL: 'https://evil.example/path'},
    checkRateLimit: () => {checked = true;}, warn() {}})('b')).release();
  assert.equal(checked, false);
});

test('input limits reject oversized questions while preserving substantial configuration and answers', () => {
  assert.equal(inputError({question: 'x'.repeat(MAX_QUESTION), history: [{question: 'Earlier?', answer: 'a'.repeat(150000)}]}), undefined);
  assert.match(inputError({question: 'x'.repeat(MAX_QUESTION + 1)}), /16,000/);
  assert.match(inputError({question: 'Next?', history: [{question: 'x'.repeat(MAX_QUESTION + 1)}]}), /new conversation/);
});

test('byte limits handle parsed objects, strings, chunked UTF-8, and misleading content lengths', async () => {
  const signal = AbortSignal.timeout(5000);
  const oversized = JSON.stringify({question: '🙂'.repeat(MAX_BYTES / 3)});
  for (const body of [oversized, JSON.parse(oversized)]) {
    assert.equal((await readBody({headers: {}, body}, signal, MAX_BYTES)).status, 413);
  }
  const bytes = Buffer.from(oversized);
  for (const headers of [{}, {'content-length': '1'}]) {
    const chunks = Array.from({length: Math.ceil(bytes.length / 1019)}, (_, i) => bytes.subarray(i * 1019, (i + 1) * 1019));
    const req = Readable.from(chunks); req.headers = headers;
    assert.equal((await readBody(req, signal, MAX_BYTES)).status, 413);
  }
  const body = {question: '配置🙂'.repeat(500)};
  const req = Readable.from([Buffer.from(JSON.stringify(body))]); req.headers = {};
  assert.deepEqual((await readBody(req, signal, MAX_BYTES)).body, body);
});
