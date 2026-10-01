const MiniSearch = require('minisearch');

const stopWords = new Set('a an and are as at be by can do does for from how i in is it me my of on or our please the this to use using what when where which with you your'.split(' '));
const tokenize = (text) => text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || [];
const options = {
  fields: ['title', 'heading', 'text'],
  storeFields: ['title', 'heading', 'url', 'snippet'],
  tokenize,
  processTerm: (term) => stopWords.has(term) ? null : term,
};

function createIndex(documents) {
  const index = new MiniSearch(options);
  index.addAll(documents);
  return index;
}

function search(index, query, {limit = 10, groupPages = true} = {}) {
  const terms = tokenize(query.slice(0, 500)).filter((term) => !stopWords.has(term));
  if (!terms.length) return [];
  const base = {boost: {title: 12, heading: 7, text: 1}, combineWith: 'AND'};
  // Exact token matches win. Prefix and typo recovery only fill an empty result set.
  let hits = index.search(terms.join(' '), base);
  if (!hits.length) hits = index.search(terms.join(' '), {...base, prefix: (term) => term.length >= 3});
  if (!hits.length) hits = index.search(terms.join(' '), {...base, fuzzy: (term) => term.length >= 7 ? 0.3 : term.length >= 5 ? 0.2 : false});
  if (!hits.length && terms.length > 2) hits = index.search(terms.join(' '), {...base, combineWith: 'OR'}).filter((hit) => hit.queryTerms.length >= Math.ceil(terms.length * 0.6));
  const phrase = terms.join(' ');
  const normalized = (text) => tokenize(text).filter((term) => !stopWords.has(term)).join(' ');
  hits.forEach((hit) => {
    const title = normalized(hit.title);
    const heading = normalized(hit.heading);
    if (title === phrase || title === `litellm ${phrase}`) hit.score *= hit.heading ? 8 : 64;
    else if (terms.every((term) => tokenize(hit.title).includes(term))) hit.score *= 3;
    if (heading === phrase) hit.score *= 2;
  });
  hits.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  const seen = new Set();
  return hits.filter((hit) => {
    const key = groupPages ? hit.url.split('#')[0] : hit.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

module.exports = {createIndex, loadIndex: (json) => MiniSearch.loadJSON(json, options), search};
