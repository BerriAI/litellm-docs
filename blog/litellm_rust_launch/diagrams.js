import React from 'react';

const s = {
  fig: {margin: '2.5rem 0', fontFamily: 'inherit'},
  box: {borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', padding: '2rem 2.5rem'},
  label: {fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', textAlign: 'center', marginBottom: '1.5rem'},
  caption: {textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 12},
  node: (border='#d1d5db', bg='#f9fafb') => ({
    border: `1px solid ${border}`, borderRadius: 6, padding: '8px 20px',
    fontSize: 13, background: bg, display: 'inline-block',
  }),
};

const SmallArrow = ({color='#9ca3af'}) => (
  <svg width="2" height="28" style={{display:'block'}}>
    <line x1="1" y1="0" x2="1" y2="22" stroke={color} strokeWidth="1.5"/>
    <polygon points="1,28 -2,21 4,21" fill={color}/>
  </svg>
);

export function RustMigrationStages() {
  const overview = [
    {stage:'Stage 0 - Today', title:'Pure Python SDK + FastAPI proxy', foot:'Rust share of hot path: 0%', color:'#2563eb', bg:'#eff6ff'},
    {stage:'Stage 1 - Core in Rust', title:'Python drives Rust transforms via PyO3', foot:'V0 - V3: transforms + router', color:'#16a34a', bg:'#f0fdf4'},
    {stage:'Stage 2 - Thin shell', title:'FastAPI shell, hot path all Rust', foot:'V4 - V5a: entire forwarding path', color:'#d97706', bg:'#fffbeb'},
    {stage:'Stage 3 - Pure Rust', title:'axum server, Python in sidecar', foot:'V5b: 100% Rust hot path', color:'#7c3aed', bg:'#faf5ff'},
  ];
  const stages = [
    {
      version: 'V0',
      title: 'OCR Rust server',
      detail: 'Low-risk /ocr route for all providers. Proves server, PyO3, and parity loop.',
      date: 'Aug 15',
      color: '#6b7280',
    },
    {
      version: 'V1',
      title: '/messages',
      detail: 'Streaming axis: SSE parsing, chunk emission, usage, cost.',
      date: 'V1',
      color: '#2563eb',
    },
    {
      version: 'V2',
      title: '/chat/completions',
      detail: 'Tools, multimodal, function calling, optional params.',
      date: 'V2',
      color: '#2563eb',
    },
    {
      version: 'V3',
      title: 'Core providers',
      detail: 'Azure, Bedrock, Vertex, OpenAI-compatible routes.',
      date: 'V3',
      color: '#2563eb',
    },
    {
      version: 'V4',
      title: 'Router in Rust',
      detail: 'Routing, fallbacks, retries, cooldowns, high concurrency.',
      date: 'V4',
      color: '#7c3aed',
    },
    {
      version: 'V5a',
      title: 'FastAPI thin shell',
      detail: 'Python terminates HTTP; forwarding path is one Rust call.',
      date: 'V5a',
      color: '#db2777',
    },
    {
      version: 'V5b',
      title: 'Pure Rust gateway',
      detail: '/chat/completions, /responses, /messages with auth.',
      date: 'V5b',
      color: '#059669',
    },
  ];

  return (
    <figure style={s.fig}>
      <div style={{...s.box, overflowX:'auto'}}>
        <p style={s.label}>Migration stages - every stage ships behind parity</p>
        <div style={{minWidth: 860}}>
          <div style={{display:'grid', gridTemplateColumns:'1fr 24px 1fr 24px 1fr 24px 1fr', alignItems:'center', marginBottom:22}}>
            {overview.map((item, index) => (
              <React.Fragment key={item.stage}>
                <div style={{border:`1.5px solid ${item.color}`, background:item.bg, borderRadius:8, padding:'16px 14px', textAlign:'center', minHeight:104}}>
                  <div style={{fontSize:11, color:item.color, fontWeight:800, marginBottom:8}}>{item.stage}</div>
                  <div style={{fontSize:13, color:'#111827', fontWeight:700, lineHeight:1.35}}>{item.title}</div>
                  <div style={{fontSize:10, color:'#6b7280', marginTop:10}}>{item.foot}</div>
                </div>
                {index < overview.length - 1 && (
                  <svg width="24" height="18" viewBox="0 0 24 18" aria-hidden="true">
                    <path d="M1 9h16" stroke="#6b7280" strokeWidth="2" />
                    <path d="M15 2l8 7-8 7z" fill="#6b7280" />
                  </svg>
                )}
              </React.Fragment>
            ))}
          </div>
          <div style={{display:'grid', gridTemplateColumns:`repeat(${stages.length}, 1fr)`, gap:10, alignItems:'stretch'}}>
            {stages.map((stage) => (
              <div key={stage.version} style={{border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', padding:'14px 12px', minHeight:142}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:10}}>
                  <span style={{display:'inline-flex', alignItems:'center', justifyContent:'center', minWidth:34, height:24, borderRadius:999, background:stage.color, color:'#fff', fontSize:11, fontWeight:700}}>
                    {stage.version}
                  </span>
                  <span style={{fontSize:10, color:stage.color, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', whiteSpace:'nowrap'}}>
                    {stage.date}
                  </span>
                </div>
                <div style={{fontSize:13, color:'#111827', fontWeight:700, lineHeight:1.3, marginBottom:8}}>{stage.title}</div>
                <div style={{fontSize:11, color:'#6b7280', lineHeight:1.45}}>{stage.detail}</div>
              </div>
            ))}
          </div>
          <div style={{position:'relative', margin:'18px 4px 0'}}>
            <div style={{height:2, background:'linear-gradient(90deg, #6b7280, #2563eb, #7c3aed, #db2777, #059669)'}} />
            <div style={{display:'grid', gridTemplateColumns:'1.3fr 1fr 1fr', gap:14, marginTop:14}}>
              <div style={{border:'1px solid #bfdbfe', background:'#eff6ff', borderRadius:8, padding:12}}>
                <div style={{fontSize:10, color:'#2563eb', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5}}>Stage 1</div>
                <div style={{fontSize:12, color:'#1f2937', lineHeight:1.45}}>Python SDK drives Rust core through bindings. Provider transforms prove parity before traffic moves.</div>
              </div>
              <div style={{border:'1px solid #ddd6fe', background:'#f5f3ff', borderRadius:8, padding:12}}>
                <div style={{fontSize:10, color:'#7c3aed', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5}}>Stage 2</div>
                <div style={{fontSize:12, color:'#1f2937', lineHeight:1.45}}>Router logic moves to Rust after provider paths are already exercised.</div>
              </div>
              <div style={{border:'1px solid #bbf7d0', background:'#f0fdf4', borderRadius:8, padding:12}}>
                <div style={{fontSize:10, color:'#059669', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5}}>Stage 3</div>
                <div style={{fontSize:12, color:'#1f2937', lineHeight:1.45}}>Pure Rust gateway serves the core endpoints with auth after full e2e coverage passes.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <figcaption style={s.caption}>The rollout follows the PDF structure: prove the smallest route first, then move provider transforms, router, thin shell, and pure Rust server.</figcaption>
    </figure>
  );
}

export function RustServerSteps() {
  const box = (border, bg, title, sub, lines) => (
    <div style={{border:`1.5px solid ${border}`, background:bg, borderRadius:8, padding:16, textAlign:'center'}}>
      <div style={{fontSize:13, color:border, fontWeight:800, marginBottom:6}}>{title}</div>
      <div style={{fontSize:11, color:'#6b7280', marginBottom:10}}>{sub}</div>
      {lines.map((line) => <div key={line} style={{fontSize:11, color:'#374151', lineHeight:1.5}}>{line}</div>)}
    </div>
  );
  return (
    <figure style={s.fig}>
      <div style={s.box}>
        <p style={s.label}>Stage 2 to Stage 3 - onto a server</p>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:28, alignItems:'start'}}>
          <div>
            <div style={{fontSize:12, color:'#d97706', fontWeight:800, marginBottom:12}}>V5a - FastAPI as a thin shell</div>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:10}}>
              {box('#9ca3af', '#f9fafb', 'client', '', [])}
              <SmallArrow color="#6b7280" />
              {box('#d97706', '#fffbeb', 'FastAPI shell (Python)', 'auth - rate limit - callbacks only', ['terminates HTTP', 'no provider forwarding logic'])}
              <SmallArrow color="#6b7280" />
              {box('#16a34a', '#f0fdf4', 'Rust engine (one PyO3 call)', 'router + core + HTTP + stream + cost', ['entire forwarding hot path'])}
              <SmallArrow color="#6b7280" />
              {box('#9ca3af', '#f9fafb', 'upstream LLM', 'provider API', [])}
            </div>
          </div>
          <div>
            <div style={{fontSize:12, color:'#7c3aed', fontWeight:800, marginBottom:12}}>V5b - pure Rust server</div>
            <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:10}}>
              {box('#9ca3af', '#f9fafb', 'client', '', [])}
              <SmallArrow color="#6b7280" />
              {box('#7c3aed', '#faf5ff', 'Rust server (axum / hyper)', 'auth - rate limit - router', ['core - streaming - cost - spend', 'no PyO3 on hot path'])}
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, width:'100%'}}>
                {box('#9ca3af', '#f9fafb', 'Redis', 'routing state', [])}
                {box('#9ca3af', '#f9fafb', 'Postgres', 'spend + config', [])}
              </div>
              <SmallArrow color="#6b7280" />
              {box('#9ca3af', '#f9fafb', 'upstream LLM', 'provider API', [])}
              <div style={{border:'1px dashed #9ca3af', borderRadius:8, padding:10, fontSize:11, color:'#6b7280', width:'80%'}}>optional PyO3 sidecar for customer Python plugins, guardrails, callbacks, and SSO</div>
            </div>
          </div>
        </div>
      </div>
      <figcaption style={s.caption}>V5a removes Python from forwarding while preserving the shell; V5b removes PyO3 from the hot path.</figcaption>
    </figure>
  );
}

export function LatencyCompare() {
  const bar = (label, widthPct, valueText, color, textColor='#fff') => (
    <div style={{display:'flex', alignItems:'center', gap:16, marginBottom:14}}>
      <div style={{width:160, fontSize:13, color:'#4b5563', textAlign:'right'}}>{label}</div>
      <div style={{flex:1, background:'#f3f4f6', borderRadius:6, height:32, position:'relative'}}>
        <div style={{width:`${widthPct}%`, height:'100%', background:color, borderRadius:6, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:12}}>
          <span style={{fontSize:12, color:textColor, fontWeight:600}}>{valueText}</span>
        </div>
      </div>
    </div>
  );
  return (
    <figure style={s.fig}>
      <div style={s.box}>
        <p style={s.label}>Gateway overhead per Claude Code call</p>
        {bar('LiteLLM-Rust (target)', 4, '<1ms', '#7c6dff')}
        {bar('Python (typical)', 60, 'ms-scale', '#9ca3af')}
        <div style={{marginTop:16, paddingTop:16, borderTop:'1px solid #e5e7eb', fontSize:12, color:'#6b7280', textAlign:'center'}}>
          Per-call overhead compounds across dozens of tool calls in a single agent run
        </div>
      </div>
      <figcaption style={s.caption}>Sub-millisecond target on the hot path — Python removed from request forwarding</figcaption>
    </figure>
  );
}

export function DropInMigration() {
  return (
    <figure style={s.fig}>
      <div style={s.box}>
        <p style={s.label}>Drop-in migration — same config, same DB</p>
        <div style={{display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:24, alignItems:'center'}}>
          <div style={{border:'1px solid #e5e7eb', borderRadius:8, padding:20, textAlign:'center'}}>
            <p style={{fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#9ca3af', marginBottom:12}}>Before</p>
            <div style={{...s.node(), marginBottom:8, width:'80%'}}>litellm (Python)</div>
            <div style={{fontSize:11, color:'#6b7280', marginTop:12}}>
              <div>config.yaml</div>
              <div>Postgres DB</div>
              <div>Client SDKs</div>
            </div>
          </div>
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
            <svg width="40" height="16"><polygon points="0,8 32,8 32,2 40,8 32,14 32,8" fill="#7c6dff"/></svg>
            <span style={{fontSize:10, color:'#7c6dff', fontWeight:600}}>swap binary</span>
          </div>
          <div style={{border:'1px solid #7c6dff', borderRadius:8, padding:20, textAlign:'center', background:'#faf9ff'}}>
            <p style={{fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'#7c6dff', marginBottom:12}}>After</p>
            <div style={{...s.node('#7c6dff','#7c6dff'), color:'#fff', marginBottom:8, width:'80%', fontWeight:600}}>litellm-rust</div>
            <div style={{fontSize:11, color:'#6b7280', marginTop:12}}>
              <div>config.yaml <span style={{color:'#16a34a'}}>(unchanged)</span></div>
              <div>Postgres DB <span style={{color:'#16a34a'}}>(unchanged)</span></div>
              <div>Client SDKs <span style={{color:'#16a34a'}}>(unchanged)</span></div>
            </div>
          </div>
        </div>
      </div>
      <figcaption style={s.caption}>Only the runtime changes — config, DB schema, and client contract are identical</figcaption>
    </figure>
  );
}

export function RemoteAgentsFlow() {
  const pill = (text, dim=false) => (
    <span style={{display:'inline-block', fontSize:11, padding:'3px 10px', borderRadius:999, border:`1px solid ${dim?'#e5e7eb':'#7c6dff'}`, color: dim?'#9ca3af':'#7c6dff', background: dim?'#f9fafb':'#faf9ff', marginRight:6, marginBottom:6}}>{text}</span>
  );
  return (
    <figure style={s.fig}>
      <div style={s.box}>
        <p style={s.label}>Coding-agent runtime in the gateway</p>
        <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
          <div style={s.node()}>Trigger (cron · webhook · API)</div>
          <SmallArrow color="#7c6dff"/>
          <div style={{...s.node('#7c6dff','#7c6dff'), color:'#fff', fontWeight:600}}>LiteLLM-Rust Gateway</div>
          <SmallArrow />
          <div style={{...s.node(), textAlign:'center', fontSize:13, padding:'12px 24px'}}>
            <div style={{fontWeight:600, marginBottom:6}}>Sandbox</div>
            <div>{pill('E2B')}{pill('Daytona')}</div>
            <div style={{fontSize:11, color:'#9ca3af', marginTop:4}}>Claude Code runs isolated</div>
          </div>
          <SmallArrow />
          <div style={{...s.node(), textAlign:'center', fontSize:13, padding:'12px 24px'}}>
            <div style={{fontWeight:600, marginBottom:6, color:'#9ca3af'}}>Roadmap</div>
            <div>{pill('durable sessions', true)}{pill('memory', true)}{pill('artifacts', true)}{pill('vault', true)}</div>
          </div>
          <SmallArrow />
          <div style={{...s.node('#111827','#111827'), color:'#fff', fontWeight:600}}>Results streamed back to caller</div>
        </div>
      </div>
      <figcaption style={s.caption}>One runtime: gateway, scheduler, sandbox — proxying LLM calls and running the agents that make them</figcaption>
    </figure>
  );
}
