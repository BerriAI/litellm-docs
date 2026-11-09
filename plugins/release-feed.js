// Builds the changelog feed on /release_notes. Each entry's title and short
// points come from release_notes/summaries.json, written by hand for the
// latest releases. A backport that shipped on several release lines is one
// entry with several versions. Dates come from the release notes' frontmatter.
//
// A release newer than the newest summarized one still shows up, so the feed
// never goes stale: its points are the first sentences of its Key Highlights
// until someone adds it to summaries.json.

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

const DIR = path.join(__dirname, '..', 'release_notes');
const SUMMARIES = path.join(DIR, 'summaries.json');
const MAX_POINTS = 4;

function readNote(folder) {
  const file = path.join(DIR, folder, 'index.md');
  if (!fs.existsSync(file)) return null;
  const {data, content} = matter(fs.readFileSync(file, 'utf8'));
  return data.date ? {data, content, date: new Date(data.date).toISOString()} : null;
}

// The page URL Docusaurus gives a release note: its folder plus a relative slug.
function permalinkOf(folder, data) {
  const slug = data.slug ? String(data.slug) : '';
  if (slug.startsWith('/')) return `/release_notes${slug}`;
  return `/release_notes/${folder}/${slug}`;
}

const versionOf = (folder) => folder.replace(/^v?/, 'v').replace(/-stable$/, '');

// "**Label**: text" -> "Label: text", cut to its first sentence.
function highlightSentences(body) {
  const start = body.search(/^## Key Highlights\s*$/m);
  if (start < 0) return [];
  const points = [];
  for (const line of body.slice(start).split('\n').slice(1)) {
    if (/^## /.test(line)) break;
    const m = /^\s*[-*]\s+(.+)$/.exec(line);
    if (!m) continue;
    const text = m[1].replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
    points.push(text.split(/(?<=\.)\s/)[0].replace(/\.$/, ''));
    if (points.length === MAX_POINTS) break;
  }
  return points;
}

function loadFeed() {
  const summaries = JSON.parse(fs.readFileSync(SUMMARIES, 'utf8'));
  const entries = [];
  for (const s of summaries) {
    const notes = s.folders.map((f) => ({folder: f, note: readNote(f)}));
    const missing = notes.filter((n) => !n.note).map((n) => n.folder);
    if (missing.length) throw new Error(`release-feed: summaries.json names missing release notes ${missing.join(', ')}`);
    entries.push({
      date: notes.map((n) => n.note.date).sort().pop(),
      title: s.title,
      points: s.points,
      versions: notes.map(({folder: f, note}) => ({version: versionOf(f), id: `${f}/index`, permalink: permalinkOf(f, note.data)})),
    });
  }

  const newest = entries.reduce((d, e) => (e.date > d ? e.date : d), '');
  const known = new Set(summaries.flatMap((s) => s.folders));
  for (const folder of fs.readdirSync(DIR)) {
    if (known.has(folder) || /rc\d*$|dev/i.test(folder)) continue;
    const note = readNote(folder);
    if (!note || note.date <= newest) continue;
    const headline = String(note.data.title || '').replace(/^(LiteLLM\s+)?v?\d+\.\d+\.\d+\S*\s+[-–—:]?\s*/, '');
    entries.push({
      date: note.date,
      title: `LiteLLM ${versionOf(folder)}${headline ? ` ${headline}` : ''}`,
      points: highlightSentences(note.content),
      versions: [{version: versionOf(folder), id: `${folder}/index`, permalink: permalinkOf(folder, note.data)}],
    });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

module.exports = function releaseFeedPlugin() {
  return {
    name: 'release-feed',
    async loadContent() {
      return loadFeed();
    },
    async contentLoaded({content, actions}) {
      actions.setGlobalData({entries: content});
    },
    // An RSS feed of the same entries, for feed readers, release trackers and agents.
    async postBuild({content, outDir, siteConfig}) {
      const site = siteConfig.url.replace(/\/$/, '');
      const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const plain = (t) => t.replace(/`/g, '');
      const items = content.map((e) => {
        const link = site + e.versions[0].permalink;
        return [
          '    <item>',
          `      <title>${esc(plain(e.title))}</title>`,
          `      <link>${esc(link)}</link>`,
          `      <guid isPermaLink="true">${esc(link)}</guid>`,
          `      <pubDate>${new Date(e.date).toUTCString()}</pubDate>`,
          `      <description>${esc(e.points.map(plain).join(' '))}</description>`,
          '    </item>',
        ].join('\n');
      });
      const xml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        '    <title>LiteLLM Changelog</title>',
        `    <link>${site}/release_notes/</link>`,
        `    <atom:link href="${site}/release_notes/rss.xml" rel="self" type="application/rss+xml"/>`,
        '    <description>The main changes in each LiteLLM release.</description>',
        '    <language>en</language>',
        content[0] ? `    <lastBuildDate>${new Date(content[0].date).toUTCString()}</lastBuildDate>` : '',
        ...items,
        '  </channel>',
        '</rss>',
        '',
      ].filter(Boolean).join('\n');
      fs.mkdirSync(path.join(outDir, 'release_notes'), {recursive: true});
      fs.writeFileSync(path.join(outDir, 'release_notes', 'rss.xml'), xml);
    },
    getPathsToWatch() {
      return [SUMMARIES, path.join(DIR, '*/index.md')];
    },
  };
};

module.exports.loadFeed = loadFeed;
module.exports.highlightSentences = highlightSentences;
module.exports.permalinkOf = permalinkOf;
