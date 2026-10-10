const contentTypes = ['docs', 'blog', 'release'];
const contentType = url => url.startsWith('/blog/') ? 'blog' : url.startsWith('/release_notes/') ? 'release' : 'docs';
const versionPattern = /\bv?(\d+\.\d+\.\d+(?:(?:-?(?:rc|beta|alpha))\.?\d+|-stable(?:\.\d+)?)?)(?![\w.])/gi;
const normalizeVersion = value => value.toLowerCase().replace(/^v/, '').replace(/-stable$/, '').replace(/-?(rc|beta|alpha)\.?([0-9]+)$/, '-$1$2');
const versionsIn = text => [...String(text || '').matchAll(versionPattern)].map(match => normalizeVersion(match[1]));
const contentPath = value => value === '/docs' || /^\/(?:docs|blog|release_notes)\//.test(value);

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

module.exports = {contentTypes, contentType, versionsIn, normalizeVersion, isContentUrl, sourceLabel, sourceDetail};
