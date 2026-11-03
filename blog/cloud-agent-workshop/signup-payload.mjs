export const WORKSHOP_TITLE = 'Workshop: Build a self-hosted cloud agent.';
export const WORKSHOP_DATES = 'October 19–30, 2026';

export const DEPLOYMENT_TIMELINES = ['ASAP', '1 month', '3 months', '6 months'];

export const FIELD_LIMITS = {
  name: 120,
  email: 254,
  company: 160,
  linkedin: 1000,
  workflow: 3000,
  onsiteInterest: 100,
  deploymentTimeline: 100,
};

const LABELS = {
  name: 'Name',
  email: 'Work email',
  company: 'Company',
  linkedin: 'LinkedIn profile',
  workflow: 'What are you hoping to achieve?',
  onsiteInterest: 'Would you like the LiteLLM team to work with you on-site?',
  deploymentTimeline: 'Deployment timeline',
};

const REQUIRED_FIELDS = ['name', 'email', 'company', 'linkedin', 'workflow'];

function linkedInProfile(value) {
  // URL parsing rewrites backslashes and strips some control characters.
  // Reject them before parsing rather than accepting a rewritten URL.
  if (/[\\\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    if (url.username || url.password || url.port) return null;
    if (url.hostname !== 'linkedin.com' && !url.hostname.endsWith('.linkedin.com')) return null;
    const parts = url.pathname.split('/');
    if (parts[1] !== 'in' || !parts[2] || parts.length > 4 || (parts.length === 4 && parts[3])) return null;
    const profile = decodeURIComponent(parts[2]);
    if (!profile || /[\/\\\s\u0000-\u001f\u007f]/.test(profile)) return null;
    return url;
  } catch {
    return null;
  }
}

export function normalizeWorkshopValues(raw) {
  const values = Object.fromEntries(Object.keys(FIELD_LIMITS).map(key => [
    key,
    typeof raw[key] === 'string' ? raw[key].trim() : '',
  ]));
  const linkedin = /^(?:[a-z0-9-]+\.)*linkedin\.com(?:\/|$)/i.test(values.linkedin)
    ? `https://${values.linkedin}`
    : values.linkedin;
  values.linkedin = linkedInProfile(linkedin)?.href || linkedin;
  return values;
}

export function validateWorkshopValues(values) {
  const errors = {};
  for (const key of REQUIRED_FIELDS) {
    if (!values[key]?.trim()) errors[key] = `${LABELS[key]} is required.`;
  }
  for (const [key, limit] of Object.entries(FIELD_LIMITS)) {
    if ((values[key]?.length || 0) > limit) errors[key] = `${LABELS[key]} must be ${limit} characters or fewer.`;
  }
  if (values.linkedin && !errors.linkedin && !linkedInProfile(values.linkedin)) {
    errors.linkedin = 'Enter a LinkedIn profile URL, such as https://www.linkedin.com/in/your-name.';
  }
  if (values.email && !errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (values.onsiteInterest && !errors.onsiteInterest && !['Yes', 'Maybe', 'No'].includes(values.onsiteInterest)) {
    errors.onsiteInterest = 'Choose an on-site preference from the list.';
  }
  if (values.deploymentTimeline && !errors.deploymentTimeline && !DEPLOYMENT_TIMELINES.includes(values.deploymentTimeline)) {
    errors.deploymentTimeline = 'Choose a deployment timeline from the list.';
  }
  return errors;
}

// Only intake answers and a stable request ID cross the browser/API boundary.
// Workshop event metadata and the destination are controlled by the server.
export function buildWorkshopSubmission(raw, {submissionId, source} = {}) {
  const values = normalizeWorkshopValues(raw);
  const errors = validateWorkshopValues(values);
  if (Object.keys(errors).length) throw new Error('Workshop intake is incomplete or exceeds a field limit.');
  if (typeof submissionId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(submissionId)) {
    throw new Error('Workshop submission metadata is required.');
  }
  return {...values, submissionId, source: typeof source === 'string' ? source : ''};
}
