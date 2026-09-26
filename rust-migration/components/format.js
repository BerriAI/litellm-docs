import {parseVersion} from '../versions';

export const SHORT_DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
export const FULL_DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});

export const formatDate = (formatter, date) => formatter.format(new Date(date));

// Where the page explains each stage, keyed like StageIcon's `kind`.
export const stageAnchor = kind => `rollout-stage-${kind}`;

// `v1.94.0-rc.1` reads as `1.94 rc1`, and a patch release keeps its patch number.
export function compactVersion(version) {
  const {major, minor, patch, prerelease} = parseVersion(version);
  const release = patch === 0 ? `${major}.${minor}` : `${major}.${minor}.${patch}`;
  return `${release} rc${prerelease[1]}`;
}
