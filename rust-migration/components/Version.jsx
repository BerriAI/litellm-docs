import React, {useEffect, useState} from 'react';
import {Combobox} from '@base-ui/react/combobox';
import {
  FEATURES,
  LATEST_STABLE_VERSION,
  MAIN_VERSION,
  RC_RELEASES,
  ROLLOUT_VERSIONS,
  STABLE_RELEASES,
  STAGES,
  changesIn,
} from '../data';
import {compareVersions, isNewer, normalizeVersion} from '../versions';
import {FULL_DATE, formatDate as formatWith, stageAnchor} from './format';
import {StageIcon} from './StageBadge';

const formatDate = date => formatWith(FULL_DATE, date);

// Versions a reader might run, newest first: every stable release and every
// published RC. Main is left out because nobody runs it yet.
const VERSION_INFO = new Map([
  ...STABLE_RELEASES.map(release => [release.version, {
    date: release.date,
    kind: release.version === LATEST_STABLE_VERSION ? 'Latest stable' : 'Stable',
  }]),
  ...RC_RELEASES.map(release => [release.version, {date: release.date, kind: 'RC'}]),
]);
const VERSIONS = [...VERSION_INFO.keys()].sort((left, right) => compareVersions(right, left));
const DEFAULT_VERSION = LATEST_STABLE_VERSION ?? VERSIONS[0];

// `?v=1.102.1` and `?v=v1.102.1` both name v1.102.1.
function versionFromQuery() {
  return normalizeVersion(new URLSearchParams(window.location.search).get('v'));
}

// Only API and provider pairs change what a request runs on, so groundwork
// areas stay out of this view.
const API_FEATURES = FEATURES.filter(feature => !feature.area.groundwork);

// Every release that moved an API and provider pair, oldest first. Within a
// release, providers that moved the same API to the same stage share one
// change, like OCR → Rust default for six providers.
const ROLLOUT_RELEASES = ROLLOUT_VERSIONS
  .map(version => ({version, changes: changesIn(version, API_FEATURES)}))
  .filter(release => release.changes.length > 0);

const PROVIDER_PREVIEW = 3;

// Names the providers in a change. A change that covers all or nearly all of an
// API's providers says so instead of listing them; a long list shows the first
// few and expands on request.
function Providers({change}) {
  const [expanded, setExpanded] = useState(false);
  const names = change.features.map(feature => feature.path.slice(1).join(' / '));
  const rest = change.area.features.filter(feature => !change.features.includes(feature));
  if (rest.length === 0 && names.length > 1) {
    return <p className="rm-impact-impactProviders">All providers</p>;
  }
  if (rest.length <= 2 && names.length > PROVIDER_PREVIEW) {
    return (
      <p className="rm-impact-impactProviders">
        All providers except {rest.map(feature => feature.path.slice(1).join(' / ')).join(', ')}
      </p>
    );
  }
  const shown = expanded ? names : names.slice(0, PROVIDER_PREVIEW);
  return (
    <p className="rm-impact-impactProviders">
      {shown.join(', ')}
      {names.length > shown.length && (
        <button className="rm-impact-impactMore" type="button" onClick={() => setExpanded(true)}>
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
      <Combobox.Trigger className={`rm-picker-sentenceControl ${className}`} aria-label="Your LiteLLM version">
        <Combobox.Value />
        <Combobox.Icon className="rm-picker-selectIcon">
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
        </Combobox.Icon>
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner className="rm-picker-selectPositioner" sideOffset={8} align="start">
          <Combobox.Popup className="rm-picker-selectPopup rm-impact-versionPopup" aria-label="Your LiteLLM version">
            <Combobox.Input className="rm-impact-versionSearch" placeholder="Search versions, like 1.101" />
            <Combobox.Empty className="rm-impact-versionEmpty">No release matches.</Combobox.Empty>
            <Combobox.List className="rm-impact-versionList">
              {item => (
                <Combobox.Item className="rm-impact-versionItem" value={item} key={item}>
                  <span className="rm-picker-selectLabel rm-impact-versionName">{item}</span>
                  {VERSION_INFO.has(item) && (
                    <span className="rm-picker-selectMeta">
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
export function VersionTimeline({version}) {
  const hereIndex = ROLLOUT_RELEASES.findIndex(release => isNewer(release.version, version));
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
      <p className="rm-impact-impactEnd">Older</p>
      <ol className="rm-impact-impactTimeline">
        {rows.map((row, index) => {
          if (row.here) {
            return (
              <li className="rm-impact-impactHere" key="here">
                You are here <span>{version}</span>
              </li>
            );
          }
          const date = VERSION_INFO.get(row.version)?.date;
          return (
            <li className={index > here ? 'rm-impact-impactLater' : 'rm-impact-impactHave'} key={row.version}>
              <p className="rm-impact-impactRelease">
                {row.version}
                {row.version === MAIN_VERSION && <span>Next release</span>}
                {date && <span>{formatDate(date)}</span>}
              </p>
              <ul className="rm-impact-impactChanges">
                {row.changes.map(change => (
                  <li key={change.key}>
                    <StageIcon kind={STAGES[change.stage].id} className="rm-impact-impactIcon" />
                    <strong>{change.area.text}</strong> →{' '}
                    <a href={`/rust-migration#${stageAnchor(STAGES[change.stage].id)}`}>
                      {STAGES[change.stage].label}
                    </a>
                    <Providers change={change} />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
      <p className={`rm-impact-impactEnd rm-impact-impactEndNewer`}>Newer</p>
    </div>
  );
}

// The page at /rust-migration/version: pick a version, see what upgrading brings.
export function RustMigrationVersion() {
  const [version, choose] = useChosenVersion();
  return (
    <main className="rm-page">
      <header className="rm-hero">
        <p className="rm-eyebrow">
          <a href="/rust-migration">Rust Migration</a>
        </p>
        <h1 className="rm-title">
          {'What changes in '}
          <VersionPicker version={version} onChange={choose} className="rm-impact-titlePicker" />
        </h1>
        <p className="rm-description">
          Changes above the marker are already in this version. Upgrading brings the ones below it.
        </p>
      </header>
      <section className="rm-section">
        <VersionTimeline version={version} />
      </section>
    </main>
  );
}
