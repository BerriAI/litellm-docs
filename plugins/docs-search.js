const fs = require('node:fs/promises');
const path = require('node:path');
const cheerio = require('cheerio');
const {createIndex} = require('../search/engine');

function extractSections(html, url) {
  url = new URL(url, 'https://docs.litellm.ai').pathname;
  const $ = cheerio.load(html);
  if (($('meta[name="robots"]').attr('content') || '').includes('noindex') || $('meta[http-equiv="refresh"]').length) return [];
  const article = $('.theme-doc-markdown').first();
  if (!article.length) return [];
  article.find('script, style, button, .hash-link, [aria-hidden="true"]').remove();
  // Prism renders code lines with <br>, which text() otherwise joins together.
  article.find('br').replaceWith('\n');
  const title = article.find('h1').first().text().trim() || $('title').text().replace(/\s*\|.*$/, '').trim();
  const description = $('meta[name="description"]').attr('content') || '';
  const keywords = $('meta[name="keywords"]').attr('content') || '';
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

module.exports = function docsSearch() {
  return {
    name: 'litellm-docs-search',
    async postBuild({outDir, routesPaths, routesBuildMetadata, baseUrl}) {
      const documents = [];
      for (const route of [...new Set(routesPaths)].sort()) {
        if (!route.startsWith(`${baseUrl}docs/`) || routesBuildMetadata[route]?.noIndex) continue;
        const relative = decodeURIComponent(route.slice(baseUrl.length)).replace(/\/$/, '');
        const candidates = [path.join(outDir, relative, 'index.html'), path.join(outDir, `${relative}.html`)];
        let html;
        for (const file of candidates) {
          try { html = await fs.readFile(file, 'utf8'); break; }
          catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        if (!html) throw new Error(`Search could not read built route: ${route}`);
        documents.push(...extractSections(html, route));
      }
      if (!documents.length) throw new Error('Docs search index is empty');
      await fs.writeFile(path.join(outDir, 'search-index.json'), JSON.stringify(createIndex(documents)));
      await fs.writeFile(path.join(outDir, 'search-documents.json'), JSON.stringify(documents));
      console.log(`[docs-search] Indexed ${documents.length} passages from ${new Set(documents.map(d => d.url.split('#')[0])).size} public docs pages.`);
    },
  };
};
module.exports.extractSections = extractSections;
