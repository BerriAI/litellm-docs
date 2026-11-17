import React from 'react';
import * as semver from 'semver';
import {Popover} from '@base-ui/react/popover';
import {MAIN_VERSION, RELEASES, levelAt, levelId, levelLabel} from '@site/src/data/rustMigration';
import styles from './LevelBadge.module.css';

const DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});
const RELEASE_DATES = new Map(RELEASES.map(release => [release.version, release.date]));

// Where the page explains each level, keyed by LEVELS id.
export const levelAnchor = id => `level-${id}`;

// `v1.94.0-rc.1` reads as `1.94 rc1`, and a patch release keeps its patch number.
export function compactVersion(version) {
  const {major, minor, patch, prerelease} = semver.parse(version);
  const release = patch === 0 ? `${major}.${minor}` : `${major}.${minor}.${patch}`;
  return `${release} rc${prerelease[1]}`;
}

// A half-filled ring for work that is in but not trusted yet, and a check once it is done.
const ICONS = {
  partial: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path className={styles.iconFill} d="M8 2.5a5.5 5.5 0 0 1 0 11Z" />
    </>
  ),
  done: <path d="M3 8.5 6.5 12 13 4.5" />,
};

// `id` is a LEVELS id past `none`.
export function LevelIcon({id, className = ''}) {
  return (
    <svg className={`${styles.icon} ${className}`} viewBox="0 0 16 16" aria-hidden="true">
      {ICONS[id]}
    </svg>
  );
}

function releaseDate(version) {
  const date = RELEASE_DATES.get(version);
  const formatted = date && DATE.format(new Date(date));
  if (version === MAIN_VERSION) {
    return formatted ? `Next release · ${formatted}` : 'Next release';
  }
  return formatted;
}

// A piece of work's current level as an icon and the release it got there,
// like `[check] 1.94 rc1`. Hovering, focusing or tapping it lists every step
// it took; what each level means lives in the page's FAQ.
export default function LevelBadge({work}) {
  const level = levelAt(work, MAIN_VERSION);
  if (level === 0) {
    return null;
  }
  const id = levelId(level);
  const {version} = work.shipped.at(-1);
  return (
    <Popover.Root>
      <Popover.Trigger
        className={styles.badge}
        openOnHover
        delay={150}
        closeDelay={150}
        aria-label={`${levelLabel(id)} since ${version}`}
      >
        <LevelIcon id={id} />
        {compactVersion(version)}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className={styles.positioner} side="bottom" align="end" sideOffset={6}>
          <Popover.Popup className={styles.popup}>
            <Popover.Title className={styles.title}>{work.text}</Popover.Title>
            {/* Newest first, so the step that set the current level leads. */}
            <ol className={styles.history}>
              {[...work.shipped].reverse().map(step => (
                <li key={step.version}>
                  <LevelIcon id={levelId(step.level)} />
                  <span className={styles.level}>{levelLabel(levelId(step.level))}</span>
                  <span className={styles.version} title={step.version}>{compactVersion(step.version)}</span>
                  {releaseDate(step.version) && <span className={styles.date}>{releaseDate(step.version)}</span>}
                </li>
              ))}
            </ol>
            <a className={styles.explain} href={`#${levelAnchor(id)}`}>
              What {levelLabel(id)} means →
            </a>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
