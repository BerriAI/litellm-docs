// Blog categories, derived from each post's tags. The first category whose
// tags match wins, so order is priority: a day 0 post tagged "routing" is
// still a model launch. Posts matching nothing land in "Gateway and product".
// CommonJS so plugins/llms.js can group posts the same way for agents.

const CATEGORIES = [
  {
    id: 'launches',
    label: 'Model launches',
    blurb: 'Day 0 support for new models, the day they ship.',
    tags: ['day 0 support'],
  },
  {
    id: 'townhall',
    label: 'Townhall',
    blurb: 'Monthly product and roadmap updates.',
    tags: ['townhall'],
  },
  {
    id: 'customers',
    label: 'Customer stories',
    blurb: 'How teams run LiteLLM in production.',
    tags: ['customer-story', 'case-study'],
  },
  {
    id: 'incidents',
    label: 'Security and incidents',
    blurb: 'Incident reports, security fixes, and compliance.',
    tags: ['incident-report', 'security', 'compliance'],
  },
  {
    id: 'autorouter',
    label: 'Auto Router',
    blurb: 'Routing each request to the cheapest model that can do the job.',
    tags: ['complexity-router', 'auto-router', 'routing', 'semantic-router', 'adaptive'],
  },
  {
    id: 'rust',
    label: 'Rust',
    blurb: 'Moving the gateway hot path to Rust.',
    tags: ['rust', 'rust-migration'],
  },
  {
    id: 'engineering',
    label: 'Engineering',
    blurb: 'Performance, reliability, and how the gateway works inside.',
    tags: ['engineering', 'performance', 'reliability', 'benchmarks', 'stability', 'redis', 'testing'],
  },
  {
    id: 'gateway',
    label: 'Gateway and product',
    blurb: 'New gateway features, agents, MCP, and product launches.',
    tags: [],
  },
];

const BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

function tagLabels(tags) {
  return (tags || []).map((t) => String(typeof t === 'string' ? t : t.label).toLowerCase());
}

function categoryOf(tags) {
  const labels = tagLabels(tags);
  return CATEGORIES.find((c) => c.tags.some((t) => labels.includes(t))) || BY_ID.gateway;
}

module.exports = {CATEGORIES, BY_ID, categoryOf};
