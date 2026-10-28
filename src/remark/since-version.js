const STANDALONE_BADGE = /^[ \t]*<SinceVersion\b[^>]*\/>[ \t]*$/;
const INLINE_BADGE = /<SinceVersion\b[^>]*\/>/g;
const KEEP_MARKER = /[ \t]*\{\/\*\s*keep-[a-z-]+\s*\*\/\}/g;

function badgeVersion(tag) {
  const m = /\bv\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*['"`]([^'"`]*)['"`]\s*\})/.exec(tag);
  return (m ? m[1] ?? m[2] ?? m[3] : '').trim().replace(/^v/i, '');
}

function proseLine(line) {
  if (STANDALONE_BADGE.test(line)) {
    const version = badgeVersion(line);
    return version ? `Available in LiteLLM v${version} and later.` : '';
  }
  return line
    .replace(INLINE_BADGE, (tag) => {
      const version = badgeVersion(tag);
      return version ? `(since LiteLLM v${version})` : '';
    })
    .replace(KEEP_MARKER, '');
}

function sinceVersionAsText(text) {
  let fence = null;
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      const fenceMatch = /^(```+|~~~+)/.exec(trimmed);
      if (fenceMatch) {
        if (!fence) fence = fenceMatch[1];
        else if (trimmed.startsWith(fence) && trimmed.replace(/[`~]/g, '') === '') fence = null;
        return line;
      }
      return fence ? line : proseLine(line);
    })
    .join('\n');
}

module.exports = {sinceVersionAsText};
