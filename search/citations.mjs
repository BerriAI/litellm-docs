import {fromMarkdown} from 'mdast-util-from-markdown';

// Preserve code such as choices[0] and arrays when validating or linking citations.
export function mapCitations(markdown, transform) {
  const ignored = [];
  function visit(node) {
    if (['code', 'inlineCode', 'html', 'link', 'image'].includes(node.type)) {
      ignored.push([node.position.start.offset, node.position.end.offset]);
    } else node.children?.forEach(visit);
  }
  visit(fromMarkdown(markdown));
  return markdown.replace(/\[(\d+)\]/g, (citation, id, offset) =>
    ignored.some(([start, end]) => offset >= start && offset < end) ? citation : transform(Number(id), citation));
}

