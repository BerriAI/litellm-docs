const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const semver = require('semver');

const REPO = 'https://github.com/BerriAI/litellm';
const MAX_CONTEXT = 240000;
const versionOf = tag => typeof tag === 'string' && /^v?\d+\.\d+\.\d+(?:-(?:stable|rc[.\d]*))?$/.test(tag)
  ? semver.valid(tag.replace(/-stable$/, '').replace(/-rc(\d+)$/, '-rc.$1')) : null;

function loadReleaseNotes(dir = path.join(__dirname, '..', 'release_notes')) {
  return fs.readdirSync(dir).flatMap(folder => {
    const version = versionOf(folder), file = path.join(dir, folder, 'index.md');
    if (!version || !fs.existsSync(file)) return [];
    const {data, content} = matter(fs.readFileSync(file, 'utf8'));
    const slug = String(data.slug || '');
    return [{version, tag: folder.replace(/-stable$/, ''), date: new Date(data.date).toISOString(),
      url: `https://docs.litellm.ai/release_notes${slug.startsWith('/') ? slug : `/${folder}/${slug}`}`,
      markdown: content}];
  }).sort((a, b) => semver.rcompare(a.version, b.version));
}

function upgradeError(status, message) {
  return Object.assign(new Error(message), {status, publicMessage: message});
}

const isMigration = name => /^(?:litellm-proxy-extras\/litellm_proxy_extras\/migrations\/|migrations\/|litellm-rust\/.*\/migrations\/).*\.(?:sql|toml)$/.test(name) || /(?:^|\/)schema\.prisma$/.test(name);
const isChangelog = name => /(?:^|\/)(?:changelog|changes)\.md$/i.test(name);

function fileDiff(name, before, after) {
  const lines = text => text ? text.replace(/\n$/, '').split('\n') : [];
  const oldLines = lines(before), newLines = lines(after);
  return `--- a/${name}\n+++ b/${name}\n@@ -${oldLines.length ? 1 : 0},${oldLines.length} +${newLines.length ? 1 : 0},${newLines.length} @@\n` +
    [...oldLines.map(line => `-${line}`), ...newLines.map(line => `+${line}`)].join('\n');
}

async function collectUpgradeSources({from, to, notes, token, signal, fetchImpl = fetch}) {
  const fromVersion = versionOf(from), toVersion = versionOf(to);
  if (!fromVersion || !toVersion || !semver.gt(toVersion, fromVersion)) {
    throw upgradeError(400, 'Enter two release tags, with the target version newer than the current version.');
  }
  let totalBytes = 0;
  async function github(endpoint) {
    const response = await fetchImpl(`https://api.github.com/repos/BerriAI/litellm/${endpoint}`, {
      signal, redirect: 'error', headers: {Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? {Authorization: `Bearer ${token}`} : {})},
    });
    if (response.status === 404) throw upgradeError(422, 'A release tag was not found on GitHub. Use an exact published tag.');
    if ([403, 429].includes(response.status)) throw upgradeError(503, 'GitHub is rate-limiting comparisons. Please try again later.');
    if (!response.ok) throw upgradeError(502, 'Could not read the release tags from GitHub. Please retry.');
    return response.json();
  }
  const commits = await Promise.all([from, to].map(tag => github(`commits/${encodeURIComponent(tag)}`)));
  if (commits.some(commit => !/^[a-f0-9]{40}$/.test(commit.sha))) throw upgradeError(502, 'Invalid GitHub commit response.');
  const [base, head] = commits.map(commit => commit.sha);
  const trees = await Promise.all([base, head].map(sha => github(`git/trees/${sha}?recursive=1`)));
  if (trees.some(tree => tree.truncated || !Array.isArray(tree.tree))) {
    throw upgradeError(422, 'GitHub returned an incomplete file tree. No upgrade guidance was generated.');
  }
  const maps = trees.map(tree => new Map(tree.tree.filter(file => file.type === 'blob' && (isMigration(file.path) || isChangelog(file.path)))
    .map(file => [file.path, file.sha])));
  const names = [...new Set(maps.flatMap(map => [...map.keys()]))].sort().filter(name => maps[0].get(name) !== maps[1].get(name));
  if (names.length > 80) throw upgradeError(422, 'This range changes too many migration files. Compare a smaller version range.');
  const sources = [];
  for (const name of names) {
    const texts = await Promise.all(maps.map(async map => {
      if (!map.has(name)) return '';
      const blob = await github(`git/blobs/${map.get(name)}`);
      if (blob.encoding !== 'base64' || typeof blob.content !== 'string') throw upgradeError(502, 'Could not read a complete source file.');
      const text = Buffer.from(blob.content, 'base64').toString('utf8');
      totalBytes += Buffer.byteLength(text);
      if (totalBytes > MAX_CONTEXT) throw upgradeError(422, 'This diff is too large. Compare a smaller version range.');
      return text;
    }));
    sources.push({kind: isMigration(name) ? 'migration' : 'changelog', title: name,
      url: `${REPO}/blob/${maps[1].has(name) ? head : base}/${name}`,
      ...(maps[0].has(name) ? {previousUrl: `${REPO}/blob/${base}/${name}`} : {}),
      diff: fileDiff(name, ...texts)});
  }
  const targetDate = new Date(commits[1].commit.committer.date).getTime();
  const selectedNotes = notes.filter(note => semver.gt(note.version, fromVersion) && semver.lte(note.version, toVersion) &&
    new Date(note.date).getTime() <= targetDate + 86400000);
  for (const note of selectedNotes) {
    sources.push({kind: 'release-note', title: `LiteLLM v${note.version} release notes`, url: note.url,
      diff: fileDiff(`release_notes/v${note.version}/index.md`, '', note.markdown)});
  }
  if (Buffer.byteLength(JSON.stringify(sources)) > MAX_CONTEXT) throw upgradeError(422, 'The changelog diff is too large. Compare a smaller version range.');
  return {from, to, base, head, migrationFiles: sources.filter(source => source.kind === 'migration').length,
    sources: sources.map((source, i) => ({id: i + 1, ...source})),
    warnings: ['Release notes are published separately from code. Notes in this version range are not a commit-ancestry audit and can include backports.',
      ...(!selectedNotes.some(note => note.version === toVersion) ? ['The target has no published release note in this docs snapshot. Breaking-change coverage is incomplete.'] : [])]};
}

module.exports = {collectUpgradeSources, loadReleaseNotes, versionOf, fileDiff};
