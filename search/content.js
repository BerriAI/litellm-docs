const contentTypes = ['docs', 'blog', 'release'];
const contentType = url => url.startsWith('/blog/') ? 'blog' : url.startsWith('/release_notes/') ? 'release' : 'docs';
const versionPattern = /\bv?(\d+\.\d+\.\d+(?:(?:-?(?:rc|beta|alpha))\.?\d+|-stable(?:\.\d+)?)?)(?![\w.])/gi;
const normalizeVersion = value => value.toLowerCase().replace(/^v/, '').replace(/-stable$/, '').replace(/-?(rc|beta|alpha)\.?([0-9]+)$/, '-$1$2');
const versionsIn = text => [...String(text || '').matchAll(versionPattern)].map(match => normalizeVersion(match[1]));
const contentPath = value => value === '/docs' || value === '/api-reference/' || /^\/(?:docs|blog|release_notes)\//.test(value);

const isOperationUrl = url => url.startsWith('/api-reference/#tag/') || url.startsWith('/api-reference/#/');
const contentPage = url => isOperationUrl(url) ? url : url.split('#')[0];

function categoryFor(url, breadcrumbs = []) {
  const pathname = url.split(/[?#]/)[0];
  if (/^\/docs\/providers(?:\/|$)/.test(pathname)) return 'Providers';
  // The first ancestor identifies the owning product or section. The final
  // breadcrumb is the page itself, and must not become its category.
  if (breadcrumbs.length > 1) return breadcrumbs[0] === 'LiteLLM Lens' ? 'Lens' : breadcrumbs[0];
  // Product landing pages and documents without breadcrumbs need a fallback.
  if (/^\/docs\/proxy\/lens(?:\/|$)/.test(pathname)) return 'Lens';
  if (/^\/docs\/mcp(?:[/_]|$)/.test(pathname)) return 'MCP Gateway';
  if (/^\/docs\/a2a(?:[/_]|$)/.test(pathname)) return 'Agent Gateway';
  if (/^\/docs\/auto_router(?:\/|$)/.test(pathname)) return 'Auto Router';
  if (/^\/docs\/(?:proxy\/|simple_proxy(?:\/|$))/.test(pathname)) return 'AI Gateway';
  if (/^\/docs\/(?:python_sdk|completion|caching|embedding|routing|set_keys)(?:[/_]|$)/.test(pathname)) return 'Python SDK';
  if (/^\/docs\/(?:observability|integrations|pass_through)\//.test(pathname)) return 'Integrations';
  return 'Docs';
}

function isContentUrl(value) {
  if (typeof value !== 'string' || !contentPath(value.split(/[?#]/)[0]) || /[\\\u0000-\u001f]/.test(value)) return false;
  try {
    const decoded = decodeURIComponent(value.split(/[?#]/)[0]);
    if (/[\\\u0000-\u001f]/.test(decoded) || decoded.split('/').includes('..')) return false;
    const url = new URL(value, 'https://docs.litellm.ai');
    return url.origin === 'https://docs.litellm.ai' && contentPath(url.pathname);
  } catch { return false; }
}

function sourceLabel(source) {
  if (source.type === 'blog') return 'Blog';
  if (source.type === 'release') return 'Release notes';
  return source.category === 'Integrations' ? 'Integration guide' : 'Docs';
}

function sourceDetail(source) {
  const parts = [];
  if (source.type === 'release' && source.version) parts.push(`v${source.version}`);
  if (source.type !== 'docs' && source.date && Number.isFinite(Date.parse(source.date))) {
    parts.push(new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'}).format(new Date(source.date)));
  } else if (source.type === 'docs' && source.category && !['Docs', 'Integrations'].includes(source.category)) {
    parts.push(source.category);
  }
  return parts.join(' · ');
}

module.exports = {contentTypes, contentType, contentPage, isOperationUrl, categoryFor, versionsIn, normalizeVersion, isContentUrl, sourceLabel, sourceDetail};
