const MiniSearch = require('minisearch');

const stopWords = new Set('a an and are as at be by can do does for from how i in is it me my of on or our per please the this to use using what when where which with you your'.split(' '));
const forms = {
  caching: 'cache', cached: 'cache', caches: 'cache', keys: 'key', budgets: 'budget',
  limits: 'limit', limiting: 'limit', retries: 'retry', retrying: 'retry', fallbacks: 'fallback',
  tracking: 'track', balancing: 'balance', completions: 'completion', providers: 'provider',
  models: 'model', teams: 'team', logs: 'log', logging: 'log', tokens: 'token',
  settings: 'setting', credentials: 'credential', quickstart: 'setup', configuring: 'configure',
};
const words = text => text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [];
const tokenize = text => words(text.replace(/\b(?:set\s+up|quick\s+start)\b/gi, 'setup')).flatMap(word => word.includes('_') ? [word, ...word.split('_')] : [word]);
const normalize = term => stopWords.has(term) ? null : Object.hasOwn(forms, term) ? forms[term] : term;
const termsOf = text => [...new Set(tokenize(text).map(normalize).filter(Boolean))];
const indexTerm = term => {
  const canonical = normalize(term);
  return canonical && canonical !== term ? [term, canonical] : canonical;
};
const pageOptions = {
  fields: ['title', 'keywords', 'description', 'headings', 'path'],
  storeFields: ['title', 'url', 'description', 'category', 'breadcrumb', 'firstId'], tokenize, processTerm: indexTerm,
};
const passageOptions = {
  fields: ['title', 'heading', 'text'],
  storeFields: ['title', 'heading', 'url', 'text'], tokenize, processTerm: indexTerm,
};

function categoryFor(url) {
  if (/\/providers\//.test(url)) return 'Providers';
  if (/\/proxy\//.test(url) || /\/docs\/(mcp|a2a)/.test(url)) return 'Gateway';
  if (/\/docs\/(completion|caching|embedding|routing|set_keys)/.test(url)) return 'SDK';
  if (/\/docs\/(observability|integrations|pass_through)\//.test(url)) return 'Integrations';
  return 'Docs';
}

function createIndex(documents) {
  const grouped = new Map();
  for (const doc of documents) {
    const url = doc.url.split('#')[0];
    if (!grouped.has(url)) grouped.set(url, []);
    grouped.get(url).push(doc);
  }
  const pages = new MiniSearch(pageOptions);
  pages.addAll([...grouped].map(([url, sections]) => {
    const first = sections[0];
    return {id: url, url, firstId: first.id, title: first.title, category: categoryFor(url),
      breadcrumb: first.breadcrumb || categoryFor(url),
      description: first.description?.length > 30 ? first.description : first.text.replace(/Join the waitlist now/gi, '').replace(/\s+/g, ' ').trim().slice(0, 300),
      keywords: first.keywords || '',
      headings: [...new Set(sections.map(doc => doc.heading))].join(' '),
      path: url.replace(/[/_-]/g, ' ')};
  }));
  const passages = new MiniSearch(passageOptions);
  passages.addAll(documents);
  return {version: 2, pages, passages};
}

function loadIndex(json) {
  const data = JSON.parse(json);
  if (data.version !== 2) throw new Error('Rebuild the documentation search index');
  return {version: 2, pages: MiniSearch.loadJS(data.pages, pageOptions), passages: MiniSearch.loadJS(data.passages, passageOptions)};
}

// Adjacent transpositions count as one typo. This keeps "fallbaks" away from "callbacks".
function distance(a, b) {
  const d = Array.from({length: a.length + 1}, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}

function retrieve(index, terms, boost) {
  const query = terms.join(' ');
  const options = {boost, combineWith: 'AND'};
  let hits = index.search(query, options);
  if (hits.length) return hits;
  hits = index.search(query, {...options, prefix: term => term.length >= 3});
  if (hits.length) return hits;
  hits = index.search(query, {...options, fuzzy: term => term.length >= 5 ? 0.3 : term.length === 4 ? 0.5 : false})
    .filter(hit => terms.every(term => Object.keys(hit.match).some(match => distance(term, match) <= (term.length >= 9 ? 2 : term.length >= 4 ? 1 : 0))));
  if (hits.length) return hits.map(hit => ({...hit, matchType: 'typo'}));
  if (terms.length > 2) return index.search(query, {...options, combineWith: 'OR'})
    .filter(hit => hit.queryTerms.length >= Math.ceil(terms.length * 0.6));
  return [];
}

function snippet(text, matchTerms, maxLength = 210) {
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const lower = text.toLowerCase();
  let best = 0, score = -1;
  for (const term of matchTerms) {
    let from = 0;
    for (let count = 0; count < 8; count++) {
      const position = lower.indexOf(term, from);
      if (position < 0) break;
      const start = Math.max(0, position - 50);
      const window = lower.slice(start, start + maxLength);
      const nextScore = matchTerms.filter(word => window.includes(word)).length;
      if (nextScore > score) {score = nextScore; best = start;}
      from = position + term.length;
    }
  }
  if (best > 0) best = Math.min(text.length, text.indexOf(' ', best) + 1 || best);
  let end = Math.min(text.length, best + maxLength);
  if (end < text.length) end = text.lastIndexOf(' ', end);
  return `${best > 0 ? '…' : ''}${text.slice(best, end)}${end < text.length ? '…' : ''}`;
}

function titleRelevance(title, terms) {
  const clean = title.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '');
  const core = termsOf(clean).filter(term => !['litellm', 'aws', 'overview', 'introduction'].includes(term));
  const matched = terms.filter(term => core.includes(term));
  const coverage = matched.length / terms.length;
  const precision = matched.length / Math.max(core.length, 1);
  return coverage * 70 + precision * 35 + (coverage === 1 && precision === 1 ? 90 : 0);
}

function search(index, query, {limit = 10, groupPages = true, category = 'All docs', correctTypo = true} = {}) {
  const rawTerms = termsOf(query.slice(0, 500));
  // Setup verbs and the product name add noise when someone names a specific feature.
  const optional = new Set(['litellm', 'setup', 'configure', 'enable', 'set', 'up']);
  const focused = rawTerms.filter(term => !optional.has(term));
  const terms = focused.length ? focused : rawTerms;
  if (rawTerms.includes('setup') && focused.length === 1 && ['proxy', 'gateway'].includes(focused[0])) terms.push('setup');
  if (!terms.length) return [];
  const pageHits = retrieve(index.pages, terms, {title: 8, keywords: 5, description: 2, headings: 1, path: 2});
  const passageHits = retrieve(index.passages, terms, {title: 5, heading: 3, text: 1});
  const groups = new Map();
  const getGroup = url => {
    if (!groups.has(url)) {
      const metadata = index.pages.getStoredFields(url);
      if (!metadata) return null;
      groups.set(url, {...metadata, id: url, pageScore: 0, passages: []});
    }
    return groups.get(url);
  };
  for (const hit of pageHits) {const group = getGroup(hit.url); if (group) {group.pageScore = hit.score; group.pageTerms = hit.terms; group.matchType = hit.matchType;}}
  for (const hit of passageHits) {const group = getGroup(hit.url.split('#')[0]); if (group) group.passages.push(hit);}
  const ranked = [...groups.values()].map(group => {
    if (!group.passages.length) {
      const intro = index.passages.getStoredFields(group.firstId);
      if (intro) group.passages.push({...intro, id: group.firstId, score: 0});
    }
    let effective = [...new Set((group.pageTerms || group.passages[0]?.terms || terms).map(normalize).filter(Boolean))];
    if (group.matchType === 'typo') {
      const correctedTitle = words(group.title).filter(word => terms.some(term => distance(term, word) <= (term.length >= 9 ? 2 : 1)));
      if (correctedTitle.length) effective = correctedTitle.map(normalize).filter(Boolean);
    }
    const titleScore = titleRelevance(group.title, effective);
    let score = titleScore + Math.log1p(group.pageScore) * 6 + Math.log1p(group.passages[0]?.score || 0) * 2;
    if (group.category === 'Providers' && effective.every(term => termsOf(group.title).includes(term))) score += 12;
    if (/\b(old|removed|deprecated)\b/i.test(group.title)) score *= 0.1;
    const titleTerms = termsOf(group.title);
    const sectionTerms = terms.filter(term => !titleTerms.includes(term));
    group.passages.sort((a, b) => {
      const boost = hit => {
        const heading = termsOf(hit.heading);
        const sectionMatch = sectionTerms.filter(term => heading.includes(term)).length / Math.max(sectionTerms.length, 1);
        return hit.score * (1 + 6 * sectionMatch) * (heading.join(' ') === terms.join(' ') ? 3 : 1);
      };
      return boost(b) - boost(a);
    });
    const titleCoverage = terms.filter(term => titleTerms.includes(term)).length;
    const titleMatch = effective.every(term => titleTerms.includes(term)) ||
      (titleCoverage >= 2 && titleCoverage / terms.length >= 2 / 3 && !/[_/]/.test(query));
    const best = group.passages[0];
    const highlights = [...new Set([...words(query).filter(word => !stopWords.has(word)), ...effective])];
    return {...group, score, best, highlights, correction: group.matchType === 'typo' && titleMatch ? effective.join(' ') : '',
      // Broad title matches open the guide; specific queries jump straight to the relevant section.
      destination: titleMatch || !best ? group.url : best.url,
      heading: titleMatch ? '' : best?.heading || '',
      snippet: snippet(titleMatch || !best ? group.description : best.text, highlights)};
  }).sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  // Once a page title gives a confident correction, use that spelling consistently.
  // Otherwise "lnes" also finds incidental mentions of "lines" all over the corpus.
  if (correctTypo && ranked[0]?.correction) {
    return search(index, ranked[0].correction, {limit, groupPages, category, correctTypo: false})
      .map(hit => ({...hit, matchType: 'typo', highlights: [...new Set([...(hit.highlights || []), ...words(query)])]}));
  }
  const filtered = ranked.filter(group => category === 'All docs' || group.category === category);
  if (!groupPages) {
    return filtered.flatMap(group => group.passages.map(hit => ({...hit, score: group.score,
      snippet: snippet(hit.text, group.highlights), category: group.category}))).slice(0, limit);
  }
  return filtered.slice(0, limit).map(({id, title, heading, destination, snippet, highlights, category, breadcrumb, score, matchType}) =>
    ({id, title, heading, url: destination, snippet, highlights, category, breadcrumb, score, matchType}));
}

module.exports = {createIndex, loadIndex, search, snippet};
