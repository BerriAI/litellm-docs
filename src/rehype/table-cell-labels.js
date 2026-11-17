// Copies each table header's text onto the cells below it as data-label, so
// narrow screens can stack rows into labeled cards (see custom.css). Cells
// with short values also get data-inline, so their label and value share a
// line instead of leaving a lone "1" or "Complete" under its label.
const INLINE_MAX_CHARS = 24;

function textOf(node) {
  if (node.type === 'text') return node.value;
  return (node.children ?? []).map(textOf).join('');
}

function childElements(node, tagName) {
  return (node.children ?? []).filter(
    (child) => child.type === 'element' && child.tagName === tagName,
  );
}

function labelTable(table) {
  const [thead] = childElements(table, 'thead');
  const [headerRow] = thead ? childElements(thead, 'tr') : [];
  if (!headerRow) return;
  const labels = childElements(headerRow, 'th').map((th) => textOf(th).trim());
  for (const tbody of childElements(table, 'tbody')) {
    for (const row of childElements(tbody, 'tr')) {
      childElements(row, 'td').forEach((td, index) => {
        if (!labels[index]) return;
        const inline = textOf(td).trim().length <= INLINE_MAX_CHARS;
        td.properties = {
          ...td.properties,
          dataLabel: labels[index],
          ...(inline ? {dataInline: ''} : {}),
        };
      });
    }
  }
}

function walk(node) {
  if (node.type === 'element' && node.tagName === 'table') labelTable(node);
  (node.children ?? []).forEach(walk);
}

function rehypeTableCellLabels() {
  return (tree) => walk(tree);
}

module.exports = rehypeTableCellLabels;
