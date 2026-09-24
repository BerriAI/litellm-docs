import React, {useEffect, useState} from 'react';
import Link from '@docusaurus/Link';
import {Combobox} from '@base-ui/react/combobox';
import * as semver from 'semver';
import {
  FEATURES,
  LATEST_STABLE_VERSION,
  MAIN_VERSION,
  RELEASES,
  STABLE_RELEASES,
  STAGES,
} from '@site/src/data/rustMigration';
import {StageIcon, stageAnchor} from '@site/src/components/RustMigration/StageBadge';
import picker from './Picker.module.css';
import styles from './VersionImpact.module.css';

const FULL_DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});

const formatDate = date => FULL_DATE.format(new Date(date));

// Versions a reader might run, newest first: every stable release and every
// published RC. Main is left out because nobody runs it yet.
const VERSION_INFO = new Map([
  ...STABLE_RELEASES.map(release => [release.version, {
    date: release.date,
    kind: release.version === LATEST_STABLE_VERSION ? 'Latest stable' : 'Stable',
  }]),
  ...RELEASES.filter(release => !release.isMain).map(release => [release.version, {date: release.date, kind: 'RC'}]),
]);
const VERSIONS = [...VERSION_INFO.keys()].sort(semver.rcompare);
const DEFAULT_VERSION = LATEST_STABLE_VERSION ?? VERSIONS[0];

// `?v=1.102.1` and `?v=v1.102.1` both name v1.102.1.
function versionFromQuery() {
  const raw = new URLSearchParams(window.location.search).get('v');
  const parsed = raw && semver.valid(raw);
  return parsed ? `v${parsed}` : null;
}

// Only API and provider pairs change what a request runs on, so groundwork
// areas stay out of this view.
const API_FEATURES = FEATURES.filter(feature => !feature.area.groundwork);

// Every release that moved an API and provider pair, oldest first. Within a
// release, providers that moved the same API to the same stage share one
// change, like OCR → Rust default for six providers.
const ROLLOUT_RELEASES = (() => {
  const byVersion = new Map();
  API_FEATURES.forEach(feature => feature.rollout.forEach(step => {
    const changes = byVersion.get(step.version) ?? new Map();
    const key = `${feature.area.id}:${step.stage}`;
    const change = changes.get(key) ?? {key, area: feature.area, stage: step.stage, features: []};
    change.features.push(feature);
    byVersion.set(step.version, changes.set(key, change));
  }));
  return [...byVersion]
    .sort(([left], [right]) => semver.compare(left, right))
    .map(([version, changes]) => ({version, changes: [...changes.values()]}));
})();

const PROVIDER_PREVIEW = 3;

// Names the providers in a change. A change that covers all or nearly all of an
// API's providers says so instead of listing them; a long list shows the first
// few and expands on request.
function Providers({change}) {
  const [expanded, setExpanded] = useState(false);
  const names = change.features.map(feature => feature.path.slice(1).join(' / '));
  const rest = change.area.features.filter(feature => !change.features.includes(feature));
  if (rest.length === 0 && names.length > 1) {
    return <p className={styles.impactProviders}>All providers</p>;
  }
  if (rest.length <= 2 && names.length > PROVIDER_PREVIEW) {
    return (
      <p className={styles.impactProviders}>
        All providers except {rest.map(feature => feature.path.slice(1).join(' / ')).join(', ')}
      </p>
    );
  }
  const shown = expanded ? names : names.slice(0, PROVIDER_PREVIEW);
  return (
    <p className={styles.impactProviders}>
      {shown.join(', ')}
      {names.length > shown.length && (
        <button className={styles.impactMore} type="button" onClick={() => setExpanded(true)}>
          +{names.length - shown.length} more
        </button>
      )}
    </p>
  );
}

// The reader's version: the latest stable until `?v=` in the URL names another,
// and every pick is written back to `?v=` so the page can be shared.
export function useChosenVersion() {
  const [version, setVersion] = useState(DEFAULT_VERSION);
  useEffect(() => {
    const fromQuery = versionFromQuery();
    if (fromQuery) {
      setVersion(fromQuery);
    }
  }, []);
  const choose = next => {
    setVersion(next);
    const url = new URL(window.location.href);
    url.searchParams.set('v', next);
    window.history.replaceState(window.history.state, '', url);
  };
  return [version, choose];
}

export function VersionPicker({version, onChange, className = ''}) {
  const items = VERSION_INFO.has(version) ? VERSIONS : [version, ...VERSIONS];
  return (
    <Combobox.Root items={items} value={version} onValueChange={next => next && onChange(next)}>
      <Combobox.Trigger className={`${picker.sentenceControl} ${className}`} aria-label="Your LiteLLM version">
        <Combobox.Value />
        <Combobox.Icon className={picker.selectIcon}>
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
        </Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner className={picker.selectPositioner} sideOffset={8} align="start">
          <Combobox.Popup className={`${picker.selectPopup} ${styles.versionPopup}`} aria-label="Your LiteLLM version">
            <Combobox.Input className={styles.versionSearch} placeholder="Search versions, like 1.101" />
            <Combobox.Empty className={styles.versionEmpty}>No release matches.</Combobox.Empty>
            <Combobox.List className={styles.versionList}>
              {item => (
                <Combobox.Item className={styles.versionItem} value={item} key={item}>
                  <span className={`${picker.selectLabel} ${styles.versionName}`}>{item}</span>
                  {VERSION_INFO.has(item) && (
                    <span className={picker.selectMeta}>
                      {VERSION_INFO.get(item).kind} · {formatDate(VERSION_INFO.get(item).date)}
                    </span>
                  )}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

// Every release that moved something to Rust, oldest first, with a marker
// where `version` falls: what is above it the reader already has, and what is
// below it arrives when they upgrade.
export default function VersionTimeline({version}) {
  const hereIndex = ROLLOUT_RELEASES.findIndex(release => semver.gt(release.version, version));
  const here = hereIndex === -1 ? ROLLOUT_RELEASES.length : hereIndex;
  const rows = [
    ...ROLLOUT_RELEASES.slice(0, here),
    {here: true},
    ...ROLLOUT_RELEASES.slice(here),
  ];

  // Oldest sits on top so upgrading reads as moving down past the marker, the
  // reverse of a changelog; the end labels say so.
  return (
    <div>
      <p className={styles.impactEnd}>Older</p>
      <ol className={styles.impactTimeline}>
        {rows.map((row, index) => {
          if (row.here) {
            return (
              <li className={styles.impactHere} key="here">
                You are here <span>{version}</span>
              </li>
            );
          }
          const date = VERSION_INFO.get(row.version)?.date;
          return (
            <li className={index > here ? styles.impactLater : styles.impactHave} key={row.version}>
              <p className={styles.impactRelease}>
                {row.version}
                {row.version === MAIN_VERSION && <span>Next release</span>}
                {date && <span>{formatDate(date)}</span>}
              </p>
              <ul className={styles.impactChanges}>
                {row.changes.map(change => (
                  <li key={change.key}>
                    <StageIcon kind={STAGES[change.stage].id} className={styles.impactIcon} />
                    <strong>{change.area.text}</strong> →{' '}
                    <Link to={`/rust-migration#${stageAnchor(STAGES[change.stage].id)}`}>
                      {STAGES[change.stage].label}
                    </Link>
                    <Providers change={change} />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
      <p className={`${styles.impactEnd} ${styles.impactEndNewer}`}>Newer</p>
    </div>
  );
}
