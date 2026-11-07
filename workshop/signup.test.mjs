import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {createWorkshopSignupHandler} from './signup.mjs';

const env = {VERCEL: '1', WORKSHOP_ZAPIER_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/test-owner/test-hook/'};
const body = {
  name: ' Alex Chen ', email: 'alex@litellm.ai', company: 'Example',
  linkedin: 'linkedin.com/in/alex-chen', workflow: 'Turn Slack bugs into tested pull requests.',
  onsiteInterest: '', submissionId: 'stable-id-123',
  source: 'https://docs.litellm.ai/blog/cloud-agent-workshop?campaign=social#signup',
};
const neverFetch = () => assert.fail('Invalid request reached the webhook');

async function invoke(handler, options = {}) {
  const req = options.stream === undefined ? {} : Readable.from([Buffer.from(options.stream)]);
  Object.assign(req, {
    method: options.method || 'POST',
    headers: {host: 'docs.litellm.ai', origin: 'https://docs.litellm.ai', 'content-type': 'application/json', ...options.headers},
    socket: {remoteAddress: options.remoteAddress || '203.0.113.1'},
  });
  if (options.stream === undefined) req.body = options.body === undefined ? body : options.body;
  const result = {};
  const res = {
    writeHead(status, headers) { Object.assign(result, {status, headers}); },
    end(value) { result.body = value === undefined ? undefined : JSON.parse(value); },
  };
  await handler(req, res);
  return result;
}

test('relay normalizes answers and sends the exact workshop hook contract', async () => {
  let calls = 0;
  const handler = createWorkshopSignupHandler({env, fetchImpl: async (url, options) => {
    calls += 1;
    assert.equal(url, env.WORKSHOP_ZAPIER_WEBHOOK_URL);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    const {slackMessage, ...fields} = JSON.parse(options.body);
    assert.deepEqual(fields, {
      event: 'cloud_agent_workshop_signup', name: 'Alex Chen', email: body.email, company: body.company,
      linkedin: 'https://linkedin.com/in/alex-chen', workflow: body.workflow, onsiteInterest: 'Not specified',
      submissionId: body.submissionId, workshop: 'Build a self-hosted cloud agent',
      dates: 'October 19–30, 2026', format: 'Remote · 2 weeks',
      source: 'https://docs.litellm.ai/blog/cloud-agent-workshop',
    });
    assert.equal(slackMessage, [
      '*New cloud agent workshop signup*',
      'Build a self-hosted cloud agent · October 19–30, 2026 · Remote · 2 weeks',
      '', '*Name:* Alex Chen', '*Work email:* alex@litellm.ai', '*Company:* Example',
      '*LinkedIn:* https://linkedin.com/in/alex-chen', '*Goals:* Turn Slack bugs into tested pull requests.',
      '*On-site interest:* Not specified', '*Source:* https://docs.litellm.ai/blog/cloud-agent-workshop',
      '*Submission ID:* stable-id-123',
    ].join('\n'));
    return Response.json({status: 'success'});
  }});
  const result = await invoke(handler);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {ok: true, submissionId: body.submissionId});
  assert.equal(calls, 1);
});

test('derived Slack message escapes special mentions and links without changing individual answers', async () => {
  const input = {...body, name: 'Alex & team', company: '<Example>', workflow: 'Ping <!channel> and see <https://evil.example|link>'};
  const handler = createWorkshopSignupHandler({env, fetchImpl: async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.name, input.name);
    assert.equal(payload.company, input.company);
    assert.equal(payload.workflow, input.workflow);
    assert.match(payload.slackMessage, /Alex &amp; team/);
    assert.match(payload.slackMessage, /&lt;Example&gt;/);
    assert.match(payload.slackMessage, /&lt;!channel&gt;/);
    assert.match(payload.slackMessage, /&lt;https:\/\/evil\.example\|link&gt;/);
    assert.doesNotMatch(payload.slackMessage, /<!channel>|<https:/);
    return Response.json({status: 'success'});
  }});
  assert.equal((await invoke(handler, {body: input})).status, 200);
});

test('method, media type, body size and malformed input fail before hook submission', async () => {
  const handler = createWorkshopSignupHandler({env, fetchImpl: neverFetch});
  for (const [options, expected] of [
    [{method: 'GET'}, 405],
    [{headers: {'content-type': 'text/plain'}}, 415],
    [{headers: {'content-length': '17000'}}, 413],
    [{body: 'x'.repeat(17000)}, 413],
    [{stream: 'x'.repeat(17000)}, 413],
    [{body: '{'}, 400],
    [{stream: '{'}, 400],
    [{body: null}, 400],
    [{body: []}, 400],
  ]) assert.equal((await invoke(handler, options)).status, expected);
});

test('missing and invalid fields, forged metadata, and unsafe source URLs never reach hook', async () => {
  for (const invalid of [
    {...body, name: ' '}, {...body, email: 'not-an-email'}, {...body, linkedin: 'https://linkedin.com.evil.example/in/alex'},
    {...body, workflow: 'x'.repeat(3001)}, {...body, onsiteInterest: 'Invented'}, {...body, company: 100},
    {...body, submissionId: 'x'}, {...body, source: 'https://evil.example/workshop'},
    {...body, source: 'https://user:password@docs.litellm.ai/blog/cloud-agent-workshop'},
    {...body, event: 'another-event'}, {...body, webhookUrl: 'https://evil.example'},
  ]) {
    const handler = createWorkshopSignupHandler({env, fetchImpl: neverFetch});
    assert.equal((await invoke(handler, {body: invalid})).status, 400);
  }
});

test('origin must match both the allowed deployment and request host', async () => {
  const handler = createWorkshopSignupHandler({env, fetchImpl: neverFetch});
  for (const headers of [
    {origin: undefined}, {origin: 'https://evil.example'}, {origin: 'null'},
    {host: 'evil.example'}, {'sec-fetch-site': 'cross-site'},
    {origin: 'http://localhost:3333', host: 'localhost:3333'},
  ]) assert.equal((await invoke(handler, {headers})).status, 403);
});

test('configured preview origins and actual loopback development are accepted', async () => {
  for (const config of [
    {env: {...env, VERCEL_URL: 'preview.vercel.app'}, origin: 'https://preview.vercel.app', remoteAddress: '203.0.113.1'},
    {env: {...env, VERCEL_BRANCH_URL: 'branch.vercel.app'}, origin: 'https://branch.vercel.app', remoteAddress: '203.0.113.1'},
    {env: {...env, VERCEL: undefined}, origin: 'http://127.0.0.1:3333', remoteAddress: '127.0.0.1'},
  ]) {
    const handler = createWorkshopSignupHandler({env: config.env, fetchImpl: async () => Response.json({status: 'success'})});
    const result = await invoke(handler, {
      headers: {host: new URL(config.origin).host, origin: config.origin}, remoteAddress: config.remoteAddress,
      body: {...body, source: `${config.origin}/blog/cloud-agent-workshop`, onsiteInterest: 'Yes'},
    });
    assert.equal(result.status, 200);
  }
});

test('missing or unsafe server webhook configuration fails closed without leaking its value', async () => {
  for (const value of [undefined, 'http://hooks.zapier.com/hooks/catch/test/test/', 'https://hooks.zapier.com.evil.example/hooks/catch/test/test/', 'https://user:secret@hooks.zapier.com/hooks/catch/test/test/', 'https://hooks.zapier.com/other', 'https://hooks.zapier.com/hooks/catch/test/test/?secret=x']) {
    const handler = createWorkshopSignupHandler({env: {...env, WORKSHOP_ZAPIER_WEBHOOK_URL: value}, fetchImpl: neverFetch});
    const result = await invoke(handler);
    assert.equal(result.status, 503);
    assert.doesNotMatch(JSON.stringify(result), /secret|zapier|test-owner/);
  }
});

test('non-success status, explicit failure, and network failures never confirm signup', async () => {
  const fetches = [
    async () => new Response('Unavailable', {status: 503}),
    async () => Response.json({success: false}),
    async () => Response.json({status: 'error'}),
    async () => Response.json({error: 'private upstream error'}),
    async () => Response.json({code: 400}),
    async () => new Response('<html>Unexpected 200 response</html>'),
    async () => new Response(''),
    async () => Response.json({}),
    async () => Response.json({status: 'success', ok: false}),
    async () => { throw new Error('private upstream error'); },
  ];
  for (const fetchImpl of fetches) {
    const result = await invoke(createWorkshopSignupHandler({env, fetchImpl}));
    assert.equal(result.status, 502);
    assert.doesNotMatch(JSON.stringify(result), /private upstream/);
  }
});

test('timeout is unconfirmed and no automatic retry is sent', async () => {
  let calls = 0;
  const fetchImpl = async (_url, {signal}) => new Promise((resolve, reject) => {
    calls += 1;
    signal.addEventListener('abort', () => reject(signal.reason), {once: true});
  });
  const keepAlive = setTimeout(() => {}, 200);
  try {
    const result = await invoke(createWorkshopSignupHandler({env, fetchImpl, timeoutMs: 5}));
    assert.equal(result.status, 502);
    assert.equal(calls, 1);
  } finally { clearTimeout(keepAlive); }
});

test('per-email attempts are limited across request IDs and the ten-minute window resets', async () => {
  let now = 0, calls = 0;
  const handler = createWorkshopSignupHandler({env, now: () => now, fetchImpl: async () => { calls += 1; return Response.json({status: 'success'}); }});
  for (let i = 0; i < 2; i += 1) assert.equal((await invoke(handler, {body: {...body, submissionId: `attempt-${i}`}})).status, 200);
  const limited = await invoke(handler, {body: {...body, email: body.email.toUpperCase(), submissionId: 'attempt-three'}});
  assert.equal(limited.status, 429);
  assert.equal(limited.headers['Retry-After'], '600');
  assert.equal(calls, 2);
  now = 600000;
  assert.equal((await invoke(handler)).status, 200);
});

test('streamed JSON input follows the same validation path', async () => {
  const handler = createWorkshopSignupHandler({env, fetchImpl: async () => Response.json({status: 'success'})});
  assert.equal((await invoke(handler, {stream: JSON.stringify(body)})).status, 200);
});


const handoffOrigins = ['https://handoff.litellm.ai', 'https://litellm-handoff.onrender.com', 'https://litellm-workshop-directions.ishaan196385.chatgpt.site'];

test('HANDOFF preflight allows only POST and Content-Type without calling Zapier', async () => {
  const handler = createWorkshopSignupHandler({env: {VERCEL: '1'}, fetchImpl: neverFetch});
  for (const origin of handoffOrigins) {
    const result = await invoke(handler, {method: 'OPTIONS', headers: {
      origin, 'sec-fetch-site': 'cross-site', 'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    }});
    assert.equal(result.status, 204);
    assert.equal(result.body, undefined);
    assert.equal(result.headers['Access-Control-Allow-Origin'], origin);
    assert.equal(result.headers['Access-Control-Allow-Methods'], 'POST');
    assert.equal(result.headers['Access-Control-Allow-Headers'], 'Content-Type');
    assert.equal(result.headers['Access-Control-Allow-Credentials'], undefined);
    assert.equal(result.headers.Vary, 'Origin');
  }
  for (const headers of [
    {'access-control-request-method': 'DELETE'},
    {'access-control-request-method': 'POST', 'access-control-request-headers': 'Content-Type, Authorization'},
    {'access-control-request-method': 'POST', 'access-control-request-headers': 'X-Custom'},
    {'access-control-request-method': undefined},
  ]) {
    const result = await invoke(handler, {method: 'OPTIONS', headers: {origin: handoffOrigins[0], ...headers}});
    assert.equal(result.status, 403);
  }
});

test('HANDOFF requests forward timeline and updated dates to the same Zapier hook', async () => {
  for (const origin of handoffOrigins) {
    let calls = 0;
    const handler = createWorkshopSignupHandler({env, fetchImpl: async (url, options) => {
      calls += 1;
      assert.equal(url, env.WORKSHOP_ZAPIER_WEBHOOK_URL);
      const payload = JSON.parse(options.body);
      assert.equal(payload.event, 'cloud_agent_workshop_signup');
      assert.equal(payload.workflow, body.workflow);
      assert.equal(payload.deploymentTimeline, '1 month');
      assert.equal(payload.dates, 'October 26–November 9, 2026');
      assert.equal(payload.source, `${origin}/`);
      assert.match(payload.slackMessage, /Deployment timeline:\* 1 month/);
      return Response.json({status: 'success'});
    }});
    const result = await invoke(handler, {headers: {origin, 'sec-fetch-site': 'cross-site'}, body: {
      ...body, source: `${origin}/?variant=animated#signup`, deploymentTimeline: '1 month',
    }});
    assert.equal(result.status, 200);
    assert.equal(result.headers['Access-Control-Allow-Origin'], origin);
    assert.equal(result.headers.Vary, 'Origin');
    assert.deepEqual(result.body, {ok: true, submissionId: body.submissionId});
    assert.equal(calls, 1);
  }
});

test('HANDOFF CORS does not accept lookalike origins, non-HTTPS origins, or arbitrary hosts', async () => {
  const handler = createWorkshopSignupHandler({env, fetchImpl: neverFetch});
  const badOrigins = [
    'https://handoff.litellm.ai.evil.example', 'https://evil.handoff.litellm.ai',
    'https://litellm-handoff.onrender.com.evil.example', 'https://another.onrender.com',
    'http://handoff.litellm.ai', 'https://handoff.litellm.ai:444',
    'https://handoff.litellm.ai/', 'https://user@handoff.litellm.ai',
  ];
  for (const origin of badOrigins) {
    for (const method of ['POST', 'OPTIONS']) {
      const result = await invoke(handler, {method, headers: {origin, 'access-control-request-method': 'POST'}});
      assert.equal(result.status, 403, origin);
      assert.equal(result.headers['Access-Control-Allow-Origin'], undefined);
    }
  }
  assert.equal((await invoke(handler, {headers: {origin: handoffOrigins[0], host: 'evil.example'}})).status, 403);
});

test('HANDOFF validation failures include CORS headers and never reach Zapier', async () => {
  const origin = handoffOrigins[0];
  const handler = createWorkshopSignupHandler({env, fetchImpl: neverFetch});
  for (const invalid of [
    {...body, source: origin, deploymentTimeline: 'Tomorrow'},
    {...body, source: origin, deploymentTimeline: 30},
    {...body, source: origin, deploymentTimeline: 'x'.repeat(101)},
    {...body, source: 'https://docs.litellm.ai/blog/cloud-agent-workshop'},
    {...body, source: origin, workflowGoals: body.workflow},
  ]) {
    const result = await invoke(handler, {headers: {origin}, body: invalid});
    assert.equal(result.status, 400);
    assert.equal(result.headers['Access-Control-Allow-Origin'], origin);
  }
  const unavailable = await invoke(createWorkshopSignupHandler({env: {VERCEL: '1'}, fetchImpl: neverFetch}), {
    headers: {origin}, body: {...body, source: origin},
  });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers['Access-Control-Allow-Origin'], origin);
});

test('HANDOFF upstream errors remain readable without exposing upstream details', async () => {
  const origin = handoffOrigins[0];
  const handler = createWorkshopSignupHandler({env, fetchImpl: async () => { throw new Error('private hook failure'); }});
  const result = await invoke(handler, {headers: {origin}, body: {...body, source: origin}});
  assert.equal(result.status, 502);
  assert.equal(result.headers['Access-Control-Allow-Origin'], origin);
  assert.doesNotMatch(JSON.stringify(result), /private hook|zapier|test-owner/);
});

test('HANDOFF rejects personal email providers before contacting Zapier', async () => {
  const domains = [
    'gmail.com', 'googlemail.com',
    'hotmail.com', 'hotmail.co.uk', 'hotmail.fr', 'hotmail.de', 'hotmail.it', 'hotmail.es', 'hotmail.ca', 'hotmail.com.au', 'hotmail.co.jp',
    'outlook.com', 'outlook.co.uk', 'outlook.fr', 'outlook.de', 'outlook.it', 'outlook.es', 'outlook.com.au', 'outlook.jp',
    'live.com', 'live.co.uk', 'live.fr', 'live.de', 'live.it', 'live.nl', 'live.ca', 'live.com.au', 'msn.com',
    'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'yahoo.in', 'yahoo.co.jp', 'yahoo.fr', 'yahoo.de', 'yahoo.it', 'yahoo.es', 'yahoo.ca',
    'yahoo.com.au', 'yahoo.com.br', 'yahoo.com.mx', 'yahoo.com.sg', 'yahoo.com.hk', 'yahoo.co.id', 'yahoo.com.tw', 'yahoo.co.kr', 'ymail.com', 'rocketmail.com',
    'icloud.com', 'me.com', 'mac.com', 'aol.com', 'aim.com',
    'proton.me', 'protonmail.com', 'protonmail.ch', 'pm.me', 'fastmail.com', 'fastmail.fm', 'hey.com', 'mail.com', 'email.com',
    'gmx.com', 'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch',
  ];
  for (const origin of handoffOrigins) {
    for (const domain of domains) {
      const handler = createWorkshopSignupHandler({env, fetchImpl: neverFetch});
      const result = await invoke(handler, {
        headers: {origin}, body: {...body, source: `${origin}/`, email: `  Alex+work@${domain.toUpperCase()}  `},
      });
      assert.equal(result.status, 400, `${origin}: ${domain}`);
      assert.deepEqual(result.body, {
        code: 'WORK_EMAIL_REQUIRED',
        error: 'Enter your work email address. Personal email addresses are not accepted.',
      });
      assert.equal(result.headers['Access-Control-Allow-Origin'], origin);
    }
  }
});

test('HANDOFF rejects personal-provider subdomains and streamed signup bodies', async () => {
  const origin = handoffOrigins[0];
  const handler = createWorkshopSignupHandler({env, fetchImpl: neverFetch});
  for (const email of ['alex@mail.gmail.com', 'alex@a.b.hotmail.co.uk', 'alex@sub.outlook.com', 'alex@sub.yahoo.co.jp', 'alex@gmail.com.', 'alex@HOTMAIL.COM..']) {
    const result = await invoke(handler, {
      headers: {origin}, stream: JSON.stringify({...body, source: `${origin}/`, email}),
    });
    assert.equal(result.status, 400, email);
    assert.equal(result.body.code, 'WORK_EMAIL_REQUIRED');
  }
});

test('HANDOFF returns the work-email error for partial intake without contacting Zapier', async () => {
  const origin = handoffOrigins[0];
  const handler = createWorkshopSignupHandler({env, fetchImpl: neverFetch});
  const result = await invoke(handler, {headers: {origin}, body: {email: 'handoff-validation-check@validation.invalid.gmail.com'}});
  assert.equal(result.status, 400);
  assert.equal(result.body.code, 'WORK_EMAIL_REQUIRED');
  assert.equal(result.headers['Access-Control-Allow-Origin'], origin);
});

test('HANDOFF accepts company email domains without matching personal-provider substrings', async () => {
  const origin = handoffOrigins[0];
  for (const email of ['alex@company.com', 'alex@gmail.company.com', 'alex@notgmail.com', 'alex@company-gmail.com', 'alex@outlook.company.com', 'alex@fastmail.company.com']) {
    let calls = 0;
    const handler = createWorkshopSignupHandler({env, fetchImpl: async (_url, options) => {
      calls += 1;
      assert.equal(JSON.parse(options.body).email, email);
      return Response.json({status: 'success'});
    }});
    const result = await invoke(handler, {headers: {origin}, body: {...body, source: `${origin}/`, email: ` ${email} `}});
    assert.equal(result.status, 200, email);
    assert.equal(calls, 1);
  }
});

test('HANDOFF email restriction does not change the original docs signup policy', async () => {
  let calls = 0;
  const handler = createWorkshopSignupHandler({env, fetchImpl: async () => {
    calls += 1;
    return Response.json({status: 'success'});
  }});
  assert.equal((await invoke(handler, {body: {...body, email: 'alex@gmail.com'}})).status, 200);
  assert.equal(calls, 1);
});

test('reserved domains are rejected on every workshop origin, including partial and streamed requests', async () => {
  const emails = [
    'qa@example.com', 'qa@EXAMPLE.NET', 'qa@team.example.org',
    'qa@example.com.', 'qa@example.org..', 'qa@company.example',
    'qa@company.test', 'qa@company.invalid', 'qa@company.localhost',
    'qa@localhost', 'qa@a.b.example.com',
  ];
  for (const origin of ['https://docs.litellm.ai', ...handoffOrigins]) {
    for (const email of emails) {
      const handler = createWorkshopSignupHandler({env, fetchImpl: neverFetch});
      const result = await invoke(handler, {headers: {origin}, stream: JSON.stringify({email})});
      assert.equal(result.status, 400, `${origin} ${email}`);
      assert.equal(result.body.code, 'INVALID_EMAIL_DOMAIN');
    }
  }
});

test('shell probes in name and company never reach the webhook on any workshop origin', async () => {
  const probes = [
    '$(sleep 5)', '`sleep 5`', ';sleep 5;', 'Example && curl https://probe.invalid',
    'Example | bash', 'Example || whoami', '${IFS}sleep${IFS}5', 'Example\nsleep 5',
  ];
  for (const origin of ['https://docs.litellm.ai', ...handoffOrigins]) {
    for (const field of ['name', 'company']) {
      for (const probe of probes) {
        const handler = createWorkshopSignupHandler({env, fetchImpl: neverFetch});
        const result = await invoke(handler, {headers: {origin}, body: {...body, source: `${origin}/`, [field]: probe}});
        assert.equal(result.status, 400, `${origin} ${field} ${probe}`);
      }
    }
  }
});

test('international names and ordinary company punctuation remain valid; workflows can discuss code', async () => {
  for (const [name, company] of [
    ['Ananya Rao', 'Cloud Research Pty. Ltd.'],
    ["María-José O’Neill", 'AT&T (Australia) Pty. Ltd.'],
    ['李小龍', '研究開発株式会社'],
    ['محمد أحمد', 'Smith & Sons / R&D'],
    ['Zoë D’Arcy', 'C++ Labs'],
  ]) {
    const workflow = 'Run `sleep 5`; use $(date) in shell scripts.\nThen open a pull request.';
    const handler = createWorkshopSignupHandler({env, fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.name, name);
      assert.equal(payload.company, company);
      assert.equal(payload.workflow, workflow);
      return Response.json({status: 'success'});
    }});
    assert.equal((await invoke(handler, {body: {...body, name, company, workflow}})).status, 200);
  }
});

test('source paths cannot carry attacker-controlled text into notifications through any workshop origin', async () => {
  for (const origin of ['https://docs.litellm.ai', ...handoffOrigins]) {
    const canonicalPath = handoffOrigins.includes(origin) ? '/' : '/blog/cloud-agent-workshop';
    for (const suffix of ['/$(sleep%206)', '/;sleep%206;', '/nested/path?campaign=social#signup']) {
      const handler = createWorkshopSignupHandler({env, fetchImpl: async (_url, options) => {
        const payload = JSON.parse(options.body);
        assert.equal(payload.source, `${origin}${canonicalPath}`);
        assert.doesNotMatch(payload.slackMessage, /sleep|nested/);
        return Response.json({status: 'success'});
      }});
      assert.equal((await invoke(handler, {headers: {origin}, body: {...body, source: `${origin}${suffix}`}})).status, 200);
    }
  }
});

test('per-client limits ignore spoofed forwarding headers and trust Vercel ingress only on Vercel', async () => {
  for (const platform of [undefined, '1']) {
    let now = 0;
    const handler = createWorkshopSignupHandler({env: {...env, VERCEL: platform}, now: () => now, fetchImpl: neverFetch});
    for (let i = 0; i < 20; i += 1) {
      const result = await invoke(handler, {body: {email: 'qa@example.com'}, headers: {
        'x-forwarded-for': `198.51.100.${i}`,
        ...(platform === '1' ? {'x-vercel-forwarded-for': '203.0.113.50'} : {'x-vercel-forwarded-for': `198.51.100.${i}`}),
      }});
      assert.equal(result.status, 400);
    }
    const blocked = await invoke(handler, {body: {email: 'qa@example.com'}, headers: {
      'x-forwarded-for': '192.0.2.55',
      'x-vercel-forwarded-for': platform === '1' ? '203.0.113.50' : '192.0.2.55',
    }});
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers['Retry-After'], '60');
    now = 60000;
    assert.equal((await invoke(handler, {body: {email: 'qa@example.com'}})).status, 400);
  }
});

test('invalid Vercel forwarding values fall back to the socket; different real clients have separate limits', async () => {
  const handler = createWorkshopSignupHandler({env, fetchImpl: neverFetch});
  for (let i = 0; i < 20; i += 1) {
    assert.equal((await invoke(handler, {body: {email: 'qa@example.com'}, headers: {
      'x-vercel-forwarded-for': `198.51.100.${i}, 203.0.113.4`,
    }})).status, 400);
  }
  assert.equal((await invoke(handler, {body: {email: 'qa@example.com'}, headers: {'x-vercel-forwarded-for': 'invalid'}})).status, 429);
  assert.equal((await invoke(handler, {body: {email: 'qa@example.com'}, headers: {'x-vercel-forwarded-for': '198.51.100.5'}})).status, 400);
});

test('successful retries with the same submission ID forward only once and altered payloads conflict', async () => {
  let calls = 0;
  const handler = createWorkshopSignupHandler({env, fetchImpl: async () => { calls += 1; return Response.json({status: 'success'}); }});
  for (let i = 0; i < 5; i += 1) {
    const result = await invoke(handler);
    assert.equal(result.status, 200);
    assert.equal(result.body.submissionId, body.submissionId);
  }
  assert.equal((await invoke(handler, {body: {...body, company: 'Different company'}})).status, 409);
  assert.equal(calls, 1);
});

test('concurrent retries share one upstream request and receive the same confirmation', async () => {
  let calls = 0, release, signalStarted;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const handler = createWorkshopSignupHandler({env, fetchImpl: async () => {
    calls += 1;
    signalStarted();
    await new Promise(resolve => { release = resolve; });
    return Response.json({status: 'success'});
  }});
  const first = invoke(handler);
  await started;
  const second = invoke(handler);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1);
  release();
  const results = await Promise.all([first, second]);
  assert.deepEqual(results.map(result => result.status), [200, 200]);
  assert.deepEqual(results[0].body, results[1].body);
});

test('failed concurrent requests are not cached as successes and a later retry can recover', async () => {
  let calls = 0, release, signalStarted;
  const started = new Promise(resolve => { signalStarted = resolve; });
  const handler = createWorkshopSignupHandler({env, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) {
      signalStarted();
      await new Promise(resolve => { release = resolve; });
      throw new Error('Upstream unavailable');
    }
    return Response.json({status: 'success'});
  }});
  const first = invoke(handler);
  await started;
  const second = invoke(handler);
  await new Promise(resolve => setImmediate(resolve));
  release();
  assert.deepEqual((await Promise.all([first, second])).map(result => result.status), [502, 502]);
  assert.equal((await invoke(handler)).status, 200);
  assert.equal((await invoke(handler)).status, 200);
  assert.equal(calls, 2);
});

test('confirmed retry records expire after one hour', async () => {
  let now = 0, calls = 0;
  const handler = createWorkshopSignupHandler({env, now: () => now, fetchImpl: async () => { calls += 1; return Response.json({status: 'success'}); }});
  assert.equal((await invoke(handler)).status, 200);
  now = 3599999;
  assert.equal((await invoke(handler)).status, 200);
  assert.equal(calls, 1);
  now = 3600000;
  assert.equal((await invoke(handler)).status, 200);
  assert.equal(calls, 2);
});

test('retry cache stays bounded by evicting old confirmed entries while recent retries remain deduplicated', async () => {
  let now = 0, calls = 0;
  const handler = createWorkshopSignupHandler({env, now: () => now, fetchImpl: async () => { calls += 1; return Response.json({status: 'success'}); }});
  const options = i => ({
    body: {...body, email: `attendee-${i}@litellm.ai`, submissionId: `bounded-cache-${i}`},
    headers: {'x-vercel-forwarded-for': `198.51.100.${i % 200 + 1}`},
  });
  for (let i = 0; i <= 1000; i += 1) {
    now = i * 1000;
    assert.equal((await invoke(handler, options(i))).status, 200, `entry ${i}`);
  }
  assert.equal(calls, 1001);
  assert.equal((await invoke(handler, options(1000))).status, 200);
  assert.equal(calls, 1001);
  assert.equal((await invoke(handler, options(0))).status, 200);
  assert.equal(calls, 1002);
});
