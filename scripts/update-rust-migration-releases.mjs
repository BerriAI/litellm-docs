import {readFile, writeFile} from 'node:fs/promises';
import {get} from 'node:https';
import process from 'node:process';
import * as semver from 'semver';

const RELEASES_URL = 'https://api.github.com/repos/BerriAI/litellm/releases?per_page=100';
const PYPROJECT_URL = 'https://raw.githubusercontent.com/BerriAI/litellm/main/pyproject.toml';
const OUTPUT_URL = new URL('../src/data/rustMigrationReleases.json', import.meta.url);
const RELEASE_COUNT = 10;

function request(url, accept) {
  return new Promise((resolve, reject) => {
    const headers = {
      Accept: accept,
      'User-Agent': 'litellm-docs-rust-migration-release-sync',
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    get(url, {headers}, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode !== 200) {
          reject(new Error(`Request failed with ${response.statusCode}: ${url}`));
          return;
        }
        resolve(body);
      });
    }).on('error', reject);
  });
}

function isRcVersion(version) {
  return semver.valid(version) !== null && semver.prerelease(version)?.[0] === 'rc';
}

function isStableVersion(version) {
  return semver.valid(version) !== null && semver.prerelease(version) === null;
}

function baseVersion(version) {
  const parsed = semver.parse(version);
  if (!parsed) {
    throw new Error(`Invalid version: ${version}`);
  }
  return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
}

function nextMainRc(projectVersion, releases) {
  const matchingRcNumbers = releases
    .filter(release => baseVersion(release.version) === projectVersion)
    .map(release => semver.prerelease(release.version)?.[1])
    .filter(value => Number.isInteger(value));
  const nextRcNumber = Math.max(0, ...matchingRcNumbers) + 1;
  return `v${projectVersion}-rc.${nextRcNumber}`;
}

function nextSaturday(releasedAt) {
  const releaseDate = new Date(releasedAt);
  const daysUntilSaturday = (6 - releaseDate.getUTCDay() + 7) % 7 || 7;
  releaseDate.setUTCDate(releaseDate.getUTCDate() + daysUntilSaturday);
  return releaseDate.toISOString().slice(0, 10);
}

async function generateSnapshot() {
  const [releasesBody, pyproject] = await Promise.all([
    request(RELEASES_URL, 'application/vnd.github+json'),
    request(PYPROJECT_URL, 'text/plain'),
  ]);
  const allReleases = JSON.parse(releasesBody)
    .map(release => ({version: release.tag_name, releasedAt: release.published_at}))
    .filter(release => release.releasedAt && semver.valid(release.version) !== null)
    .sort((left, right) => semver.compare(left.version, right.version));
  const releases = allReleases.filter(release => isRcVersion(release.version));
  // Every stable release and RC in the fetched window, so readers can look up
  // the one they run. `published` stays the chart's short window.
  const stable = allReleases.filter(release => isStableVersion(release.version));
  const projectVersion = pyproject.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (!projectVersion || semver.valid(projectVersion) === null) {
    throw new Error('Could not read a valid project version from main/pyproject.toml');
  }
  if (releases.length < RELEASE_COUNT) {
    throw new Error(`Expected at least ${RELEASE_COUNT} published RC releases, found ${releases.length}`);
  }

  const published = releases.slice(-RELEASE_COUNT);
  const main = {
    version: nextMainRc(projectVersion, releases),
    plannedFor: nextSaturday(published.at(-1).releasedAt),
  };
  return `${JSON.stringify({
    source: 'BerriAI/litellm',
    published,
    candidates: releases,
    stable,
    main,
  }, null, 2)}\n`;
}

const snapshot = await generateSnapshot();
if (process.argv.includes('--check')) {
  const current = await readFile(OUTPUT_URL, 'utf8');
  if (current !== snapshot) {
    console.error('Rust migration releases are stale. Run npm run update:rust-migration-releases');
    process.exitCode = 1;
  }
} else {
  await writeFile(OUTPUT_URL, snapshot);
  console.log(`Updated ${OUTPUT_URL.pathname}`);
}
