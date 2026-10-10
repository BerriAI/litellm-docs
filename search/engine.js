const MiniSearch = require('minisearch');
const {contentTypes, contentType, versionsIn, normalizeVersion} = require('./content');

const stopWords = new Set('a an and are as at be by can do does for from how i in is it me my of on or our per please the this to use using what when where which with you your was did'.split(' '));
const forms = {
  caching: 'cache', cached: 'cache', caches: 'cache', keys: 'key', budgets: 'budget',
  limits: 'limit', limiting: 'limit', retries: 'retry', retrying: 'retry', fallbacks: 'fallback',
  tracking: 'track', balancing: 'balance', completions: 'completion', providers: 'provider',
  models: 'model', teams: 'team', logs: 'log', logging: 'log', tokens: 'token',
  settings: 'setting', credentials: 'credential', quickstart: 'setup', configuring: 'configure',
  embeddings: 'embedding', batches: 'batch', configurations: 'config', configuration: 'config', configs: 'config',
  guardrails: 'guardrail', routers: 'router', routing: 'router', classifiers: 'classifier', releases: 'release',
  reranking: 'rerank', aliases: 'alias', costs: 'spend', cost: 'spend', spending: 'spend',
};
// Keep numeric identifiers whole: 5.5 must not match 5.43 or 1.104.1 match 1.104.10.
const words = text => text.toLowerCase().replace(/(\p{L})-(\d+)-(\d+)(?![-.\w])/gu, '$1-$2.$3')
  .match(/\bv?\d+(?:\.\d+)+(?!\d)(?:(?:-?(?:rc|beta|alpha))\.?\d+|-stable(?:\.\d+)?)?(?![\w.])|[\p{L}\p{N}_]+/gu) || [];
const titlePairs = title => {
  const parts = words(title).flatMap(word => word.split('_'));
  return parts.slice(1).map((word, i) => [parts[i], word])
    .filter(pair => pair.every(word => !stopWords.has(word)));
};
const tokenize = (text, field) => [
  ...words(text.replace(/\b(?:set\s+up|quick\s+start)\b/gi, 'setup')).flatMap(word => word.includes('_') ? [word, ...word.split('_')] : [word]),
  ...(field === 'title' ? titlePairs(text).map(pair => pair.join('')) : []),
];
const normalize = term => stopWords.has(term) ? null : /^v?\d+\.\d+\.\d+/.test(term) ? normalizeVersion(term) : Object.hasOwn(forms, term) ? forms[term] : term;
const termsOf = text => [...new Set(tokenize(text).map(normalize).filter(Boolean))];
const indexTerm = term => {
  const canonical = normalize(term);
  return canonical && canonical !== term ? [term, canonical] : canonical;
};
const pageOptions = {
  fields: ['title', 'keywords', 'description', 'headings', 'path', 'version'],
  storeFields: ['title', 'url', 'description', 'category', 'breadcrumb', 'firstId', 'type', 'date', 'version'], tokenize, processTerm: indexTerm,
};
const passageOptions = {
  fields: ['title', 'heading', 'text'],
  storeFields: ['title', 'heading', 'url', 'text', 'type', 'date', 'version', 'category'], tokenize, processTerm: indexTerm,
};

function categoryFor(url) {
  if (/\/providers\//.test(url)) return 'Providers';
  if (/\/proxy\//.test(url) || /\/docs\/(mcp|a2a)/.test(url)) return 'Gateway';
  if (/\/docs\/(completion|caching|embedding|routing|set_keys)/.test(url)) return 'SDK';
  if (/\/docs\/(observability|integrations|pass_through)\//.test(url)) return 'Integrations';
  return 'Docs';
}

function createCollection(documents) {
  const grouped = new Map();
  for (const doc of documents) {
    const url = doc.url.split('#')[0];
    if (!grouped.has(url)) grouped.set(url, []);
    grouped.get(url).push(doc);
  }
  const pages = new MiniSearch(pageOptions);
  pages.addAll([...grouped].map(([url, sections]) => {
    const first = sections[0];
    return {id: url, url, firstId: first.id, title: first.title, category: first.category || categoryFor(url),
      type: first.type || contentType(url), date: first.date || '', version: first.version || '',
      breadcrumb: first.breadcrumb || categoryFor(url),
      description: first.description?.length > 30 ? first.description : first.text.replace(/Join the waitlist now/gi, '').replace(/\s+/g, ' ').trim().slice(0, 300),
      keywords: first.keywords || '',
      headings: [...new Set(sections.map(doc => doc.heading))].join(' '),
      path: url.replace(/[/_-]/g, ' ')};
  }));
  const passages = new MiniSearch(passageOptions);
  passages.addAll(documents);
  return {pages, passages};
}

function createIndex(documents) {
  const collections = Object.fromEntries(contentTypes.map(type => [type,
    createCollection(documents.filter(doc => (doc.type || contentType(doc.url)) === type))]));
  // Separate term statistics keep new archives from changing matches within the docs collection.
  return {version: 3, collections};
}

function loadIndex(json) {
  const data = JSON.parse(json);
  if (data.version !== 3) throw new Error('Rebuild the documentation search index');
  return {version: 3, collections: Object.fromEntries(contentTypes.map(type => [type, {
    pages: MiniSearch.loadJS(data.collections[type].pages, pageOptions),
    passages: MiniSearch.loadJS(data.collections[type].passages, passageOptions),
  }]))};
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
  hits = index.search(query, {...options, prefix: term => term.length >= 3 && !/^\d/.test(term)});
  if (hits.length) return hits;
  if (terms.some(term => /^\d/.test(term))) return [];
  hits = index.search(query, {...options, fuzzy: term => term.length >= 5 ? 0.3 : term.length === 4 ? 0.5 : false})
    .filter(hit => terms.every(term => Object.entries(hit.match).some(([match, fields]) => {
      // Joined aliases match literally; they must not invent spelling corrections for other words.
      if (match !== term && fields.every(field => field === 'title') && !termsOf(hit.title).includes(normalize(match))) return false;
      return distance(term, match) <= (term.length >= 9 ? 2 : term.length >= 4 ? 1 : 0);
    })));
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

function titleRelevance(title, terms, queryTerms, exactBoost = 90) {
  const clean = title.replace(/\[[^\]]*\]/g, '').replace(/\([^)]*\)/g, '').replace(/\s+-\s+(?:quick\s?start|overview|introduction)$/i, '');
  terms = expandTitleTerms(clean, terms, queryTerms);
  // Parentheses can be either decoration or useful aliases such as (RBAC).
  return Math.max(...[clean, title].map(value => {
    const core = termsOf(value).filter(term => !['litellm', 'aws', 'overview', 'introduction'].includes(term))
      .flatMap(term => terms.length > 1 && term === terms.join('') ? terms : [term]);
    const matched = terms.filter(term => core.includes(term));
    const coverage = matched.length / terms.length;
    const precision = matched.length / Math.max(core.length, 1);
    return coverage * 70 + precision * 35 + (coverage === 1 && precision === 1 ? exactBoost : 0);
  }));
}

// Use the original words for ranking and navigation when a query uses a joined title pair.
function expandTitleTerms(title, terms, queryTerms = terms) {
  const pairs = new Map(titlePairs(title).map(pair => [pair.join(''), pair]));
  return [...new Set(terms.flatMap(term => queryTerms.includes(term) && pairs.has(term) ? pairs.get(term) : [term])
    .map(normalize).filter(Boolean))];
}

function searchCollection(index, query, {limit = 10, groupPages = true, category = 'All docs', correctTypo = true} = {}) {
  const rawTerms = termsOf(query.slice(0, 500));
  // Setup verbs and the product name add noise when someone names a specific feature.
  const optional = new Set(['litellm', 'setup', 'configure', 'enable', 'set', 'up']);
  const focused = rawTerms.filter(term => !optional.has(term));
  const terms = focused.length ? focused : rawTerms;
  if (rawTerms.includes('setup') && focused.length && (/\bquick\s?start\b/i.test(query) || focused.length === 1 && ['proxy', 'gateway'].includes(focused[0]))) terms.push('setup');
  if (!terms.length) return [];
  const pageHits = retrieve(index.pages, terms, {title: 8, keywords: 5, description: 2, headings: 1, path: 2, version: 12});
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
    const contextualTitle = `${group.title} ${group.url.replace(/[/_-]/g, ' ')}`;
    const titleScore = Math.max(titleRelevance(group.title, effective, terms),
      titleRelevance(contextualTitle, effective, terms, 0));
    const headingScore = Math.max(0, ...group.passages.filter(hit => hit.heading).map(hit => titleRelevance(hit.heading, effective, terms, 0))) * 0.8;
    let score = Math.max(titleScore, headingScore) + Math.log1p(group.pageScore) * 6 + Math.log1p(group.passages[0]?.score || 0) * 2;
    const effectiveTitleTerms = expandTitleTerms(group.title, effective, terms);
    if (group.category === 'Providers' && effectiveTitleTerms.every(term => termsOf(group.title).includes(term))) score += 12;
    const pathParts = group.url.split('/').filter(Boolean);
    const slugTerms = termsOf(pathParts.at(-1).replace(/[_-]/g, ' '));
    const topicRoot = pathParts.length === 2 || group.category === 'Providers' && pathParts.length === 3;
    if (group.type === 'docs' && topicRoot && effective.length === slugTerms.length && effective.every(term => slugTerms.includes(term))) score += 30;
    if (group.type === 'docs') score -= Math.max(0, pathParts.length - 2);
    if (/\b(old|removed|deprecated|legacy)\b/i.test(group.title) || /(?:^|[/_-])(old|removed|deprecated|legacy)(?:$|[/_-])/i.test(group.url)) score *= 0.1;
    const titleTerms = termsOf(group.title);
    const queryTitleTerms = expandTitleTerms(group.title, terms);
    const sectionTerms = queryTitleTerms.filter(term => !titleTerms.includes(term));
    group.passages.sort((a, b) => {
      const boost = hit => {
        const heading = termsOf(hit.heading);
        const sectionMatch = sectionTerms.filter(term => heading.includes(term)).length / Math.max(sectionTerms.length, 1);
        return hit.score * (1 + 6 * sectionMatch) * (heading.join(' ') === terms.join(' ') ? 3 : 1);
      };
      return boost(b) - boost(a);
    });
    const titleCoverage = queryTitleTerms.filter(term => titleTerms.includes(term)).length;
    const titleMatch = effectiveTitleTerms.every(term => titleTerms.includes(term)) ||
      (titleCoverage >= 2 && titleCoverage / queryTitleTerms.length >= 2 / 3 && !/[_/]/.test(query));
    const best = group.passages[0];
    const highlights = [...new Set([...words(query).filter(word => !stopWords.has(word)), ...effective, ...effectiveTitleTerms])];
    return {...group, score, best, highlights, correction: group.matchType === 'typo' && titleMatch ? effective.join(' ') : '',
      // Broad title matches open the guide; specific queries jump straight to the relevant section.
      destination: titleMatch || !best ? group.url : best.url,
      heading: titleMatch ? '' : best?.heading || '',
      snippet: snippet(titleMatch || !best ? group.description : best.text, highlights)};
  }).sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  // Once a page title gives a confident correction, use that spelling consistently.
  // Otherwise "lnes" also finds incidental mentions of "lines" all over the corpus.
  if (correctTypo && ranked[0]?.correction) {
    return searchCollection(index, ranked[0].correction, {limit, groupPages, category, correctTypo: false})
      .map(hit => ({...hit, matchType: 'typo', highlights: [...new Set([...(hit.highlights || []), ...words(query)])]}));
  }
  const filtered = ranked.filter(group => category === 'All docs' || group.category === category);
  if (!groupPages) {
    return filtered.flatMap(group => group.passages.map(hit => ({...hit, score: group.score,
      snippet: snippet(hit.text, group.highlights), category: group.category}))).slice(0, limit);
  }
  return filtered.slice(0, limit).map(({id, title, heading, destination, snippet, highlights, category, breadcrumb, score, matchType, type, date, version}) =>
    ({id, title, heading, url: destination, snippet, highlights, category, breadcrumb, score, matchType, type, date, version}));
}

function queryIntent(query) {
  if (/\b(latest|newest|recent)\b|what['’]?s new/i.test(query)) return 'latest';
  if (versionsIn(query).length || /\b(releases?|pre-?releases?|rcs?|changelog|introduced|shipped)\b|\bwhen (was|did)\b/i.test(query)) return 'history';
  if (/\b(blogs?|articles?|blog posts?)\b/i.test(query)) return 'blog';
  if (/\b(benchmarks?|comparisons?|compare|versus|vs|measured)\b/i.test(query)) return 'benchmark';
  if (/\b(setup|set up|configure|configuration|install|enable)\b|\bhow (do|can|to)\b/i.test(query)) return 'setup';
  return 'general';
}

function newestFirst(a, b) {
  const date = (b.date || '').localeCompare(a.date || '');
  if (date) return date;
  const left = (a.version || '').split('-'), right = (b.version || '').split('-');
  const version = right[0].localeCompare(left[0], undefined, {numeric: true});
  if (version) return version;
  if (!left[1] !== !right[1]) return left[1] ? 1 : -1;
  return (right[1] || '').localeCompare(left[1] || '', undefined, {numeric: true}) || a.url.localeCompare(b.url);
}

function search(index, query, {limit = 10, groupPages = true, type = 'all', category = 'All docs', intent} = {}) {
  if (typeof query !== 'string' || !query.trim() || !['all', ...contentTypes].includes(type)) return [];
  intent ||= queryIntent(query);
  const versions = versionsIn(query);
  const wantsBlog = /\b(blogs?|articles?|blog posts?)\b/i.test(query);
  const wantsRelease = /\b(releases?|pre-?releases?|rcs?|changelog)\b/i.test(query);
  const stableOnly = /\bstable\b/i.test(query) && !versions.length && (wantsRelease || type === 'release');
  const prereleaseOnly = /\b(release candidates?|pre-?releases?|rcs?)\b/i.test(query) && !stableOnly && !versions.length;
  let scopedQuery = query.replace(/\b(?:blogs?(?: posts?)?|articles?|release candidates?|pre-?releases?|rcs?(?!\.)|release(?:s| notes?)?|changelog|latest|newest|recent)\b|what['’]?s new/gi, ' ').trim();
  if (stableOnly) scopedQuery = scopedQuery.replace(/\bstable\b/gi, ' ');
  const browse = (wantsBlog || wantsRelease || intent === 'latest') && !termsOf(scopedQuery).filter(term => term !== 'litellm').length;
  if (wantsRelease && !browse && !versions.length) scopedQuery += ' release';
  scopedQuery = scopedQuery.replace(/\b(compare|versus|vs)\b/gi, ' ');
  const scope = type !== 'all' ? type : wantsBlog ? 'blog' : browse && (wantsRelease || intent === 'latest') ? 'release' : 'all';
  const browseType = wantsBlog ? 'blog' : wantsRelease || type === 'all' ? 'release' : type;
  const candidates = [];
  for (const sourceType of contentTypes) {
    if (scope !== 'all' && scope !== sourceType) continue;
    const collection = index.collections[sourceType];
    if (browse) {
      if (sourceType !== browseType || sourceType === 'docs') continue;
      candidates.push(...collection.pages.search(MiniSearch.wildcard).map(hit => ({...hit, type: sourceType,
        heading: '', snippet: hit.description, highlights: [], score: 0})));
    } else {
      const hits = searchCollection(collection, scopedQuery, {limit: Math.max(limit, 30), groupPages, category});
      candidates.push(...hits.map(hit => ({...hit, type: sourceType})));
    }
  }
  const weights = {general: {docs: 20, blog: 0, release: -40}, setup: {docs: 30, blog: 0, release: -40},
    benchmark: {docs: 8, blog: 24, release: -30}, blog: {docs: 0, blog: 60, release: -40},
    history: {docs: 5, blog: 5, release: 30}, latest: {docs: 0, blog: 0, release: 35}};
  const dated = candidates.filter(hit => hit.date).map(hit => Date.parse(hit.date));
  const newest = Math.max(0, ...dated);
  const hasExact = candidates.some(hit => hit.matchType !== 'typo');
  const ranked = candidates.filter(hit => !stableOnly || hit.type !== 'release' || !/-(rc|alpha|beta)/.test(hit.version))
    .filter(hit => !prereleaseOnly || hit.type !== 'release' || /-(rc|alpha|beta)/.test(hit.version))
    .map(hit => {
      let score = hit.score + (weights[intent] || weights.general)[hit.type];
      if (versions.length && versions.includes(hit.version)) score += 160;
      if (hasExact && hit.matchType === 'typo') score -= 80;
      if (intent === 'latest' && hit.date) score += 40 / (1 + Math.max(0, newest - Date.parse(hit.date)) / (30 * 86400000));
      return {...hit, score};
    }).sort((a, b) => browse ? newestFirst(a, b) : b.score - a.score || newestFirst(a, b));
  if (browse && !groupPages) {
    return ranked.flatMap(page => index.collections[page.type].passages.search(MiniSearch.wildcard, {
      filter: hit => hit.url.split('#')[0] === page.url,
    }).map(hit => ({...hit, score: page.score}))).slice(0, limit);
  }
  return ranked.slice(0, limit);
}

module.exports = {createIndex, loadIndex, search, snippet, queryIntent};
