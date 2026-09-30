import React from 'react';
import {MAIN_VERSION, PLAN_RELEASES, RELEASES, STAGES, stageAt} from '../data';
import {FULL_DATE, SHORT_DATE, compactVersion, formatDate, stageAnchor} from './format';

const RELEASE_DATES = new Map(RELEASES.map(release => [release.version, release.date]));
const PLANNED_DATES = new Map(PLAN_RELEASES.map(release => [release.version, release.date]));

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
      <rect className="rm-badge-iconFill" x="1.5" y="4" width="13" height="8" rx="4" />
      <circle className="rm-badge-iconKnob" cx="10.5" cy="8" r="2" />
    </>
  ),
  // Ferris, Rust's crab: a shell, two raised claws, eye stalks and legs.
  rustRequired: (
    <>
      <path className="rm-badge-iconFill" d="M3.2 10.2C3.2 8.1 5.4 7 8 7s4.8 1.1 4.8 3.2c0 1.5-2.1 2.4-4.8 2.4s-4.8-.9-4.8-2.4Z" />
      <path d="M4 8.6 2.6 6.4M12 8.6l1.4-2.2" />
      <path className="rm-badge-iconFill" d="M1.2 5.4c0-1.5 1-2.6 2.2-2.6L2.9 4.6l1.3.5C4 6 3.3 6.6 2.6 6.6c-.8 0-1.4-.5-1.4-1.2ZM14.8 5.4c0-1.5-1-2.6-2.2-2.6l.5 1.8-1.3.5c.2.9.9 1.5 1.6 1.5.8 0 1.4-.5 1.4-1.2Z" />
      <path d="M6.6 7.1 6.2 5.6M9.4 7.1l.4-1.5M3.6 11.2l-1.6.9M4.4 12.3l-1.1 1.4M12.4 11.2l1.6.9M11.6 12.3l1.1 1.4" />
    </>
  ),
  done: <path d="M3 8.5 6.5 12 13 4.5" />,
};

// `kind` is a STAGES id past Python, or `done` for a finished task.
export function StageIcon({kind, className = ''}) {
  return (
    <svg className={`rm-badge-icon ${className}`} viewBox="0 0 16 16" aria-hidden="true">
      {ICONS[kind]}
    </svg>
  );
}

const kindOf = (feature, stage) => (feature.task ? 'done' : STAGES[stage].id);
const labelOf = (feature, stage) => (feature.task ? 'Done' : STAGES[stage].label);

function releaseDate(version) {
  if (PLANNED_DATES.has(version)) {
    return `Projected · ~${formatDate(SHORT_DATE, PLANNED_DATES.get(version))}`;
  }
  const date = RELEASE_DATES.get(version);
  const formatted = date && formatDate(FULL_DATE, date);
  if (version === MAIN_VERSION) {
    return formatted ? `Next release · ${formatted}` : 'Next release';
  }
  return formatted;
}

// A unit's current stage as an icon and the release it got there, like
// `[switch] 1.94 rc1`. A unit still on Python that the plan moves shows its
// next stage and release with a dashed outline. Hovering, focusing or tapping
// the badge lists every step, planned ones first; what each stage means lives
// in the page's stages section.
export function StageBadge({feature}) {
  const stage = stageAt(feature, MAIN_VERSION);
  const [nextStep] = feature.planned;
  if (stage === 0 && !nextStep) {
    return null;
  }
  const isPlan = stage === 0;
  const shown = isPlan ? nextStep : feature.rollout.at(-1);
  const shownStage = isPlan ? nextStep.stage : stage;
  const popupId = `stage-history-${feature.id.replace(/[^a-z0-9]+/gi, '-')}`;
  const steps = [
    ...[...feature.planned].reverse().map(step => ({...step, isPlan: true})),
    ...[...feature.rollout].reverse(),
  ];
  return (
    <div className="rm-badge-wrap">
      <button
        className={`rm-badge-badge ${isPlan ? 'rm-badge-planned' : ''}`}
        type="button"
        aria-describedby={popupId}
        aria-label={`${labelOf(feature, shownStage)} ${isPlan ? 'projected for' : 'since'} ${shown.version}`}
      >
        <StageIcon kind={kindOf(feature, shownStage)} />
        {compactVersion(shown.version)}
      </button>
      <div className="rm-badge-popup" id={popupId} role="tooltip">
        <p className="rm-badge-title">{feature.text}</p>
        {/* Newest first, so the step that set the current stage leads. */}
        <ol className="rm-badge-history">
          {steps.map(step => (
            <li className={step.isPlan ? 'rm-badge-planRow' : ''} key={step.version}>
              <StageIcon kind={kindOf(feature, step.stage)} />
              <span className="rm-badge-stage">{labelOf(feature, step.stage)}</span>
              <span className="rm-badge-version" title={step.version}>{compactVersion(step.version)}</span>
              {releaseDate(step.version) && <span className="rm-badge-date">{releaseDate(step.version)}</span>}
            </li>
          ))}
        </ol>
        <a className="rm-badge-explain" href={`#${stageAnchor(kindOf(feature, shownStage))}`}>
          What {labelOf(feature, shownStage)} means →
        </a>
      </div>
    </div>
  );
}
