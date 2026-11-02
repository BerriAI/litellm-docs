const {test} = require('node:test');
const assert = require('node:assert/strict');
const {collectUpgradeSources, loadReleaseNotes} = require('./upgrade-sources');
const {validGuide} = require('./upgrade-api');

const base = 'a'.repeat(40), head = 'b'.repeat(40);
function github({changed = true, truncated = false, missing = false} = {}) {
  return async url => {
    if (missing) return {status: 404};
    let data;
    if (url.includes('/commits/')) data = {sha: url.endsWith('v1.0.0') ? base : head, commit: {committer: {date: '2026-01-03'}}};
    else if (url.includes('/git/trees/')) data = {truncated, tree: [{type: 'blob', path: 'migrations/001/migration.sql', sha: changed && url.includes(head) ? 'new' : 'old'}]};
    else data = {encoding: 'base64', content: Buffer.from(url.endsWith('new') ? 'ALTER TABLE keys ADD COLUMN expires timestamp;' : 'CREATE TABLE keys (id text);').toString('base64')};
    return {ok: true, status: 200, json: async () => data};
  };
}
const options = {from: 'v1.0.0', to: 'v1.1.0', notes: [{version: '1.1.0', date: '2026-01-02', url: 'https://docs.litellm.ai/release_notes/v1.1.0', markdown: 'Breaking: renamed config'}]};
test('collects complete changed migration contents and intervening Markdown with immutable code links', async () => {
  const result = await collectUpgradeSources({...options, fetchImpl: github()});
  assert.equal(result.migrationFiles, 1);
  assert.match(result.sources[0].diff, /-CREATE TABLE/);
  assert.match(result.sources[0].diff, /\+ALTER TABLE/);
  assert.match(result.sources[0].url, new RegExp(head));
  assert.match(result.sources[0].previousUrl, new RegExp(base));
  assert.match(result.sources[1].diff, /\+Breaking: renamed config/);
});
test('unchanged migrations are not reported', async () => {
  const result = await collectUpgradeSources({...options, fetchImpl: github({changed: false})});
  assert.equal(result.migrationFiles, 0);
  assert.equal(result.sources.length, 1);
});
test('fails closed on invalid ranges, missing tags and truncated trees', async () => {
  for (const from of ['../../main', 'main', 'v1.1.0', 'v2.0.0']) {
    await assert.rejects(collectUpgradeSources({...options, from, fetchImpl: github()}), {status: 400});
  }
  await assert.rejects(collectUpgradeSources({...options, fetchImpl: github({missing: true})}), {status: 422});
  await assert.rejects(collectUpgradeSources({...options, fetchImpl: github({truncated: true})}), {status: 422});
});
test('requires valid source citations on every generated claim', () => {
  const guide = {breakingChanges: [{text: 'Rename config', sources: [1]}], databaseMigrations: [], upgradeSteps: [], otherChanges: []};
  assert.equal(validGuide(guide, 1), true);
  assert.equal(validGuide(guide, 0), false);
  assert.equal(validGuide({...guide, breakingChanges: [{text: 'Unverified', sources: []}]}, 1), false);
});
test('loads published versioned notes with source URLs', () => {
  const notes = loadReleaseNotes();
  assert.ok(notes.length > 0);
  assert.ok(notes.every(note => note.markdown && note.url.startsWith('https://docs.litellm.ai/release_notes')));
});
