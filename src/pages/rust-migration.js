import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import {useEventListener, useResizeObserver} from 'usehooks-ts';
import {usePluginData} from '@docusaurus/useGlobalData';
import Link from '@docusaurus/Link';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import {Select} from '@base-ui/react/select';
import {
  CURRENT_VERSION,
  GOALS,
  LEVELS,
  PLANS,
  ROUTES,
  TERMS,
  changesBetween,
  levelLabel,
  pointsAt,
  progressAt,
  timelineFor,
} from '@site/src/data/rustMigration';
import LevelBadge, {LevelIcon, compactVersion, levelAnchor} from '@site/src/components/RustMigration/LevelBadge';
import {createTimeScale, labelWidth, layoutTimelineLabels, layoutTimelineValues, monthTicks, LABEL_ROW_HEIGHT} from '@site/src/components/RustMigration/timeline';
import picker from '@site/src/components/RustMigration/Picker.module.css';
import styles from './rust-migration.module.css';

const SHORT_DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
const MONTH = new Intl.DateTimeFormat('en-US', {month: 'short', timeZone: 'UTC'});
const FULL_DATE = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});

const formatDate = (formatter, date) => formatter.format(new Date(date));

const GOAL_TIMELINES = new Map(GOALS.map(goal => [goal.id, timelineFor(goal)]));

// Every percent on the page is a whole number, like 13.5% as 14%.
const wholePercent = percent => Math.round(percent);

// Points keep one decimal, since a single provider can be worth a fraction of one.
const formatPoints = value => (Math.round(value * 10) / 10).toString();

// The extra height a route plan's label takes for its route line.
const ROUTE_LINE = 16;

// `selectedKey` is the point whose details replace the chart, or null.
function MigrationTimeline({goal, selectedKey, onSelect}) {
  const points = GOAL_TIMELINES.get(goal.id);
  const chartRef = useRef(null);
  // Nothing is measured on the server or before the first resize, so start at a desktop width.
  const width = Math.round(useResizeObserver({ref: chartRef}).width || 920);
  const [hovered, setHovered] = useState(null);
  // A term in a plan's axis label, explained on its own while hovered.
  const [term, setTerm] = useState(null);
  const showTerm = (id, event) => {
    const box = event.currentTarget.getBoundingClientRect();
    const chartBox = chartRef.current.getBoundingClientRect();
    setTerm({id, anchor: {x: box.left + box.width / 2 - chartBox.left, y: box.top - chartBox.top}});
  };
  const selected = points.findIndex(point => point.key === selectedKey);
  const select = index => onSelect(points[index].key);
  const compact = width < 560;
  const baseHeight = compact ? 240 : 336;
  const plot = compact
    ? {left: 40, right: 20, top: 36, bottom: 56}
    : {left: 48, right: 40, top: 40, bottom: 64};
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = baseHeight - plot.top - plot.bottom;
  const goalX = plot.left + plotWidth;
  const dateX = createTimeScale(points[0].date, goal.endsOn, plot.left, goalX);
  const x = index => dateX(points[index].date);
  const baseline = plot.top + plotHeight;
  const y = percent => baseline - (percent / 100) * plotHeight;
  const axisLabel = point => ({
    name: pointName(point),
    date: point.kind === 'latest' && !compact ? `${formatDate(SHORT_DATE, point.date)} · latest` : formatDate(SHORT_DATE, point.date),
  });
  const {labels, rowCount} = layoutTimelineLabels(points.map((point, index) => {
    const {name, date} = axisLabel(point);
    // A route plan's widest line may be the route itself, which is monospace.
    const route = point.route ? ROUTES[point.route] : '';
    const moved = index > 0 && points[index - 1].percent !== point.percent;
    return {key: index, anchor: x(index), width: Math.max(labelWidth(point.route ? point.label : name, date), route.length * 7), priority: index === 0 || point.kind !== 'release' ? 2 : moved ? 1 : 0};
  }), goalX - labelWidth('Goal', formatDate(SHORT_DATE, goal.endsOn)), width);
  const values = layoutTimelineValues(points, x, y);
  // A route plan's label takes three lines, so its rows grow by one line.
  const routeLines = points.some(point => point.route) ? 1 : 0;
  const rowHeight = LABEL_ROW_HEIGHT + routeLines * ROUTE_LINE;
  const height = baseHeight + routeLines * ROUTE_LINE + (rowCount - 1) * rowHeight;
  const current = points.findIndex(point => point.kind === 'latest');
  const linePath = points
    .slice(0, current + 1)
    .map((point, index) => (index === 0 ? `M${x(0)},${y(point.percent)}` : `H${x(index)}V${y(point.percent)}`))
    .join('');
  const areaPath = `${linePath}V${baseline}H${x(0)}Z`;
  // From today through each plan to the goal, as one dashed projection.
  const projectionPath = points
    .slice(current)
    .map((point, offset) => `${offset === 0 ? 'M' : 'L'}${x(current + offset)},${y(point.percent)}`)
    .join('') + `L${goalX},${y(100)}`;

  // A clicked point takes the chart's place at the chart's size, like a page in the card.
  if (selected >= 0) {
    return (
      <div className={styles.chartBody} ref={chartRef}>
        <PointDetails
          goal={goal}
          point={points[selected]}
          previous={points[selected - 1] ?? null}
          width={width}
          height={height}
        />
      </div>
    );
  }

  return (
    <div className={styles.chartBody} ref={chartRef}>
      <svg
        className={styles.timeline}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        // A label rather than <title>, which browsers show as a tooltip over the whole chart.
        aria-label="Rust gateway progress over time"
        aria-describedby="timeline-description"
      >
        <desc id="timeline-description">
          {wholePercent(points[current].percent)} percent of {goal.text} is built in {CURRENT_VERSION}.
          {points.filter(point => point.kind === 'plan').map(point => ` ${pointName(point)} is planned to reach ${wholePercent(point.percent)} percent.`)}
          {' '}The goal targets 100 percent by {goal.endsOn}.
          {' '}Horizontal distance represents elapsed time on the same scale for releases, plans, and the goal.
        </desc>
        <defs>
          <linearGradient id="progress-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" className={styles.areaStart} />
            <stop offset="100%" className={styles.areaEnd} />
          </linearGradient>
        </defs>
        {monthTicks(points[0].date, goal.endsOn).map(month => (
          <g key={month}>
            <line className={styles.monthLine} x1={dateX(month)} x2={dateX(month)} y1={plot.top - 18} y2={baseline} />
            {goalX - dateX(month) >= 96 && (
              <text className={styles.monthLabel} x={dateX(month) + 4} y={plot.top - 8}>
                {formatDate(MONTH, month)}
              </text>
            )}
          </g>
        ))}
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
        {[...labels].map(([index, label]) => (
          <path
            key={index}
            className={styles.labelGuide}
            // Straight down when the date still falls under its label.
            d={`M${x(index)},${baseline + 4}L${Math.min(Math.max(x(index), label.x - label.width / 2), label.x + label.width / 2)},${baseline + 12 + label.row * rowHeight}`}
          />
        ))}
        {points.map((point, index) => {
          const cx = x(index);
          const cy = y(point.percent);
          const pinned = point.kind !== 'release';
          const pointClass = {release: styles.progressPoint, latest: styles.mainPoint, plan: styles.planPoint}[point.kind];
          const label = labels.get(index);
          const labelY = label && baseline + 26 + label.row * rowHeight;
          const value = values.get(index);
          return (
            <g
              key={point.key}
              className={styles.pointButton}
              tabIndex={0}
              role="button"
              aria-label={`${axisLabel(point).name}, ${wholePercent(point.percent)}%`}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered(null)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              onClick={() => select(index)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  select(index);
                }
              }}
            >
              <circle className={styles.pointHit} cx={cx} cy={cy} r={compact ? 12 : 14} />
              {/* Grows on hover and focus, so the dot itself reads as the thing to click. */}
              <circle className={styles.pointHalo} cx={cx} cy={cy} r={pinned ? 10 : 8.5} />
              <circle className={pointClass} cx={cx} cy={cy} r={pinned ? 5 : 3.5} />
              {point.kind === 'latest' && (
                // Up and to the left, clear of the projection rising to the right.
                <text className={styles.pointValue} x={cx - 6} y={cy - 9} textAnchor="end">
                  {wholePercent(point.percent)}%
                </text>
              )}
              {value && (
                <>
                  {value.y < cy - 12 && <line className={styles.labelGuide} x1={cx} x2={cx} y1={cy - 7} y2={value.y + 3} />}
                  <text className={`${styles.pointValue} ${styles.planValue}`} x={cx} y={value.y} textAnchor="middle">
                    {wholePercent(point.percent)}%
                  </text>
                </>
              )}
              {label && (
                <>
                  <rect
                    className={styles.labelBackground}
                    x={label.x - label.width / 2 - 4}
                    y={labelY - 12}
                    width={label.width + 8}
                    height={34 + (point.route ? ROUTE_LINE : 0)}
                  />
                  <text
                    className={`${styles.versionLabel} ${{release: '', latest: styles.mainVersionLabel, plan: styles.planVersionLabel}[point.kind]}`}
                    x={label.x}
                    y={labelY}
                    textAnchor="middle"
                  >
                    {point.route ? (
                      <>
                        <tspan className={styles.routeName} x={label.x}>{ROUTES[point.route]}</tspan>
                        <tspan x={label.x} dy={ROUTE_LINE}>
                          {point.terms.map((id, termIndex) => (
                            <React.Fragment key={id}>
                              {termIndex > 0 && ', '}
                              <tspan className={styles.term} onMouseEnter={event => showTerm(id, event)} onMouseLeave={() => setTerm(null)}>
                                {id}
                              </tspan>
                            </React.Fragment>
                          ))}
                        </tspan>
                      </>
                    ) : (
                      <tspan x={label.x}>{axisLabel(point).name}</tspan>
                    )}
                    <tspan className={styles.versionDate} x={label.x} dy="16">{axisLabel(point).date}</tspan>
                  </text>
                </>
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
      {term && <TermTooltip id={term.id} anchor={term.anchor} />}
      {hovered !== null && !term && (
        <PointTooltip goal={goal} point={points[hovered]} previous={points[hovered - 1] ?? null} anchor={{x: x(hovered), y: y(points[hovered].percent)}} />
      )}
    </div>
  );
}

// A plan about one route reads as the route then the label, like `/messages End to end`.
function pointName(point) {
  if (point.kind !== 'plan') {
    return compactVersion(point.version);
  }
  return point.route ? `${ROUTES[point.route]} ${point.label}` : point.label;
}

// The same name in HTML, with the route as a tag on its own line.
function PointName({point}) {
  if (point.kind !== 'plan' || !point.route) {
    return pointName(point);
  }
  return (
    <>
      <code className={styles.routeTag}>{ROUTES[point.route]}</code>
      <span className={styles.routeLabel}>{point.label}</span>
    </>
  );
}

const pointDate = point => `${point.kind === 'plan' ? 'Target' : 'Released'} ${formatDate(SHORT_DATE, point.date)}`;

const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

// What a point moved, in one line: `14 items in 5 components`.
function changeCount(changes) {
  const items = changes.reduce((sum, change) => sum + change.work.length, 0);
  const components = new Set(changes.map(change => change.component.id)).size;
  return `${plural(items, 'item')} in ${plural(components, 'component')}`;
}

function PercentGain({point, previous}) {
  const gain = previous ? wholePercent(point.percent) - wholePercent(previous.percent) : 0;
  return (
    <span>
      {wholePercent(point.percent)}%
      {gain > 0 && <em className={styles.tooltipGain}> +{gain}</em>}
    </span>
  );
}

const TOOLTIP_GAP = 14;
const TOOLTIP_MARGIN = 8;

const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));

// Where a tooltip of `size` goes inside `bounds` next to `anchor`: beside the
// point on whichever side has room, or centered over it and kept inside the
// card when neither side does, as on a phone. Points sit low on the chart, so
// the tooltip rises from the point into the empty space above the line rather
// than covering the axis labels. `bounds.top` is negative, since a tall tooltip
// may rise over the sentence above the chart.
function placeTooltip(anchor, size, bounds) {
  const right = anchor.x + TOOLTIP_GAP;
  const left = anchor.x - TOOLTIP_GAP - size.width;
  const fitsRight = right + size.width <= bounds.width - TOOLTIP_MARGIN;
  const fitsLeft = left >= TOOLTIP_MARGIN;
  const preferLeft = anchor.x > bounds.width / 2;
  const beside = fitsLeft && (preferLeft || !fitsRight) ? left : fitsRight ? right : null;
  const x = beside ?? clamp(anchor.x - size.width / 2, TOOLTIP_MARGIN, bounds.width - size.width - TOOLTIP_MARGIN);
  const bottom = beside === null ? anchor.y - TOOLTIP_GAP : anchor.y + TOOLTIP_GAP;
  const y = clamp(bottom - size.height, bounds.top + TOOLTIP_MARGIN, bounds.bottom - size.height - TOOLTIP_MARGIN);
  return {left: x, top: y};
}

// What one term in a plan's label means, like `e2e`.
function TermTooltip({id, anchor}) {
  const ref = useRef(null);
  const [position, setPosition] = useState(null);
  useLayoutEffect(() => {
    // Centered over the term and kept inside the card, so the label it explains stays visible.
    const tooltip = ref.current;
    const width = tooltip.offsetParent.clientWidth;
    setPosition({
      left: clamp(anchor.x - tooltip.offsetWidth / 2, TOOLTIP_MARGIN, width - tooltip.offsetWidth - TOOLTIP_MARGIN),
      top: anchor.y - TOOLTIP_GAP / 2 - tooltip.offsetHeight,
    });
  }, [anchor.x, anchor.y, id]);
  return (
    <div ref={ref} className={`${styles.tooltip} ${styles.termTooltip}`} style={position ?? {left: 0, top: 0, visibility: 'hidden'}} role="tooltip">
      <strong>{TERMS[id].name}</strong>
      <div className={styles.tooltipDate}>{TERMS[id].description}</div>
    </div>
  );
}

// A glance at a point while hovering: its name, progress, and how much it
// moved. The full list opens below the chart on click.
function PointTooltip({goal, point, previous, anchor}) {
  const changes = changesBetween(goal, point, previous);
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
  }, [anchor.x, anchor.y, point.key, goal.id]);
  return (
    <div
      ref={ref}
      className={styles.tooltip}
      style={position ?? {left: 0, top: 0, visibility: 'hidden'}}
      role="tooltip"
    >
      <div className={styles.tooltipHead}>
        <strong><PointName point={point} /></strong>
        <PercentGain point={point} previous={previous} />
      </div>
      <div className={styles.tooltipDate}>
        {pointDate(point)} · {changes.length === 0 ? 'no change' : changeCount(changes)}
      </div>
      {changes.length > 0 && <div className={styles.tooltipHint}>Click the point to see what it moves</div>}
    </div>
  );
}

// The details grid is sized to the chart's box and never scrolls: cards have
// a fixed height, and what does not fit folds into a last `+N more` card.
const DETAILS_PADDING = 16;
const CARD_GAP = 8;

// One card per component, so work landing at two levels at once, like auth
// partly done, reads as one component. A mixed card marks its partial work.
function componentCards(changes) {
  const cards = new Map();
  for (const change of changes) {
    const card = cards.get(change.component.id) ?? {key: change.component.id, component: change.component, changes: []};
    card.changes.push(change);
    cards.set(card.key, card);
  }
  return [...cards.values()].map(card => {
    const levels = new Set(card.changes.map(change => change.level));
    const level = levels.size === 1 ? [...levels][0] : null;
    const work = card.changes.flatMap(change => change.work.map(item => (level || change.level === 'done' ? item.text : `${item.text} (partial)`)));
    const whole = card.changes.length === 1 && card.changes[0].whole;
    return {...card, level, summary: whole ? `All ${work.length} items` : work.join(', ')};
  });
}

// Everything a point moved, one card per component, listing its work.
function PointDetails({goal, point, previous, width, height}) {
  const changes = componentCards(changesBetween(goal, point, previous));
  const compact = width < 560;
  const columns = compact ? 1 : width < 860 ? 2 : 3;
  const cardHeight = compact ? 48 : 64;
  const rows = Math.max(1, Math.floor((height - DETAILS_PADDING + CARD_GAP) / (cardHeight + CARD_GAP)));
  const capacity = rows * columns;
  const shown = changes.length > capacity ? changes.slice(0, capacity - 1) : changes;
  const hidden = changes.slice(shown.length);
  return (
    <section className={styles.details} style={{height}} aria-label={`What ${pointName(point)} moves`}>
      {changes.length === 0 ? (
        <p className={styles.detailsEmpty}>No {point.kind === 'plan' ? 'planned ' : ''}change to {goal.text}.</p>
      ) : (
        <ul
          className={`${styles.detailsList} ${compact ? styles.detailsCompact : ''}`}
          style={{gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: cardHeight}}
        >
          {shown.map(card => (
            <li className={styles.detailsCard} key={card.key}>
              <p className={styles.detailsComponent}>
                <span>{card.component.text}</span>
                {card.level && (
                  <span className={styles.detailsLevel}>
                    <LevelIcon id={card.level} />
                    {levelLabel(card.level)}
                  </span>
                )}
              </p>
              <p className={styles.detailsWork}>{card.summary}</p>
            </li>
          ))}
          {hidden.length > 0 && (
            <li className={styles.detailsCard}>
              <p className={styles.detailsComponent}>+{hidden.length} more</p>
              <p className={styles.detailsWork}>{hidden.map(card => card.component.text).join(', ')}</p>
            </li>
          )}
        </ul>
      )}
    </section>
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

function WorkNode({work}) {
  return (
    <li>
      <div className={styles.node}>
        <ProgressMarker percent={progressAt(work, CURRENT_VERSION)} />
        <span className={styles.nodeText}>{work.text}</span>
        <span className={styles.nodeMeta}><LevelBadge work={work} /></span>
      </div>
    </li>
  );
}

// Components start collapsed so the list stays scannable; opening one shows
// its work. Each also shows how many points of the goal it carries.
function ComponentNode({component}) {
  const percent = progressAt(component, CURRENT_VERSION);
  return (
    <li>
      <details className={styles.group}>
        <summary className={styles.node}>
          <ProgressMarker percent={percent} expandable />
          <span className={styles.nodeText}>{component.text}</span>
          <span className={`${styles.nodeMeta} ${percent > 0 ? styles.onRust : ''}`}>
            {wholePercent(percent)}%
            <span className={styles.nodePoints}>of {component.size} pts</span>
          </span>
        </summary>
        <ul>
          {component.work.map(work => <WorkNode work={work} key={work.id} />)}
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
                <Select.Item className={picker.selectItem} value={item.id} key={item.id} disabled={item.disabled}>
                  <Select.ItemText className={picker.selectLabel}>{item.text}</Select.ItemText>
                  <span className={picker.selectMeta}>{item.disabled ? 'Not tracked yet' : `by ${formatDate(FULL_DATE, item.endsOn)}`}</span>
                  {/* Answers "what is in this goal" right where it is picked. */}
                  <span className={picker.selectScope}>
                    {item.summary ?? item.components.map(component => component.text).join(', ')}
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
  // Kept by key, so a point stays open across goals that share it.
  const [selectedKey, setSelectedKey] = useState(null);
  const otherView = view === 'timeline' ? 'breakdown' : 'timeline';
  const detailsOpen = view === 'timeline' && GOAL_TIMELINES.get(goal.id).some(point => point.key === selectedKey);
  useEventListener('keydown', event => {
    if (event.key === 'Escape') setSelectedKey(null);
  });

  return (
    <section className={styles.section} aria-labelledby="migration-tracker-title">
      <SectionHeading id="migration-tracker-title" kicker="Migration tracker" title="Where we are today" />
      <div className={styles.chartCard}>
        {/* Open details swap the sentence for a back button, which holds its
            place so the card keeps its size. */}
        {detailsOpen && (
          <button className={styles.detailsBack} type="button" onClick={() => setSelectedKey(null)} autoFocus>
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.5 2.5 4 6l3.5 3.5" /></svg>
            Back
          </button>
        )}
        <p className={`${styles.goalSentence} ${detailsOpen ? styles.goalSentenceHidden : ''}`} aria-hidden={detailsOpen}>
          <strong
            className={styles.progressSummary}
            title={`${formatPoints(pointsAt(goal, CURRENT_VERSION))} of ${goal.size} points as of ${CURRENT_VERSION}`}
          >
            {wholePercent(progressAt(goal, CURRENT_VERSION))}%
          </strong>
          {' of '}
          <GoalSelect goal={goal} onChange={setGoal} />
          {' built, '}
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
          <MigrationTimeline goal={goal} selectedKey={selectedKey} onSelect={setSelectedKey} />
        </div>
        {/* The sentence above already names the goal, so the tree starts at its children. */}
        <ul className={styles.tree} hidden={view !== 'breakdown'}>
          {goal.components.map(component => <ComponentNode component={component} key={component.id} />)}
        </ul>
      </div>
    </section>
  );
}

// Explains each level once, so the tracker's badges can stay terse and link
// here instead.
function Levels() {
  const levels = LEVELS.slice(1);
  // Badges link to these cards, so the build's anchor check must know them.
  const brokenLinks = useBrokenLinks();
  levels.forEach(level => brokenLinks.collectAnchor(levelAnchor(level.id)));
  return (
    <>
      <p className={styles.sectionLead}>
        A level says how confident we are in the work itself, not whether anything uses it yet. Groundwork that is
        finished and trusted but waits for the gateway to deploy is already done.
      </p>
      <ul className={styles.levels}>
        {levels.map(level => (
          <li className={styles.level} id={levelAnchor(level.id)} key={level.id}>
            <p className={styles.levelName}>
              <LevelIcon id={level.id} className={styles.levelIcon} />
              {level.label}
            </p>
            <p className={styles.levelDescription}>{level.description}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

// The goal's components with their sizes, what they hold today, and what the
// plans should add, straight from the data the chart uses.
function Scoring() {
  const [goal] = GOALS;
  const lastPlan = PLANS.at(-1);
  return (
    <>
      <p className={styles.sectionLead}>
        Every piece of work has a size in rough engineer-weeks, and a component's points are the sizes of its work.
        A piece earns 80% of its size once it is in a release but incomplete or not yet trusted, and all of it once it
        is done. {goal.text} is {goal.size} points in all.
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
          {goal.components.map(component => (
            <tr key={component.id}>
              <th scope="row">{component.text}</th>
              <td>{component.size}</td>
              <td>{formatPoints(pointsAt(component, CURRENT_VERSION))}</td>
              {lastPlan && <td>{formatPoints(pointsAt(component, lastPlan))}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td>{goal.size}</td>
            <td>{formatPoints(pointsAt(goal, CURRENT_VERSION))}</td>
            {lastPlan && <td>{formatPoints(pointsAt(goal, lastPlan))}</td>}
          </tr>
        </tfoot>
      </table>
    </>
  );
}

const FAQ = [
  {id: 'faq-scoring', question: 'How is the percentage calculated?', answer: <Scoring />},
  {id: 'faq-levels', question: 'What do Partial and Done mean?', answer: <Levels />},
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
// entry per toggle. A deeper link already inside the answer, like a level, is
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
// answer, or to something inside one like a level badge's "What Done means",
// opens it first so the target is visible.
function Faq() {
  const listRef = useRef(null);
  const openHashTarget = () => {
    const id = hashId();
    // Only targets inside the list, which may sit deep inside an answer.
    const target = id ? listRef.current?.querySelector(`#${CSS.escape(id)}`) : null;
    const details = target?.closest('details');
    if (details && !details.open) {
      details.open = true;
      target.scrollIntoView();
    }
  };
  useEffect(openHashTarget, []);
  useEventListener('hashchange', openHashTarget);

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
        delay and the memory that each gateway adds.
      </p>
      {/* One card per panel. The two use different scales, so they are two
          measurements rather than one chart cut in half. */}
      <div className={styles.benchPanels}>
        {BENCHMARK.map(panel => (
          <div className={`${styles.chartCard} ${styles.benchPanel}`} key={panel.id}>
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
          <p className={styles.description}>See how much of the move to Rust is built and what is next.</p>
        </header>
        <MigrationTracker />
        <GatewayBenchmark />
        <MigrationUpdates />
        <Faq />
      </main>
    </Layout>
  );
}
