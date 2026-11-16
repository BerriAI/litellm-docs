const STANDALONE_BADGE = /^[ \t]*<SinceVersion\b[^>]*\/>[ \t]*$/;
const INLINE_BADGE = /<SinceVersion\b[^>]*\/>/g;
const KEEP_MARKER = /[ \t]*\{\/\*\s*keep-[a-z-]+(?:[^*]|\*(?!\/\}))*\*\/\}/g;

const bare = (version) => version.trim().replace(/^v/i, '');

function badgeVersion(tag) {
  const m = /\bv\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*['"`]([^'"`]*)['"`]\s*\})/.exec(tag);
  return bare(m ? m[1] ?? m[2] ?? m[3] : '');
}

function badgeBackports(tag) {
  const m = /\bbackports\s*=\s*\{\s*\[([^\]]*)\]\s*\}/.exec(tag);
  if (!m) return [];
  return [...m[1].matchAll(/['"`]([^'"`]*)['"`]/g)].map((q) => bare(q[1])).filter(Boolean);
}

function backportText(tag) {
  const lines = badgeBackports(tag).map((v) => `v${v} and later ${v.split('.').slice(0, 2).join('.')}.x patches`);
  return lines.length < 2 ? lines.join('') : `${lines.slice(0, -1).join(', ')} and ${lines[lines.length - 1]}`;
}

function proseLine(line) {
  if (STANDALONE_BADGE.test(line)) {
    const version = badgeVersion(line);
    const backports = backportText(line);
    if (!version) return '';
    return backports
      ? `Available in LiteLLM v${version} and later, and in ${backports}.`
      : `Available in LiteLLM v${version} and later.`;
  }
  return line
    .replace(INLINE_BADGE, (tag) => {
      const version = badgeVersion(tag);
      const backports = backportText(tag);
      if (!version) return '';
      return backports ? `(since LiteLLM v${version}, and ${backports})` : `(since LiteLLM v${version})`;
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
