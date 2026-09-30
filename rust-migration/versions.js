// Version helpers for `v1.102.1` and `v1.104.0-rc.2` style tags. This covers
// what the migration pages need so they run without the semver package.
const PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

// `{major, minor, patch, prerelease}`, where `prerelease` splits `rc.2` into
// `['rc', 2]`, or null when `version` is not a version.
export function parseVersion(version) {
  const match = PATTERN.exec(String(version ?? ''));
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.').map(part => (/^\d+$/.test(part) ? Number(part) : part)) : [],
  };
}

export const isValidVersion = version => parseVersion(version) !== null;

// `1.102.1` and `v1.102.1` both become `v1.102.1`; anything else is null.
export function normalizeVersion(version) {
  const parsed = parseVersion(version);
  if (!parsed) {
    return null;
  }
  const {major, minor, patch, prerelease} = parsed;
  return `v${major}.${minor}.${patch}${prerelease.length ? `-${prerelease.join('.')}` : ''}`;
}

function comparePrerelease(left, right) {
  // A release sorts after any prerelease of the same number.
  if (left.length === 0 || right.length === 0) {
    return right.length - left.length;
  }
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index];
    const b = right[index];
    if (a === undefined || b === undefined) {
      return a === undefined ? -1 : 1;
    }
    if (a === b) {
      continue;
    }
    if (typeof a === 'number' && typeof b === 'number') {
      return a - b;
    }
    // Numeric identifiers sort before alphanumeric ones.
    if (typeof a === 'number' || typeof b === 'number') {
      return typeof a === 'number' ? -1 : 1;
    }
    return a < b ? -1 : 1;
  }
  return 0;
}

// Negative when `left` is older than `right`, like an Array.sort comparator.
export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  return a.major - b.major
    || a.minor - b.minor
    || a.patch - b.patch
    || comparePrerelease(a.prerelease, b.prerelease);
}

export const isNewer = (left, right) => compareVersions(left, right) > 0;
export const isNotNewer = (left, right) => compareVersions(left, right) <= 0;

export const isRcVersion = version => parseVersion(version)?.prerelease[0] === 'rc';
