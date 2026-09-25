// Per-chunk validation: the translated text must preserve all non-prose
// structure of the source slice. Returns a list of failure reasons (empty = ok).

function multiset(arr) {
  const m = new Map();
  for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
  return m;
}

function eqMultiset(a, b) {
  if (a.length !== b.length) return false;
  const ma = multiset(a);
  for (const [k, v] of multiset(b)) {
    if (ma.get(k) !== v) return false;
  }
  return true;
}

function codeSpans(t) {
  return t.match(/`+[^`\n]*`+/g) || [];
}

function linkTargets(t) {
  const out = [];
  const re = /\]\(([^)\s]+)[^)]*\)/g;
  let m;
  while ((m = re.exec(t))) out.push(m[1]);
  return out;
}

function bareUrls(t) {
  // strip targets already captured via ](...) to avoid double counting
  const stripped = t.replace(/\]\(([^)\s]+)[^)]*\)/g, '](');
  // printable ASCII only; full-width CJK punctuation after a URL is prose,
  // and trailing delimiters absorbed by the greedy match are trimmed
  return (stripped.match(/https?:\/\/[\x21-\x7e]+/g) || []).map((u) => u.replace(/[)\]"'`]+$/g, ''));
}

function placeholders(t) {
  return t.match(/\{\{[^{}]+\}\}/g) || [];
}

function anchors(t) {
  return t.match(/\{#[^}\s]+\}/g) || [];
}

function jsxTags(t) {
  return t.match(/<\/?[A-Za-z][\w.-]*/g) || [];
}

function headingLevel(t) {
  const m = /^\s*(#{1,6})\s/.exec(t);
  return m ? m[1].length : 0;
}

function listMarker(t) {
  const m = /^\s*([-*+]|\d+[.)])\s+/.exec(t);
  return m ? m[1] : null;
}

export function validateChunk(source, translated, kind) {
  const reasons = [];
  if (typeof translated !== 'string' || !translated.length) {
    return ['empty translation'];
  }
  if (kind === 'frontmatter') {
    if (/\n/.test(translated)) reasons.push('frontmatter value contains a newline');
    if (!eqMultiset(placeholders(source), placeholders(translated))) {
      reasons.push('placeholder multiset changed');
    }
    return reasons;
  }
  const srcSpans = codeSpans(source);
  const outSpans = codeSpans(translated);
  {
    // every source span must be preserved; extra spans are tolerated only when
    // their inner text occurs verbatim in the source (model wrapped a plain
    // identifier in backticks)
    const remaining = new Map();
    for (const s of outSpans) remaining.set(s, (remaining.get(s) || 0) + 1);
    const missing = [];
    for (const s of srcSpans) {
      if (remaining.get(s)) remaining.set(s, remaining.get(s) - 1);
      else missing.push(s);
    }
    const extras = [];
    for (const [s, n] of remaining) {
      for (let i = 0; i < n; i++) extras.push(s);
    }
    const badExtras = extras.filter((s) => !source.includes(s.replace(/^`+|`+$/g, '')));
    if (missing.length || badExtras.length) {
      reasons.push(
        `inline code spans changed: missing/altered ${JSON.stringify(missing)}, added ${JSON.stringify(badExtras)}`,
      );
    }
  }
  const srcLinks = linkTargets(source);
  const outLinks = linkTargets(translated);
  if (srcLinks.length !== outLinks.length || srcLinks.some((v, i) => v !== outLinks[i])) {
    reasons.push(`link/image targets changed: source ${JSON.stringify(srcLinks)} vs output ${JSON.stringify(outLinks)}`);
  }
  const srcUrls = bareUrls(source);
  const outUrls = bareUrls(translated);
  if (srcUrls.length !== outUrls.length || srcUrls.some((v, i) => v !== outUrls[i])) {
    reasons.push(`bare URLs changed: source ${JSON.stringify(srcUrls)} vs output ${JSON.stringify(outUrls)}`);
  }
  if (!eqMultiset(placeholders(source), placeholders(translated))) {
    reasons.push(`placeholders changed: source ${JSON.stringify(placeholders(source))} vs output ${JSON.stringify(placeholders(translated))}`);
  }
  const srcAnchors = anchors(source);
  if (!eqMultiset(srcAnchors, anchors(translated))) {
    reasons.push(`heading anchors changed: source ${JSON.stringify(srcAnchors)} vs output ${JSON.stringify(anchors(translated))}`);
  }
  const srcTags = jsxTags(source);
  const outTags = jsxTags(translated);
  if (srcTags.length !== outTags.length || srcTags.some((v, i) => v !== outTags[i])) {
    reasons.push(`JSX/HTML tag sequence changed: source ${JSON.stringify(srcTags)} vs output ${JSON.stringify(outTags)}`);
  }
  if (kind === 'table') {
    const srcLines = source.split('\n').length;
    const outLines = translated.split('\n').length;
    if (srcLines !== outLines) {
      reasons.push(`table line count changed: ${srcLines} -> ${outLines}`);
    }
  }
  if (kind === 'heading') {
    const lvl = headingLevel(source);
    if (lvl && headingLevel(translated) !== lvl) {
      reasons.push(`heading level changed: ${lvl} -> ${headingLevel(translated)}`);
    }
  }
  const srcMarker = listMarker(source);
  if (srcMarker) {
    const outMarker = listMarker(translated);
    if (srcMarker !== outMarker) {
      reasons.push(`list marker changed: ${srcMarker} -> ${outMarker}`);
    }
  }
  return reasons;
}
