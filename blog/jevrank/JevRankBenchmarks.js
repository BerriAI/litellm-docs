import React, {useId} from 'react';
import styles from './benchmarks.module.css';

// Full-precision values from the verified chart provenance. Costs are USD / 1M queries.
const referenceRows = [
  {
    name: 'Perplexity Decider Flash v1.2 (JevRank)',
    provider: 'perplexity',
    method: 'Multiple choice',
    origin: 'Reference',
    score: 0.775,
    cost: 73,
    lowestCost: true,
  },
  {
    name: 'Perplexity Decider v1.2 (JevRank)',
    provider: 'perplexity',
    method: 'Multiple choice',
    origin: 'Reference',
    score: 0.777,
    cost: 146,
  },
  {
    name: 'TypeSafe Jev 1.14 (JevRank)',
    provider: 'typesafe',
    method: 'Per document',
    origin: 'Reference',
    score: 0.776,
    cost: 580,
    approximate: true,
  },
  {
    name: 'Cohere Rerank 4 Pro',
    provider: 'cohere',
    method: 'Rerank API',
    origin: 'Reference',
    score: 0.775,
    cost: 2500,
  },
];
const measuredRows = [
  {
    name: 'TypeSafe Jev 1.13.0 (JevRank)',
    provider: 'typesafe',
    method: 'Per document',
    origin: 'LiteLLM run',
    score: 0.7676260618846087,
    cost: 575.39426,
    approximate: true,
  },
  {
    name: 'BM25',
    provider: null,
    method: 'Local retrieval',
    origin: 'LiteLLM run',
    score: 0.6863002612489066,
    cost: 0,
  },
];
const rows = [...referenceRows, ...measuredRows];

const logos = {
  perplexity: '/img/jevrank/perplexity-ai.svg',
  typesafe: '/img/jevrank/typesafe.png',
  cohere: '/img/jevrank/cohere.svg',
};

function price(row) {
  if (!row.provider) return 'No rerank calls';
  return `${row.approximate ? '≈' : ''}$${Math.round(row.cost).toLocaleString('en-US')}`;
}

function rowClass(row) {
  return row.origin === 'LiteLLM run' ? styles.measured : styles.reference;
}

function Provider({row}) {
  return row.provider ? (
    <img
      className={styles.logo}
      src={logos[row.provider]}
      width="26"
      height="26"
      alt=""
    />
  ) : (
    <span className={styles.textMark} aria-hidden="true">
      BM25
    </span>
  );
}

function Model({row}) {
  return (
    <div className={styles.model}>
      <Provider row={row} />
      <div>
        <span className={styles.modelName}>{row.name}</span>
        {row.lowestCost && (
          <span className={styles.valueTag}>Lowest reference cost</span>
        )}
        <span className={styles.modelMeta}>
          {row.method} <span aria-hidden="true">·</span>{' '}
          <span className={rowClass(row)}>{row.origin}</span>
        </span>
      </div>
    </div>
  );
}

function Scale({cost = false}) {
  const ticks = cost
    ? ['$0', '$500', '$1,000', '$1,500', '$2,000', '$2,500']
    : ['0', '0.25', '0.5', '0.75', '1'];
  return (
    <div className={styles.scale} aria-hidden="true">
      {ticks.map((tick, i) => (
        <span key={tick} style={{left: `${(i / (ticks.length - 1)) * 100}%`}}>
          {tick}
        </span>
      ))}
    </div>
  );
}

function Metric({row, cost = false}) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricTop}>
        <span className={styles.mobileLabel}>
          {cost ? 'Cost / 1M queries ↓' : 'Quality ↑'}
        </span>
        <span className={styles.value}>
          {cost ? price(row) : row.score.toFixed(3)}
        </span>
      </div>
      <div
        className={`${styles.track} ${cost ? styles.costTrack : ''}`}
        aria-hidden="true"
      >
        <span
          className={`${styles.bar} ${!row.provider || row.provider === 'cohere' ? styles.baselineBar : ''} ${row.origin === 'LiteLLM run' || row.lowestCost ? styles.emphasisBar : ''}`}
          style={{
            width: `${cost ? (row.cost / 2500) * 100 : row.score * 100}%`,
          }}
        />
      </div>
      <div className={styles.mobileScale}>
        <Scale cost={cost} />
      </div>
    </div>
  );
}

function Comparison({data, title, caption, children}) {
  const id = useId();
  return (
    <figure className={styles.figure} aria-labelledby={`${id}-title`}>
      <figcaption className={styles.figureHeading} id={`${id}-title`}>
        {title}
      </figcaption>
      <table className={styles.comparison}>
        <caption className={styles.srOnly}>
          {caption} Quality uses a zero-to-one nDCG@10 scale. Projected cost
          uses a zero-to-2,500 USD scale per million queries.
        </caption>
        <thead>
          <tr>
            <th scope="col">
              Model <span>Method and result origin</span>
            </th>
            <th scope="col">
              Ranking quality <span>nDCG@10 · higher is better</span>
            </th>
            <th scope="col">
              Reranking cost <span>USD / 1M queries · lower is better</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.name}
              className={row.lowestCost ? styles.valueRow : undefined}
            >
              <th scope="row">
                <Model row={row} />
              </th>
              <td>
                <span className={styles.srOnly}>nDCG at 10: </span>
                <Metric row={row} />
              </td>
              <td>
                <span className={styles.srOnly}>
                  Projected reranking cost per million queries:{' '}
                </span>
                <Metric row={row} cost />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot aria-hidden="true">
          <tr>
            <td />
            <td>
              <Scale />
            </td>
            <td>
              <Scale cost />
            </td>
          </tr>
        </tfoot>
      </table>
      <div className={styles.evidenceNote}>{children}</div>
    </figure>
  );
}

export function QualityCostChart() {
  return (
    <Comparison
      data={referenceRows}
      title="Reference benchmark"
      caption="Four reference configurations, ordered by reranking cost from lowest to highest."
    >
      <p>
        <strong>SciFact · 300 queries · 20 candidates · October 2026.</strong>{' '}
        Reference results via OpenRouter. Flash costs $73 versus Cohere Pro’s
        $2,500 per million queries, about 34× lower. These are reference
        results, not our LiteLLM run.
      </p>
      <p>
        Costs exclude gateway overhead; Jev 1.14 is projected from a rounded
        per-1K cost. Small score gaps do not establish a quality win.
      </p>
    </Comparison>
  );
}

export function MeasuredQualityChart() {
  return (
    <Comparison
      data={measuredRows}
      title="LiteLLM benchmark"
      caption="Two results measured by LiteLLM: TypeSafe Jev 1.13.0 and the local BM25 baseline."
    >
      <p>
        <strong>SciFact · 300 queries · 20 BM25 candidates per query.</strong>{' '}
        Measured through LiteLLM. Jev’s cost is estimated from reported tokens
        and excludes gateway overhead. BM25 adds no reranking calls.
      </p>
      <p>
        The reference run’s retrieval settings and candidate identity were not
        verified to match this run.
      </p>
    </Comparison>
  );
}

function Scatter({compact}) {
  const width = compact ? 340 : 960;
  const height = compact ? 570 : 500;
  const left = compact ? 36 : 66;
  const right = compact ? 322 : 928;
  const top = compact ? 150 : 120;
  const bottom = compact ? 510 : 440;
  const x = (cost) => left + ((right - left) * cost) / 2500;
  const y = (score) => bottom - (bottom - top) * score;
  const labels = compact
    ? [
        {
          x: 48,
          y: 20,
          path: [
            [44, 65],
            [59, 65],
            [59, 50],
          ],
        },
        {
          x: 75,
          y: 85,
          path: [
            [53, 130],
            [86, 130],
            [86, 115],
          ],
        },
        {
          x: 130,
          y: 180,
          path: [
            [114, 211],
            [120, 211],
          ],
        },
        {
          x: 130,
          y: 295,
          path: [
            [322, 275],
            [141, 275],
            [141, 285],
          ],
        },
        {
          x: 100,
          y: 365,
          path: [
            [101, 345],
            [111, 345],
            [111, 355],
          ],
        },
        {
          x: 48,
          y: 435,
          path: [
            [42, 281],
            [42, 451],
          ],
        },
      ]
    : [
        {
          x: 66,
          y: 32,
          path: [
            [91, 83],
            [77, 83],
            [77, 65],
          ],
        },
        {
          x: 330,
          y: 32,
          path: [
            [116, 101],
            [341, 101],
            [341, 65],
          ],
        },
        {
          x: 340,
          y: 145,
          path: [
            [310, 192],
            [310, 160],
            [330, 160],
          ],
        },
        {
          x: 716,
          y: 32,
          path: [
            [928, 83],
            [727, 83],
            [727, 65],
          ],
        },
        {
          x: 360,
          y: 280,
          path: [
            [264, 295],
            [350, 295],
          ],
        },
        {
          x: 100,
          y: 345,
          path: [
            [82, 240],
            [82, 360],
            [90, 360],
          ],
        },
      ];
  const shortNames = [
    ['Perplexity Flash v1.2', '(JevRank)'],
    ['Perplexity Decider v1.2', '(JevRank)'],
    ['TypeSafe Jev 1.14', '(JevRank)'],
    ['Cohere Rerank 4 Pro'],
    ['TypeSafe Jev 1.13.0', '(JevRank)'],
    ['BM25'],
  ];
  return (
    <svg
      className={compact ? styles.compactPlot : styles.widePlot}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      {[0, 0.25, 0.5, 0.75, 1].map((score) => (
        <g key={score}>
          <line
            className={styles.gridLine}
            x1={left}
            y1={y(score)}
            x2={right}
            y2={y(score)}
          />
          <text
            className={styles.axisText}
            x={left - 10}
            y={y(score) + 4}
            textAnchor="end"
          >
            {score}
          </text>
        </g>
      ))}
      {(compact ? [0, 1000, 2000, 2500] : [0, 500, 1000, 1500, 2000, 2500]).map(
        (cost) => (
          <g key={cost}>
            <line
              className={styles.gridLine}
              x1={x(cost)}
              y1={top}
              x2={x(cost)}
              y2={bottom}
            />
            <text
              className={styles.axisText}
              x={x(cost)}
              y={bottom + 22}
              textAnchor="middle"
            >
              {cost === 0 ? '$0' : `$${cost / 1000}k`}
            </text>
          </g>
        ),
      )}
      <line
        className={styles.axisLine}
        x1={left}
        y1={top}
        x2={left}
        y2={bottom}
      />
      <line
        className={styles.axisLine}
        x1={left}
        y1={bottom}
        x2={right}
        y2={bottom}
      />
      {rows.map((row, i) => (
        <g key={row.name}>
          <polyline
            className={styles.leader}
            points={[[x(row.cost), y(row.score)], ...labels[i].path]
              .map((point) => point.join(','))
              .join(' ')}
          />
          <circle
            className={`${styles.point} ${row.origin === 'LiteLLM run' ? styles.measuredPoint : ''} ${row.provider === 'cohere' || !row.provider ? styles.baselinePoint : ''}`}
            cx={x(row.cost)}
            cy={y(row.score)}
            r={compact ? 4 : 5}
          />
        </g>
      ))}
      {rows.map((row, i) => (
        <g
          key={row.name}
          className={styles.plotLabel}
          transform={`translate(${labels[i].x} ${labels[i].y})`}
        >
          {row.provider && (
            <image
              href={logos[row.provider]}
              width="22"
              height="22"
              preserveAspectRatio="xMidYMid meet"
            />
          )}
          <text className={styles.plotModel} x={row.provider ? 30 : 0} y="14">
            {shortNames[i].map((line, lineIndex) => (
              <tspan
                key={line}
                x={row.provider ? 30 : 0}
                dy={lineIndex ? 16 : 0}
              >
                {line}
              </tspan>
            ))}
          </text>
          <text
            className={styles.plotDetail}
            x={row.provider ? 30 : 0}
            y={shortNames[i].length > 1 ? 48 : 32}
          >
            {row.origin} · {row.score.toFixed(3)} ·{' '}
            {row.provider ? `${price(row)} / 1M` : 'No rerank calls'}
          </text>
        </g>
      ))}
      <text
        className={styles.axisTitle}
        x={(left + right) / 2}
        y={height - 9}
        textAnchor="middle"
      >
        Projected cost / 1M queries (USD) →
      </text>
    </svg>
  );
}

export function CostQualityChart() {
  const id = useId();
  return (
    <figure className={styles.figure} aria-labelledby={`${id}-title`}>
      <figcaption className={styles.figureHeading}>
        <span id={`${id}-title`}>Cost vs. ranking quality</span>
        <a
          href="/benchmarks/jevrank/jevrank-cost-quality.svg"
          target="_blank"
          rel="noopener noreferrer"
        >
          Download figure <span aria-hidden="true">↗</span>
        </a>
      </figcaption>
      <div className={styles.plotTop}>
        <span>Quality (nDCG@10) ↑</span>
        <span>
          Hollow: reference <span aria-hidden="true">·</span> Solid: LiteLLM run
        </span>
      </div>
      <Scatter compact={false} />
      <Scatter compact />
      <details className={styles.plotData}>
        <summary>View exact chart data</summary>
        <div className={styles.dataScroll}>
          <table className={styles.dataTable}>
            <caption className={styles.srOnly}>
              Cost vs. ranking quality for all six configurations. Quality is
              nDCG at10; costs are USD per million queries.
            </caption>
            <thead>
              <tr>
                <th scope="col">Model and method</th>
                <th scope="col">Origin</th>
                <th scope="col">nDCG@10</th>
                <th scope="col">Cost / 1M</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.name}>
                  <th scope="row">
                    {row.name}
                    <span>{row.method}</span>
                  </th>
                  <td>{row.origin}</td>
                  <td>{row.score}</td>
                  <td>
                    {row.provider
                      ? `${row.approximate ? '≈' : ''}$${row.cost.toLocaleString('en-US', {maximumFractionDigits: 5})}`
                      : 'No rerank calls'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className={styles.plotNote}>
        Both axes start at zero. Lines connect labels to their actual data
        points. Reference and measured candidate protocols may differ. BM25 has
        no reranking calls; retrieval itself is not asserted to be free.
      </p>
      <div className={styles.evidenceNote}>
        <p>
          Reference results via OpenRouter; solid points are our LiteLLM run.
          Costs exclude gateway overhead. The 34× comparison applies only to
          reference Flash versus reference Cohere Pro; nearby scores do not
          establish a quality win.
        </p>
      </div>
    </figure>
  );
}
