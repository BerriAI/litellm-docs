import test from 'node:test';
import assert from 'node:assert/strict';
import {submitWorkshopSignup} from './signup-client.mjs';

const fields = {name: 'Alex', submissionId: 'stable-id-123'};

test('client sends one JSON request to the same-origin workshop API', async () => {
  let calls = 0;
  const result = await submitWorkshopSignup(fields, async (url, options) => {
    calls += 1;
    assert.equal(url, '/api/workshop/signup');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), fields);
    return Response.json({ok: true, submissionId: fields.submissionId});
  });
  assert.equal(calls, 1);
  assert.equal(result.ok, true);
});

test('client requires matching confirmed success and never retries automatically', async () => {
  const responses = [
    Response.json({ok: true, submissionId: fields.submissionId}, {status: 502}),
    Response.json({ok: false, submissionId: fields.submissionId}),
    Response.json({ok: true, submissionId: 'different-id'}),
    new Response('<html>Not the signup endpoint</html>'),
  ];
  for (const response of responses) {
    let calls = 0;
    await assert.rejects(submitWorkshopSignup(fields, async () => { calls += 1; return response; }), /could not be confirmed/);
    assert.equal(calls, 1);
  }
  await assert.rejects(submitWorkshopSignup(fields, async () => { throw new Error('network failure'); }));
});
