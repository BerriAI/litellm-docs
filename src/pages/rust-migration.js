import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import {usePluginData} from '@docusaurus/useGlobalData';
import Link from '@docusaurus/Link';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import {Select} from '@base-ui/react/select';
import {
  CURRENT_VERSION,
  GOALS,
  PLANS,
  RELEASES,
  STAGES,
  changesIn,
  progressAt,
  stageAt,
} from '@site/src/data/rustMigration';
import StageBadge, {StageIcon, compactVersion, stageAnchor} from '@site/src/components/RustMigration/StageBadge';
import picker from '@site/src/components/RustMigration/Picker.module.css';
import styles from './rust-migration.module.css';

const SHORT_DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
const FULL_DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});

const formatDate = (formatter, date) => formatter.format(new Date(date));

// Each goal's progress at every published release, then where the plans
// should take it. The last published release is today.
const GOAL_TIMELINES = new Map(GOALS.map(goal => [
  goal.id,
  [
    ...RELEASES.map(release => ({
      ...release,
      percent: progressAt(goal, release.version),
      isCurrent: release.version === CURRENT_VERSION,
    })),
    ...PLANS.map(plan => ({...plan, percent: progressAt(goal, plan.version, true), isPlan: true})),
  ],
]));

// Every percent on the page is a whole number, like 13.5% as 14%.
const wholePercent = percent => Math.round(percent);

// Points keep one decimal, since a single provider can be worth a fraction of one.
const formatPoints = value => (Math.round(value * 10) / 10).toString();

// A goal's progress in points of its weight, like 11.8 of 100.
const pointsAt = (goal, version, projected = false) => (progressAt(goal, version, projected) * goal.points) / 100;

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

// Label as many points as fit without overlapping. The first release, today,
// and the plans claim their spots first, then releases where progress moved.
function pickLabeledPoints(points, x, goalX) {
  const pinned = point => point.isCurrent || point.isPlan;
  const priority = index => {
    if (index === 0 || pinned(points[index])) {
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
      && (pinned(points[index]) || goalX - x(index) >= LABEL_SPACING);
    if (priority(index) === 2 || fits) {
      labeled.add(index);
    }
  }
  return labeled;
}

function MigrationTimeline({goal}) {
  const points = GOAL_TIMELINES.get(goal.id);
  const [chartRef, width] = useElementWidth(920);
  const [hovered, setHovered] = useState(null);
  const compact = width < 560;
  const height = compact ? 240 : 336;
  const plot = compact
    ? {left: 40, right: 20, top: 36, bottom: 56}
    : {left: 48, right: 40, top: 40, bottom: 64};
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const goalGap = compact ? 64 : 112;
  // Plans get wider steps than releases so their labels never collide.
  const planGap = compact ? 60 : 100;
  const releaseCount = RELEASES.length;
  const releaseEnd = plot.left + plotWidth - goalGap - PLANS.length * planGap;
  const x = index => (index < releaseCount
    ? plot.left + (index / (releaseCount - 1)) * (releaseEnd - plot.left)
    : releaseEnd + (index - releaseCount + 1) * planGap);
  const baseline = plot.top + plotHeight;
  const y = percent => baseline - (percent / 100) * plotHeight;
  const goalX = plot.left + plotWidth;
  const current = releaseCount - 1;
  const linePath = points
    .slice(0, releaseCount)
    .map((point, index) => (index === 0 ? `M${x(0)},${y(point.percent)}` : `H${x(index)}V${y(point.percent)}`))
    .join('');
  const areaPath = `${linePath}V${baseline}H${x(0)}Z`;
  // From today through each plan to the goal, as one dashed projection.
  const projectionPath = points
    .slice(current)
    .map((point, offset) => `${offset === 0 ? 'M' : 'L'}${x(current + offset)},${y(point.percent)}`)
    .join('') + `L${goalX},${y(100)}`;
  const labeled = pickLabeledPoints(points, x, goalX);

  return (
    <div className={styles.chartBody} ref={chartRef}>
      <svg
        className={styles.timeline}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        // A label rather than <title>, which browsers show as a tooltip over the whole chart.
        aria-label="Rust migration progress over time"
        aria-describedby="timeline-description"
      >
        <desc id="timeline-description">
          {wholePercent(points[current].percent)} percent of {goal.text} is migrated in {CURRENT_VERSION}.
          {PLANS.map(plan => {
            const point = points.find(candidate => candidate.version === plan.version);
            return ` ${plan.label} is planned to reach ${wholePercent(point.percent)} percent.`;
          })}
          {' '}The goal targets 100 percent by {goal.endsOn}.
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
        <path className={styles.goalLine} d={projectionPath} fill="none" />
        <path className={styles.progressLine} d={linePath} />
        {points.map((point, index) => {
          const cx = x(index);
          const cy = y(point.percent);
          const date = formatDate(SHORT_DATE, point.date);
          const pinned = point.isCurrent || point.isPlan;
          const pointClass = point.isPlan ? styles.planPoint : point.isCurrent ? styles.mainPoint : styles.progressPoint;
          return (
            <g
              key={point.version}
              tabIndex={0}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              onClick={() => setHovered(index)}
            >
              <circle className={styles.pointHit} cx={cx} cy={cy} r={compact ? 12 : 14} />
              <circle className={pointClass} cx={cx} cy={cy} r={pinned ? 5 : 3.5} />
              {pinned && (
                <text
                  className={`${styles.pointValue} ${point.isPlan ? styles.planValue : ''}`}
                  x={cx}
                  y={cy - 12}
                  textAnchor="middle"
                >
                  {wholePercent(point.percent)}%
                </text>
              )}
              {labeled.has(index) && (
                <text
                  className={`${styles.versionLabel} ${point.isCurrent ? styles.mainVersionLabel : ''} ${point.isPlan ? styles.planVersionLabel : ''}`}
                  x={cx}
                  y={baseline + 26}
                  textAnchor={compact && index === 0 ? 'start' : 'middle'}
                >
                  <tspan x={cx}>{point.isPlan ? point.label : compactVersion(point.version)}</tspan>
                  <tspan className={styles.versionDate} x={cx} dy="16">
                    {point.isCurrent && !compact ? `${date} · today` : date}
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
      {hovered !== null && (
        <PointTooltip goal={goal} point={points[hovered]} previous={points[Math.max(hovered - 1, 0)]} anchor={{x: x(hovered), y: y(points[hovered].percent)}} />
      )}
    </div>
  );
}

const TOOLTIP_LINES = 4;
const TOOLTIP_UNITS = 4;

// One line per area and stage, so six providers moving together read as one
// change. `from` is where the units stood before, when they all stood in one
// place. A plan's lines come from what it expects to move.
function summarizeChanges(goal, point, previous) {
  const projected = Boolean(point.isPlan);
  return changesIn(point.version, goal.features, projected).map(({key, area, stage, features}) => {
    const before = new Set(features.map(feature => stageAt(feature, previous.version, projected)));
    const names = features.map(feature => feature.path.slice(1).join(' / '));
    // A whole provider list reads as "All providers"; shared work is named,
    // since "All" says nothing about what got done.
    return {
      key,
      area: area.text,
      units: !area.groundwork && features.length === area.features.length && names.length > 1
        ? 'All providers'
        : names.length > TOOLTIP_UNITS
          ? `${names.slice(0, TOOLTIP_UNITS).join(', ')} +${names.length - TOOLTIP_UNITS} more`
          : names.join(', '),
      from: before.size === 1 && !features[0].task ? STAGES[[...before][0]].label : null,
      to: features[0].task ? 'Done' : STAGES[stage].label,
    };
  });
}

const TOOLTIP_GAP = 14;
const TOOLTIP_MARGIN = 8;

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

// Where a tooltip of `size` goes inside `bounds` next to `anchor`: beside the
// point on whichever side has room, or centered over it and kept inside the
// card when neither side does, as on a phone. `bounds.top` is negative, since
// a tall tooltip may rise over the sentence above the chart.
function placeTooltip(anchor, size, bounds) {
  const right = anchor.x + TOOLTIP_GAP;
  const left = anchor.x - TOOLTIP_GAP - size.width;
  const fitsRight = right + size.width <= bounds.width - TOOLTIP_MARGIN;
  const fitsLeft = left >= TOOLTIP_MARGIN;
  const preferLeft = anchor.x > bounds.width / 2;
  const x = fitsLeft && (preferLeft || !fitsRight)
    ? left
    : fitsRight
      ? right
      : clamp(anchor.x - size.width / 2, TOOLTIP_MARGIN, bounds.width - size.width - TOOLTIP_MARGIN);
  const y = clamp(anchor.y - size.height / 2, bounds.top + TOOLTIP_MARGIN, bounds.bottom - size.height - TOOLTIP_MARGIN);
  return {left: x, top: y};
}

function PointTooltip({goal, point, previous, anchor}) {
  const lines = summarizeChanges(goal, point, previous);
  const shown = lines.slice(0, TOOLTIP_LINES);
  const ref = useRef(null);
  // Hidden until measured, since where it fits depends on its own size.
  const [position, setPosition] = useState(null);
  useLayoutEffect(() => {
    const tooltip = ref.current;
    const chart = tooltip.offsetParent;
    // The anchor is in SVG coordinates, and the SVG sits inside the chart's
    // padding. SVG elements have no offsetLeft, so measure the gap directly.
    const svgBox = chart.querySelector('svg').getBoundingClientRect();
    const chartBox = chart.getBoundingClientRect();
    setPosition(placeTooltip(
      {x: anchor.x + svgBox.left - chartBox.left, y: anchor.y + svgBox.top - chartBox.top},
      {width: tooltip.offsetWidth, height: tooltip.offsetHeight},
      {width: chart.clientWidth, top: -chart.offsetTop, bottom: chart.clientHeight},
    ));
  }, [anchor.x, anchor.y, point.version, goal.id]);
  return (
    <div
      ref={ref}
      className={styles.tooltip}
      style={position ?? {left: 0, top: 0, visibility: 'hidden'}}
      role="tooltip"
    >
      <div className={styles.tooltipHead}>
        <strong>{point.isPlan ? `${point.label} · ${compactVersion(point.version)}` : compactVersion(point.version)}</strong>
        <span>{wholePercent(point.percent)}%</span>
      </div>
      <div className={styles.tooltipDate}>
        {point.isPlan ? `Planned for ${formatDate(FULL_DATE, point.date)}: ${point.summary}` : `Released ${formatDate(FULL_DATE, point.date)}`}
      </div>
      {lines.length === 0 ? (
        <div className={styles.tooltipEmpty}>Nothing moved for {goal.text} in this release.</div>
      ) : (
        <ul className={styles.tooltipList}>
          {shown.map(line => (
            <li key={line.key}>
              <span className={styles.tooltipArea}>
                {line.area}
                <em> · {line.units}</em>
              </span>
              <span className={styles.tooltipStage}>
                {line.from && <em>{line.from} → </em>}
                {line.to}
              </span>
            </li>
          ))}
          {lines.length > shown.length && (
            <li className={styles.tooltipMore}>+{lines.length - shown.length} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

// Every row leads with the same ring. Its arc is the node's progress, a group
// draws its chevron inside, and once a node is complete the ring fills solid
// with the glyph cut out of it: the chevron for a group, a check otherwise.
function ProgressMarker({percent, expandable}) {
  const complete = Math.round(percent) === 100;
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
        <ProgressMarker percent={progressAt(node, CURRENT_VERSION)} />
        <span className={styles.nodeText}>{node.text}</span>
        <span className={styles.nodeMeta}><StageBadge feature={node} /></span>
      </div>
    </li>
  );
}

// Groups start collapsed so the list stays scannable; opening one shows what it
// holds. A goal's areas also show how many points of the goal they carry.
function GroupNode({group, points}) {
  const percent = progressAt(group, CURRENT_VERSION);
  return (
    <li>
      <details className={styles.group}>
        <summary className={styles.node}>
          <ProgressMarker percent={percent} expandable />
          <span className={styles.nodeText}>{group.text}</span>
          <span className={`${styles.nodeMeta} ${percent > 0 ? styles.onRust : ''}`}>
            {wholePercent(percent)}%
            {points !== undefined && <span className={styles.nodePoints}>of {points} pts</span>}
          </span>
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
          <strong
            className={styles.progressSummary}
            title={`${formatPoints(pointsAt(goal, CURRENT_VERSION))} of ${goal.points} points as of ${CURRENT_VERSION}`}
          >
            {wholePercent(progressAt(goal, CURRENT_VERSION))}%
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
          {goal.children.map(area => <GroupNode group={area} points={area.weight} key={area.id} />)}
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
  // Other pages link to these cards, so the build's anchor check must know them.
  const brokenLinks = useBrokenLinks();
  stages.forEach(stage => brokenLinks.collectAnchor(stageAnchor(stage.kind)));
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

// How `other` weighs areas differently from `goal`, like `Long tail from 4 to 23 points`.
function reweighed(goal, other) {
  return other.children
    .map(area => [area, goal.children.find(candidate => candidate.id === area.id)])
    .filter(([area, base]) => base && base.weight !== area.weight)
    .map(([area, base]) => `${area.text} from ${base.weight} to ${area.weight} points`)
    .join(' and ');
}

// The goal's areas with their weights, what they hold today, and what the plans
// should add, straight from the data the chart uses.
function Scoring() {
  const [goal] = GOALS;
  const lastPlan = PLANS.at(-1);
  const rows = goal.children.map(area => {
    const points = area.weight;
    return {
      area,
      points,
      today: (progressAt(area, CURRENT_VERSION) * points) / 100,
      planned: lastPlan && (progressAt(area, lastPlan.version, true) * points) / 100,
    };
  });
  return (
    <>
      <p className={styles.sectionLead}>
        Each area of work carries a share of {goal.points} points for {goal.text}, and within an area its providers or
        pieces split those points evenly. A piece earns 80% of its share once anyone can turn it on, even as an opt-in,
        and the last 20% once it runs on Rust by default or the Python path is gone. Shared groundwork, like cloud auth,
        counts in full once it is done.
        {GOALS.slice(1).map(other => ` ${other.text} reweighs ${reweighed(goal, other)}, for ${other.points} in all.`)}
      </p>
      <table className={styles.scoring}>
        <thead>
          <tr>
            <th scope="col">{goal.text}</th>
            <th scope="col">Points</th>
            <th scope="col">Today</th>
            {lastPlan && <th scope="col">By {formatDate(SHORT_DATE, lastPlan.date)}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.area.id}>
              <th scope="row">{row.area.text}</th>
              <td>{row.points}</td>
              <td>{formatPoints(row.today)}</td>
              {lastPlan && <td>{formatPoints(row.planned)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{goal.points}</td>
            <td>{formatPoints(pointsAt(goal, CURRENT_VERSION))}</td>
            {lastPlan && <td>{formatPoints(pointsAt(goal, lastPlan.version, true))}</td>}
          </tr>
        </tfoot>
      </table>
    </>
  );
}

const FAQ = [
  {id: 'faq-scoring', question: 'How is the percentage calculated?', answer: <Scoring />},
  {id: 'faq-rollout-stages', question: 'How does a feature move to Rust?', answer: <RolloutStages />},
];

// A malformed escape like `#%` reads as no hash rather than breaking the FAQ.
function hashId() {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return '';
  }
}

// Point the URL at an open answer so it can be shared, without adding a history
// entry per toggle. A deeper link already inside the answer, like a stage, is
// kept while it is open and cleared when it closes, so following the same link
// again fires `hashchange` and reopens it.
function syncHash(details) {
  const current = hashId();
  const pointsInside = Boolean(current) && details.contains(document.getElementById(current));
  const {pathname, search} = window.location;
  if (details.open && !pointsInside) {
    window.history.replaceState(window.history.state, '', `${pathname}${search}#${details.id}`);
  } else if (!details.open && pointsInside) {
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

// AIGatewayBench results for the finished Rust gateway. Every figure is from
// blog/rust_ai_gateway_benchmarks; do not edit one here without editing it
// there. Rows are ascending in both panels, so the order is the same in each.
const BENCHMARK = [
  {
    id: 'overhead',
    label: 'Added latency at p99',
    unit: 'ms',
    // 0.7ms against 257.7ms is a 368x spread, so a linear bar would render the
    // Rust result as a hairline. Widths are log scaled and the axis says so.
    log: true,
    rows: [
      {name: 'LiteLLM Rust', value: 0.7, lead: true},
      {name: 'Portkey', value: 2.3},
      {name: 'Bifrost', value: 4.5},
      {name: 'LiteLLM Python v1', value: 257.7},
    ],
  },
  {
    id: 'memory',
    label: 'Maximum memory use',
    unit: 'MB',
    rows: [
      {name: 'LiteLLM Rust', value: 21.8, lead: true},
      {name: 'Portkey', value: 90.4},
      {name: 'Bifrost', value: 199.1},
      {name: 'LiteLLM Python v1', value: 329.5},
    ],
  },
];

// Log widths run from a tenth of a millisecond so the smallest bar still reads
// as a bar rather than a sliver.
const LOG_FLOOR = 0.1;

function barWidth(panel, value) {
  const max = Math.max(...panel.rows.map(row => row.value));
  if (!panel.log) {
    return (value / max) * 100;
  }
  const floor = Math.log10(LOG_FLOOR);
  return ((Math.log10(value) - floor) / (Math.log10(max) - floor)) * 100;
}

function GatewayBenchmark() {
  return (
    <section className={styles.section} aria-labelledby="benchmark-title">
      <SectionHeading id="benchmark-title" kicker="Result" title="The result of the move to Rust" />
      <p className={styles.sectionLead}>
        This is where the migration takes us. AIGatewayBench measured four gateways against the
        same mock server: the Rust gateway, Portkey, Bifrost, and the current Python proxy. The test measured the
        delay and the memory that each gateway adds. Each route that moves to Rust has these results.
      </p>
      <div className={styles.benchPanels}>
        {BENCHMARK.map(panel => (
          <div className={styles.benchPanel} key={panel.id}>
            <p className={styles.benchPanelLabel}>{panel.label}</p>
            <ul className={styles.benchRows}>
              {panel.rows.map(row => {
                // The column height and the label sitting on top of it are the
                // same percentage, so the reading always rides its own bar.
                const height = `${barWidth(panel, row.value)}%`;
                return (
                  <li className={styles.benchRow} key={row.name}>
                    <span className={styles.benchTrack}>
                      <span
                        className={`${styles.benchValue} ${row.lead ? styles.benchValueLead : ''}`}
                        style={{bottom: height}}>
                        {row.value} {panel.unit}
                      </span>
                      <span
                        className={`${styles.benchBar} ${row.lead ? styles.benchBarLead : ''}`}
                        style={{height}}
                      />
                    </span>
                    <span className={styles.benchName}>{row.name}</span>
                  </li>
                );
              })}
            </ul>
            <p className={styles.benchAxis}>
              {panel.log ? 'Logarithmic scale. A low value is better.' : 'A low value is better.'}
            </p>
          </div>
        ))}
      </div>
      <p className={styles.benchNote}>
        These numbers are the delay the gateway itself adds. Each gateway handled 5000 requests for each endpoint,
        and p99 is the slowest request in every 100. The{' '}
        <Link to="/blog/rust-ai-gateway-benchmarks">AIGatewayBench report</Link> gives the full method, the raw data,
        and the limits of the test.
      </p>
    </section>
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
        <GatewayBenchmark />
        <MigrationUpdates />
        <Faq />
      </main>
    </Layout>
  );
}
