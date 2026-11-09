const cheerio = require('cheerio');
const {isContentUrl, contentPage} = require('./content');
const {operationStructure} = require('./openapi');
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const unique = values => [...new Map(values.filter(Boolean).map(value => [JSON.stringify(value), value])).values()];

function extractStructure(html, url) {
  const $ = cheerio.load(html);
  const article = $('.theme-doc-markdown, article .markdown').first();
  article.find('script, style, .hash-link').remove();
  const meta = {};
  $('meta[name], meta[property]').each((_, element) => {
    const name = $(element).attr('name') || $(element).attr('property');
    if (['description', 'keywords', 'og:title', 'og:description', 'article:section', 'article:tag'].includes(name)) meta[name] = clean($(element).attr('content'));
  });
  const textList = selector => unique(article.find(selector).map((_, element) => clean($(element).text())).get());
  return {
    title: clean($('title').text()), metadata: meta,
    breadcrumbs: unique($('.breadcrumbs__item').map((_, element) => clean($(element).text())).get()),
    outline: article.find('h1,h2,h3,h4,h5,h6').map((_, element) => ({level: Number(element.tagName[1]), title: clean($(element).text()), id: $(element).attr('id') || ''})).get(),
    tabs: textList('[role="tab"], .tabs__item'),
    links: unique(article.find('a[href]').map((_, element) => {
      const label = clean($(element).text());
      if (!label) return null;
      try {const target = new URL($(element).attr('href'), `https://docs.litellm.ai${url}`);return /^https?:$/.test(target.protocol) ? {label, url: target.href} : null;} catch {return null;}
    }).get()),
    tables: article.find('table').map((_, table) => ({caption: clean($(table).find('caption').text()), columns: $(table).find('tr').first().find('th,td').map((_, cell) => clean($(cell).text())).get()})).get(),
    images: unique(article.find('img').map((_, element) => ({alt: clean($(element).attr('alt')), title: clean($(element).attr('title')), file: ($(element).attr('src') || '').split('/').at(-1), caption: clean($(element).closest('figure').find('figcaption').text())})).get()),
    codeTitles: textList('[class*="codeBlockTitle"]'),
    codeLanguages: unique(article.find('pre,code').map((_, element) => (($(element).attr('class') || '').match(/language-([\w-]+)/) || [])[1]).get()),
    admonitionTitles: textList('[class*="admonitionHeading"]'),
    contents: unique($('.table-of-contents a').map((_, element) => clean($(element).text())).get()),
  };
}

async function buildStructure(directory) {
  const fs = require('node:fs/promises'), path = require('node:path');
  const docs = JSON.parse(await fs.readFile(path.join(directory, 'search-documents.json'), 'utf8'));
  const grouped = new Map();
  for (const doc of docs) {
    const url = contentPage(doc.url);
    if (!grouped.has(url)) grouped.set(url, []);
    grouped.get(url).push(doc);
  }
  const urls = [...grouped.keys()].filter(isContentUrl);
  const pages = {}, failures = []; let next = 0;
  await Promise.all(Array.from({length: 8}, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      if (url.startsWith('/api-reference/#/')) {pages[url] = operationStructure(grouped.get(url)); continue;}
      try {
        const response = await fetch(`https://docs.litellm.ai${url}`, {signal: AbortSignal.timeout(15000)});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        pages[url] = extractStructure(await response.text(), url);
      } catch {failures.push(url);}
    }
  }));
  await fs.writeFile(path.join(directory, 'search-structure.json'), JSON.stringify({fetchedAt: new Date().toISOString(), pages}));
  console.log(JSON.stringify({pages: Object.keys(pages).length, failures, largestBytes: Math.max(...Object.values(pages).map(page => Buffer.byteLength(JSON.stringify(page))))}));
}
if (require.main === module) buildStructure(process.argv[2] || '.cache-loader/jev-search').catch(error => {console.error(error.message);process.exitCode = 1;});
module.exports = {extractStructure};
