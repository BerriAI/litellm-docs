const fs = require('node:fs/promises');
const path = require('node:path');
const cheerio = require('cheerio');
const {createIndex} = require('../search/engine');
const {contentType, versionsIn, isContentUrl} = require('../search/content');

function extractSections(html, url, metadata = {}) {
  url = new URL(url, 'https://docs.litellm.ai').pathname;
  const $ = cheerio.load(html);
  if (($('meta[name="robots"]').attr('content') || '').includes('noindex') || $('meta[http-equiv="refresh"]').length) return [];
  const type = metadata.type || contentType(url);
  const article = type === 'blog' ? $('article .markdown').first() : $('.theme-doc-markdown').first();
  if (!article.length) return [];
  article.find('script, style, button, .hash-link, [aria-hidden="true"]').remove();
  // Prism renders code lines with <br>, which text() otherwise joins together.
  article.find('br').replaceWith('\n');
  const title = metadata.title || article.find('h1').first().text().trim() || $('title').text().replace(/\s*\|.*$/, '').trim();
  const description = metadata.description || $('meta[name="description"]').attr('content') || '';
  const keywords = [metadata.keywords, $('meta[name="keywords"]').attr('content')].filter(Boolean).join(' ');
  const breadcrumb = $('.breadcrumbs__item').map((_, item) => $(item).text().trim()).get().filter(Boolean).join(' / ');
  const sections = [];
  let heading = '', anchor = '', parts = [];
  function flush() {
    const text = parts.join('\n\n').trim();
    if (text) {
      // Bound retrieval passages without losing the rest of a long section.
      for (let offset = 0; offset < text.length; offset += 2600) {
        const chunk = text.slice(offset, offset + 3000);
        sections.push({id: `${url}#${anchor}:${sections.length}`, title, heading, description, keywords, breadcrumb,
          type, date: metadata.date || '', version: metadata.version || '', category: metadata.category,
          url: anchor ? `${url}#${encodeURIComponent(anchor)}` : url,
          text: chunk, snippet: chunk.replace(/\s+/g, ' ').slice(0, 240)});
        if (offset + 3000 >= text.length) break;
      }
    }
    parts = [];
  }
  article.find('h1,h2,h3,h4,h5,h6,p,pre,table,li').each((_, element) => {
    const node = $(element);
    if (node.parents('pre,table,li').length) return;
    if (/^h[1-6]$/.test(element.tagName)) {
      flush();
      heading = element.tagName === 'h1' ? '' : node.text().trim();
      anchor = element.tagName === 'h1' ? '' : node.attr('id') || '';
    } else {
      const text = element.tagName === 'table'
        ? node.find('tr').map((_, row) => $(row).find('th,td').map((_, cell) => $(cell).text().trim()).get().join(' | ')).get().join('\n')
        : node.text().trim();
      if (text) parts.push(text);
    }
  });
  flush();
  return sections;
}

function collectPages(allContent) {
  const pages = new Map();
  const add = metadata => {
    const route = metadata.permalink;
    if (!isContentUrl(route) || metadata.draft || metadata.unlisted || metadata.frontMatter?.draft || metadata.frontMatter?.unlisted) return;
    const type = contentType(route);
    const version = type === 'release' ? versionsIn(metadata.title || '')[0] : '';
    // Only article metadata enters this list; collection routes never do.
    if (type === 'release' && !version) return;
    const published = metadata.date || metadata.frontMatter?.date;
    pages.set(route, {type, title: metadata.title, description: metadata.description,
      date: published && Number.isFinite(Date.parse(published)) ? new Date(published).toISOString().slice(0, 10) : '',
      version: version || '', category: metadata.sidebar === 'integrationsSidebar' ? 'Integrations' : undefined,
      keywords: [metadata.frontMatter?.keywords, metadata.tags?.map(tag => tag.label)].flat(2).filter(Boolean).join(' ')});
  };
  for (const instance of Object.values(allContent['docusaurus-plugin-content-docs'] || {})) {
    for (const version of instance.loadedVersions || []) for (const doc of version.docs || []) add(doc);
  }
  for (const instance of Object.values(allContent['docusaurus-plugin-content-blog'] || {})) {
    for (const post of instance.blogPosts || []) add(post.metadata);
  }
  return pages;
}

async function buildSearchIndex({outDir, outputDir = outDir, pages, routesBuildMetadata = {}, baseUrl = '/'}) {
  const documents = [];
  for (const [route, metadata] of [...pages].sort(([a], [b]) => a.localeCompare(b))) {
    if (routesBuildMetadata[route]?.noIndex) continue;
    const relative = decodeURIComponent(route.slice(baseUrl.length)).replace(/\/$/, '');
    const candidates = [path.join(outDir, relative, 'index.html'), path.join(outDir, `${relative}.html`)];
    let html;
    for (const file of candidates) {
      try { html = await fs.readFile(file, 'utf8'); break; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    if (!html) throw new Error(`Search could not read built route: ${route}`);
    documents.push(...extractSections(html, route, metadata));
  }
  if (!documents.length) throw new Error('Docs search index is empty');
  await fs.writeFile(path.join(outputDir, 'search-index.json'), JSON.stringify(createIndex(documents)));
  await fs.writeFile(path.join(outputDir, 'search-documents.json'), JSON.stringify(documents));
  console.log(`[docs-search] Indexed ${documents.length} passages from ${new Set(documents.map(d => d.url.split('#')[0])).size} public pages.`);
  return documents;
}

module.exports = function docsSearch() {
  let pages = new Map();
  return {
    name: 'litellm-docs-search',
    allContentLoaded({allContent}) { pages = collectPages(allContent); },
    async postBuild(options) {
      await buildSearchIndex({...options, pages});
    },
  };
};
module.exports.extractSections = extractSections;
module.exports.collectPages = collectPages;
module.exports.buildSearchIndex = buildSearchIndex;
