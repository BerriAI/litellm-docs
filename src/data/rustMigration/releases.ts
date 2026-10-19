import * as semver from 'semver';
import releaseSnapshot from '../rustMigrationReleases.json';
import {isoDay} from './days';
import {fail} from './fail';
import type {Release} from './types';

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

// Stable releases, oldest first. A stable release carries the rollouts of the
// RCs it was cut from, which semver ordering already gives: v1.102.1 sorts
// after v1.102.0-rc.2 and before v1.103.0-rc.1.
export const STABLE_RELEASES = releasesOf(releaseSnapshot.stable);

export const LATEST_STABLE_VERSION = STABLE_RELEASES.at(-1)?.version;

// Every published RC in the snapshot, oldest first. The timeline above only
// keeps the latest few; this is the full list readers pick their version from.
export const RC_RELEASES = releasesOf(releaseSnapshot.candidates);

// Rollouts name RC versions, and none can be newer than main.
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
