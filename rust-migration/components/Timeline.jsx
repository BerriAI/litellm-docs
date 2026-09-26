import React, {useEffect, useRef, useState} from 'react';
import {GOALS, MAIN_VERSION, PLAN_RELEASES, RELEASES, STAGES, changesIn, progressAt, stageAt} from '../data';
import {FULL_DATE, SHORT_DATE, compactVersion, formatDate} from './format';

// Each goal's progress at every release on the timeline, then at the upcoming
// releases the plan moves something in. Planned points are estimates.
const GOAL_TIMELINES = new Map(GOALS.map(goal => [goal.id, {
  actual: RELEASES.map(release => ({...release, percent: progressAt(goal, release.version)})),
  planned: PLAN_RELEASES
    .filter(release => changesIn(release.version, goal.features, {planned: true}).length > 0)
    .map(release => ({
      ...release,
      isMain: false,
      isPlanned: true,
      percent: progressAt(goal, release.version, {planned: true}),
    })),
}]));

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
const VALUE_SPACING = 36;

// Show the percent at main and wherever it changed from the point before,
// skipping any that would sit on top of one already shown. Main goes first,
// then the later points, since those are the ones that matter next.
function pickValuePoints(points, x) {
  const shown = new Set();
  const changed = points
    .map((point, index) => index)
    .filter(index => points[index].isMain || (index > 0 && points[index - 1].percent !== points[index].percent))
    .sort((a, b) => Number(points[b].isMain) - Number(points[a].isMain) || b - a);
  for (const index of changed) {
    if ([...shown].every(other => Math.abs(x(index) - x(other)) >= VALUE_SPACING)) {
      shown.add(index);
    }
  }
  return shown;
}

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

export function MigrationTimeline({goal}) {
  const {actual, planned} = GOAL_TIMELINES.get(goal.id);
  const points = [...actual, ...planned];
  const mainIndex = actual.length - 1;
  const [chartRef, width] = useElementWidth(920);
  const [hovered, setHovered] = useState(null);
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
  const latest = actual.at(-1);
  const lastPoint = points.at(-1);
  const linePath = actual
    .map((point, index) => (index === 0 ? `M${x(0)},${y(point.percent)}` : `H${x(index)}V${y(point.percent)}`))
    .join('');
  const areaPath = `${linePath}V${baseline}H${x(0)}Z`;
  // The plan steps on from main, at the same heights the goal line would need.
  const planPath = planned.length === 0
    ? ''
    : `M${x(mainIndex)},${y(latest.percent)}${planned
      .map((point, offset) => `H${x(mainIndex + 1 + offset)}V${y(point.percent)}`)
      .join('')}`;
  const planAreaPath = planned.length === 0 ? '' : `${planPath}V${baseline}H${x(mainIndex)}Z`;
  const labeled = pickLabeledPoints(points, x, goalX);
  const valued = pickValuePoints(points, x);

  return (
    <div className="rm-chartBody" ref={chartRef}>
      <svg
        className="rm-timeline"
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
            <stop offset="0%" className="rm-areaStart" />
            <stop offset="100%" className="rm-areaEnd" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map(tick => (
          <g key={tick}>
            <line
              className={tick === 0 ? 'rm-baseline' : 'rm-gridLine'}
              x1={plot.left}
              x2={goalX}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text className="rm-axisLabel" x={plot.left - 10} y={y(tick) + 4} textAnchor="end">{tick}%</text>
          </g>
        ))}
        <path d={areaPath} fill="url(#progress-area)" />
        {planned.length > 0 && (
          <g>
            <path className="rm-planArea" d={planAreaPath} />
          </g>
        )}
        {/* From the last point we can stand behind, straight to the goal. Any
            distance left under the goal is work nobody has scheduled yet. */}
        <line
          className="rm-goalLine"
          x1={x(points.length - 1)}
          x2={goalX}
          y1={y(lastPoint.percent)}
          y2={y(100)}
        />
        {planned.length > 0 && <path className="rm-planLine" d={planPath} />}
        <path className="rm-progressLine" d={linePath} />
        {points.map((point, index) => {
          const cx = x(index);
          const cy = y(point.percent);
          const date = formatDate(SHORT_DATE, point.date);
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
              <circle className="rm-pointHit" cx={cx} cy={cy} r={compact ? 12 : 14} />
              <circle
                className={point.isMain ? 'rm-mainPoint' : point.isPlanned ? 'rm-planPoint' : 'rm-progressPoint'}
                cx={cx}
                cy={cy}
                r={point.isMain ? 5 : 3.5}
              />
              {valued.has(index) && (
                <text className="rm-pointValue" x={cx} y={cy - 12} textAnchor="middle">
                  {point.percent}%
                </text>
              )}
              {labeled.has(index) && (
                <text
                  className={`rm-versionLabel ${point.isMain ? 'rm-mainVersionLabel' : ''} ${point.isPlanned ? 'rm-plannedVersionLabel' : ''}`}
                  x={cx}
                  y={baseline + 26}
                  textAnchor={compact && index === 0 ? 'start' : 'middle'}
                >
                  <tspan x={cx}>{compactVersion(point.version)}</tspan>
                  <tspan className="rm-versionDate" x={cx} dy="16">
                    {point.isPlanned ? `~${date}` : point.isMain && !compact ? `${date} · main` : date}
                  </tspan>
                </text>
              )}
            </g>
          );
        })}
        <g className="rm-goal">
          <title>{goal.text}: 100% by {goal.endsOn}</title>
          <circle cx={goalX} cy={y(100)} r="5" />
          <text className="rm-goalLabel" x={goalX} y={y(100) - 14} textAnchor="end">
            100% goal
          </text>
          <text className="rm-goalAxisLabel" x={goalX} y={baseline + 26} textAnchor="end">
            <tspan x={goalX}>Goal</tspan>
            <tspan className="rm-versionDate" x={goalX} dy="16">
              {formatDate(SHORT_DATE, goal.endsOn)}
            </tspan>
          </text>
        </g>
      </svg>
      {hovered !== null && (
        <PointTooltip goal={goal} point={points[hovered]} previous={points[Math.max(hovered - 1, 0)]} left={x(hovered)} top={y(points[hovered].percent)} width={width} />
      )}
    </div>
  );
}

const TOOLTIP_LINES = 3;
const TOOLTIP_PROVIDERS = 4;

// One line per area and stage, so six providers moving together read as one
// change. Foundation work is left out, since it isn't an API and provider pair.
// `from` is where the providers stood before, when they all stood in one place.
function summarizeChanges(goal, point, previous) {
  const apiFeatures = goal.features.filter(feature => !feature.area.groundwork);
  return changesIn(point.version, apiFeatures, {planned: point.isPlanned}).map(({key, area, stage, features}) => {
    const before = new Set(features.map(feature => stageAt(feature, previous.version, {planned: true})));
    const names = features.map(feature => feature.path.slice(1).join(' / '));
    return {
      key,
      area: area.text,
      providers: features.length === area.features.length && names.length > 1
        ? 'All providers'
        : names.length > TOOLTIP_PROVIDERS
          ? `${names.slice(0, TOOLTIP_PROVIDERS).join(', ')} +${names.length - TOOLTIP_PROVIDERS} more`
          : names.join(', '),
      from: before.size === 1 ? STAGES[[...before][0]].label : null,
      to: STAGES[stage].label,
    };
  });
}

function PointTooltip({goal, point, previous, left, top, width}) {
  const lines = summarizeChanges(goal, point, previous);
  const shown = lines.slice(0, TOOLTIP_LINES);
  const flipped = left > width / 2;
  return (
    <div
      className={`rm-tooltip ${flipped ? 'rm-tooltipLeft' : 'rm-tooltipRight'}`}
      style={{left, top}}
      role="tooltip"
    >
      <div className="rm-tooltipHead">
        <strong>{compactVersion(point.version)}</strong>
        <span className="rm-tooltipDate">
          {point.isPlanned ? '~' : ''}{formatDate(FULL_DATE, point.date)}{point.isMain ? ' · next release' : ''}
        </span>
        <span className="rm-tooltipPercent">{point.percent}%</span>
      </div>
      {lines.length === 0 ? (
        <div className="rm-tooltipEmpty">Nothing moved for {goal.text} in this release.</div>
      ) : (
        <ul className="rm-tooltipList">
          {shown.map(line => (
            <li key={line.key}>
              <span className="rm-tooltipArea">{line.area}</span>
              <span className="rm-tooltipStage">
                {line.from && <em>{line.from} → </em>}
                {line.to}
              </span>
              <span className="rm-tooltipProviders">{line.providers}</span>
            </li>
          ))}
          {lines.length > shown.length && (
            <li className="rm-tooltipMore">+{lines.length - shown.length} more</li>
          )}
        </ul>
      )}
    </div>
  );
}
