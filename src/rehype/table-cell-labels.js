// Copies each table header's text onto the cells below it as data-label, so
// narrow screens can stack rows into labeled cards (see custom.css).
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
        td.properties = {...td.properties, dataLabel: labels[index]};
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
