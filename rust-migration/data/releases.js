import {compareVersions, isRcVersion, isValidVersion, parseVersion} from '../versions';
import {fail} from './fail';
import {releaseSnapshot} from './releases.snapshot';

export const MAIN_VERSION = releaseSnapshot.main.version;

// Every release on the timeline, oldest first, ending with the upcoming one on main.
export const RELEASES = [
  ...releaseSnapshot.published.map(release => ({version: release.version, date: release.releasedAt, isMain: false})),
  {version: MAIN_VERSION, date: releaseSnapshot.main.plannedFor, isMain: true},
].sort((left, right) => compareVersions(left.version, right.version));

// Stable releases, oldest first. A stable release carries the rollouts of the
// RCs it was cut from, which semver ordering already gives: v1.102.1 sorts
// after v1.102.0-rc.2 and before v1.103.0-rc.1.
export const STABLE_RELEASES = releaseSnapshot.stable
  .map(release => ({version: release.version, date: release.releasedAt}))
  .sort((left, right) => compareVersions(left.version, right.version));

export const LATEST_STABLE_VERSION = STABLE_RELEASES.at(-1)?.version;

// Every published RC in the snapshot, oldest first. The timeline above only
// keeps the latest few; this is the full list readers pick their version from.
export const RC_RELEASES = releaseSnapshot.candidates
  .map(release => ({version: release.version, date: release.releasedAt}))
  .sort((left, right) => compareVersions(left.version, right.version));

// Rollouts name RC versions. One newer than main is a projection.
export function checkVersion(version) {
  if (!isValidVersion(version) || !isRcVersion(version)) {
    fail(`versions must be RC semver versions: ${version}`);
  }
}

if (RELEASES.length < 10) {
  fail('the timeline needs at least 10 RC versions');
}
RELEASES.forEach(release => checkVersion(release.version));
if (!RELEASES.at(-1)?.isMain) {
  fail(`main (${MAIN_VERSION}) must be newer than every published release`);
}

// A guess at when an upcoming RC ships, as a `YYYY-MM-DD` date. Releases land
// weekly, so each minor version after main adds a week, and each later RC of
// the same minor adds a few days. Planned releases show it as an estimate.
export function estimateReleaseDate(version) {
  const main = parseVersion(MAIN_VERSION);
  const target = parseVersion(version);
  const weeks = target.minor - main.minor;
  const rcDays = 3 * ((target.prerelease[1] ?? 1) - (main.prerelease[1] ?? 1));
  const date = new Date(`${releaseSnapshot.main.plannedFor}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + weeks * 7 + rcDays);
  return date.toISOString().slice(0, 10);
}
