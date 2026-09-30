// Posts to the "Talk to sales form" on www.litellm.ai/enterprise through
// Webflow's public form endpoint, with the same payload webflow.js sends from
// the website. Webflow records it as an ordinary submission of that form, so
// the Zap that watches the form (sales sheet, Slack, Calendly join) runs with
// no change on the Webflow or Zapier side. `source` carries the docs URL.
//
// If the form is ever rebuilt in the Designer, its element id changes; read
// the new data-wf-element-id off the <form> on /enterprise and update it here.

const SITE_ID = '69eb241da3f923869c226875';
const FORM = {
  name: 'Talk to sales form',
  pageId: '69fcbe97c6ffb21cbc7c3d8c',
  elementId: '815fd284-8dd9-1f9d-f7ee-1bce5ac92ad0',
  domain: 'www.litellm.ai',
};
const ENDPOINT = `https://webflow.com/api/v1/form/${SITE_ID}`;

// Every field the website form sends, in its order. The website hides
// linkedin, current-stage, purchase-timing and how-hear and sends them empty;
// the docs do the same so each Zap step finds the keys it maps.
export const FIELD_ORDER = [
  'intent',
  'first-name',
  'email',
  'company-name',
  'company-size',
  'hoping-to-learn',
  'phone',
  'notes',
  'linkedin',
  'current-stage',
  'purchase-timing',
  'how-hear',
  'submission-id',
  'lead-score',
  'lead-route',
  'lead-routing-reason',
];

export async function submitToWebflow(fields) {
  const body = new URLSearchParams();
  body.append('name', FORM.name);
  body.append('pageId', FORM.pageId);
  body.append('elementId', FORM.elementId);
  body.append('domain', FORM.domain);
  body.append('collectionId', '');
  body.append('itemSlug', '');
  body.append('source', window.location.href);
  body.append('test', 'false');
  FIELD_ORDER.forEach((key) => {
    const v = fields[key];
    body.append(`fields[${key}]`, v == null ? '' : String(v).trim());
  });
  body.append('dolphin', 'false');

  // A form-encoded POST is a simple CORS request, so there is no preflight.
  const res = await fetch(ENDPOINT, {method: 'POST', body});
  let data = null;
  try {
    data = await res.json();
  } catch {
    // fall through to the check below
  }
  if (!res.ok || !data || data.code !== 200) {
    throw new Error(data?.msg || `Webflow form endpoint returned ${res.status}`);
  }
  return data;
}
