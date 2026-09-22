import React, {useEffect, useRef, useState} from 'react';
import Layout from '@theme/Layout';
import {usePluginData} from '@docusaurus/useGlobalData';
import {PostRow} from '@theme/BlogListPage';
import * as semver from 'semver';
import {
  MAIN_MIGRATION_VERSION,
  MIGRATION_LAYERS,
  MIGRATION_MILESTONES,
  MIGRATION_PURPOSES,
  MIGRATION_RELEASES,
  MIGRATION_STATUSES,
  MIGRATION_VERSIONS,
} from '@site/src/data/rustMigration';
import styles from './rust-migration.module.css';

const MIGRATED_STATUSES = new Set(['default', 'rustOnly']);
const RELEASE_METADATA = new Map(MIGRATION_RELEASES.map(release => [release.version, release]));
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const MILESTONE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

function migrationUnits() {
  return MIGRATION_PURPOSES.flatMap(purpose => purpose.variants);
}

function migrationTimeline() {
  const units = migrationUnits();
  const versions = [...MIGRATION_VERSIONS].sort(semver.compare);
  const missingIntroduction = units.find(unit => !Object.hasOwn(unit, 'introducedIn'));
  if (missingIntroduction) {
    throw new Error(`Rust migration support unit must declare introducedIn: ${missingIntroduction.id}`);
  }
  if (versions.length < 10) {
    throw new Error('Rust migration timeline must contain at least 10 RC versions');
  }
  if (!versions.some(version => semver.eq(version, MAIN_MIGRATION_VERSION))) {
    throw new Error(`Rust migration timeline must contain main: ${MAIN_MIGRATION_VERSION}`);
  }
  const invalidVersion = [MAIN_MIGRATION_VERSION, ...versions, ...units.map(unit => unit.introducedIn)]
    .filter(Boolean)
    .find(version => semver.valid(version) === null || semver.prerelease(version)?.[0] !== 'rc');
  if (invalidVersion) {
    throw new Error(`Rust migration versions must be RC semver versions: ${invalidVersion}`);
  }

  return versions.map(version => ({
    version,
    migrated: units.filter(unit => (
      MIGRATED_STATUSES.has(unit.status)
      && unit.introducedIn
      && semver.lte(unit.introducedIn, version)
    )).length,
    total: units.length,
  }));
}

function compactVersion(version) {
  const parsed = semver.parse(version);
  if (!parsed) {
    return version;
  }
  const release = parsed.patch === 0
    ? `${parsed.major}.${parsed.minor}`
    : `${parsed.major}.${parsed.minor}.${parsed.patch}`;
  return `${release} rc${parsed.prerelease[1]}`;
}

function releaseDate(version) {
  const release = RELEASE_METADATA.get(version);
  const date = release?.releasedAt ?? release?.plannedFor;
  return date ? DATE_FORMATTER.format(new Date(date)) : '';
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

function MilestoneSelector() {
  return (
    <div className={styles.milestoneSelector} role="group" aria-label="Migration milestone">
      {MIGRATION_MILESTONES.map((milestone, index) => (
        <button
          className={index === 0 ? styles.activeMilestone : undefined}
          type="button"
          aria-pressed={index === 0}
          disabled={milestone.disabled}
          key={milestone.id}
        >
          <strong>{milestone.label}</strong>
          <span>{MILESTONE_DATE_FORMATTER.format(new Date(milestone.endsOn))}</span>
        </button>
      ))}
    </div>
  );
}

function MigrationTimeline() {
  const milestones = migrationTimeline();
  const selectedMilestone = MIGRATION_MILESTONES[0];
  const [chartRef, width] = useElementWidth(920);
  const compact = width < 560;
  const height = compact ? 240 : 336;
  const plot = compact
    ? {left: 40, right: 20, top: 36, bottom: 56}
    : {left: 48, right: 40, top: 40, bottom: 64};
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const goalGap = compact ? 72 : 120;
  const x = index => plot.left + (index / (milestones.length - 1)) * (plotWidth - goalGap);
  const goalX = plot.left + plotWidth;
  const baseline = plot.top + plotHeight;
  const percentage = milestone => Math.round((milestone.migrated / milestone.total) * 100);
  const y = value => baseline - (value / 100) * plotHeight;
  const latest = milestones[milestones.length - 1];
  const latestX = x(milestones.length - 1);
  const linePath = milestones
    .map((milestone, index) => (
      index === 0
        ? `M${x(0)},${y(percentage(milestone))}`
        : `H${x(index)}V${y(percentage(milestone))}`
    ))
    .join('');
  const areaPath = `${linePath}V${baseline}H${x(0)}Z`;

  return (
    <div className={styles.progressView}>
      <div className={styles.chartCard}>
        <div className={styles.chartHeader}>
          <div className={styles.progressSummary}>
            <strong>{percentage(latest)}%</strong>
          </div>
          <MilestoneSelector />
        </div>

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
              {percentage(latest)} percent of tracked support units run on Rust by default in {MAIN_MIGRATION_VERSION}.
              The selected milestone targets 100 percent by {selectedMilestone.endsOn}.
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
            <path className={styles.progressArea} d={areaPath} fill="url(#progress-area)" />
            <line
              className={styles.goalLine}
              x1={latestX}
              x2={goalX}
              y1={y(percentage(latest))}
              y2={y(100)}
            />
            <path className={styles.progressLine} d={linePath} />
            {milestones.map((milestone, index) => {
              const previous = milestones[index - 1];
              const isMain = semver.eq(milestone.version, MAIN_MIGRATION_VERSION);
              const changed = previous !== undefined && percentage(previous) !== percentage(milestone);
              const notable = index === 0 || isMain || changed;
              const date = releaseDate(milestone.version);
              const cy = y(percentage(milestone));
              return (
                <g key={milestone.version}>
                  <title>
                    {milestone.version}: {percentage(milestone)}%, {isMain ? `planned for ${date}` : `released ${date}`}
                  </title>
                  <circle
                    className={isMain ? styles.mainPoint : styles.progressPoint}
                    cx={x(index)}
                    cy={cy}
                    r={isMain ? 5 : 3.5}
                  />
                  {changed && (
                    <text className={styles.pointValue} x={x(index)} y={cy - 12} textAnchor="middle">
                      {percentage(milestone)}%
                    </text>
                  )}
                  {(notable || !compact) && (
                    <text
                      className={`${styles.versionLabel} ${isMain ? styles.mainVersionLabel : ''}`}
                      x={x(index)}
                      y={baseline + 26}
                      textAnchor={compact && index === 0 ? 'start' : 'middle'}
                    >
                      <tspan x={x(index)}>{compactVersion(milestone.version)}</tspan>
                      <tspan className={styles.versionDate} x={x(index)} dy="16">
                        {isMain && !compact ? `${date} · main` : date}
                      </tspan>
                    </text>
                  )}
                </g>
              );
            })}
            <g className={styles.goal}>
              <title>{selectedMilestone.label}: 100% by {selectedMilestone.endsOn}</title>
              <circle cx={goalX} cy={y(100)} r="5" />
              <text className={styles.goalLabel} x={goalX} y={y(100) - 14} textAnchor="end">
                100% goal
              </text>
              <text className={styles.goalAxisLabel} x={goalX} y={baseline + 26} textAnchor="end">
                <tspan x={goalX}>Goal</tspan>
                <tspan className={styles.versionDate} x={goalX} dy="16">
                  {DATE_FORMATTER.format(new Date(selectedMilestone.endsOn))}
                </tspan>
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}

function MigrationMatrix() {
  const columnCount = Math.max(...MIGRATION_PURPOSES.map(purpose => purpose.variants.length));
  const layerOrder = MIGRATION_LAYERS.map(layer => layer.id);
  const layerLabels = new Map(MIGRATION_LAYERS.map(layer => [layer.id, layer.label]));
  const purposes = [...MIGRATION_PURPOSES].sort((a, b) => layerOrder.indexOf(a.layer) - layerOrder.indexOf(b.layer));
  const unitLabels = new Map(MIGRATION_PURPOSES.flatMap(purpose => (
    purpose.variants.map(variant => [variant.id, `${purpose.label}: ${variant.label}`])
  )));

  return (
    <div className={styles.detailsView}>
      <div className={styles.detailsIntro}>
        <p>Each cell is one tracked route, provider, adapter, or capability, grouped by layer.</p>
        <div className={styles.legend} aria-label="Migration status legend">
          {Object.entries(MIGRATION_STATUSES).map(([status, metadata]) => (
            <span key={status}><i className={styles[status]} />{metadata.label}</span>
          ))}
        </div>
      </div>

      <div
        className={styles.matrix}
        style={{'--matrix-columns': columnCount}}
      >
        {purposes.map((purpose, index) => {
          const firstInLayer = purposes[index - 1]?.layer !== purpose.layer;
          return (
            <div
              className={`${styles.matrixRow} ${firstInLayer && index > 0 ? styles.layerStart : ''}`}
              key={purpose.id}
            >
              <div className={styles.purposeLabel}>
                <span>{firstInLayer ? layerLabels.get(purpose.layer) : ''}</span>
                <strong>{purpose.label}</strong>
              </div>
              <div className={styles.cells}>
                {purpose.variants.map(variant => {
                  const status = MIGRATION_STATUSES[variant.status];
                  return (
                    <article
                      className={`${styles.cell} ${styles[`cell_${variant.status}`]}`}
                      title={variant.requires
                        ? `Requires ${variant.requires.map(id => unitLabels.get(id) ?? id).join(', ')}`
                        : undefined}
                      key={variant.id}
                    >
                      <strong>{variant.label}</strong>
                      <span className={styles.cellMeta}>
                        {status.label}
                        {variant.introducedIn && ` · ${compactVersion(variant.introducedIn)}`}
                        {variant.introducedIn && semver.eq(variant.introducedIn, MAIN_MIGRATION_VERSION) && ' (main)'}
                      </span>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MigrationTracker() {
  const [view, setView] = useState('progress');

  return (
    <section className={styles.trackerSection} aria-labelledby="migration-tracker-title">
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.kicker}>Migration tracker</p>
          <h2 id="migration-tracker-title">Rust migration progress</h2>
        </div>
        <div className={styles.viewToggle} role="group" aria-label="Migration tracker view">
          <button
            className={view === 'progress' ? styles.activeToggle : undefined}
            type="button"
            aria-pressed={view === 'progress'}
            onClick={() => setView('progress')}
          >
            Progress
          </button>
          <button
            className={view === 'details' ? styles.activeToggle : undefined}
            type="button"
            aria-pressed={view === 'details'}
            onClick={() => setView('details')}
          >
            Details
          </button>
        </div>
      </div>
      <div className={styles.trackerBody}>
        <div
          className={`${styles.viewPanel} ${view === 'progress' ? styles.activePanel : ''}`}
          aria-hidden={view !== 'progress'}
        >
          <MigrationTimeline />
        </div>
        <div
          className={`${styles.viewPanel} ${view === 'details' ? styles.activePanel : ''}`}
          aria-hidden={view !== 'details'}
        >
          <MigrationMatrix />
        </div>
      </div>
    </section>
  );
}

export default function RustMigrationPage() {
  // Collected at build time from every blog post tagged `rust-migration`.
  const {posts = []} = usePluginData('rust-migration-posts') || {};

  return (
    <Layout
      title="LiteLLM Rust Migration"
      description="Updates from LiteLLM's migration to Rust."
    >
      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Rust Migration</p>
          <h1 className={styles.title}>LiteLLM is moving to Rust</h1>
          <p className={styles.description}>Follow migration progress across routes, providers, adapters, and foundational services.</p>
          <p className={styles.prototypeNote}>Experimental view. The initial coverage inventory is illustrative and will change.</p>
        </header>

        <MigrationTracker />

        <section className={styles.updates} aria-labelledby="migration-updates-title">
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.kicker}>Engineering updates</p>
              <h2 id="migration-updates-title">How we are getting there</h2>
            </div>
          </div>
          <div className={styles.list}>
            {posts.map(post => <PostRow key={post.permalink} post={post} />)}
          </div>
        </section>
      </main>
    </Layout>
  );
}
