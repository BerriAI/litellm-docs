import React from 'react';

// Header hero: big to small. A wide, full-height bundle of thin cream lines on the
// left funnels down and collapses into one small glowing rust core on the right,
// a large Python gateway shrinking into a small, fast Rust binary.
export function RustHeader() {
  const N = 37, TOP = 22, BOT = 478, NODE_X = 1000, NODE_Y = 250, CREAM = '#faf9f5';
  const center = (N - 1) / 2;
  const paths = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const yl = TOP + t * (BOT - TOP);
    const cy = NODE_Y + (yl - NODE_Y) * 0.3;
    const op = 0.16 + (1 - Math.abs(i - center) / center) * (0.5 - 0.16);
    paths.push(
      <path key={i} d={`M 0 ${yl} Q 540 ${cy}, ${NODE_X} ${NODE_Y}`}
        fill="none" stroke={CREAM} strokeWidth="0.9" strokeOpacity={Number(op.toFixed(4))} strokeLinecap="round" />
    );
  }
  const rings = [[150, 215, 0.10], [360, 150, 0.085], [560, 95, 0.07], [740, 52, 0.06]].map(
    ([rx, ry, op], j) => (
      <ellipse key={`r${j}`} cx={rx} cy={NODE_Y} rx="14" ry={ry} fill="none"
        stroke={CREAM} strokeWidth="0.8" strokeOpacity={op} />
    )
  );
  return (
    <figure style={{margin: '0 0 2rem 0'}}>
      <div style={{background: '#3a3a2e', borderRadius: 12, overflow: 'hidden', aspectRatio: '1200 / 500', width: '100%'}}>
        <svg viewBox="0 0 1200 500" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"
          style={{display: 'block'}} role="img"
          aria-label="A wide bundle of thin lines on the left funnels down and collapses into one small glowing core on the right, a large Python gateway shrinking into a small, fast Rust binary.">
          <defs>
            <radialGradient id="rustGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f0a35e" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#d97a3d" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#d97a3d" stopOpacity="0" />
            </radialGradient>
          </defs>
          {rings}
          {paths}
          <circle cx={NODE_X} cy={NODE_Y} r="34" fill="url(#rustGlow)" />
          <circle cx={NODE_X} cy={NODE_Y} r="5.5" fill="#f4b079" opacity="0.98" />
        </svg>
      </div>
    </figure>
  );
}

const s = {
  fig: {margin: '2.5rem 0', fontFamily: 'inherit'},
  box: {borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', padding: '2rem 2.5rem'},
  label: {fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', textAlign: 'center', marginBottom: '1.5rem'},
  caption: {textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 12},
  node: (border = '#d1d5db', bg = '#f9fafb', color = '#111827') => ({
    border: `1.5px solid ${border}`, borderRadius: 8, padding: '12px 18px',
    background: bg, color, textAlign: 'center', width: '100%', boxSizing: 'border-box',
  }),
};

const SmallArrow = ({color = '#9ca3af', h = 26}) => (
  <svg width="2" height={h} style={{display: 'block'}} aria-hidden="true">
    <line x1="1" y1="0" x2="1" y2={h - 6} stroke={color} strokeWidth="1.5" />
    <polygon points={`1,${h} -2,${h - 7} 4,${h - 7}`} fill={color} />
  </svg>
);

const RightArrow = ({color = '#6b7280', w = 40, label}) => (
  <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
    {label && <span style={{fontSize: 10, color, fontWeight: 600, marginBottom: 3}}>{label}</span>}
    <svg width={w} height="14" viewBox={`0 0 ${w} 14`} aria-hidden="true">
      <path d={`M0 7h${w - 8}`} stroke={color} strokeWidth="1.5" />
      <path d={`M${w - 9} 1l8 6-8 6z`} fill={color} />
    </svg>
  </div>
);

// Page 1 (top): the four-stage overview + "Rust share of hot path" axis.
export function RustMigrationStages() {
  const stages = [
    {stage: 'Stage 0 · Today', title: 'Pure Python SDK + FastAPI proxy', foot: '100% Python', color: '#2563eb', bg: '#eff6ff'},
    {stage: 'Stage 1 · Core in Rust', title: 'Python drives Rust transforms via PyO3', foot: 'V0 to V3', color: '#16a34a', bg: '#f0fdf4'},
    {stage: 'Stage 2 · Thin shell', title: 'FastAPI shell, hot path all Rust', foot: 'V4 to V5a', color: '#d97706', bg: '#fffbeb'},
    {stage: 'Stage 3 · Pure Rust', title: 'axum server, Python in sidecar', foot: 'V5b', color: '#7c3aed', bg: '#faf5ff'},
  ];
  const axis = [
    {text: '0%', color: '#2563eb'},
    {text: 'transforms + router', color: '#16a34a'},
    {text: '~entire forwarding path', color: '#d97706'},
    {text: '100%', color: '#7c3aed'},
  ];
  return (
    <figure style={s.fig}>
      <div style={{...s.box, overflowX: 'auto'}}>
        <div style={{minWidth: 760}}>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 22px 1fr 22px 1fr 22px 1fr', alignItems: 'center'}}>
            {stages.map((item, index) => (
              <React.Fragment key={item.stage}>
                <div style={{border: `1.5px solid ${item.color}`, background: item.bg, borderRadius: 8, padding: '16px 14px', textAlign: 'center', minHeight: 116}}>
                  <div style={{fontSize: 12, color: item.color, fontWeight: 800, marginBottom: 8}}>{item.stage}</div>
                  <div style={{fontSize: 13, color: '#111827', fontWeight: 600, lineHeight: 1.35}}>{item.title}</div>
                  <div style={{fontSize: 11, color: '#6b7280', marginTop: 10, fontWeight: 600}}>{item.foot}</div>
                </div>
                {index < stages.length - 1 && (
                  <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true">
                    <path d="M1 8h14" stroke="#9ca3af" strokeWidth="2" />
                    <path d="M13 2l8 6-8 6z" fill="#9ca3af" />
                  </svg>
                )}
              </React.Fragment>
            ))}
          </div>
          <div style={{height: 1, background: '#e5e7eb', margin: '20px 0 12px'}} />
          <div style={{display: 'grid', gridTemplateColumns: '1fr 22px 1fr 22px 1fr 22px 1fr', alignItems: 'center'}}>
            <div style={{gridColumn: '1 / -1', fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 8}}>Rust share of hot path</div>
            {axis.map((item, index) => (
              <React.Fragment key={item.text}>
                <div style={{textAlign: 'center', fontSize: 12, color: item.color, fontWeight: 700}}>{item.text}</div>
                {index < axis.length - 1 && <div />}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <figcaption style={s.caption}>Four stages, each shipped to production before the next begins.</figcaption>
    </figure>
  );
}

// The repeating cadence inside Stage 1: prove one provider, roll out all providers, fold the route into the Rust core.
export function RouteCadence() {
  const beats = ['1. Prove one provider', '2. Roll out all providers', '3. Fold route into the Rust core'];
  const routes = [
    {name: 'OCR', start: 'Mistral OCR', note: 'lowest-risk route, start here', color: '#16a34a', bg: '#f0fdf4'},
    {name: '/v1/messages', start: 'one provider', note: 'adds the streaming axis', color: '#2563eb', bg: '#eff6ff'},
    {name: '/chat/completions', start: 'one provider', note: 'largest param surface', color: '#7c3aed', bg: '#faf5ff'},
  ];
  const beatCell = (route, i) => (
    <div style={{border: `1.5px solid ${route.color}`, background: route.bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center'}}>
      <div style={{fontSize: 12, color: '#111827', fontWeight: 700}}>{i === 0 ? route.start : (i === 1 ? `all ${route.name}` : `${route.name} in Rust`)}</div>
      {i === 0 && <div style={{fontSize: 10, color: '#9ca3af', marginTop: 3}}>{route.note}</div>}
    </div>
  );
  return (
    <figure style={s.fig}>
      <div style={{...s.box, overflowX: 'auto'}}>
        <p style={s.label}>The repeating cadence inside Stage 1</p>
        <div style={{minWidth: 680, display: 'grid', gridTemplateColumns: '150px 1fr 26px 1fr 26px 1fr', alignItems: 'center', rowGap: 12}}>
          <div />
          {beats.map((b, i) => (
            <React.Fragment key={b}>
              <div style={{fontSize: 11, color: '#6b7280', fontWeight: 700, textAlign: 'center'}}>{b}</div>
              {i < beats.length - 1 && <div />}
            </React.Fragment>
          ))}
          {routes.map((route) => (
            <React.Fragment key={route.name}>
              <div style={{fontSize: 13, fontWeight: 800, color: route.color}}>{route.name}</div>
              {beatCell(route, 0)}
              <RightArrow color={route.color} w={24} />
              {beatCell(route, 1)}
              <RightArrow color={route.color} w={24} />
              {beatCell(route, 2)}
            </React.Fragment>
          ))}
        </div>
      </div>
      <figcaption style={s.caption}>Same three beats per route: one provider, then all providers, then the route lives in the Rust core. OCR goes first.</figcaption>
    </figure>
  );
}

// Page 1 (bottom): Stage 1 architecture — Python SDK delegates transforms to the Rust core via PyO3.
export function Stage1Architecture() {
  return (
    <figure style={s.fig}>
      <div style={{...s.box, overflowX: 'auto'}}>
        <p style={s.label}>Stage 1 · Rust core, driven by the Python SDK</p>
        <div style={{minWidth: 720, maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
          <div style={{...s.node('#9ca3af', '#f3f4f6'), width: 140}}>client</div>
          <SmallArrow />
          <div style={s.node('#2563eb', '#eff6ff', '#1e3a8a')}>
            <div style={{fontWeight: 700, fontSize: 13}}>FastAPI proxy (Python)</div>
            <div style={{fontSize: 11, color: '#3b5b7a', marginTop: 4}}>auth · rate limit · callbacks · DB · spend</div>
            <div style={{fontSize: 10, color: '#9ca3af', marginTop: 4}}>unchanged in Stage 1</div>
          </div>
          <SmallArrow />
          {/* Python SDK + the Rust path it delegates to */}
          <div style={{display: 'grid', gridTemplateColumns: '1.1fr 60px 1fr', alignItems: 'center', width: '100%'}}>
            <div style={s.node('#2563eb', '#eff6ff', '#1e3a8a')}>
              <div style={{fontWeight: 700, fontSize: 13}}>litellm Python SDK</div>
              <div style={{fontSize: 11, color: '#3b5b7a', marginTop: 4}}>does the I/O: HTTP · auth · retries · streaming loop</div>
            </div>
            <RightArrow color="#16a34a" w={56} label="flag on" />
            <div style={s.node('#d97706', '#fffbeb', '#92400e')}>
              <div style={{fontWeight: 700, fontSize: 13}}>PyO3 bridge</div>
              <div style={{fontSize: 10, color: '#b45309', marginTop: 4}}>flag-gated</div>
            </div>
          </div>
          <div style={{display: 'grid', gridTemplateColumns: '1.1fr 60px 1fr', alignItems: 'stretch', width: '100%', marginTop: 10}}>
            <div style={{border: '1.5px dashed #cbd5e1', borderRadius: 8, padding: '12px 18px', textAlign: 'center', background: '#fafafa'}}>
              <div style={{fontWeight: 600, fontSize: 12, color: '#6b7280'}}>Python transforms (today's code)</div>
              <div style={{fontSize: 10, color: '#9ca3af', marginTop: 4}}>flag off or unsupported provider</div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#16a34a'}}>↓</div>
            <div style={s.node('#16a34a', '#f0fdf4', '#166534')}>
              <div style={{fontWeight: 700, fontSize: 13}}>litellm-core (Rust, pure)</div>
              <div style={{fontSize: 11, color: '#15803d', marginTop: 4}}>transform_request / transform_response</div>
              <div style={{fontSize: 11, color: '#15803d'}}>stream chunk transform · token cost</div>
              <div style={{fontSize: 10, color: '#9ca3af', marginTop: 4}}>“describe, don't execute” · no I/O</div>
            </div>
          </div>
          <SmallArrow color="#6b7280" h={30} />
          <div style={{...s.node('#9ca3af', '#f3f4f6'), width: 220}}>
            <div style={{fontWeight: 600, fontSize: 13}}>upstream LLM</div>
            <div style={{fontSize: 10, color: '#9ca3af', marginTop: 2}}>provider API · HTTP (Python flips)</div>
          </div>
        </div>
      </div>
      <figcaption style={s.caption}>The Rust core returns a prepared request; the Python SDK still performs every byte of I/O.</figcaption>
    </figure>
  );
}

// Page 3: Stage 2 thin shell (V5a) and Stage 3 pure Rust server (V5b), side by side.
export function RustServerSteps() {
  const node = (border, bg, color, title, sub, lines) => (
    <div style={s.node(border, bg, color)}>
      <div style={{fontSize: 13, fontWeight: 700}}>{title}</div>
      {sub && <div style={{fontSize: 11, color: '#6b7280', marginTop: 4}}>{sub}</div>}
      {lines.map((line) => <div key={line} style={{fontSize: 11, color: '#374151', marginTop: 2}}>{line}</div>)}
    </div>
  );
  return (
    <figure style={s.fig}>
      <div style={{...s.box, overflowX: 'auto'}}>
        <p style={s.label}>Stage 2 → Stage 3 · onto a server</p>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start', minWidth: 640}}>
          <div>
            <div style={{fontSize: 12, color: '#d97706', fontWeight: 800, marginBottom: 14}}>Stage 2 · FastAPI as a thin shell (V5a)</div>
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
              {node('#9ca3af', '#f3f4f6', '#111827', 'client', '', [])}
              <SmallArrow />
              {node('#d97706', '#fffbeb', '#92400e', 'FastAPI shell (Python)', 'auth · rate limit · callbacks only', ['terminates HTTP', 'no forwarding logic'])}
              <SmallArrow />
              {node('#16a34a', '#f0fdf4', '#166534', 'Rust engine (one PyO3 call)', 'router + core + HTTP + stream + cost', ['entire forwarding hot path'])}
              <SmallArrow />
              {node('#9ca3af', '#f3f4f6', '#111827', 'upstream LLM', 'provider API', [])}
            </div>
          </div>
          <div>
            <div style={{fontSize: 12, color: '#7c3aed', fontWeight: 800, marginBottom: 14}}>Stage 3 · Pure Rust server (V5b)</div>
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
              {node('#9ca3af', '#f3f4f6', '#111827', 'client', '', [])}
              <SmallArrow />
              <div style={{display: 'grid', gridTemplateColumns: '1fr 110px', gap: 10, alignItems: 'center', width: '100%'}}>
                {node('#7c3aed', '#faf5ff', '#5b21b6', 'Rust server (axum / hyper)', 'auth · rate limit · router', ['core · streaming · cost · spend', 'no PyO3 on hot path'])}
                <div style={{border: '1.5px dashed #c4b5fd', borderRadius: 8, padding: '10px 8px', fontSize: 10, color: '#7c3aed', textAlign: 'center', background: '#faf5ff'}}>
                  <div style={{fontWeight: 700}}>PyO3 sidecar</div>
                  <div style={{color: '#9ca3af', marginTop: 2}}>customer Python plugins · guardrails</div>
                </div>
              </div>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: 'calc(100% - 120px)', alignSelf: 'flex-start'}}>
                {node('#9ca3af', '#f3f4f6', '#111827', 'Redis', 'routing state', [])}
                {node('#9ca3af', '#f3f4f6', '#111827', 'Postgres', 'spend + config', [])}
              </div>
              <SmallArrow />
              {node('#9ca3af', '#f3f4f6', '#111827', 'upstream LLM', 'provider API', [])}
            </div>
          </div>
        </div>
      </div>
      <figcaption style={s.caption}>V5a removes Python from forwarding while keeping the shell; V5b removes PyO3 from the hot path.</figcaption>
    </figure>
  );
}
