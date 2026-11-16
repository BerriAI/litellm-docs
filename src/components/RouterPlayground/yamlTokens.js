// A line-at-a-time YAML highlighter for the config editor's backdrop. It only has to colour the
// shapes a router config uses: comments, keys, list dashes, and scalar values. Every character of
// the line comes back in order, so the backdrop lines up with the textarea above it.

const SCALAR = [
  [/^(true|false|True|False|yes|no|null|~)(?=\s*(#|$))/, 'bool'],
  [/^-?\d+(\.\d+)?(e-?\d+)?(?=\s*(#|$))/, 'number'],
  [/^"(?:[^"\\]|\\.)*"|^'(?:[^']|'')*'/, 'string'],
  [/^os\.environ\/\S+/, 'env'],
];

function value(text, out) {
  const comment = text.search(/(^|\s)#/);
  const body = comment < 0 ? text : text.slice(0, comment);
  const rest = comment < 0 ? '' : text.slice(comment);
  let i = 0;
  while (i < body.length) {
    const tail = body.slice(i);
    const space = tail.match(/^[\s[\]{},]+/);
    if (space) {
      out.push({text: space[0], kind: 'punct'});
      i += space[0].length;
      continue;
    }
    const known = SCALAR.map(([re, kind]) => [tail.match(re), kind]).find(([match]) => match);
    if (known) {
      out.push({text: known[0][0], kind: known[1]});
      i += known[0][0].length;
      continue;
    }
    const word = tail.match(/^[^\s[\]{},]+(?:[^\S\n]+[^\s[\]{},#]+)*/)[0];
    out.push({text: word, kind: 'string'});
    i += word.length;
  }
  if (rest) out.push({text: rest, kind: 'comment'});
}

export function yamlTokens(line) {
  const out = [];
  const lead = line.match(/^(\s*)((?:-\s+)*)/);
  if (lead[1]) out.push({text: lead[1], kind: null});
  if (lead[2]) out.push({text: lead[2], kind: 'dash'});
  const rest = line.slice(lead[0].length);
  if (rest.startsWith('#')) {
    out.push({text: rest, kind: 'comment'});
    return out;
  }
  const key = rest.match(/^("[^"]*"|'[^']*'|[^\s:#][^:#]*?)(\s*:)(?=\s|$)/);
  if (key) {
    out.push({text: key[1], kind: 'key'});
    out.push({text: key[2], kind: 'punct'});
    value(rest.slice(key[0].length), out);
  } else {
    value(rest, out);
  }
  return out;
}
