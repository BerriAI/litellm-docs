import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkDirective from 'remark-directive';
import remarkMdx from 'remark-mdx';
import yaml from 'js-yaml';
import {toString} from 'mdast-util-to-string';
import {createSlugger, parseMarkdownHeadingId} from '@docusaurus/utils';

const SKIP_TYPES = new Set([
  'code',
  'yaml',
  'mdxjsEsm',
  'mdxFlowExpression',
  'mdxTextExpression',
  'html',
  'toml',
]);

const CHUNK_TYPES = new Set(['heading', 'paragraph', 'table']);

const FRONTMATTER_KEYS = ['title', 'description', 'sidebar_label', 'tagline'];

const HAS_LETTER = /[A-Za-z]/;

function parser(withMdx = true) {
  const p = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml'])
    .use(remarkGfm)
    .use(remarkDirective);
  if (withMdx) p.use(remarkMdx);
  return p;
}

function parseTree(source) {
  try {
    return parser(true).parse(source);
  } catch {
    // bare {{placeholder}} braces etc. break the MDX expression parser; fall
    // back to plain markdown so prose still gets translated
    return parser(false).parse(source);
  }
}

// Mirrors @docusaurus/mdx-loader headings plugin: explicit {#id} headings do
// not consume a slugger counter, and the slug text excludes html/jsx children.
function headingSlug(slugs, node) {
  const textNodes = node.children.filter(({type}) => !['html', 'jsx'].includes(type));
  const heading = toString(textNodes.length > 0 ? textNodes : node);
  const parsed = parseMarkdownHeadingId(heading);
  if (parsed.id) return {id: parsed.id, explicit: true};
  return {id: slugs.slug(heading, {maintainCase: false}), explicit: false};
}

function visit(node, parent, fn) {
  fn(node, parent);
  if (SKIP_TYPES.has(node.type)) return;
  if (node.children) for (const c of node.children) visit(c, node, fn);
}

// Extract translatable chunks from a markdown/mdx source.
// Returns {chunks, tree, codeRanges}.
// chunk: {id, start, end, text, kind, key?, headingAnchor?, slug?}
export function extractChunks(source) {
  const tree = parseTree(source);
  const chunks = [];
  const codeRanges = [];
  const slugger = createSlugger();

  // collect fenced code ranges for the asset rewrite skip list
  const collect = (n) => {
    if ((n.type === 'code' || n.type === 'mdxjsEsm') && n.position) {
      codeRanges.push([n.position.start.offset, n.position.end.offset]);
    }
    if (n.children) n.children.forEach(collect);
  };
  collect(tree);

  let idx = 0;
  const push = (c) => chunks.push({id: `c${idx++}`, ...c});

  // frontmatter first (it appears at offset 0 in the source)
  let fmNode = null;
  visit(tree, null, (n) => {
    if (n.type === 'yaml' && n.position && n.position.start.offset === 0) fmNode = n;
  });
  const fmLineEdits = []; // {key, valueNodeStartLine} handled in applyFrontmatter
  if (fmNode) {
    let parsed = null;
    try {
      parsed = yaml.load(fmNode.value);
    } catch {
      parsed = null;
    }
    if (parsed && typeof parsed === 'object') {
      const fmText = source.slice(fmNode.position.start.offset, fmNode.position.end.offset);
      const lines = fmText.split('\n');
      for (let li = 0; li < lines.length; li++) {
        const m = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(lines[li]);
        if (!m) continue;
        const [, key, rawVal] = m;
        if (!FRONTMATTER_KEYS.includes(key)) continue;
        // empty value or block scalar indicator (>, |, >-, |- ...) means the
        // value continues on following lines; translating this line alone
        // would corrupt the YAML, so leave the whole key untouched
        if (!rawVal.trim() || /^[>|]/.test(rawVal.trim())) continue;
        const val = parsed[key];
        if (typeof val !== 'string' || !val) continue;
        const lineStart = fmNode.position.start.offset + lines.slice(0, li).join('\n').length + (li ? 1 : 0);
        push({
          kind: 'frontmatter',
          key,
          start: lineStart,
          end: lineStart + lines[li].length,
          text: val,
          lineText: lines[li],
        });
      }
    }
  }

  visit(tree, null, (n) => {
    if (!n.position) return;
    if (n.type === 'heading') {
      const {id: slug, explicit} = headingSlug(slugger, n);
      const start = n.position.start.offset;
      const end = n.position.end.offset;
      const text = source.slice(start, end);
      push({
        kind: 'heading',
        start,
        end,
        text,
        slug,
        depth: n.depth,
        anchor: explicit ? `{#${slug}}` : null,
      });
    } else if (n.type === 'paragraph' || n.type === 'table') {
      const start = n.position.start.offset;
      const end = n.position.end.offset;
      push({kind: n.type, start, end, text: source.slice(start, end)});
    }
  });

  chunks.sort((a, b) => a.start - b.start);
  // re-id in document order
  chunks.forEach((c, i) => {
    c.id = `c${i}`;
  });
  return {chunks: chunks.filter((c) => HAS_LETTER.test(c.text)), tree, codeRanges};
}

// Splice translated chunk texts back into the source, end-to-start.
// translations: Map<chunkId, string>. frontmatter values are JSON-quoted per line.
export function applyChunks(source, chunks, translations) {
  const edits = [];
  for (const c of chunks) {
    const t = translations.get(c.id);
    if (t == null) continue;
    if (c.kind === 'frontmatter') {
      const m = /^([A-Za-z_][\w-]*)\s*:/.exec(c.lineText);
      const key = m ? m[1] : c.key;
      edits.push({start: c.start, end: c.end, text: `${key}: ${JSON.stringify(t)}`});
    } else if (c.kind === 'heading' && !c.anchor && c.depth !== 1) {
      // Never inject {#slug} onto an H1: Docusaurus's createExcerpt regex
      // turns it into the meta description of pages without frontmatter
      // description. H1s still consume the slugger counter so later
      // duplicate-heading slugs stay aligned with the English build.
      edits.push({start: c.start, end: c.end, text: `${t.replace(/\s+$/, '')} {#${c.slug}}`});
    } else {
      edits.push({start: c.start, end: c.end, text: t});
    }
  }
  edits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}
