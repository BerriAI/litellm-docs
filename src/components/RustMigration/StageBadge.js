import React from 'react';
import * as semver from 'semver';
import {Popover} from '@base-ui/react/popover';
import {MAIN_VERSION, RELEASES, STAGES, stageAt} from '@site/src/data/rustMigration';
import styles from './StageBadge.module.css';

const DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
const RELEASE_DATES = new Map(RELEASES.map(release => [release.version, release.date]));

// Where the page explains each stage, keyed like StageIcon's `kind`.
export const stageAnchor = kind => `rollout-stage-${kind}`;

// `v1.94.0-rc.1` reads as `1.94 rc1`, and a patch release keeps its patch number.
export function compactVersion(version) {
  const {major, minor, patch, prerelease} = semver.parse(version);
  const release = patch === 0 ? `${major}.${minor}` : `${major}.${minor}.${patch}`;
  return `${release} rc${prerelease[1]}`;
}

// One glyph per stage past Python: a switch you can turn on, a switch that is
// already on, and Rust's crab once Python is gone. A finished task gets a check.
const ICONS = {
  rustOptIn: (
    <>
      <rect x="1.5" y="4" width="13" height="8" rx="4" />
      <circle cx="5.5" cy="8" r="2" />
    </>
  ),
  rustOptOut: (
    <>
      <rect className={styles.iconFill} x="1.5" y="4" width="13" height="8" rx="4" />
      <circle className={styles.iconKnob} cx="10.5" cy="8" r="2" />
    </>
  ),
  // Ferris, Rust's crab: a shell, two raised claws, eye stalks and legs.
  rustRequired: (
    <>
      <path className={styles.iconFill} d="M3.2 10.2C3.2 8.1 5.4 7 8 7s4.8 1.1 4.8 3.2c0 1.5-2.1 2.4-4.8 2.4s-4.8-.9-4.8-2.4Z" />
      <path d="M4 8.6 2.6 6.4M12 8.6l1.4-2.2" />
      <path className={styles.iconFill} d="M1.2 5.4c0-1.5 1-2.6 2.2-2.6L2.9 4.6l1.3.5C4 6 3.3 6.6 2.6 6.6c-.8 0-1.4-.5-1.4-1.2ZM14.8 5.4c0-1.5-1-2.6-2.2-2.6l.5 1.8-1.3.5c.2.9.9 1.5 1.6 1.5.8 0 1.4-.5 1.4-1.2Z" />
      <path d="M6.6 7.1 6.2 5.6M9.4 7.1l.4-1.5M3.6 11.2l-1.6.9M4.4 12.3l-1.1 1.4M12.4 11.2l1.6.9M11.6 12.3l1.1 1.4" />
    </>
  ),
  done: <path d="M3 8.5 6.5 12 13 4.5" />,
};

// `kind` is a STAGES id past Python, or `done` for a finished task.
export function StageIcon({kind, className = ''}) {
  return (
    <svg className={`${styles.icon} ${className}`} viewBox="0 0 16 16" aria-hidden="true">
      {ICONS[kind]}
    </svg>
  );
}

const kindOf = (feature, stage) => (feature.task ? 'done' : STAGES[stage].id);
const labelOf = (feature, stage) => (feature.task ? 'Done' : STAGES[stage].label);

function releaseDate(version) {
  const date = RELEASE_DATES.get(version);
  const formatted = date && DATE.format(new Date(date));
  if (version === MAIN_VERSION) {
    return formatted ? `Next release · ${formatted}` : 'Next release';
  }
  return formatted;
}

// A unit's current stage as an icon and the release it got there, like
// `[switch] 1.94 rc1`. Hovering, focusing or tapping it lists every step the
// unit took; what each stage means lives in the page's stages section.
export default function StageBadge({feature}) {
  const stage = stageAt(feature, MAIN_VERSION);
  if (stage === 0) {
    return null;
  }
  const {version} = feature.rollout.at(-1);
  return (
    <Popover.Root>
      <Popover.Trigger
        className={styles.badge}
        openOnHover
        delay={150}
        closeDelay={150}
        aria-label={`${labelOf(feature, stage)} since ${version}`}
      >
        <StageIcon kind={kindOf(feature, stage)} />
        {compactVersion(version)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className={styles.positioner} side="bottom" align="end" sideOffset={6}>
          <Popover.Popup className={styles.popup}>
            <Popover.Title className={styles.title}>{feature.text}</Popover.Title>
            {/* Newest first, so the step that set the current stage leads. */}
            <ol className={styles.history}>
              {[...feature.rollout].reverse().map(step => (
                <li key={step.version}>
                  <StageIcon kind={kindOf(feature, step.stage)} />
                  <span className={styles.stage}>{labelOf(feature, step.stage)}</span>
                  <span className={styles.version} title={step.version}>{compactVersion(step.version)}</span>
                  {releaseDate(step.version) && <span className={styles.date}>{releaseDate(step.version)}</span>}
                </li>
              ))}
            </ol>
            <a className={styles.explain} href={`#${stageAnchor(kindOf(feature, stage))}`}>
              What {labelOf(feature, stage)} means →
            </a>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
