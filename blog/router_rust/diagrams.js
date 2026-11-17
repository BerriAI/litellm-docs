import React from 'react';
import s from './diagrams.module.css';

// Diagrams for the "Routing in Rust" post. Each one is a plain SVG themed through the CSS
// variables in diagrams.module.css, so it follows the site's light and dark mode.

const cx = (...names) => names.filter(Boolean).map(name => s[name]).join(' ');

function Fig({n, eyebrow, title, label, viewBox, caption, children}) {
  return (
    <figure className={s.fig}>
      <div className={s.art}>
        <div className={s.head}>
          <span className={s.eyebrow}>
            <span className={s.num}>{n}</span>
            {eyebrow}
          </span>
          <p className={s.title}>{title}</p>
        </div>
        <div className={s.scroll}>
          <svg className={s.svg} viewBox={viewBox} role="img" aria-label={label}>
            {children}
          </svg>
        </div>
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}

// One arrowhead per color so a wire can match the box it points at.
const MARKER_KINDS = ['', 'ok', 'bad', 'py', 'rs', 'mut', 'soft'];
const Markers = ({id}) => (
  <defs>
    {MARKER_KINDS.map(k => (
      <marker
        key={k || 'base'}
        id={k ? `${id}-${k}` : id}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10Z" className={cx('head1', k && `head_${k}`)} />
      </marker>
    ))}
  </defs>
);

const Box = ({x, y, w, h, v = 'box', dashed, shadow, rx = 10}) => (
  <rect x={x} y={y} width={w} height={h} rx={rx} className={cx(v, dashed && 'dashed', shadow && 'shadow')} />
);

// Stacked lines of text; `cls` names classes from the module.
const Lines = ({x, y, lines, cls = ['s'], step = 17, anchor}) =>
  lines.map((line, i) => (
    <text key={i} x={x} y={y + i * step} className={cx(...cls)} textAnchor={anchor}>
      {line}
    </text>
  ));

// A connector. `flow` overlays a slow-moving dash so the reader sees direction; it is hidden
// under prefers-reduced-motion.
const Wire = ({d, id, both, v, flow, dashed}) => {
  const marker = v ? `${id}-${v}` : id;
  return (
    <>
      <path
        d={d}
        className={cx(v === 'soft' ? 'wireSoft' : 'wire', v && v !== 'soft' && `wire_${v}`, dashed && 'dashed')}
        markerEnd={`url(#${marker})`}
        markerStart={both ? `url(#${marker})` : undefined}
      />
      {flow && <path d={d} className={cx('flow', v && v !== 'soft' && `flow_${v}`)} />}
    </>
  );
};

const Pill = ({x, y, w, h = 24, v = 'box', text, cls, dashed}) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={h / 2} className={cx(v, dashed && 'dashed')} />
    <text x={x + w / 2} y={y + h / 2 + 4} className={cx('s', 'pillText', cls)} textAnchor="middle">
      {text}
    </text>
  </g>
);

// Small icons drawn in SVG, centered on (0,0).
const LockIcon = ({x, y, cls = 'tOk'}) => (
  <g transform={`translate(${x} ${y})`} className={cx('icon', cls)}>
    <path d="M-3.5 -1V-4a3.5 3.5 0 0 1 7 0V-1" className={s.iconStroke} />
    <rect x={-6} y={-1} width={12} height={9} rx={2} className={s.iconFill} />
  </g>
);
const PencilIcon = ({x, y, cls = 'tMut'}) => (
  <g transform={`translate(${x} ${y})`} className={cx('icon', cls)}>
    <path d="M-6 6l1.6-5.2 7-7 3.6 3.6-7 7z" className={s.iconFill} />
    <path d="M-6 6l5.2-1.6" className={s.iconStroke} />
  </g>
);
const Check = ({x, y, cls = 'tOk', r = 7}) => (
  <g transform={`translate(${x} ${y})`} className={cx('icon', cls)}>
    <circle r={r} className={s.iconFill} />
    <path d="M-3 0.2l2 2 4-4.4" className={s.iconCheck} />
  </g>
);

// 1. The swap: one request before and after v1.110.0.
export function SwapDiagram() {
  const id = 'rr-swap';
  return (
    <Fig
      n="01"
      eyebrow="BEFORE AND AFTER v1.110.0"
      title="Every routing decision now comes from one Rust core"
      viewBox="0 0 760 290"
      label="Before v1.110.0, a request from the SDK or proxy went through the Python litellm.Router, which did name resolution, selection, retries, fallbacks, cooldowns and health, before reaching providers. Now the request goes through a thin Python Router API into the Rust core, which does the same work, and on to the same providers."
      caption="The Python API callers use stays in place. Everything behind it now runs in Rust.">
      <Markers id={id} />

      <text x="20" y="30" className={s.e}>BEFORE</text>
      <Box x={20} y={44} w={130} h={84} />
      <Lines x={85} y={81} lines={['SDK / proxy']} cls={['t']} anchor="middle" />
      <Lines x={85} y={101} lines={['your request']} anchor="middle" />
      <Box x={200} y={44} w={340} h={84} v="py" shadow />
      <Lines x={222} y={74} lines={['litellm.Router (Python)']} cls={['t', 'tPy']} />
      <Lines x={222} y={96} lines={['name resolution · selection · retries', 'fallbacks · cooldowns · health']} />
      <Box x={590} y={44} w={150} h={84} />
      <Lines x={665} y={81} lines={['Providers']} cls={['t']} anchor="middle" />
      <Lines x={665} y={101} lines={['OpenAI, Anthropic, …']} anchor="middle" />
      <Wire d="M150 86H198" id={id} />
      <Wire d="M540 86H588" id={id} />

      <text x="20" y="176" className={s.e}>NOW</text>
      <Box x={20} y={186} w={130} h={84} />
      <Lines x={85} y={223} lines={['SDK / proxy']} cls={['t']} anchor="middle" />
      <Lines x={85} y={243} lines={['same request']} anchor="middle" />
      <Box x={200} y={186} w={110} h={84} v="py" />
      <Lines x={255} y={223} lines={['Router API']} cls={['t', 'tPy']} anchor="middle" />
      <Lines x={255} y={243} lines={['Python, thin']} anchor="middle" />
      <Box x={340} y={186} w={200} h={84} v="rs" shadow />
      <Lines x={440} y={218} lines={['Rust core']} cls={['t', 'tRs']} anchor="middle" />
      <Lines x={440} y={239} lines={['all the same logic,', 'one source of truth']} anchor="middle" />
      <Box x={590} y={186} w={150} h={84} />
      <Lines x={665} y={223} lines={['Providers']} cls={['t']} anchor="middle" />
      <Lines x={665} y={243} lines={['unchanged']} anchor="middle" />
      <Wire d="M150 228H198" id={id} flow />
      <Wire d="M310 228H338" id={id} flow />
      <Wire d="M540 228H588" id={id} flow />
    </Fig>
  );
}

// 2. Everything the router touches.
export function HubDiagram() {
  const id = 'rr-hub';
  return (
    <Fig
      n="02"
      eyebrow="WHY IT'S HARD"
      title="The router sits between everything"
      viewBox="0 0 760 390"
      label="The router sits in the middle, on every request. SDK users and the LiteLLM proxy call it. It reads and writes Redis for cooldowns and usage shared across replicas, and the database for deployments and config. It calls every inference endpoint and fires callbacks and logging."
      caption="Every request crosses the router, and the router reaches into every other part of LiteLLM.">
      <Markers id={id} />

      <rect x={282} y={132} width={196} height={126} rx={18} className={s.halo} />
      <Box x={290} y={140} w={180} h={110} v="py" rx={14} shadow />
      <Lines x={380} y={193} lines={['Router']} cls={['h', 'tPy']} anchor="middle" />
      <Lines x={380} y={215} lines={['on every request']} anchor="middle" />

      <Box x={20} y={70} w={200} h={64} />
      <Lines x={36} y={96} lines={['SDK users']} cls={['t']} />
      <Lines x={36} y={116} lines={['litellm.Router(...)']} cls={['m']} />
      <Box x={20} y={256} w={200} h={64} />
      <Lines x={36} y={282} lines={['LiteLLM proxy']} cls={['t']} />
      <Lines x={36} y={302} lines={['every /v1 request']} />

      <Box x={290} y={20} w={180} h={56} />
      <Lines x={380} y={43} lines={['Redis']} cls={['t']} anchor="middle" />
      <Lines x={380} y={62} lines={['cooldowns, usage, replicas']} anchor="middle" />
      <Box x={290} y={314} w={180} h={56} />
      <Lines x={380} y={337} lines={['Database']} cls={['t']} anchor="middle" />
      <Lines x={380} y={356} lines={['deployments, config']} anchor="middle" />

      <Box x={540} y={70} w={200} h={64} />
      <Lines x={556} y={96} lines={['Every inference endpoint']} cls={['t']} />
      <Lines x={556} y={116} lines={['chat, embeddings, images, …']} />
      <Box x={540} y={256} w={200} h={64} />
      <Lines x={556} y={282} lines={['Callbacks & logging']} cls={['t']} />
      <Lines x={556} y={302} lines={['success, failure, spend']} />

      <Wire d="M220 102L288 170" id={id} flow />
      <text x={268} y={122} className={s.wl} textAnchor="middle">calls</text>
      <Wire d="M220 288L288 220" id={id} flow />
      <text x={272} y={278} className={s.wl} textAnchor="middle">calls</text>
      <Wire d="M380 138V78" id={id} both />
      <text x={370} y={112} className={s.wl} textAnchor="end">reads · writes</text>
      <Wire d="M380 252V312" id={id} both />
      <text x={370} y={286} className={s.wl} textAnchor="end">reads · writes</text>
      <Wire d="M470 170L538 102" id={id} flow />
      <text x={486} y={114} className={s.wl} textAnchor="middle">calls out</text>
      <Wire d="M470 220L538 288" id={id} flow />
      <text x={492} y={286} className={s.wl} textAnchor="middle">fires</text>
    </Fig>
  );
}

// 3. Refactor first, then swap the core.
const NEW_API = ['registry()', 'settings()', 'health()', 'select()', 'apply(ChangeSet)', '+ more'];

export function PlanDiagram() {
  const id = 'rr-plan';
  const apiRows = (x, cls) =>
    NEW_API.map((name, i) => (
      <g key={name}>
        {name.startsWith('+') ? (
          <text x={x} y={110 + i * 16} className={cx('m', 'tMuted')}>{name}</text>
        ) : (
          <>
            <circle cx={x + 5} cy={106 + i * 16} r={3} className={cx('dot', cls)} />
            <text x={x + 16} y={110 + i * 16} className={cx('m', cls)}>{name}</text>
          </>
        )}
      </g>
    ));
  return (
    <Fig
      n="03"
      eyebrow="THE PLAN"
      title="Refactor in Python first, then swap the core"
      viewBox="0 0 760 295"
      label="Three stages. Start: a Python router grown over years with near-duplicate methods, drawn as tangled lines. Step one, refactor: the same Python router behind a new API of registry, settings, health, select, apply and more. Step two, swap: a Rust core behind that same API. A differential test compared old against refactored for step one, and the Python core against the Rust core for step two."
      caption="Each step is behavior-preserving on its own, so each one gets its own differential test.">
      <Markers id={id} />

      <Box x={20} y={30} w={200} h={170} />
      <Lines x={36} y={54} lines={['START']} cls={['e']} />
      <Lines x={36} y={78} lines={['Python router']} cls={['t']} />
      <Lines x={36} y={98} lines={['grown over years,', 'near-duplicate methods']} />
      <g transform="translate(0 2)">
        <path className={s.tangle} d="M36 160C60 128 84 182 110 146S150 170 168 140S196 158 204 150" />
        <path className={s.tangle} d="M36 146C64 176 92 132 118 166S158 132 176 164S198 148 204 166" />
        <path className={s.tangle} d="M36 172C58 150 90 156 114 136S156 178 180 152S200 140 204 136" />
      </g>

      <Box x={280} y={30} w={200} h={170} v="py" shadow />
      <Lines x={296} y={54} lines={['STEP 1 · REFACTOR']} cls={['e', 'tPy']} />
      <Lines x={296} y={78} lines={['Python router, new API']} cls={['t', 'tPy']} />
      {apiRows(296, 'tPy')}

      <Box x={540} y={30} w={200} h={170} v="rs" shadow />
      <Lines x={556} y={54} lines={['STEP 2 · SWAP']} cls={['e', 'tRs']} />
      <Lines x={556} y={78} lines={['Rust core']} cls={['t', 'tRs']} />
      {apiRows(556, 'tRs')}

      <Wire d="M220 110H278" id={id} v="py" />
      <text x={249} y={101} className={s.wl} textAnchor="middle">refactor</text>
      <Wire d="M480 110H538" id={id} v="rs" />
      <text x={509} y={101} className={s.wl} textAnchor="middle">swap</text>

      {/* Brackets: each differential test spans the two states it compares. */}
      <path d="M120 200V222H372V200" className={s.bracket} />
      <Pill x={146} y={207} w={200} h={30} v="ok" cls="tOk" text="diff test: old ↔ refactored" />
      <path d="M388 200V262H640V200" className={s.bracket} />
      <Pill x={399} y={247} w={230} h={30} v="ok" cls="tOk" text="diff test: Python core ↔ Rust core" />
    </Fig>
  );
}

// 4. Old router members and the entry point each one now points to.
const API_GROUPS = [
  {to: 'select()', sub: 'picks, without calling', v: 'ok', old: ['async_get_available_deployment', 'async_get_healthy_deployments', 'get_available_deployment_for_pass_through']},
  {to: 'health()', sub: 'cooldowns, blocks, usage', v: 'ok', old: ['is_deployment_blocked', 'cooldown_cache']},
  {to: 'registry()', sub: 'which deployments exist', v: 'ok', old: ['get_model_list', 'get_deployment']},
  {to: 'settings()', sub: 'a frozen snapshot', v: 'ok', old: ['get_settings', 'cooldown_time, allowed_fails, …']},
  {to: 'apply(ChangeSet)', sub: 'upsert · delete · settings', v: 'mut', old: ['upsert_deployment', 'delete_deployment', 'update_settings']},
];

export function ApiMapDiagram() {
  const id = 'rr-api';
  const rows = [];
  const targets = [];
  let y = 50;
  for (const group of API_GROUPS) {
    const top = y;
    for (const name of group.old) {
      rows.push({name, y, group});
      y += 34;
    }
    const bottom = y - 6;
    targets.push({...group, top, h: bottom - top});
    y += 18;
  }
  const height = y + 32;
  return (
    <Fig
      n="04"
      eyebrow="OLD API → NEW API"
      title="Only one entry point changes the router"
      viewBox={`0 0 760 ${height}`}
      label="Old router members map onto new entry points. select, health, registry and settings only read, marked with a lock. apply with a ChangeSet will change the router, marked with a pencil: upsert_deployment, delete_deployment and update_settings all become apply."
      caption="A sample of the old members. Each one still works, and logs a deprecation warning naming its replacement.">
      <Markers id={id} />
      <text x="20" y="30" className={s.e}>OLD ROUTER MEMBERS</text>
      <text x="460" y="30" className={s.e}>NEW ENTRY POINT</text>
      {targets.map(t => (
        <rect key={`band-${t.to}`} x={10} y={t.top - 8} width={740} height={t.h + 16} rx={12} className={s.band} />
      ))}
      {rows.map(row => {
        const target = targets.find(t => t.to === row.group.to);
        const ty = target.top + target.h / 2;
        const ry = row.y + 14;
        return <Wire key={`w-${row.name}`} v="soft" d={`M340 ${ry}C402 ${ry} 398 ${ty} 458 ${ty}`} id={id} />;
      })}
      {rows.map(row => (
        <g key={row.name}>
          <rect x={20} y={row.y} width={320} height={28} rx={7} className={s.box} />
          <text x={32} y={row.y + 18} className={s.m}>{row.name}</text>
        </g>
      ))}
      {targets.map(t => (
        <g key={t.to}>
          <rect x={460} y={t.top} width={280} height={t.h} rx={10} className={cx(t.v, 'shadow', t.v === 'mut' && 'focal')} />
          <text x={480} y={t.top + t.h / 2 - 3} className={cx('m', 'mBold', t.v === 'mut' ? 'tMut' : 'tOk')}>
            {t.to}
          </text>
          <text x={480} y={t.top + t.h / 2 + 15} className={s.s}>{t.sub}</text>
          {t.v === 'mut' ? <PencilIcon x={716} y={t.top + t.h / 2} /> : <LockIcon x={716} y={t.top + t.h / 2} />}
        </g>
      ))}
      <LockIcon x={28} y={height - 16} />
      <text x={44} y={height - 12} className={s.s}>reads, never changes the router</text>
      <PencilIcon x={268} y={height - 16} />
      <text x={284} y={height - 12} className={s.s}>will change the router</text>
    </Fig>
  );
}

// 5. Differential testing: one case through two black boxes.
export function DiffTestDiagram() {
  const id = 'rr-diff';
  const output = y => (
    <g>
      <Box x={480} y={y} w={140} h={80} />
      <Lines x={496} y={y + 26} lines={['picked b', '1 retry', 'a cooling down']} cls={['m']} step={18} />
    </g>
  );
  return (
    <Fig
      n="05"
      eyebrow="DIFFERENTIAL TESTING"
      title="Same case in, same behavior out?"
      viewBox="0 0 760 300"
      label="One case: model gpt-4o, deployments a and b, a answers 429 and b answers 200. It runs through A, the Python core, and B, the Rust core, both black boxes. Both pick b after one retry, with a cooling down. The oracle compares the two outputs and reports them the same."
      caption="The oracle never asks whether b was the right pick. It only asks whether both cores picked b.">
      <Markers id={id} />

      <Box x={20} y={50} w={200} h={200} />
      <Lines x={36} y={76} lines={['ONE CASE']} cls={['e']} />
      <Lines x={36} y={108} lines={['model: gpt-4o', 'deployments: a, b', 'a answers 429', 'b answers 200']} cls={['m']} step={24} />

      <Wire d="M220 150H245V90H268" id={id} flow />
      <Wire d="M220 150H245V210H268" id={id} flow />

      <Box x={270} y={50} w={170} h={80} v="py" shadow />
      <circle cx={292} cy={72} r={10} className={s.badgePy} />
      <text x={292} y={76} className={s.badgeText} textAnchor="middle">A</text>
      <Lines x={365} y={85} lines={['Python core']} cls={['t', 'tPy']} anchor="middle" />
      <Lines x={365} y={105} lines={['black box']} anchor="middle" />
      <Box x={270} y={170} w={170} h={80} v="rs" shadow />
      <circle cx={292} cy={192} r={10} className={s.badgeRs} />
      <text x={292} y={196} className={s.badgeText} textAnchor="middle">B</text>
      <Lines x={365} y={205} lines={['Rust core']} cls={['t', 'tRs']} anchor="middle" />
      <Lines x={365} y={225} lines={['black box']} anchor="middle" />

      <Wire d="M440 90H478" id={id} v="py" />
      <Wire d="M440 210H478" id={id} v="rs" />
      {output(50)}
      {output(170)}

      <Wire d="M620 90H648" id={id} v="ok" />
      <Wire d="M620 210H648" id={id} v="ok" />
      <Box x={650} y={50} w={90} h={200} v="ok" shadow />
      <Lines x={695} y={76} lines={['ORACLE']} cls={['e', 'tOk']} anchor="middle" />
      <text x={695} y={156} className={cx('glyph', 'tOk')} textAnchor="middle">=</text>
      <Check x={695} y={196} r={9} />
      <Lines x={695} y={226} lines={['same']} cls={['t', 'tOk']} anchor="middle" />
    </Fig>
  );
}

// 6. litefuzz: world, case, lanes, channels, normalizer, oracle.
const CHANNELS = ['client response', 'provider requests', 'DB writes', 'Redis', 'callbacks', 'router state'];

export function LitefuzzDiagram() {
  const id = 'rr-fuzz';
  const lanes = [
    {y: 120, v: 'py', name: 'lane py', sub: 'reference', dashed: false},
    {y: 196, v: 'py', name: 'lane aa', sub: 'same build again, catches noise', dashed: true},
    {y: 272, v: 'rs', name: 'lane rust', sub: 'the change under test', dashed: false},
  ];
  return (
    <Fig
      n="06"
      eyebrow="INSIDE LITEFUZZ"
      title="World, case, channels, oracle"
      viewBox="0 0 760 380"
      label="A case of requests and provider replies runs inside a world of config, seeded database rows, Redis, Postgres and fake providers. It runs on three lanes: py, the reference; aa, the same build again to catch noise; and rust, the change under test. Each lane's channels are captured: client response, provider requests, database writes, Redis, callbacks and router state. A normalizer strips ids and times, an oracle asks whether the lanes agree, and differences become findings."
      caption="The aa lane runs the reference build twice. Anything that differs between py and aa is noise, not a finding.">
      <Markers id={id} />

      <Box x={20} y={150} w={120} h={90} />
      <Lines x={36} y={174} lines={['CASE']} cls={['e']} />
      <Lines x={36} y={196} lines={['requests +', 'provider replies']} />

      <rect x={165} y={40} width={280} height={310} rx={14} className={s.frame} />
      <Lines x={181} y={64} lines={['WORLD']} cls={['e']} />
      <Lines x={181} y={84} lines={['config.yaml · seeded DB rows · Redis', 'Postgres · fake providers']} />

      {lanes.map(lane => (
        <g key={lane.name}>
          <Box x={185} y={lane.y} w={240} h={56} v={lane.v} dashed={lane.dashed} />
          <text x={201} y={lane.y + 24} className={cx('t', lane.v === 'rs' ? 'tRs' : 'tPy')}>{lane.name}</text>
          <text x={201} y={lane.y + 43} className={s.s}>{lane.sub}</text>
          <Wire d={`M140 195H162V${lane.y + 28}H183`} id={id} />
          <path d={`M425 ${lane.y + 28}H450`} className={s.wireSoft} />
        </g>
      ))}
      <path d="M450 148V300" className={s.wireSoft} />
      <Wire d="M450 195H466" id={id} />

      <rect x={468} y={40} width={138} height={310} rx={14} className={s.frame} />
      <Lines x={484} y={64} lines={['CHANNELS']} cls={['e']} />
      {CHANNELS.map((name, i) => (
        <Pill key={name} x={478} y={86 + i * 38} w={118} h={30} text={name} />
      ))}

      <Wire d="M606 195H628" id={id} />
      <Box x={630} y={170} w={110} h={50} shadow />
      <Lines x={685} y={191} lines={['normalize']} cls={['t']} anchor="middle" />
      <Lines x={685} y={209} lines={['strip ids, times']} anchor="middle" />
      <Wire d="M685 220V238" id={id} />
      <Box x={630} y={240} w={110} h={50} v="ok" shadow />
      <Lines x={685} y={261} lines={['oracle']} cls={['t', 'tOk']} anchor="middle" />
      <Lines x={685} y={279} lines={['lanes agree?']} anchor="middle" />
      <Wire d="M685 290V308" id={id} v="bad" />
      <Box x={630} y={310} w={110} h={50} v="bad" shadow />
      <Lines x={685} y={331} lines={['findings']} cls={['t', 'tBad']} anchor="middle" />
      <Lines x={685} y={349} lines={['by hypothesis']} anchor="middle" />
    </Fig>
  );
}

// 7. Coverage-guided mutation, as a flowchart: mutate one field of a case, run both lanes, and
// keep the mutant only if it finds a difference or reaches a new line.
const SEED = ['model: "claude-sonnet-5"', 'num_retries: 3', 'deployments: a, b', 'a → 429, b → 200'];
// [field, new value, realistic?]: realistic values a user might send, and edge-case garbage.
const MUTATIONS = [
  ['model', '"claude-opus-5"', true],
  ['model', '"anthropic/*"', true],
  ['model', '""', false],
  ['model', '"🦀"', false],
  ['num_retries', '0', true],
  ['num_retries', '-1', false],
  ['num_retries', '2^63', false],
];

// A flowchart decision: a diamond centered on (x, y).
const Diamond = ({x, y, hw = 92, hh = 42, text}) => (
  <g>
    <path d={`M${x} ${y - hh}L${x + hw} ${y}L${x} ${y + hh}L${x - hw} ${y}Z`} className={cx('box', 'shadow')} />
    <text x={x} y={y + 5} className={s.t} textAnchor="middle">{text}</text>
  </g>
);

export function MutationDiagram() {
  const id = 'rr-mut';
  return (
    <Fig
      n="07"
      eyebrow="COVERAGE-GUIDED MUTATION"
      title="Keep a mutant only if it earns its place"
      viewBox="0 0 760 500"
      label="Flowchart. A seed case from the corpus asks for model claude-sonnet-5 with num_retries 3, across deployments a and b, where a answers 429 and b answers 200. One field is mutated: the model becomes claude-opus-5 or the wildcard anthropic/*, which are realistic, or an empty string or a crab emoji, which are edge cases; num_retries becomes 0, which is realistic, or -1 or two to the sixty-third, which are edge cases. The mutant runs on both lanes, py and rust, with line coverage. Decision: do the lanes differ? If yes, add it to the corpus, which seeds the next round. If no, decision: did it reach a new line? If yes, add it to the corpus too. If no, discard it."
      caption="Realistic values reach the code real traffic reaches; edge-case values find the inputs nobody thought to test. litefuzz mixes both.">
      <Markers id={id} />

      {/* Corpus, with the seed case spelled out. */}
      <rect x={30} y={30} width={200} height={160} rx={10} className={s.stack} />
      <rect x={25} y={35} width={200} height={160} rx={10} className={s.stack} />
      <Box x={20} y={40} w={200} h={160} shadow />
      <Lines x={36} y={64} lines={['CORPUS']} cls={['e']} />
      <Lines x={36} y={86} lines={['seed case']} cls={['t']} />
      <Lines x={36} y={114} lines={SEED} cls={['m']} step={20} />

      {/* Mutate one field. */}
      <Box x={262} y={20} w={240} h={214} />
      <Lines x={278} y={44} lines={['MUTATE ONE FIELD']} cls={['e']} />
      {MUTATIONS.map(([field, value, real], i) => (
        <text key={i} x={278} y={72 + i * 20} className={s.m}>
          <tspan className={s.tMuted}>{field}: </tspan>
          <tspan className={cx('mBold', real ? 'tPy' : 'tMut')}>{value}</tspan>
        </text>
      ))}
      <circle cx={282} cy={212} r={4} className={s.badgePy} />
      <text x={292} y={216} className={s.s}>realistic</text>
      <circle cx={372} cy={212} r={4} className={s.mut} />
      <text x={382} y={216} className={s.s}>edge case</text>

      {/* Run both lanes. */}
      <Box x={545} y={60} w={190} h={84} shadow />
      <Lines x={640} y={86} lines={['run both lanes']} cls={['t']} anchor="middle" />
      <Pill x={583} y={96} w={52} h={20} v="py" cls="tPy" text="py" />
      <Pill x={643} y={96} w={52} h={20} v="rs" cls="tRs" text="rust" />
      <Lines x={640} y={134} lines={['with line coverage']} anchor="middle" />

      <Diamond x={640} y={268} text="Lanes differ?" />
      <Diamond x={640} y={384} text="New line hit?" />

      {/* Outcomes: both yes branches add the mutant to the corpus; discard is a terminator. */}
      <rect x={372} y={367} width={150} height={34} rx={6} className={s.ok} />
      <text x={447} y={388} className={cx('s', 'pillText', 'tOk')} textAnchor="middle">Add to corpus</text>
      <Pill x={580} y={454} w={120} h={34} v="ghost" text="Discard" dashed />

      <Wire d="M220 110H260" id={id} flow />
      <Wire d="M502 102H543" id={id} flow />
      <Wire d="M640 144V224" id={id} flow />
      <Wire d="M548 268H447V365" id={id} v="ok" />
      <text x={536} y={260} className={s.wl} textAnchor="middle">yes</text>
      <Wire d="M640 310V340" id={id} />
      <text x={650} y={330} className={s.wl}>no</text>
      <Wire d="M548 384H524" id={id} v="ok" />
      <text x={536} y={376} className={s.wl} textAnchor="middle">yes</text>
      <Wire d="M640 426V452" id={id} />
      <text x={650} y={444} className={s.wl}>no</text>
      <Wire d="M372 384H120V202" id={id} v="ok" flow />
      <Lines x={246} y={376} lines={['seeds the next round']} anchor="middle" />
    </Fig>
  );
}

// 8. How agents build a suite: behaviors, cases, then a coverage push.
export function AgentPipelineDiagram() {
  const id = 'rr-agents';
  const cards = [
    {x: 20, n: 'ROUND 1', title: 'Find the behaviors', lines: ['Agents list what the module', 'does, and gap-finders compare', 'the lists. This repeats until', 'no new gaps turn up.'], exit: 'a settled list of behaviors'},
    {x: 267, n: 'ROUND 2', title: 'Write the cases', lines: ['One agent writes cases for', 'each behavior. Ephemeral', 'workers run them on both', 'sides and record coverage.'], exit: 'until new cases add little'},
    {x: 514, n: 'ROUND 3', title: 'Push coverage', lines: ['Mutation rounds come first.', 'Then agents trace back from', 'each uncovered line to build', 'a case that reaches it.'], exit: 'difficult lines to review'},
  ];
  const grid = [1, 1, 1, 1, 1, 2, 0, 0, 1, 1, 1, 1, 2, 2, 0, 0, 1, 1, 1, 2, 0, 0, 0, 0]; // 1 hit, 2 new this round, 0 not yet
  const code = [
    {indent: 0, w: 120, hit: true},
    {indent: 14, w: 96, hit: true},
    {indent: 28, w: 84, hit: true},
    {indent: 28, w: 72, hit: false},
    {indent: 14, w: 104, hit: true},
    {indent: 0, w: 60, hit: true},
  ];
  return (
    <Fig
      n="08"
      eyebrow="BUILDING A SUITE WITH AGENTS"
      title="Refining the test suite"
      viewBox="0 0 760 320"
      label="Three rounds. Round one, find the behaviors: agents list what the module does and gap-finders compare the lists, repeating until no new gaps turn up; drawn as a checklist with one row still marked as a possible gap. Round two, write the cases: one agent writes cases for each behavior, and ephemeral workers run them on both sides and record coverage, until new cases add little; drawn as a grid of lines filling in. Round three, push coverage: mutation rounds first, then agents trace back from each uncovered line to build a case that reaches it; drawn as code lines with one line marked difficult for the orchestrator to review."
      caption="A difficult line ends as one of two things: a harness that needs to be more flexible, or a line that can't be reached at all.">
      <Markers id={id} />
      {cards.map((card, i) => (
        <g key={card.n}>
          <Box x={card.x} y={20} w={226} h={280} v={i === 2 ? 'rs' : 'box'} shadow={i === 2} />
          <Lines x={card.x + 16} y={46} lines={[card.n]} cls={['e', i === 2 ? 'tRs' : null].filter(Boolean)} />
          <Lines x={card.x + 16} y={70} lines={[card.title]} cls={['t']} />
          <Lines x={card.x + 16} y={96} lines={card.lines} step={16} />
          <path d={`M${card.x + 16} 262H${card.x + 210}`} className={s.rule} />
          <Wire d={`M${card.x + 16} 283H${card.x + 28}`} id={id} v="ok" />
          <text x={card.x + 36} y={287} className={cx('s', 'tOk', 'exit')}>{card.exit}</text>
        </g>
      ))}

      <g transform="translate(0 10)">
      {/* Round 1: a checklist of behaviors, with one row still a possible gap. */}
      {[128, 96, 150, 110].map((w, i) => (
        <g key={i}>
          <Check x={46} y={163 + i * 20} />
          <rect x={60} y={158 + i * 20} width={w} height={10} rx={5} className={s.barPy} />
        </g>
      ))}
      <circle cx={46} cy={243} r={7} className={s.gapDot} />
      <rect x={60} y={238} width={118} height={10} rx={5} className={s.barGap} />
      <text x={186} y={247} className={cx('s', 'tMut', 'tag')}>gap?</text>

      {/* Round 2: lines covered so far, filling in as cases land. */}
      {grid.map((v, i) => {
        const col = i % 8;
        const row = Math.floor(i / 8);
        return <rect key={i} x={283 + col * 24} y={156 + row * 24} width={18} height={18} rx={4} className={[s.bar, s.barOk, s.barNew][v]} />;
      })}
      <rect x={283} y={236} width={9} height={9} rx={2} className={s.barOk} />
      <text x={297} y={244} className={cx('s', 'tag')}>hit</text>
      <rect x={329} y={236} width={9} height={9} rx={2} className={s.barNew} />
      <text x={343} y={244} className={cx('s', 'tag')}>new this round</text>
      <rect x={437} y={236} width={9} height={9} rx={2} className={s.bar} />
      <text x={451} y={244} className={cx('s', 'tag')}>not yet</text>

      {/* Round 3: code lines with a coverage gutter; one line resists every case. */}
      {code.map((line, i) => {
        const y = 156 + i * 16;
        return (
          <g key={i}>
            {line.hit ? (
              <path d={`M${541} ${y + 4}l2 2 4-4.4`} className={s.tick} />
            ) : (
              <path d={`M${541} ${y + 1}l6 6M${547} ${y + 1}l-6 6`} className={s.cross} />
            )}
            <rect x={556 + line.indent} y={y} width={line.w} height={8} rx={4} className={line.hit ? s.bar : s.barMut} />
          </g>
        );
      })}
      <Pill x={662} y={194} w={62} h={20} v="mut" cls="tMut" text="difficult" />
      <Wire d="M532 206C520 196 520 170 530 160" id={id} v="mut" dashed />
      </g>
    </Fig>
  );
}
