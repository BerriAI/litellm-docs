import React from 'react';

const s = {
  fig: {margin: '2.5rem 0', fontFamily: 'inherit'},
  box: {borderRadius: 12, border: '1px solid #e5e7eb', background: '#fff', padding: '2rem 2.5rem'},
  label: {fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9ca3af', textAlign: 'center', marginBottom: '1.5rem'},
  caption: {textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 12},
  node: (border = '#d1d5db', bg = '#f9fafb') => ({
    border: `1px solid ${border}`, borderRadius: 6, padding: '8px 20px',
    fontSize: 13, background: bg, display: 'inline-block', textAlign: 'center',
  }),
  note: {fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 4},
  col: {display: 'flex', flexDirection: 'column', alignItems: 'center'},
};

const Arrow = ({color = '#9ca3af', label}) => (
  <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
    <svg width="2" height="30" style={{display: 'block'}}>
      <line x1="1" y1="0" x2="1" y2="24" stroke={color} strokeWidth="1.5"/>
      <polygon points="1,30 -2,23 4,23" fill={color}/>
    </svg>
    {label && <span style={{position: 'absolute', left: 10, top: 6, fontSize: 11, color, whiteSpace: 'nowrap'}}>{label}</span>}
  </div>
);

const Layer = ({title, children, border, bg}) => (
  <div style={{...s.node(border, bg), width: '100%', padding: '10px 16px'}}>
    <div style={{fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9ca3af', marginBottom: 4}}>{title}</div>
    <div>{children}</div>
  </div>
);

export function BeforeArchitecture() {
  return (
    <figure style={s.fig}>
      <div style={s.box}>
        <p style={s.label}>Before: the browser does the math</p>
        <div style={{...s.col, maxWidth: 520, margin: '0 auto'}}>
          <Layer title="Browser (Admin UI)" border="#fca5a5" bg="#fef2f2">
            <span style={{color: '#b91c1c', fontWeight: 600}}>Holds every key's daily rows in memory</span>
            <div style={s.note}>adds up totals, sorts keys, searches, exports, all in JavaScript</div>
          </Layer>
          <Arrow color="#f87171" label="page 1, page 2, ... page N (1000 rows each)"/>
          <Layer title="Proxy (API route)">
            /daily/activity?page=N
            <div style={s.note}>SQL string lives inside the route file</div>
          </Layer>
          <Arrow/>
          <Layer title="Postgres">
            LiteLLM_DailyUserSpend, LiteLLM_DailyTeamSpend, ...
            <div style={s.note}>one row per key, per model, per day</div>
          </Layer>
        </div>
      </div>
      <figcaption style={s.caption}>More API keys means more pages, more bytes and a slower page. There is no upper bound.</figcaption>
    </figure>
  );
}

export function AfterArchitecture() {
  const small = (text) => <div style={{...s.node('#bfdbfe', '#eff6ff'), fontSize: 12, padding: '6px 12px'}}>{text}</div>;
  return (
    <figure style={s.fig}>
      <div style={s.box}>
        <p style={s.label}>After: the database does the math</p>
        <div style={{...s.col, maxWidth: 560, margin: '0 auto'}}>
          <Layer title="Client layer (Admin UI)" border="#86efac" bg="#f0fdf4">
            <span style={{color: '#15803d', fontWeight: 600}}>Holds one small response: totals + top N keys</span>
            <div style={s.note}>N is chosen by the client, capped by the server</div>
          </Layer>
          <Arrow color="#22c55e" label="one bounded request"/>
          <Layer title="Service layer (API routes)">
            aggregated, search_keys, model_top_keys, cache_leakage_keys, export
            <div style={s.note}>auth, scope, limit check (422 above the max). No SQL here</div>
          </Layer>
          <Arrow/>
          <Layer title="Repository layer (DailyActivityRepository)">
            typed scope in, typed rows out
            <div style={s.note}>Prisma where it fits, one central SQL builder for the rest</div>
          </Layer>
          <Arrow/>
          <Layer title="Postgres">
            same tables, same data
            <div style={s.note}>GROUP BY, ORDER BY, LIMIT run next to the data</div>
          </Layer>
        </div>
        <div style={{display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem'}}>
          {small('search: server-side, on demand')}
          {small('export: server-side, complete')}
          {small('per-model top keys: fetched when a row is opened')}
          {small('cache leakage: ranked in SQL')}
        </div>
      </div>
      <figcaption style={s.caption}>The page loads the same amount of data whether the proxy has 50 keys or 50,000.</figcaption>
    </figure>
  );
}

export function BeforeAfterGrid() {
  const cell = (head, before, after) => (
    <tr key={head}>
      <td style={{padding: '8px 12px', fontSize: 13, fontWeight: 600, borderBottom: '1px solid #f3f4f6'}}>{head}</td>
      <td style={{padding: '8px 12px', fontSize: 13, color: '#b91c1c', borderBottom: '1px solid #f3f4f6'}}>{before}</td>
      <td style={{padding: '8px 12px', fontSize: 13, color: '#15803d', borderBottom: '1px solid #f3f4f6'}}>{after}</td>
    </tr>
  );
  return (
    <figure style={s.fig}>
      <div style={{...s.box, padding: '1.5rem'}}>
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr>
              <th style={{textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em'}}></th>
              <th style={{textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em'}}>Before</th>
              <th style={{textAlign: 'left', padding: '8px 12px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em'}}>After</th>
            </tr>
          </thead>
          <tbody>
            {cell('Requests per page load', 'one per 1000 rows, grows with keys', 'one')}
            {cell('Data in the browser', 'every key, every day, every model', 'totals plus top N keys')}
            {cell('Totals', 'summed in JavaScript', 'summed in SQL, never capped')}
            {cell('Key search', 'filters the in-memory list', 'server route, searches all keys')}
            {cell('CSV export', 'built from what the browser holds', 'server route, streams every row')}
            {cell('Per-model top keys', 'taken from the global list', 'server route, per model, on demand')}
            {cell('Where SQL lives', 'inside route files', 'repository layer only')}
          </tbody>
        </table>
      </div>
      <figcaption style={s.caption}>What changed for each part of the usage page</figcaption>
    </figure>
  );
}
