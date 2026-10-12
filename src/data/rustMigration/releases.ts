import * as semver from 'semver';
import releaseSnapshot from '../rustMigrationReleases.json';
import {fail} from './fail';
import type {Release} from './types';

export const MAIN_VERSION = releaseSnapshot.main.version;

// Every release on the timeline, oldest first, ending with the upcoming one on main.
export const RELEASES: Release[] = [
  ...releaseSnapshot.published.map(release => ({version: release.version, date: release.releasedAt, isMain: false})),
  {version: MAIN_VERSION, date: releaseSnapshot.main.plannedFor, isMain: true},
].sort((left, right) => semver.compare(left.version, right.version));

// Stable releases, oldest first. A stable release carries the rollouts of the
// RCs it was cut from, which semver ordering already gives: v1.102.1 sorts
// after v1.102.0-rc.2 and before v1.103.0-rc.1.
export const STABLE_RELEASES = releaseSnapshot.stable
  .map(release => ({version: release.version, date: release.releasedAt}))
  .sort((left, right) => semver.compare(left.version, right.version));

export const LATEST_STABLE_VERSION = STABLE_RELEASES.at(-1)?.version;

// Every published RC in the snapshot, oldest first. The timeline above only
// keeps the latest few; this is the full list readers pick their version from.
export const RC_RELEASES = releaseSnapshot.candidates
  .map(release => ({version: release.version, date: release.releasedAt}))
  .sort((left, right) => semver.compare(left.version, right.version));

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
if (!RELEASES.at(-1)?.isMain) {
  fail(`main (${MAIN_VERSION}) must be newer than every published release`);
}
