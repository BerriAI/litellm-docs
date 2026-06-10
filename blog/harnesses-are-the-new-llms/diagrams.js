import React from 'react';

const ROWS = [
  {
    label: 'Unified API',
    sub: 'one interface, many backends',
    model: { name: 'LiteLLM', desc: 'one API across 100+ models', open: false },
    agent: { name: '?', desc: 'one API across agent runtimes', open: true },
  },
  {
    label: 'Managed cloud service',
    sub: 'fully hosted, pay-per-use',
    model: { name: 'Bedrock', desc: 'cloud model inference', open: false },
    agent: { name: 'Claude Managed Agents', desc: 'cloud model + harness API', open: false },
  },
  {
    label: 'Deployment platform',
    sub: 'run open-source yourself',
    model: { name: 'SageMaker', desc: 'deploy OSS models', open: false },
    agent: { name: 'AgentCore · Vertex Agents', desc: 'deploy OSS harnesses', open: false },
  },
  {
    label: 'High-perf serving',
    sub: 'throughput & latency engine',
    model: { name: 'vLLM', desc: 'fast model serving', open: false },
    agent: { name: '?', desc: 'fast harness serving', open: true },
  },
];

const BLUE = '#3b82f6';

const s = {
  fig: { margin: '2.5rem 0', fontFamily: 'inherit' },
  wrap: {
    display: 'grid',
    gridTemplateColumns: '180px 1fr 24px 1fr',
    gap: '12px 12px',
    alignItems: 'center',
  },
  colHeader: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'center',
    paddingBottom: 4,
  },
  colSub: {
    fontSize: 11,
    opacity: 0.6,
    textAlign: 'center',
    paddingBottom: 12,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: 600,
    paddingRight: 12,
  },
  rowSub: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 2,
  },
  box: (open) => ({
    border: open ? `1.5px dashed ${BLUE}` : '1px solid var(--ifm-color-emphasis-300)',
    background: open ? 'rgba(59,130,246,0.08)' : 'transparent',
    borderRadius: 8,
    padding: '14px 18px',
    minHeight: 56,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  }),
  boxName: (open) => ({
    fontSize: 14,
    fontWeight: 700,
    color: open ? BLUE : 'inherit',
  }),
  boxDesc: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 3,
  },
  arrow: {
    fontSize: 16,
    opacity: 0.5,
    textAlign: 'center',
  },
  legend: {
    display: 'flex',
    gap: 24,
    justifyContent: 'center',
    marginTop: 24,
    fontSize: 12,
    opacity: 0.7,
    flexWrap: 'wrap',
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: 8 },
  legendSwatch: (open) => ({
    width: 24,
    height: 14,
    borderRadius: 4,
    border: open ? `1.5px dashed ${BLUE}` : '1px solid var(--ifm-color-emphasis-300)',
    background: open ? 'rgba(59,130,246,0.08)' : 'transparent',
  }),
  caption: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.6,
    marginTop: 14,
  },
};

export function StackComparison() {
  return (
    <figure style={s.fig}>
      <div style={s.wrap}>
        <div />
        <div>
          <div style={s.colHeader}>Model stack — today</div>
          <div style={s.colSub}>calling models</div>
        </div>
        <div />
        <div>
          <div style={s.colHeader}>Agent stack — future</div>
          <div style={s.colSub}>calling harnesses</div>
        </div>

        {ROWS.map((row, i) => (
          <React.Fragment key={i}>
            <div style={s.rowLabel}>
              {row.label}
              <div style={s.rowSub}>{row.sub}</div>
            </div>
            <div style={s.box(row.model.open)}>
              <div style={s.boxName(row.model.open)}>{row.model.name}</div>
              <div style={s.boxDesc}>{row.model.desc}</div>
            </div>
            <div style={s.arrow}>→</div>
            <div style={s.box(row.agent.open)}>
              <div style={s.boxName(row.agent.open)}>{row.agent.name}</div>
              <div style={s.boxDesc}>{row.agent.desc}</div>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div style={s.legend}>
        <div style={s.legendItem}>
          <div style={s.legendSwatch(true)} />
          <span>open gap — no clear winner yet</span>
        </div>
        <div style={s.legendItem}>
          <div style={s.legendSwatch(false)} />
          <span>established / announced player</span>
        </div>
      </div>

      <figcaption style={s.caption}>
        Each model-stack layer has a mirror in the agent stack. Dashed boxes mark open opportunities.
      </figcaption>
    </figure>
  );
}
