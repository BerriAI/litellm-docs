// Builds the changelog feed on /release_notes from the release notes themselves:
// the version and headline come from each note's title, the date and authors
// from its frontmatter, and the short points from the bold labels that open
// each Key Highlights bullet. Nothing is written twice, so a new release note
// shows up in the feed on the next build.

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

const DIR = path.join(__dirname, '..', 'release_notes');
const MAX_POINTS = 4;

// "v1.105.0 - Claude Sonnet 5.5, ..." -> version and headline. Older titles
// carry "-stable" on the version, and a few have no headline at all.
function splitTitle(title, folder) {
  const m = /^(v?\d+\.\d+\.\d+(?:[-.]?\w+)?)\s+[-–—]\s+(.+)$/.exec(title || '');
  const version = (m ? m[1] : folder).replace(/^v?/, 'v').replace(/-stable$/, '');
  return {version, headline: m ? m[2].trim() : title || version};
}

const SKIP_SECTIONS = /^(deploy this version|key highlights|full changelog|new contributors|what's changed|new models|new models \/ updated models|new \/ updated models|tldr|bug fixes|breaking changes|known issues)/i;

function section(body, heading) {
  const start = body.search(new RegExp(`^#{2,3} ${heading}\\s*$`, 'm'));
  if (start < 0) return [];
  const lines = body.slice(start).split('\n').slice(1);
  const end = lines.findIndex((l) => /^#{2,3} /.test(l));
  return end < 0 ? lines : lines.slice(0, end);
}

const clean = (t) => t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\s*[:\-–—]\s*$/, '').trim();
const shorten = (t, n = 90) => (t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t);

// Short points for a release, from the most to the least curated source:
// the bold labels in Key Highlights ("**Decisions API**: ..."), plain
// "Label - text" highlight lines, the note's own section headings, and last
// the first items under What's Changed, cut before their PR links.
function highlights(body, max = MAX_POINTS) {
  const key = section(body, 'Key Highlights');
  let points = key.map((l) => /^\s*[-*]\s+\*\*(.+?)\*\*/.exec(l)).filter(Boolean).map((m) => clean(m[1]));
  if (!points.length) {
    points = key.map((l) => /^([A-Z][^-–—:\n]{3,80}?)\s+[-–—]\s+\S/.exec(l.trim())).filter(Boolean).map((m) => clean(m[1]));
  }
  if (!points.length) {
    points = [...body.matchAll(/^## (.+)$/gm)].map((m) => clean(m[1])).filter((h) => !SKIP_SECTIONS.test(h));
  }
  if (!points.length) {
    points = section(body, "What's Changed")
      .map((l) => /^\s*[-*]\s+(.+)$/.exec(l))
      .filter(Boolean)
      .map((m) => shorten(clean(m[1].replace(/\s+(?:[-–—]\s+|by\s+@|in\s+)?\[?(?:PR\s*)?#?\d+.*$/i, ''))));
  }
  return points.filter(Boolean).slice(0, max);
}

function loadReleases() {
  const releases = [];
  for (const folder of fs.readdirSync(DIR)) {
    // Release candidates and dev builds stay in the sidebar, not the feed.
    if (/rc\d*$|dev/i.test(folder)) continue;
    const file = path.join(DIR, folder, 'index.md');
    if (!fs.existsSync(file)) continue;
    const {data, content} = matter(fs.readFileSync(file, 'utf8'));
    if (!data.date) continue;
    const {version, headline} = splitTitle(data.title, folder);
    releases.push({
      id: `${folder}/index`,
      version,
      headline,
      date: new Date(data.date).toISOString(),
      points: highlights(content),
      authors: (data.authors || [])
        .filter((a) => a && typeof a === 'object' && a.name)
        .map((a) => ({name: a.name, image: a.image_url || null})),
    });
  }
  return releases.sort((a, b) => b.date.localeCompare(a.date));
}

module.exports = function releaseFeedPlugin() {
  return {
    name: 'release-feed',
    async loadContent() {
      return loadReleases();
    },
    async contentLoaded({content, actions}) {
      actions.setGlobalData({releases: content});
    },
    getPathsToWatch() {
      return [path.join(DIR, '*/index.md')];
    },
  };
};

module.exports.loadReleases = loadReleases;
module.exports.highlights = highlights;
module.exports.splitTitle = splitTitle;
