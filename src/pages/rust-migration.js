import React, {useEffect, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import {usePluginData} from '@docusaurus/useGlobalData';
import Link from '@docusaurus/Link';
import * as semver from 'semver';
import {Select} from '@base-ui/react/select';
import {
  GOALS,
  MAIN_VERSION,
  RELEASES,
  RELEASE_NOTES,
  STAGES,
  progressAt,
  stageAt,
} from '@site/src/data/rustMigration';
import styles from './rust-migration.module.css';

const SHORT_DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
const FULL_DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});

const formatDate = (formatter, date) => formatter.format(new Date(date));

// Each goal's progress at every release on the timeline.
const GOAL_TIMELINES = new Map(GOALS.map(goal => [
  goal.id,
  RELEASES.map(release => ({...release, percent: progressAt(goal, release.version)})),
]));

function compactVersion(version) {
  const {major, minor, patch, prerelease} = semver.parse(version);
  const release = patch === 0 ? `${major}.${minor}` : `${major}.${minor}.${patch}`;
  return `${release} rc${prerelease[1]}`;
}

function useElementWidth(fallback) {
  const ref = useRef(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      const nextWidth = Math.round(entry.contentRect.width);
      if (nextWidth > 0) {
        setWidth(nextWidth);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

const LABEL_SPACING = 100;

// Label as many releases as fit without overlapping. The first release, main,
// and releases where progress moved claim their spots before the rest.
function pickLabeledPoints(points, x, goalX) {
  const priority = index => {
    if (index === 0 || points[index].isMain) {
      return 2;
    }
    return points[index - 1].percent !== points[index].percent ? 1 : 0;
  };
  const byPriority = points
    .map((point, index) => index)
    .sort((a, b) => priority(b) - priority(a) || a - b);
  const labeled = new Set();
  for (const index of byPriority) {
    const fits = [...labeled].every(other => Math.abs(x(index) - x(other)) >= LABEL_SPACING)
      && (points[index].isMain || goalX - x(index) >= LABEL_SPACING);
    if (priority(index) === 2 || fits) {
      labeled.add(index);
    }
  }
  return labeled;
}

function MigrationTimeline({goal}) {
  const points = GOAL_TIMELINES.get(goal.id);
  const [chartRef, width] = useElementWidth(920);
  const compact = width < 560;
  const height = compact ? 240 : 336;
  const plot = compact
    ? {left: 40, right: 20, top: 36, bottom: 56}
    : {left: 48, right: 40, top: 40, bottom: 64};
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const goalGap = compact ? 72 : 120;
  const x = index => plot.left + (index / (points.length - 1)) * (plotWidth - goalGap);
  const baseline = plot.top + plotHeight;
  const y = percent => baseline - (percent / 100) * plotHeight;
  const goalX = plot.left + plotWidth;
  const latest = points.at(-1);
  const linePath = points
    .map((point, index) => (index === 0 ? `M${x(0)},${y(point.percent)}` : `H${x(index)}V${y(point.percent)}`))
    .join('');
  const areaPath = `${linePath}V${baseline}H${x(0)}Z`;
  const labeled = pickLabeledPoints(points, x, goalX);

  return (
    <div className={styles.chartBody} ref={chartRef}>
      <svg
        className={styles.timeline}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="timeline-title timeline-description"
      >
        <title id="timeline-title">Rust migration progress over time</title>
        <desc id="timeline-description">
          {latest.percent} percent of the work for {goal.text} is done in {MAIN_VERSION}.
          The goal targets 100 percent by {goal.endsOn}.
        </desc>
        <defs>
          <linearGradient id="progress-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" className={styles.areaStart} />
            <stop offset="100%" className={styles.areaEnd} />
          </linearGradient>
        </defs>
        {[0, 50, 100].map(tick => (
          <g key={tick}>
            <line
              className={tick === 0 ? styles.baseline : styles.gridLine}
              x1={plot.left}
              x2={goalX}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className={styles.axisLabel} x={plot.left - 10} y={y(tick) + 4} textAnchor="end">{tick}%</text>
          </g>
        ))}
        <path d={areaPath} fill="url(#progress-area)" />
        <line
          className={styles.goalLine}
          x1={x(points.length - 1)}
          x2={goalX}
          y1={y(latest.percent)}
          y2={y(100)}
        />
        <path className={styles.progressLine} d={linePath} />
        {points.map((point, index) => {
          const cx = x(index);
          const cy = y(point.percent);
          const date = formatDate(SHORT_DATE, point.date);
          return (
            <g key={point.version}>
              <title>
                {point.version}: {point.percent}%, {point.isMain ? 'planned for' : 'released'} {date}
              </title>
              <circle
                className={point.isMain ? styles.mainPoint : styles.progressPoint}
                cx={cx}
                cy={cy}
                r={point.isMain ? 5 : 3.5}
              />
              {point.isMain && (
                <text className={styles.pointValue} x={cx} y={cy - 12} textAnchor="middle">
                  {point.percent}%
                </text>
              )}
              {labeled.has(index) && (
                <text
                  className={`${styles.versionLabel} ${point.isMain ? styles.mainVersionLabel : ''}`}
                  x={cx}
                  y={baseline + 26}
                  textAnchor={compact && index === 0 ? 'start' : 'middle'}
                >
                  <tspan x={cx}>{compactVersion(point.version)}</tspan>
                  <tspan className={styles.versionDate} x={cx} dy="16">
                    {point.isMain && !compact ? `${date} · main` : date}
                  </tspan>
                </text>
              )}
            </g>
          );
        })}
        <g className={styles.goal}>
          <title>{goal.text}: 100% by {goal.endsOn}</title>
          <circle cx={goalX} cy={y(100)} r="5" />
          <text className={styles.goalLabel} x={goalX} y={y(100) - 14} textAnchor="end">
            100% goal
          </text>
          <text className={styles.goalAxisLabel} x={goalX} y={baseline + 26} textAnchor="end">
            <tspan x={goalX}>Goal</tspan>
            <tspan className={styles.versionDate} x={goalX} dy="16">
              {formatDate(SHORT_DATE, goal.endsOn)}
            </tspan>
          </text>
        </g>
      </svg>
    </div>
  );
}

function GraphNode({node}) {
  return (
    <li>
      <div className={styles.node}>
        <span className={styles.nodeText}>{node.text}</span>
        {node.rollout ? (
          <FeatureStage feature={node} />
        ) : (
          <span className={styles.nodeMeta}>{progressAt(node, MAIN_VERSION)}%</span>
        )}
      </div>
      {node.children.length > 0 && (
        <ul>
          {node.children.map(child => <GraphNode node={child} key={child.id} />)}
        </ul>
      )}
    </li>
  );
}

// The current stage and when it landed, with one pip per stage past Python.
function FeatureStage({feature}) {
  const stage = stageAt(feature, MAIN_VERSION);
  const lastStep = feature.rollout.at(-1);
  const history = feature.rollout
    .map(step => `${STAGES[step.stage].label} in ${step.version}`)
    .join(', then ');
  return (
    <span className={`${styles.nodeMeta} ${stage > 0 ? styles.onRust : ''}`} title={history || 'Python only'}>
      {/* Python only is the default, so empty pips say enough. */}
      {stage > 0 && `${STAGES[stage].label} · ${lastStep.version === MAIN_VERSION ? 'next release' : compactVersion(lastStep.version)}`}
      <span className={styles.pips} aria-hidden="true">
        {STAGES.slice(1).map((item, index) => (
          <i className={index < stage ? styles.pipOn : undefined} key={item.id} />
        ))}
      </span>
    </span>
  );
}

const GOAL_ITEMS = GOALS.map(goal => ({value: goal.id, label: goal.text}));

function GoalSelect({goal, onChange}) {
  return (
    <Select.Root
      items={GOAL_ITEMS}
      value={goal.id}
      onValueChange={id => onChange(GOALS.find(item => item.id === id))}
    >
      <Select.Trigger className={styles.sentenceControl} aria-label="Migration goal">
        <Select.Value />
        <Select.Icon className={styles.selectIcon}>
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className={styles.selectPositioner} sideOffset={8} align="start" alignItemWithTrigger={false}>
          <Select.Popup className={styles.selectPopup}>
            <Select.List>
              {GOALS.map(item => (
                <Select.Item className={styles.selectItem} value={item.id} key={item.id}>
                  <Select.ItemText className={styles.selectLabel}>{item.text}</Select.ItemText>
                  <span className={styles.selectMeta}>by {formatDate(FULL_DATE, item.endsOn)}</span>
                  {/* Answers "what is in this goal" right where it is picked. */}
                  <span className={styles.selectScope}>
                    {item.summary ?? item.children.map(child => child.text).join(', ')}
                  </span>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

// Icons mirror the views they open: a stepped progress line and a dependency tree.
const VIEW_ICONS = {
  timeline: <path d="M2 13h3V9h4V6h5" />,
  breakdown: (
    <>
      <path d="M4 5v8h5M4 8.5h5" />
      <circle cx="4" cy="3.5" r="1.5" />
      <circle cx="11" cy="8.5" r="1.5" />
      <circle cx="11" cy="13" r="1.5" />
    </>
  ),
};

function MigrationTracker() {
  const [goal, setGoal] = useState(GOALS[0]);
  const [view, setView] = useState('timeline');
  const otherView = view === 'timeline' ? 'breakdown' : 'timeline';

  return (
    <section className={styles.section} aria-labelledby="migration-tracker-title">
      <SectionHeading id="migration-tracker-title" kicker="Migration tracker" title="Where we are today" />
      <div className={styles.chartCard}>
        <p className={styles.goalSentence}>
          <strong className={styles.progressSummary} title={`Across ${goal.features.length} features`}>
            {progressAt(goal, MAIN_VERSION)}%
          </strong>
          {' of '}
          <GoalSelect goal={goal} onChange={setGoal} />
          {' migrated to Rust, '}
          <span className={styles.keepTogether}>
            {'shown as a '}
            <button
              className={styles.sentenceControl}
              type="button"
              title={`Show the ${otherView}`}
              onClick={() => setView(otherView)}
            >
              {/* Keyed so the word pops each time it flips. */}
              <span className={styles.viewWord} key={view}>
                {view}
                <svg viewBox="0 0 16 16" aria-hidden="true">{VIEW_ICONS[view]}</svg>
              </span>
            </button>
            .
          </span>
        </p>
        {/* The chart stays mounted so it keeps its measured width. */}
        <div hidden={view !== 'timeline'}>
          <MigrationTimeline goal={goal} />
        </div>
        {/* The sentence above already names the goal, so the tree starts at its children. */}
        <ul className={styles.tree} hidden={view !== 'breakdown'}>
          {goal.children.map(node => <GraphNode node={node} key={node.id} />)}
        </ul>
      </div>
    </section>
  );
}

function SectionHeading({id, kicker, title}) {
  return (
    <header className={styles.sectionHeading}>
      <p className={styles.kicker}>{kicker}</p>
      <h2 id={id}>{title}</h2>
    </header>
  );
}

const RELEASE_EVENTS = RELEASE_NOTES.map(note => ({
  kind: 'Release',
  title: `Released ${note.version}`,
  href: `https://github.com/BerriAI/litellm/releases/tag/${note.version}`,
  date: note.releasedOn,
  changes: note.changes,
}));

function MigrationUpdates() {
  // Collected at build time from every blog post tagged `rust-migration`.
  const {posts = []} = usePluginData('rust-migration-posts') || {};
  const events = [
    ...posts.map(post => ({kind: 'Blog post', title: post.title, href: post.permalink, date: post.date})),
    ...RELEASE_EVENTS,
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <section className={styles.section} aria-labelledby="migration-updates-title">
      <SectionHeading id="migration-updates-title" kicker="Engineering updates" title="How we are getting there" />
      <ol className={styles.events}>
        {events.map(event => (
          <li className={`${styles.event} ${event.changes ? styles.releaseEvent : ''}`} key={event.href}>
            <p className={styles.eventMeta}>
              <time dateTime={event.date}>{formatDate(FULL_DATE, event.date)}</time>
              {' · '}
              {event.kind}
            </p>
            <Link className={styles.eventTitle} to={event.href}>{event.title}</Link>
            {event.changes && (
              <ul className={styles.eventChanges}>
                {event.changes.map(change => <li key={change}>{change}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function RustMigrationPage() {
  return (
    <Layout title="LiteLLM Rust Migration" description="Updates from LiteLLM's migration to Rust.">
      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Rust Migration</p>
          <h1 className={styles.title}>LiteLLM is moving to Rust</h1>
          <p className={styles.description}>See what already runs on Rust and what is next.</p>
        </header>
        <MigrationTracker />
        <MigrationUpdates />
      </main>
    </Layout>
  );
}
