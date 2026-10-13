import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildWorkshopSubmission, normalizeWorkshopValues, validateWorkshopValues} from './signup-payload.mjs';

const base = {name: 'Alex Chen', email: 'alex@example.com', company: 'Example', companySize: '50-199', workflow: 'Turn a Slack bug report into a tested pull request.'};
const metadata = {submissionId: 'qa-stable-id', route: 'Sales email follow-up', reason: 'Company size is below 500'};

test('all workshop answers survive the shared Webflow field whitelist', () => {
  const values = {...base, harness: 'Hermes', providers: 'Bedrock', sandbox: 'Our VPC', location: 'San Francisco', onsiteInterest: 'Yes', priorAttempts: 'A local prototype\nBlocked on deployment', litellmBlockers: 'Model routing'};
  const payload = buildWorkshopSubmission(values, metadata);
  const webflowSource = readFileSync(new URL('../../src/components/SalesForm/webflow.js', import.meta.url), 'utf8');
  const fieldOrderSource = webflowSource.match(/export const FIELD_ORDER = (\[[\s\S]*?\]);/)[1];
  const fieldOrder = [...fieldOrderSource.matchAll(/'([^']+)'/g)].map(match => match[1]);
  assert.ok(Object.keys(payload).every(key => fieldOrder.includes(key)));
  for (const value of Object.values(values)) assert.ok(payload.notes.includes(value), `Missing answer: ${value}`);
  assert.match(payload.notes, /Workshop: Build a self-hosted cloud agent\./);
  assert.match(payload.notes, /October 19–30, 2026/);
  assert.match(payload['hoping-to-learn'], /Slack bug report/);
  assert.equal(payload.intent, 'talk-to-sales');
  assert.equal(payload['lead-route'], metadata.route);
});

test('optional answers are clearly absent and a retry preserves its submission id', () => {
  const first = buildWorkshopSubmission(base, metadata);
  const retry = buildWorkshopSubmission(base, metadata);
  assert.equal(first['submission-id'], retry['submission-id']);
  assert.match(first.notes, /Interest in an on-site build: Not provided/);
  assert.match(first.notes, /Other LiteLLM problems: Not provided/);
});

test('normalization drops unknown fields and rejects whitespace-only required answers', () => {
  const values = normalizeWorkshopValues({...base, name: '  ', role: 'unknown field'});
  assert.deepEqual(validateWorkshopValues(values), {name: 'Name is required.'});
  assert.equal(values.role, undefined);
  assert.throws(() => buildWorkshopSubmission(values, metadata), /incomplete/);
});

test('oversized answers are rejected rather than silently truncated', () => {
  const values = normalizeWorkshopValues({...base, workflow: 'x'.repeat(3001)});
  assert.match(validateWorkshopValues(values).workflow, /3000 characters/);
  assert.throws(() => buildWorkshopSubmission(values, metadata), /field limit/);
});
