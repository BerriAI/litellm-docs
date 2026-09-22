import React, {useState} from 'react';
import Layout from '@theme/Layout';
import {PostRow} from '@theme/BlogListPage';
import * as semver from 'semver';
import {
  MAIN_MIGRATION_VERSION,
  MIGRATION_PURPOSES,
  MIGRATION_RELEASES,
  MIGRATION_STATUSES,
  MIGRATION_VERSIONS,
} from '@site/src/data/rustMigration';
import styles from './rust-migration.module.css';

const POSTS = [
  {
    title: 'OCR uses Rust by default starting with v1.102.0-rc.1',
    permalink: '/blog/litellm-rust-ocr',
    date: '2026-09-13T10:00:00.000Z',
    description: 'Starting with v1.102.0-rc.1, OCR calls use the Rust implementation by default while preserving the existing API.',
    authors: [{name: 'Yujong Lee', url: 'mailto:yujong@berri.ai'}],
  },
  {
    title: 'Benchmarking the LiteLLM Rust AI Gateway: Overhead, Memory, and Cost',
    permalink: '/blog/rust-ai-gateway-benchmarks',
    date: '2026-07-22T09:00:00.000Z',
    description: 'AIGatewayBench measures gateway overhead against a deterministic mock. The LiteLLM Rust gateway has the lowest overhead and memory footprint of the four gateways tested.',
    authors: [{name: 'Ishaan Jaffer', url: 'https://www.linkedin.com/in/reffajnaahsi/'}],
  },
  {
    title: 'Migrating LiteLLM to Rust - Building the Fastest and Litest AI Gateway',
    permalink: '/blog/litellm-rust-launch',
    date: '2026-06-22T09:00:00.000Z',
    description: 'LiteLLM is moving its AI gateway to Rust: 15x throughput, 11x less memory, and sub-1ms per-request overhead. No v2, no migration, your config stays the same.',
    authors: [{name: 'Ishaan Jaffer', url: 'https://www.linkedin.com/in/reffajnaahsi/'}],
  },
];

const MIGRATED_STATUSES = new Set(['default', 'rustOnly']);
const RELEASE_METADATA = new Map(MIGRATION_RELEASES.map(release => [release.version, release]));
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
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

function MigrationTimeline() {
  const milestones = migrationTimeline();
  const width = 920;
  const height = 350;
  const plot = {left: 76, right: 56, top: 24, bottom: 88};
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const x = index => plot.left + (index / (milestones.length - 1)) * plotWidth;
  const percentage = milestone => Math.round((milestone.migrated / milestone.total) * 100);
  const y = value => plot.top + plotHeight - (value / 100) * plotHeight;
  const points = milestones.map((milestone, index) => `${x(index)},${y(percentage(milestone))}`).join(' ');
  const latest = milestones[milestones.length - 1];

  return (
    <div className={styles.progressView}>
      <div className={styles.viewIntro}>
        <p>Percentage of tracked support units that run on Rust by default or require Rust.</p>
        <div className={styles.progressSummary}>
          <strong>{percentage(latest)}%</strong>
          <span>{latest.migrated} of {latest.total} support units</span>
        </div>
      </div>

      <div className={styles.chartFrame}>
        <svg
          className={styles.timeline}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-labelledby="timeline-title timeline-description"
        >
          <title id="timeline-title">Rust migration progress over time</title>
          <desc id="timeline-description">
            {percentage(latest)} percent of tracked support units run on Rust by default in {MAIN_MIGRATION_VERSION}.
          </desc>
          {[0, 25, 50, 75, 100].map(tick => (
            <g key={tick}>
              <line
                className={styles.gridLine}
                x1={plot.left}
                x2={width - plot.right}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text className={styles.axisLabel} x={plot.left - 12} y={y(tick) + 4} textAnchor="end">{tick}%</text>
            </g>
          ))}
          <polyline className={styles.progressLine} points={points} />
          {milestones.map((milestone, index) => {
            const previous = milestones[index - 1];
            const notable = index === 0 || index === milestones.length - 1 || percentage(previous) !== percentage(milestone);
            const version = compactVersion(milestone.version);
            const isMain = semver.eq(milestone.version, MAIN_MIGRATION_VERSION);
            const date = releaseDate(milestone.version);
            const hideOnMobile = !notable;
            return (
              <g key={milestone.version}>
                <title>
                  {milestone.version}, {isMain ? `planned for ${date}` : `released ${date}`}
                </title>
                <line
                  className={styles.versionTick}
                  x1={x(index)}
                  x2={x(index)}
                  y1={plot.top + plotHeight}
                  y2={plot.top + plotHeight + 6}
                />
                {notable && (
                  <>
                    <circle className={styles.progressPointHalo} cx={x(index)} cy={y(percentage(milestone))} r="9" />
                    <circle className={styles.progressPoint} cx={x(index)} cy={y(percentage(milestone))} r="5">
                      <title>{percentage(milestone)}% in {milestone.version}</title>
                    </circle>
                    <text className={styles.pointValue} x={x(index)} y={y(percentage(milestone)) - 16} textAnchor="middle">
                      {percentage(milestone)}%
                    </text>
                  </>
                )}
                <text
                  className={`${styles.versionLabel} ${isMain ? styles.mainVersionLabel : ''} ${hideOnMobile ? styles.hideOnMobile : ''}`}
                  x={x(index)}
                  y={height - 38}
                  textAnchor="middle"
                >
                  <tspan x={x(index)}>{version}</tspan>
                  <tspan className={styles.versionDate} x={x(index)} dy="17">{date}</tspan>
                </text>
                {isMain && (
                  <g className={styles.mainBadge}>
                    <rect x={x(index) - 18} y={height - 66} width="36" height="14" rx="7" />
                    <text x={x(index)} y={height - 56} textAnchor="middle">MAIN</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <p className={styles.methodNote}>
        Preview and in-progress units appear in the matrix but are not counted as migrated. Published RCs come from{' '}
        <a href="https://github.com/BerriAI/litellm/releases">LiteLLM releases</a>; main is the next RC derived from the
        repository version and is planned for the next Saturday.
      </p>
    </div>
  );
}

function MigrationMatrix() {
  const columnCount = Math.max(...MIGRATION_PURPOSES.map(purpose => purpose.variants.length));
  const unitLabels = new Map(MIGRATION_PURPOSES.flatMap(purpose => (
    purpose.variants.map(variant => [variant.id, `${purpose.label}: ${variant.label}`])
  )));

  return (
    <div className={styles.detailsView}>
      <div className={styles.detailsIntro}>
        <p>Each cell is one independently tracked route, provider, adapter, or foundation capability.</p>
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
        {MIGRATION_PURPOSES.map(purpose => (
          <div className={styles.matrixRow} key={purpose.id}>
            <div className={styles.purposeLabel}>
              <span>{purpose.group}</span>
              <strong>{purpose.label}</strong>
            </div>
            <div className={styles.cells}>
              {purpose.variants.map(variant => {
                const status = MIGRATION_STATUSES[variant.status];
                return (
                  <article className={`${styles.cell} ${styles[`cell_${variant.status}`]}`} key={variant.id}>
                    <span className={styles.cellStatus}>{status.label}</span>
                    <strong>{variant.label}</strong>
                    <span className={styles.cellRelease}>
                      {variant.introducedIn
                        ? `First in ${variant.introducedIn}${semver.eq(variant.introducedIn, MAIN_MIGRATION_VERSION) ? ' · main' : ''}`
                        : 'Not introduced'}
                    </span>
                    {variant.requires && (
                      <span className={styles.cellDependency}>
                        Requires {variant.requires.map(id => unitLabels.get(id) ?? id).join(', ')}
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MigrationTracker() {
  const [view, setView] = useState('progress');

  return (
    <section className={styles.trackerSection} aria-labelledby="migration-tracker-title">
      <div className={styles.trackerCard}>
        <div className={styles.trackerHeader}>
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
      </div>
    </section>
  );
}

export default function RustMigrationPage() {
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
            {POSTS.map(post => <PostRow key={post.permalink} post={post} />)}
          </div>
        </section>
      </main>
    </Layout>
  );
}
