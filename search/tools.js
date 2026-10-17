const {search} = require('./engine');
const {isContentUrl, contentType, contentPage} = require('./content');

const intents = ['general', 'setup', 'benchmark', 'history', 'latest', 'blog'];
const tools = [
  {type: 'function', function: {name: 'search_docs',
    description: 'Search LiteLLM docs, API reference, blogs, and release notes with one or more keyword queries. Preserve the user\'s feature terms, even unfamiliar ones, together with the provider or integration; generic provider setup does not establish support for a named capability. Results are grouped by query, with each page title followed by matching passages. Short, distinctive topic names work best. Read passages for full evidence.',
    parameters: {type: 'object', additionalProperties: false, required: ['queries'], properties: {
      queries: {type: 'array', minItems: 1, maxItems: 3, items: {type: 'string', minLength: 1, maxLength: 160}},
      intent: {type: 'string', enum: intents},
    }}}},
  {type: 'function', function: {name: 'read_docs',
    description: 'View the full documentation pages containing passages discovered by search_docs, without truncation. Requested passages come first, followed by the rest of each page. An API reference page contains one operation and all its referenced schemas. Returned source numbers are used for citations.',
    parameters: {type: 'object', additionalProperties: false, required: ['passage_ids'], properties: {
      passage_ids: {type: 'array', minItems: 1, maxItems: 32, items: {type: 'string'}},
    }}}},
];
const fieldsAre = (value, fields) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => fields.includes(key));
const metadata = ({title, heading, url, type = 'docs', date = '', version = '', category}) =>
  ({title, heading, url, type, date, version, category});

function createDocumentationTools({index, documents, tracing, signal, onEvent = async () => {}}) {
  const discovered = new Set(), sources = new Map(), pages = new Map(), passages = new Map();
  let passageCount = 0, linkCount = 0;
  for (const doc of documents.values()) {
    const path = contentPage(doc.url);
    if (!pages.has(path)) pages.set(path, []);
    pages.get(path).push(doc);
  }
  return {
    sources, passages,
    async execute(call) {
      signal?.throwIfAborted();
      let args;
      try {args = JSON.parse(call.function.arguments);} catch {return {error: 'Tool arguments must be valid JSON.'};}
      const name = call.function.name;
      return tracing.span(name === 'search_docs' ? 'retrieve documentation' : 'read documentation', {
        'openinference.span.kind': 'TOOL', 'tool.name': name, 'tool_call.id': call.id,
        'input.value': JSON.stringify(args), 'input.mime_type': 'application/json',
      }, async span => {
        let result;
        if (name === 'search_docs') {
          if (!fieldsAre(args, ['queries', 'intent']) || !Array.isArray(args.queries) || args.queries.length < 1 || args.queries.length > 3 ||
            args.queries.some(q => typeof q !== 'string' || !q.trim() || q.length > 160) || (args.intent !== undefined && !intents.includes(args.intent))) {
            return {error: 'Provide 1 to 3 queries, each 1 to 160 characters, and a valid optional intent.'};
          }
          await onEvent('status', {message: 'Searching documentation…'});
          // These searches are synchronous and local. Keep query provenance; no automatic
          // whole-page expansion or protected top result can crowd out another topic.
          result = {results: args.queries.map(query => {
            const hits = search(index, query, {limit: 4, intent: args.intent});
            const passageHits = search(index, query, {limit: 100, groupPages: false, intent: args.intent});
            return {query, matches: hits.map(hit => {
              const guide = pages.get(contentPage(hit.url)) || [];
              const matching = passageHits
                .filter(match => contentPage(match.url) === contentPage(hit.url)).slice(0, 3);
              const wanted = new Set(matching.map(match => match.id));
              guide.slice(0, 1).forEach(doc => wanted.add(doc.id));
              guide.filter(doc => /prerequisite|quick.?start|requirement/i.test(doc.heading)).slice(0, 2).forEach(doc => wanted.add(doc.id));
              const sections = guide.filter(doc => wanted.has(doc.id));
              const headings = new Set();
              const contents = guide.filter(doc => {
                if (!doc.heading || headings.has(doc.heading)) return false;
                headings.add(doc.heading); return true;
              }).slice(0, 24);
              [...sections, ...contents].forEach(doc => discovered.add(doc.id));
              return {...metadata(hit), score: hit.score, snippet: hit.snippet,
                passages: sections.map(doc => ({passage_id: doc.id, heading: doc.heading, preview: doc.snippet || doc.text.slice(0, 240),
                  ...(doc.links?.length ? {links: doc.links.filter(link => isContentUrl(link.url)).slice(0, 8)} : {})})),
                sections: contents.map(doc => ({passage_id: doc.id, heading: doc.heading}))};
            })};
          })};
        } else if (name === 'read_docs') {
          if (!fieldsAre(args, ['passage_ids']) || !Array.isArray(args.passage_ids) || args.passage_ids.length < 1 || args.passage_ids.length > 32 ||
            args.passage_ids.some(id => typeof id !== 'string' || !discovered.has(id))) return {error: 'Read 1 to 32 passage_ids returned by search_docs.'};
          await onEvent('status', {message: 'Reading relevant documentation…'});
          result = {passages: [], unavailable: []};
          // Read every passage on each selected page, including prerequisites and examples.
          const selected = new Set([...args.passage_ids, ...args.passage_ids.flatMap(id => {
            const doc = documents.get(id);
            return doc ? (pages.get(contentPage(doc.url)) || []).map(part => part.id) : [id];
          })]);
          for (const id of selected) {
            const doc = documents.get(id);
            if (!doc) {result.unavailable.push(id); continue;}
            if (!sources.has(id)) {
              sources.set(id, {id: sources.size + 1, ...metadata(doc)}); passageCount++;
            }
            const links = [];
            for (const target of doc.links || []) {
              if (!isContentUrl(target.url) || typeof target.title !== 'string') continue;
              const key = `link:${target.url}`;
              if (!sources.has(key)) {
                sources.set(key, {id: sources.size + 1, title: target.title, url: target.url, type: contentType(target.url), heading: ''});
                linkCount++;
              }
              if (sources.has(key)) links.push({source: sources.get(key).id, title: target.title, url: target.url});
            }
            result.passages.push({source: sources.get(id).id, ...metadata(doc), text: doc.text,
              ...(links.length ? {links} : {})});
          }
          for (const passage of result.passages) passages.set(passage.source, passage);
        } else return {error: 'Unknown documentation tool.'};
        span.setAttribute('output.value', JSON.stringify(result));
        span.setAttribute('output.mime_type', 'application/json');
        span.setAttribute('docs.search.passage_count', passageCount);
        span.setAttribute('docs.search.link_count', linkCount);
        return result;
      });
    },
  };
}
module.exports = {tools, createDocumentationTools};
