import * as semver from 'semver';
import releaseSnapshot from './releases.json';
import {fail, isoDay} from './check';
import type {Release} from './shared';

export const MAIN_VERSION = releaseSnapshot.main.version;

// Every published release on the timeline, oldest first. Main is not on it:
// what lands there next shows up as the plans past the last release.
// Releases are kept by UTC day, the precision the page draws them at.
const releasesOf = (releases: {version: string; releasedAt: string}[]): Release[] => releases
  .map(release => ({version: release.version, date: isoDay(release.releasedAt, release.version)}))
  .sort((left, right) => semver.compare(left.version, right.version));

export const RELEASES = releasesOf(releaseSnapshot.published);

// The newest published RC, which is what "today" means on the page.
export const CURRENT_VERSION = RELEASES.at(-1)!.version;

// The catalog names RC versions, and none can be newer than main.
export function checkVersion(version: string) {
  if (semver.valid(version) === null || semver.prerelease(version)?.[0] !== 'rc') {
    fail(`versions must be RC semver versions: ${version}`);
  }
  if (semver.gt(version, MAIN_VERSION)) {
    fail(`${version} is newer than main (${MAIN_VERSION})`);
  }
}

if (RELEASES.length < 10) {
  fail('the timeline needs at least 10 RC versions');
}
RELEASES.forEach(release => checkVersion(release.version));
if (semver.lte(MAIN_VERSION, CURRENT_VERSION)) {
  fail(`main (${MAIN_VERSION}) must be newer than every published release`);
}
