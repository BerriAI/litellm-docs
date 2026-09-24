import React, {useEffect, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import {usePluginData} from '@docusaurus/useGlobalData';
import Link from '@docusaurus/Link';
import {Select} from '@base-ui/react/select';
import {
  GOALS,
  MAIN_VERSION,
  RELEASES,
  STAGES,
  progressAt,
} from '@site/src/data/rustMigration';
import StageBadge, {StageIcon, compactVersion, stageAnchor} from '@site/src/components/RustMigration/StageBadge';
import picker from '@site/src/components/RustMigration/Picker.module.css';
import styles from './rust-migration.module.css';

const SHORT_DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
const FULL_DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});

const formatDate = (formatter, date) => formatter.format(new Date(date));

// Each goal's progress at every release on the timeline.
const GOAL_TIMELINES = new Map(GOALS.map(goal => [
  goal.id,
  RELEASES.map(release => ({...release, percent: progressAt(goal, release.version)})),
]));

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

// Every row leads with the same ring. Its arc is the node's progress, a group
// draws its chevron inside, and once a node is complete the ring fills solid
// with the glyph cut out of it: the chevron for a group, a check otherwise.
function ProgressMarker({percent, expandable}) {
  const complete = percent === 100;
  return (
    <svg className={`${styles.marker} ${complete ? styles.markerComplete : ''}`} viewBox="0 0 16 16" aria-hidden="true">
      <circle className={styles.markerTrack} cx="8" cy="8" r="6.5" />
      {percent > 0 && !complete && (
        <circle className={styles.markerArc} cx="8" cy="8" r="6.5" pathLength="100" strokeDasharray={`${percent} 100`} />
      )}
      {expandable && <path className={styles.markerGlyph} d="M7 5.5 9.5 8 7 10.5" />}
      {!expandable && complete && <path className={styles.markerGlyph} d="M5.3 8.2 7.2 10 10.7 6.2" />}
    </svg>
  );
}

function GraphNode({node}) {
  if (!node.rollout) {
    return <GroupNode group={node} />;
  }
  return (
    <li>
      <div className={styles.node}>
        <ProgressMarker percent={progressAt(node, MAIN_VERSION)} />
        <span className={styles.nodeText}>{node.text}</span>
        <span className={styles.nodeMeta}><StageBadge feature={node} /></span>
      </div>
    </li>
  );
}

// Groups start collapsed so the list stays scannable; opening one shows what it holds.
function GroupNode({group}) {
  const percent = progressAt(group, MAIN_VERSION);
  return (
    <li>
      <details className={styles.group}>
        <summary className={styles.node}>
          <ProgressMarker percent={percent} expandable />
          <span className={styles.nodeText}>{group.text}</span>
          <span className={`${styles.nodeMeta} ${percent > 0 ? styles.onRust : ''}`}>{percent}%</span>
        </summary>
        <ul>
          {group.children.map(child => <GraphNode node={child} key={child.id} />)}
        </ul>
      </details>
    </li>
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
      <Select.Trigger className={picker.sentenceControl} aria-label="Migration goal">
        <Select.Value />
        <Select.Icon className={picker.selectIcon}>
          <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner className={picker.selectPositioner} sideOffset={8} align="start" alignItemWithTrigger={false}>
          <Select.Popup className={picker.selectPopup}>
            <Select.List>
              {GOALS.map(item => (
                <Select.Item className={picker.selectItem} value={item.id} key={item.id}>
                  <Select.ItemText className={picker.selectLabel}>{item.text}</Select.ItemText>
                  <span className={picker.selectMeta}>by {formatDate(FULL_DATE, item.endsOn)}</span>
                  {/* Answers "what is in this goal" right where it is picked. */}
                  <span className={picker.selectScope}>
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
              className={picker.sentenceControl}
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
          {goal.children.map(area => <GroupNode group={area} key={area.id} />)}
        </ul>
      </div>
    </section>
  );
}

// Explains each rollout stage once, so the tracker's badges can stay terse and
// link here instead.
function RolloutStages() {
  const stages = [
    ...STAGES.slice(1).map(stage => ({kind: stage.id, ...stage})),
    {
      kind: 'done',
      label: 'Done',
      description: 'Shared work like cloud auth has no rollout of its own. It is done once every Rust path can use it.',
    },
  ];
  return (
    <>
      <p className={styles.sectionLead}>
        Each feature starts on Python and moves through these stages one release at a time. For the two middle stages,
        the <code>LITELLM_RUST</code> environment variable flips the default for the whole process.
      </p>
      <ul className={styles.stages}>
        {stages.map(stage => (
          <li className={styles.stage} id={stageAnchor(stage.kind)} key={stage.kind}>
            <p className={styles.stageName}>
              <StageIcon kind={stage.kind} className={styles.stageIcon} />
              {stage.label}
            </p>
            <p className={styles.stageDescription}>{stage.description}</p>
            {stage.switch && (
              <p className={styles.stageSwitch}>
                <code>LITELLM_RUST={stage.switch.value}</code>
                <span>{stage.switch.effect}</span>
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

const FAQ = [
  {
    id: 'faq-my-version',
    question: 'I am on a specific version. What is the impact for me?',
    answer: (
      <p className={styles.sectionLead}>
        Pick your version on the <Link to="/rust-migration/version">version impact page</Link> to see what already
        runs on Rust for you and what changes when you upgrade.
      </p>
    ),
  },
  {id: 'faq-rollout-stages', question: 'How does a feature move to Rust?', answer: <RolloutStages />},
];

const hashId = () => decodeURIComponent(window.location.hash.slice(1));

// Point the URL at an open answer so it can be shared, without adding a history
// entry per toggle. A deeper link already inside the answer, like a stage, is kept.
function syncHash(details) {
  const current = hashId();
  const {pathname, search} = window.location;
  if (details.open && !(current && details.contains(document.getElementById(current)))) {
    window.history.replaceState(window.history.state, '', `${pathname}${search}#${details.id}`);
  } else if (!details.open && current === details.id) {
    window.history.replaceState(window.history.state, '', `${pathname}${search}`);
  }
}

// Answers start collapsed, and each one is addressable as `#<id>`. A link to an
// answer, or to something inside one like a stage badge's "What this means",
// opens it first so the target is visible.
function Faq() {
  const listRef = useRef(null);
  useEffect(() => {
    const openHashTarget = () => {
      const id = hashId();
      const target = id && document.getElementById(id);
      const details = target && listRef.current?.contains(target) && target.closest('details');
      if (details && !details.open) {
        details.open = true;
        target.scrollIntoView();
      }
    };
    openHashTarget();
    window.addEventListener('hashchange', openHashTarget);
    return () => window.removeEventListener('hashchange', openHashTarget);
  }, []);

  return (
    <section className={styles.section} id="faq" aria-labelledby="faq-title">
      <SectionHeading id="faq-title" kicker="FAQ" title="Frequently asked questions" />
      <ul className={styles.faq} ref={listRef}>
        {FAQ.map(item => (
          <li key={item.id}>
            <details className={styles.faqItem} id={item.id} onToggle={event => syncHash(event.currentTarget)}>
              <summary className={styles.faqQuestion}>
                {item.question}
                <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>
              </summary>
              <div className={styles.faqAnswer}>{item.answer}</div>
            </details>
          </li>
        ))}
      </ul>
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

function MigrationUpdates() {
  // Collected at build time from every blog post tagged `rust-migration`.
  const {posts = []} = usePluginData('rust-migration-posts') || {};
  const events = posts
    .map(post => ({kind: 'Blog post', title: post.title, href: post.permalink, date: post.date}))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <section className={styles.section} aria-labelledby="migration-updates-title">
      <SectionHeading id="migration-updates-title" kicker="Engineering updates" title="How we are getting there" />
      <p className={styles.sectionLead}>
        For what each release moved to Rust, pick your version on
        the <Link to="/rust-migration/version">version impact page</Link>.
      </p>
      <ol className={styles.events}>
        {events.map(event => (
          <li className={styles.event} key={event.href}>
            <p className={styles.eventMeta}>
              <time dateTime={event.date}>{formatDate(FULL_DATE, event.date)}</time>
              {' · '}
              {event.kind}
            </p>
            <Link className={styles.eventTitle} to={event.href}>{event.title}</Link>
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
        <Faq />
      </main>
    </Layout>
  );
}
