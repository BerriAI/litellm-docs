// The lead scoring and routing that www.litellm.ai/enterprise runs before it
// submits (the "codex-enterprise-unified-routing" custom code in Webflow).
// Keep this in step with the website: the Zap and the sales sheet read
// lead-score, lead-route and lead-routing-reason from every submission.

export const CALENDLY = {
  SDR: 'https://calendly.com/varoon-berri/intro-call',
  AE: 'https://calendly.com/d/cx2b-bjm-s77',
};

const POINTS = {
  intent: {'30-day-trial': 10, 'talk-to-sales': 20, other: 0},
  gateway: {
    'Using LiteLLM OSS today': 20,
    'Using another or homegrown gateway': 15,
    'Calling model providers directly': 8,
    'Still exploring': 0,
  },
  timing: {
    'Within a month': 20,
    'In the next 1–3 months': 15,
    'In the next 3–6 months': 5,
    'Just gathering information': 0,
  },
  size: {
    '1-49': 0,
    '50-199': 5,
    '200-499': 10,
    '500-999': 25,
    '1000-4999': 35,
    '5000-9999': 50,
    '10000+': 55,
  },
};

export const INTENTS = [
  {value: '30-day-trial', title: 'Get a 30-day trial key', note: 'Evaluate Enterprise in your own environment.', submit: 'Get my trial key'},
  {value: 'talk-to-sales', title: 'Talk to sales', note: 'Discuss pricing, procurement, or rollout.', submit: 'See available times'},
  {value: 'other', title: 'Something else', note: 'Product, partnership, or general question.', submit: 'Send request'},
];

export const COMPANY_SIZES = [
  ['1-49', '1–49 employees'],
  ['50-199', '50–199 employees'],
  ['200-499', '200–499 employees'],
  ['500-999', '500–999 employees'],
  ['1000-4999', '1,000–4,999 employees'],
  ['5000-9999', '5,000–9,999 employees'],
  ['10000+', '10,000+ employees'],
];

// Only the largest companies see the three extra questions, as on the website.
export const ENTERPRISE_SIZE = '10000+';

function route(size) {
  if (size === '5000-9999' || size === '10000+') return {route: 'AE', reason: 'Company size is 5,000+'};
  if (size === '500-999' || size === '1000-4999') return {route: 'SDR', reason: 'Company size is 500–4,999'};
  return {route: 'Sales email follow-up', reason: 'Company size is below 500'};
}

export function scoreLead({intent, size, stage = '', timing = ''}) {
  const {route: r, reason} = route(size);
  const score =
    (POINTS.intent[intent] || 0) + (POINTS.gateway[stage] || 0) + (POINTS.timing[timing] || 0) + (POINTS.size[size] || 0);
  return {intent, score, route: r, reason};
}

export const meetsSales = (result) => result.route === 'AE' || result.route === 'SDR';

// The same thank-you copy the website shows after a submission.
export function successCopy(result) {
  const call = meetsSales(result);
  if (result.intent === '30-day-trial') {
    return {
      heading: 'Thanks, your trial request is in.',
      body: call
        ? 'Your request is confirmed. If you would like help planning the evaluation, choose a time below.'
        : 'You will get an email from our team with next steps.',
    };
  }
  if (result.intent === 'talk-to-sales') {
    return {
      heading: call ? 'Thanks, let’s talk.' : 'Thank you for your interest in LiteLLM.',
      body: call ? 'Choose a time that works for you.' : 'You will get an email from our sales team shortly.',
    };
  }
  return {
    heading: call ? 'Thanks, let’s connect.' : 'Thanks, your request is in.',
    body: call ? 'Choose a time that works for you.' : 'You will get an email from our team shortly.',
  };
}

// Calendly only accepts its utm_* and salesforce_uuid hidden params. The
// website sends the submission id and routing signals through them so the
// Calendly Zap can join a booking to its lead; the docs send the same.
export function calendlyUrl(result, {name, email, submissionId}) {
  const base = result.route === 'AE' ? CALENDLY.AE : CALENDLY.SDR;
  const p = new URLSearchParams({embed_domain: window.location.hostname, embed_type: 'Inline', hide_gdpr_banner: '1'});
  if (name) p.set('name', name);
  if (email) p.set('email', email);
  p.set('utm_source', 'litellm-enterprise-form');
  if (submissionId) p.set('utm_term', submissionId);
  p.set('utm_campaign', result.route);
  p.set('utm_content', String(result.score));
  return `${base}?${p.toString()}`;
}

export function newSubmissionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
