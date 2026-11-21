// Page index for the docs MCP server, written at build time next to the .md
// files plugins/llms.js emits:
//
//   build/mcp-pages.json  every published page: url, .md path, title, type,
//                         and its headings with anchor ids and character
//                         ranges, so a server can return one section
//   build/mcp-nav.json    the sidebars as a plain tree of titles and urls
//
// The server only serves pages listed here, so the list doubles as its
// allowlist: unlisted and draft pages never reach it.

const {createSlugger, parseMarkdownHeadingId} = require('@docusaurus/utils');

const FRONT_MATTER = /^---\n[\s\S]*?\n---\n/;
// Up to three spaces of indent, optionally inside blockquotes, as CommonMark
// allows. A closing #-run only counts after whitespace ("C#" keeps its #).
const HEADING = /^(?: {0,3}>[ \t]?)* {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/;

// Heading text as Docusaurus reads it (mdast toString): links and images keep
// their text, code keeps its content, emphasis and tags go.
function plainText(md) {
  // Code spans keep their text untouched, so split them out first.
  return md
    .split(/(`+[^`]*`+)/)
    .map((part, i) => {
      if (i % 2) return part.replace(/^`+|`+$/g, '');
      return part
        .replace(/!\[((?:[^[\]]|\[[^\]]*\])*)\]\([^)]*\)/g, '$1')
        .replace(/\[((?:[^[\]]|\[[^\]]*\])*)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]+>/g, '')
        // Emphasis only counts when it hugs its text, as in CommonMark:
        // "** API**" stays literal.
        .replace(/(\*\*|__)(?!\s)(.+?)(?<!\s)\1/g, '$2')
        .replace(/(^|[^\w*])\*(?!\s)([^*]+?)(?<!\s)\*(?!\w)/g, '$1$2')
        .replace(/(^|\W)_(?!\s)([^_]+?)(?<!\s)_(?!\w)/g, '$1$2')
        .replace(/\\([\\`*_{}[\]()#+\-.!|<>])/g, '$1');
    })
    .join('')
    .trim();
}

// Headings of a markdown page with the anchor id the rendered page uses and
// the [start, end) character range of the section each one opens. A section
// ends where the next heading of the same or a higher level starts. Headings
// at or after sourceEnd were added by the export and get no anchor id.
//
// titleInSource says whether the page's H1 came from its source. Docusaurus
// slugs that H1 (so a later "## Logging" under "# Logging" is logging-1) but
// renders it without an id, so the H1 gets no anchor here either. A title
// taken from front matter is rendered by the theme and takes no slug.
function headingIndex(markdown, {titleInSource = true, sourceEnd = Infinity} = {}) {
  const slugger = createSlugger();
  const headings = [];
  const fm = FRONT_MATTER.exec(markdown);
  let offset = fm ? fm[0].length : 0;
  let fence = null;
  let seenTitle = false;
  for (const line of markdown.slice(offset).split('\n')) {
    const start = offset;
    offset += line.length + 1;
    const trimmed = line.trim();
    const fenceMatch = /^(```+|~~~+)/.exec(trimmed);
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1];
      else if (trimmed.startsWith(fence) && trimmed.replace(/[`~]/g, '') === '') fence = null;
      continue;
    }
    if (fence) continue;
    const match = HEADING.exec(line);
    if (!match) continue;
    const depth = match[1].length;
    const {text, id: explicitId} = parseMarkdownHeadingId(match[2]);
    const title = plainText(text);
    if (!title) continue;
    let id = explicitId || null;
    if (start >= sourceEnd) {
      // Added by the markdown export (for example "Related pages"); the
      // rendered page has no such heading, so it gets no anchor.
      id = null;
    } else if (depth === 1 && !seenTitle) {
      seenTitle = true;
      if (titleInSource && !explicitId) slugger.slug(title);
      id = null;
    } else if (!id) {
      id = slugger.slug(title);
    }
    headings.push({depth, title, id, start});
  }
  const length = markdown.length;
  for (let i = 0; i < headings.length; i++) {
    const next = headings.slice(i + 1).find((h) => h.depth <= headings[i].depth);
    headings[i].end = next ? next.start : length;
  }
  return headings;
}

// The .md file a permalink is served from, relative to the build directory.
const mdFile = (permalink) => (permalink.endsWith('/') ? `${permalink}index.md` : `${permalink}.md`).replace(/^\//, '');

function pageEntry({url, title, type, markdown, titleInSource = true, sourceEnd}) {
  return {
    url,
    md: mdFile(url),
    title,
    type,
    length: markdown.length,
    headings: headingIndex(markdown, {titleInSource, sourceEnd}),
  };
}

// The sidebars as {title, url?, items?} trees. Docs resolve to their
// permalink; categories keep their landing page when they have one; html
// items and docs that are not published are dropped.
function navTree(sidebars, byId, clean = (s) => String(s || '').trim()) {
  const node = (item) => {
    if (item.type === 'doc' || item.type === 'ref') {
      const doc = byId.get(item.id);
      return doc ? {title: clean(item.label || doc.title), url: doc.permalink} : null;
    }
    if (item.type === 'link') return {title: clean(item.label), url: item.href};
    if (item.type !== 'category') return null;
    const link = item.link;
    let url;
    if (link?.type === 'doc') url = byId.get(link.id)?.permalink;
    else if (link?.type === 'generated-index') url = link.permalink;
    const items = (item.items || []).map(node).filter(Boolean);
    if (!items.length && !url) return null;
    return {title: clean(item.label), ...(url ? {url} : {}), ...(items.length ? {items} : {})};
  };
  const tree = {};
  for (const [name, items] of Object.entries(sidebars)) {
    tree[name] = (items || []).map(node).filter(Boolean);
  }
  return tree;
}

module.exports = {headingIndex, pageEntry, navTree, mdFile, plainText};
