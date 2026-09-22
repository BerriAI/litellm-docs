import React, {useState} from 'react';
import Layout from '@theme/Layout';
import {PostRow} from '@theme/BlogListPage';
import {
  MIGRATION_PURPOSES,
  MIGRATION_START,
  MIGRATION_STATUSES,
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

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function migrationUnits() {
  return MIGRATION_PURPOSES.flatMap(purpose => purpose.variants);
}

function migrationTimeline() {
  const units = migrationUnits();
  const releases = units
    .filter(unit => MIGRATED_STATUSES.has(unit.status) && unit.release)
    .map(unit => unit.release)
    .sort((left, right) => left.date.localeCompare(right.date));
  const milestones = [...new Map(
    [MIGRATION_START, ...releases].map(release => [`${release.date}-${release.version}`, release]),
  ).values()];

  return milestones.map(milestone => ({
    ...milestone,
    migrated: units.filter(unit => (
      MIGRATED_STATUSES.has(unit.status)
      && unit.release
      && unit.release.date <= milestone.date
    )).length,
    total: units.length,
  }));
}

function MigrationTimeline() {
  const milestones = migrationTimeline();
  const width = 920;
  const height = 330;
  const plot = {left: 64, right: 24, top: 24, bottom: 68};
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const dates = milestones.map(milestone => Date.parse(`${milestone.date}T00:00:00Z`));
  const firstDate = dates[0];
  const dateRange = dates[dates.length - 1] - firstDate;
  const x = milestone => plot.left + (
    dateRange === 0 ? 0 : ((Date.parse(`${milestone.date}T00:00:00Z`) - firstDate) / dateRange) * plotWidth
  );
  const percentage = milestone => Math.round((milestone.migrated / milestone.total) * 100);
  const y = value => plot.top + plotHeight - (value / 100) * plotHeight;
  const points = milestones.map(milestone => `${x(milestone)},${y(percentage(milestone))}`).join(' ');
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
            {percentage(latest)} percent of tracked support units run on Rust by default as of {formatDate(latest.date)}.
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
          {milestones.map(milestone => (
            <g key={`${milestone.date}-${milestone.version}`}>
              <circle className={styles.progressPointHalo} cx={x(milestone)} cy={y(percentage(milestone))} r="9" />
              <circle className={styles.progressPoint} cx={x(milestone)} cy={y(percentage(milestone))} r="5">
                <title>{percentage(milestone)}% on {formatDate(milestone.date)}, {milestone.version}</title>
              </circle>
              <text className={styles.pointValue} x={x(milestone)} y={y(percentage(milestone)) - 16} textAnchor="middle">
                {percentage(milestone)}%
              </text>
              <text className={styles.axisLabel} x={x(milestone)} y={height - 35} textAnchor="middle">
                {formatDate(milestone.date)}
              </text>
              <text className={styles.versionLabel} x={x(milestone)} y={height - 15} textAnchor="middle">
                {milestone.version}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className={styles.methodNote}>Preview and in-progress units appear in the matrix but are not counted as migrated.</p>
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
                    {variant.release && (
                      <span className={styles.cellRelease}>{variant.release.version}</span>
                    )}
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
