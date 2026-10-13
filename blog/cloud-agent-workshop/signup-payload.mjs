export const WORKSHOP_TITLE = 'Workshop: Build a self-hosted cloud agent.';
export const WORKSHOP_DATES = 'October 19–30, 2026';

export const FIELD_LIMITS = {
  name: 120,
  email: 254,
  company: 160,
  companySize: 40,
  workflow: 3000,
  harness: 200,
  providers: 1000,
  sandbox: 1000,
  location: 200,
  onsiteInterest: 100,
  priorAttempts: 2000,
  litellmBlockers: 2000,
};

const LABELS = {
  name: 'Name',
  email: 'Work email',
  company: 'Company',
  companySize: 'Company size',
  workflow: 'First workflow',
  harness: 'Agent or harness',
  providers: 'AI providers',
  sandbox: 'Sandbox and cloud',
  location: 'Team location',
  onsiteInterest: 'Interest in an on-site build',
  priorAttempts: 'Previous attempts',
  litellmBlockers: 'Other LiteLLM problems',
};

const REQUIRED_FIELDS = ['name', 'email', 'company', 'companySize', 'workflow'];

export function normalizeWorkshopValues(raw) {
  return Object.fromEntries(Object.keys(FIELD_LIMITS).map(key => [
    key,
    typeof raw[key] === 'string' ? raw[key].trim() : '',
  ]));
}

export function validateWorkshopValues(values) {
  const errors = {};
  for (const key of REQUIRED_FIELDS) {
    if (!values[key]?.trim()) errors[key] = `${LABELS[key]} is required.`;
  }
  for (const [key, limit] of Object.entries(FIELD_LIMITS)) {
    if ((values[key]?.length || 0) > limit) errors[key] = `${LABELS[key]} must be ${limit} characters or fewer.`;
  }
  return errors;
}

// The shared Webflow helper only sends its FIELD_ORDER. Keep the workshop
// answers in its supported notes field so optional fields are not dropped.
// Preserve the existing talk-to-sales intent and routing contract.
export function buildWorkshopSubmission(raw, {submissionId, route, reason}) {
  const values = normalizeWorkshopValues(raw);
  const errors = validateWorkshopValues(values);
  if (Object.keys(errors).length) throw new Error('Workshop intake is incomplete or exceeds a field limit.');
  if (!submissionId || !route || !reason) throw new Error('Workshop submission metadata is required.');

  const notes = [
    WORKSHOP_TITLE,
    `Dates: ${WORKSHOP_DATES}`,
    'Format: Remote, two weeks; optional on-site work by arrangement',
    '',
    ...Object.entries(LABELS).map(([key, label]) => `${label}: ${values[key] || 'Not provided'}`),
  ].join('\n');

  return {
    intent: 'talk-to-sales',
    'first-name': values.name,
    email: values.email,
    'company-name': values.company,
    'company-size': values.companySize,
    'hoping-to-learn': `${WORKSHOP_TITLE}\n${WORKSHOP_DATES}\n${values.workflow}`,
    notes,
    'submission-id': submissionId,
    'lead-route': route,
    'lead-routing-reason': reason,
  };
}
