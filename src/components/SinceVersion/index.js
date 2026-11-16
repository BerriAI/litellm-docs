import React from 'react';
import styles from './styles.module.css';

const bare = (version) => String(version).trim().replace(/^v/i, '');

// A backport ships on its own release line only, so each version is named with the line it is on.
const releaseLine = (version) => `${version.split('.').slice(0, 2).join('.')}.x`;

const joined = (items) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export default function SinceVersion({ v, backports }) {
  if (!v) return null;

  const version = bare(v);
  const sinceTitle = `Available in LiteLLM v${version} and later`;
  const patches = (Array.isArray(backports) ? backports : []).map(bare).filter(Boolean);
  if (!patches.length) {
    return (
      <span className={styles.badge} data-since-version={version} title={sinceTitle}>
        {`Since v${version}`}
      </span>
    );
  }

  // Search reads the group's title once, so only the group carries data-since-version.
  const onLines = joined(patches.map((patch) => `v${patch} and later ${releaseLine(patch)} patches`));
  return (
    <span className={styles.group} data-since-version={version} title={`${sinceTitle}, and in ${onLines}`}>
      <span className={styles.badge} title={sinceTitle}>{`Since v${version}`}</span>{' '}
      <span className={styles.badge} title={`Included in ${onLines}`}>
        {`Backported to ${patches.map((patch) => `v${patch}`).join(', ')}`}
      </span>
    </span>
  );
}
