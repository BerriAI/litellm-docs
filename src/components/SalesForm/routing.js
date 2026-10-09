// The lead routing that www.litellm.ai/enterprise runs before it submits
// (the "codex-enterprise-unified-routing" custom code in Webflow). Company
// size alone picks the route; the Zap and the sales sheet read lead-route and
// lead-routing-reason, and the route picks the Calendly page. The website
// also sends a lead score, which is no longer used; the docs leave it blank.

export const CALENDLY = {
  SDR: 'https://calendly.com/varoon-berri/intro-call',
  AE: 'https://calendly.com/d/cx2b-bjm-s77',
};

// The docs button that opens the form already says what the reader wants, so
// the form sets the intent from it and offers a one-line switch.
export const INTENTS = {
  'talk-to-sales': {
    title: 'Talk to sales',
    lead: 'Pricing, procurement, or rollout. Takes less than a minute.',
    submit: 'See available times',
    switchTo: '30-day-trial',
    switchLabel: 'Want a 30-day trial key instead?',
  },
  '30-day-trial': {
    title: 'Get a 30-day trial key',
    lead: 'Evaluate Enterprise in your own environment.',
    submit: 'Get my trial key',
    switchTo: 'talk-to-sales',
    switchLabel: 'Want to talk to sales instead?',
  },
};

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

export function routeLead({intent, size}) {
  return {intent, ...route(size)};
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
  return {
    heading: call ? 'Thanks, let’s talk.' : 'Thank you for your interest in LiteLLM.',
    body: call ? 'Choose a time that works for you.' : 'You will get an email from our sales team shortly.',
  };
}

// Calendly only accepts its utm_* and salesforce_uuid hidden params. The
// website sends the submission id and route through them so the
// Calendly Zap can join a booking to its lead; the docs send the same.
export function calendlyUrl(result, {name, email, submissionId}) {
  const base = result.route === 'AE' ? CALENDLY.AE : CALENDLY.SDR;
  const p = new URLSearchParams({embed_domain: window.location.hostname, embed_type: 'Inline', hide_gdpr_banner: '1'});
  if (name) p.set('name', name);
  if (email) p.set('email', email);
  p.set('utm_source', 'litellm-enterprise-form');
  if (submissionId) p.set('utm_term', submissionId);
  p.set('utm_campaign', result.route);
  return `${base}?${p.toString()}`;
}

export function newSubmissionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
