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
      versions: s.folders.map((f) => ({version: versionOf(f), id: `${f}/index`})),
    });
  }

  const newest = entries.reduce((d, e) => (e.date > d ? e.date : d), '');
  const known = new Set(summaries.flatMap((s) => s.folders));
  for (const folder of fs.readdirSync(DIR)) {
    if (known.has(folder) || /rc\d*$|dev/i.test(folder)) continue;
    const note = readNote(folder);
    if (!note || note.date <= newest) continue;
    const headline = String(note.data.title || '').replace(/^v?\d+\.\d+\.\d+\S*\s+[-–—]\s+/, '');
    entries.push({
      date: note.date,
      title: `LiteLLM ${versionOf(folder)}${headline ? ` ${headline}` : ''}`,
      points: highlightSentences(note.content),
      versions: [{version: versionOf(folder), id: `${folder}/index`}],
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
    getPathsToWatch() {
      return [SUMMARIES, path.join(DIR, '*/index.md')];
    },
  };
};

module.exports.loadFeed = loadFeed;
module.exports.highlightSentences = highlightSentences;
