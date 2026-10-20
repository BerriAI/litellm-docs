// Preserve section links from the single /docs/decisions page after it moved to subpages.
const ANCHORS = {
  'supported-providers': '/docs/decisions/providers',
  'self-hosted-laya-and-nimble': '/docs/decisions/providers#self-hosted-laya-and-nimble',
  v1decisions: '/docs/decisions/openai_format',
  'image-input': '/docs/decisions/openai_format#image-input',
  v1systemone: '/docs/decisions/systemone_format',
  'typesafe-images-box-questions-and-long-context': '/docs/decisions/typesafe_images',
  'sdk-usage': '/docs/decisions/sdk',
  'try-it-in-the-admin-ui': '/docs/decisions/admin_ui',
  'add-a-decision-model': '/docs/decisions/admin_ui#add-a-decision-model',
  'decisions-playground': '/docs/decisions/admin_ui#decisions-playground',
};

export function onRouteDidUpdate({location}) {
  if (location.pathname.replace(/\/$/, '') !== '/docs/decisions') return;
  const hash = location.hash.slice(1);
  const target = Object.prototype.hasOwnProperty.call(ANCHORS, hash) ? ANCHORS[hash] : undefined;
  if (target) window.location.replace(target);
}
