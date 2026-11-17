import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWorkshopSubmission, normalizeWorkshopValues, validateWorkshopValues} from './signup-payload.mjs';

const base = {
  name: 'Alex Chen',
  email: 'alex@example.com',
  company: 'Example',
  linkedin: 'https://www.linkedin.com/in/alex-chen/',
  workflow: 'Turn a Slack bug report into a tested pull request.',
};
const metadata = {submissionId: 'qa-stable-id', source: 'https://docs.litellm.ai/blog/cloud-agent-workshop'};

test('client payload contains every workshop answer and stable metadata', () => {
  const values = {...base, onsiteInterest: 'Yes'};
  const payload = buildWorkshopSubmission(values, metadata);
  assert.deepEqual(payload, {...values, deploymentTimeline: '', ...metadata});
});

test('removed fields and sales routing are not sent in workshop payload', () => {
  const removed = {
    companySize: '10000+',
    harness: 'Hermes',
    providers: 'Bedrock',
    sandbox: 'Our VPC',
    location: 'San Francisco',
    priorAttempts: 'A previous prototype',
    litellmBlockers: 'Model routing',
  };
  const values = normalizeWorkshopValues({...base, ...removed});
  const payload = buildWorkshopSubmission({...base, ...removed}, metadata);
  for (const [key, value] of Object.entries(removed)) {
    assert.equal(values[key], undefined);
    assert.ok(!JSON.stringify(payload).includes(value), `Removed answer persisted: ${key}`);
  }
  assert.equal(payload['company-size'], undefined);
  assert.equal(payload['lead-route'], undefined);
  assert.equal(payload['lead-routing-reason'], undefined);
  assert.doesNotMatch(JSON.stringify(payload), /below 500/i);
});

test('optional on-site answer is clearly absent and retries preserve the submission id', () => {
  const first = buildWorkshopSubmission(base, metadata);
  const retry = buildWorkshopSubmission(base, metadata);
  assert.equal(first.submissionId, retry.submissionId);
  assert.equal(first.onsiteInterest, '');
});

test('all required answers, including LinkedIn, reject missing or whitespace-only values', () => {
  const labels = {name: 'Name', email: 'Work email', company: 'Company', linkedin: 'LinkedIn profile', workflow: 'What are you hoping to achieve?'};
  for (const [key, label] of Object.entries(labels)) {
    for (const value of [undefined, '  ']) {
      const values = normalizeWorkshopValues({...base, [key]: value});
      assert.deepEqual(validateWorkshopValues(values), {[key]: `${label} is required.`});
      assert.throws(() => buildWorkshopSubmission(values, metadata), /incomplete/);
    }
  }
});

test('scheme-less LinkedIn profile URLs normalize to HTTPS and persist', () => {
  for (const linkedin of ['linkedin.com/in/alex', 'www.linkedin.com/in/alex/', 'uk.linkedin.com/in/alex']) {
    const values = normalizeWorkshopValues({...base, linkedin: `  ${linkedin}  `});
    assert.equal(values.linkedin, `https://${linkedin}`);
    assert.deepEqual(validateWorkshopValues(values), {});
    const payload = buildWorkshopSubmission({...base, linkedin}, metadata);
    assert.equal(payload.linkedin, `https://${linkedin}`);
  }
});

test('HTTP and HTTPS LinkedIn profiles with regional subdomains and URL suffixes are valid', () => {
  for (const linkedin of [
    'http://linkedin.com/in/alex',
    'https://www.linkedin.com/in/alex?trk=profile',
    'https://uk.linkedin.com/in/alex/#about',
  ]) {
    const values = normalizeWorkshopValues({...base, linkedin});
    assert.deepEqual(validateWorkshopValues(values), {}, linkedin);
  }
});

test('LinkedIn validation rejects lookalikes, credentials, non-profiles, and unsafe URL rewrites', () => {
  for (const linkedin of [
    'https://linkedin.com.evil.example/in/alex',
    'https://notlinkedin.com/in/alex',
    'https://linkedin.example/in/alex',
    'https://user@linkedin.com/in/alex',
    'https://user:password@linkedin.com/in/alex',
    'https://linkedin.com@evil.example/in/alex',
    'javascript://linkedin.com/in/alex',
    'ftp://linkedin.com/in/alex',
    'https://linkedin.com/company/example',
    'https://linkedin.com/in/',
    'https://linkedin.com/',
    'https://linkedin.com/in/alex/details',
    'https://linkedin.com/in/alex%2Fdetails',
    'https://linkedin.com/in/alex%20chen',
    'https://linkedin.com/in/alex%00',
    'https://linkedin.com/in/al\\ex',
    'https://linkedin.com/in/al\nex',
    'https://linkedin.com:8080/in/alex',
  ]) {
    const values = normalizeWorkshopValues({...base, linkedin});
    assert.match(validateWorkshopValues(values).linkedin, /LinkedIn profile URL/, linkedin);
    assert.throws(() => buildWorkshopSubmission(values, metadata), /incomplete/, linkedin);
  }
});

test('unknown fields are dropped, oversized answers rejected, and submission metadata required', () => {
  const values = normalizeWorkshopValues({...base, role: 'unknown field', workflow: 'x'.repeat(3001)});
  assert.equal(values.role, undefined);
  assert.match(validateWorkshopValues(values).workflow, /3000 characters/);
  assert.throws(() => buildWorkshopSubmission(values, metadata), /field limit/);
  assert.throws(() => buildWorkshopSubmission(base), /metadata is required/);
});


test('deployment timeline is optional and accepts only listed answers', () => {
  assert.equal(buildWorkshopSubmission(base, metadata).deploymentTimeline, '');
  for (const deploymentTimeline of ['ASAP', '1 month', '3 months', '6 months']) {
    assert.equal(buildWorkshopSubmission({...base, deploymentTimeline}, metadata).deploymentTimeline, deploymentTimeline);
  }
  for (const deploymentTimeline of ['Tomorrow', 'x'.repeat(101)]) {
    assert.throws(() => buildWorkshopSubmission({...base, deploymentTimeline}, metadata), /incomplete/);
  }
});
