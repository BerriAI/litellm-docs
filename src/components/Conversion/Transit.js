import React, {useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import PromptButton from './PromptButton';
import {PRODUCTS} from './content';
import {usePrefersReducedMotion} from './shared';
import styles from './transit.module.css';

// Route maps drawn like a transit map: lines run straight, turn at 45 degrees,
// and bundle in parallel into an interchange. The interchange holds the real
// LiteLLM monogram with the clear space the logo guidelines ask for (half its
// height on every side). Everything is theme-aware through CSS variables.

// A transit-map line from (x1, y1) to (x2, y2): level, one 45-degree run, level.
export function route(x1, y1, x2, y2) {
  const dy = y2 - y1;
  const a = Math.abs(dy);
  const w = x2 - x1;
  if (a < 0.5) return `M${x1} ${y1} H${x2}`;
  if (a >= w - 4) return `M${x1} ${y1} L${x2} ${y2}`;
  const xa = x1 + (w - a) / 2;
  return `M${x1} ${y1} H${xa} L${xa + a} ${y2} H${x2}`;
}

function Monogram({x, y, size}) {
  const blue = useBaseUrl('/img/brand/litellm-monogram-blue.svg');
  const white = useBaseUrl('/img/brand/litellm-monogram-white.svg');
  return (
    <>
      <image href={blue} x={x} y={y} width={size} height={size} className={styles.monoLight} />
      <image href={white} x={x} y={y} width={size} height={size} className={styles.monoDark} />
    </>
  );
}

function Car({d, dur, begin}) {
  return (
    // Hidden until its first run starts, so it never waits at the origin
    <rect className={styles.car} x="-8" y="-3.5" width="16" height="7" rx="2.5" opacity="0">
      <set attributeName="opacity" to="1" begin={begin} fill="freeze" />
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={d} rotate="auto" />
    </rect>
  );
}

// ---------------------------------------------------------------------------
// The "Who is calling the models?" diagram, one layout per answer.

const PROVIDERS = ['OpenAI', 'Anthropic', 'Bedrock', 'Agent Platform', '100+ more'];
const PY = [34, 99, 164, 229, 294];
const APPS_Y = [64, 164, 264];
const APPS = {
  gateway: ['Python service', 'Node.js app', 'Claude Code'],
  enterprise: ['Search team', 'Support team', 'Every employee'],
};
const HUB = {x: 300, y: 104, s: 120};
const HUB_CY = HUB.y + HUB.s / 2;
const BOX_W = 146;
const PROV_X = 560;

// What the interchange does, under its name.
const CHIPS = {
  sdk: [
    ['completion()', 82],
    ['Fallbacks', 64],
    ['Cost per call', 84],
  ],
  gateway: [
    ['Virtual keys', 70],
    ['Budgets', 54],
    ['Spend logs', 70],
  ],
};

const TITLES = {
  sdk: 'Inside your Python process, the LiteLLM SDK calls every provider directly: one completion() call with fallbacks and cost per call.',
  gateway: 'Several apps reach every provider through one LiteLLM Gateway that issues virtual keys, enforces budgets, and logs spend.',
  enterprise:
    'Every team and employee reaches every provider through the LiteLLM Gateway inside your organization, with SSO, audit logs, roles, and regions on its edge.',
};

function AppBox({y, label}) {
  return (
    <g>
      <rect className={styles.box} x="12.5" y={y - 17.5} width={BOX_W} height="35" rx="6" />
      <text className={styles.boxText} x="26" y={y + 4.5}>
        {label}
      </text>
      <rect className={styles.stn} x={BOX_W + 6.5} y={y - 5.5} width="11" height="11" rx="3" />
    </g>
  );
}

function ProviderBox({y, label, more}) {
  return (
    <g>
      <rect className={clsx(styles.box, more && styles.boxMore)} x={PROV_X + 0.5} y={y - 15.5} width="152" height="31" rx="6" />
      <text className={clsx(styles.boxText, more && styles.boxTextMore)} x={PROV_X + 76} y={y + 4.5} textAnchor="middle">
        {label}
      </text>
      <rect className={clsx(styles.stn, more && styles.stnMore)} x={PROV_X - 5.5} y={y - 5.5} width="11" height="11" rx="3" />
    </g>
  );
}

function Tag({x, y, label, anchor = 'middle'}) {
  const w = label.length * 6 + 14;
  const left = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return (
    <g>
      <rect className={styles.tag} x={left} y={y - 8} width={w} height="16" rx="4" />
      <text className={styles.tagText} x={left + w / 2} y={y + 3.6} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

export function TransitDiagram({path}) {
  const reduced = usePrefersReducedMotion();
  const direct = path === 'sdk';
  const ent = path === 'enterprise';
  const outbound = PY.map((py, j) => route(HUB.x + HUB.s, HUB_CY + (j - 2) * 12, PROV_X - 6, py));
  const inbound = direct ? [`M${BOX_W + 18} ${HUB_CY} H${HUB.x}`] : APPS_Y.map((y, i) => route(BOX_W + 18, y, HUB.x, HUB_CY + (i - 1) * 16));
  const chips = CHIPS[direct ? 'sdk' : 'gateway'];
  const chipsW = chips.reduce((a, [, w]) => a + w, 0) + (chips.length - 1) * 6;
  let chipX = HUB.x + HUB.s / 2 - chipsW / 2;

  return (
    <svg className={styles.svg} viewBox="0 0 720 330" role="img" aria-label={TITLES[path]}>
      <defs>
        <pattern id="tr-dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className={styles.dot} />
        </pattern>
      </defs>
      <rect width="720" height="330" fill="url(#tr-dots)" />

      {direct && (
        <g className={styles.fadeIn}>
          <rect className={styles.zone} x="4.5" y="84.5" width="486" height="216" rx="18" />
          <text className={styles.zoneText} x="18" y="104">
            Your Python process
          </text>
        </g>
      )}
      {ent && (
        <g className={styles.fadeIn}>
          <rect className={styles.zone} x="244.5" y="60.5" width="232" height="240" rx="18" />
          <text className={styles.zoneText} x="258" y="80">
            Your organization
          </text>
        </g>
      )}

      {/* lines redraw on every answer */}
      <g key={path}>
        {inbound.map((d, i) => (
          <path key={`in${i}`} d={d} className={clsx(styles.line, styles.draw)} pathLength="1" />
        ))}
        {outbound.map((d, j) => (
          <path key={`out${j}`} d={d} className={clsx(styles.line, j === 4 ? styles.lineMore : styles.draw)} pathLength="1" />
        ))}
        {!reduced && (
          <g className={styles.cars}>
            {inbound.map((d, i) => (
              <Car key={`ci${i}`} d={d} dur={direct ? '1.4s' : '2.2s'} begin={`${0.8 + i * 0.7}s`} />
            ))}
            {outbound.slice(0, 4).map((d, j) => (
              <Car key={`co${j}`} d={d} dur="2.4s" begin={`${1.4 + j * 0.55}s`} />
            ))}
          </g>
        )}
      </g>

      <g className={styles.fadeIn}>
        {direct ? (
          <>
            <AppBox y={HUB_CY} label="Your Python app" />
            <rect className={styles.tag} x="12.5" y={HUB_CY + 24} width="98" height="18" rx="4" />
            <text className={clsx(styles.tagText, styles.mono)} x="61.5" y={HUB_CY + 37} textAnchor="middle">
              import litellm
            </text>
          </>
        ) : (
          APPS[path].map((label, i) => <AppBox key={label} y={APPS_Y[i]} label={label} />)
        )}
        <rect className={styles.hub} x={HUB.x + 0.5} y={HUB.y + 0.5} width={HUB.s} height={HUB.s} rx="14" />
        <Monogram x={HUB.x + 30} y={HUB.y + 30} size={60} />
        <text className={styles.hubLabel} x={HUB.x + HUB.s / 2} y={HUB.y + HUB.s + 22} textAnchor="middle">
          {direct ? 'LiteLLM SDK' : 'LiteLLM Gateway'}
        </text>
        {chips.map(([label, w]) => {
          const x = chipX;
          chipX += w + 6;
          return (
            <g key={label}>
              <rect className={styles.chip} x={x + 0.5} y={HUB.y + HUB.s + 34.5} width={w} height="20" rx="4" />
              <text className={styles.chipText} x={x + w / 2} y={HUB.y + HUB.s + 48} textAnchor="middle">
                {label}
              </text>
            </g>
          );
        })}
      </g>

      {ent && (
        <g className={styles.fadeIn}>
          <Tag x={244.5} y={96} label="SSO" />
          <Tag x={360} y={60.5} label="Audit log" />
          <Tag x={360} y={300.5} label="Roles" />
          <Tag x={476.5} y={117} label="Regions" />
        </g>
      )}

      {PROVIDERS.map((p, j) => (
        <ProviderBox key={p} y={PY[j]} label={p} more={j === 4} />
      ))}
    </svg>
  );
}

// The same three answers for a phone: apps across the top, the interchange
// in the middle, and providers as stops on one line running down the page.

// The vertical twin of route(): down, one 45-degree run, down.
function vroute(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const a = Math.abs(dx);
  const h = y2 - y1;
  if (a < 0.5) return `M${x1} ${y1} V${y2}`;
  if (a >= h - 4) return `M${x1} ${y1} L${x2} ${y2}`;
  const ya = y1 + (h - a) / 2;
  return `M${x1} ${y1} V${ya} L${x2} ${ya + a} V${y2}`;
}

const T_HUB = {x: 125, y: 150, s: 110};
const T_APPS_X = [62, 180, 298];
// Providers in two rows under the interchange. The second row sits under the
// gaps in the first, so its lines pass between the first row's tiles.
const T_PROV = [
  {x: 60, y: 372, w: 100},
  {x: 180, y: 372, w: 100},
  {x: 300, y: 372, w: 100},
  {x: 120, y: 428, w: 110},
  {x: 240, y: 428, w: 110},
];
// Which hub exit (left to right) feeds which provider, so no lines cross
const T_EXIT = [0, 2, 4, 1, 3];

export function TransitTall({path}) {
  const reduced = usePrefersReducedMotion();
  const direct = path === 'sdk';
  const ent = path === 'enterprise';
  const hubCx = T_HUB.x + T_HUB.s / 2;
  const hubBottom = T_HUB.y + T_HUB.s;
  const inbound = direct ? [`M${hubCx} 64 V${T_HUB.y}`] : T_APPS_X.map((x, i) => vroute(x, 64, hubCx + (i - 1) * 15, T_HUB.y));
  const outbound = T_PROV.map((p, j) => vroute(hubCx - 30 + T_EXIT[j] * 15, hubBottom, p.x, p.y - 22));
  const chips = CHIPS[direct ? 'sdk' : 'gateway'];
  const labels = direct ? ['Your Python app'] : APPS[path];

  return (
    <svg className={styles.svg} viewBox="0 0 360 462" role="img" aria-label={TITLES[path]}>
      <defs>
        <pattern id="tr-dots-tall" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className={styles.dot} />
        </pattern>
      </defs>
      <rect width="360" height="462" fill="url(#tr-dots-tall)" />

      {direct && (
        <g className={styles.fadeIn}>
          <rect className={styles.zone} x="6.5" y="8.5" width="347" height="290" rx="18" />
          <text className={styles.zoneText} x="20" y="84">
            Your Python process
          </text>
        </g>
      )}
      {ent && (
        <g className={styles.fadeIn}>
          <rect className={styles.zone} x="8.5" y="120.5" width="343" height="176" rx="18" />
          <text className={styles.zoneText} x="22" y="146">
            Your organization
          </text>
        </g>
      )}

      <g key={path}>
        {inbound.map((d, i) => (
          <path key={`in${i}`} d={d} className={clsx(styles.line, styles.draw)} pathLength="1" />
        ))}
        {outbound.map((d, j) => (
          <path key={`out${j}`} d={d} className={clsx(styles.line, j === 4 ? styles.lineMore : styles.draw)} pathLength="1" />
        ))}
        {!reduced && (
          <g className={styles.cars}>
            {inbound.map((d, i) => (
              <Car key={`ci${i}`} d={d} dur="1.8s" begin={`${0.8 + i * 0.6}s`} />
            ))}
            {outbound.slice(0, 4).map((d, j) => (
              <Car key={`co${j}`} d={d} dur="2s" begin={`${1.4 + j * 0.5}s`} />
            ))}
          </g>
        )}
      </g>

      <g className={styles.fadeIn}>
        {labels.map((label, i) => {
          const cx = direct ? hubCx : T_APPS_X[i];
          const w = direct ? 150 : 110;
          return (
            <g key={label}>
              <rect className={styles.box} x={cx - w / 2 + 0.5} y="20.5" width={w} height="34" rx="6" />
              <text className={styles.boxTextSm} x={cx} y="42" textAnchor="middle">
                {label}
              </text>
              <rect className={styles.stn} x={cx - 5.5} y="52.5" width="11" height="11" rx="3" />
            </g>
          );
        })}
        <rect className={styles.hub} x={T_HUB.x + 0.5} y={T_HUB.y + 0.5} width={T_HUB.s} height={T_HUB.s} rx="13" />
        <Monogram x={T_HUB.x + 27} y={T_HUB.y + 27} size={56} />
        {/* the name sits left of the interchange and the chips right, so
            the lines below leave the interchange unobstructed */}
        <text className={styles.hubLabel} x={T_HUB.x - 12} y={T_HUB.y + 50} textAnchor="end">
          LiteLLM
        </text>
        <text className={styles.hubLabel} x={T_HUB.x - 12} y={T_HUB.y + 68} textAnchor="end">
          {direct ? 'SDK' : 'Gateway'}
        </text>
        {chips.map(([label, w], i) => (
          <g key={label}>
            <rect className={styles.chip} x={T_HUB.x + T_HUB.s + 12.5} y={T_HUB.y + 20.5 + i * 26} width={w} height="20" rx="4" />
            <text className={styles.chipText} x={T_HUB.x + T_HUB.s + 12 + w / 2} y={T_HUB.y + 34 + i * 26} textAnchor="middle">
              {label}
            </text>
          </g>
        ))}
      </g>

      {ent && (
        <g className={styles.fadeIn}>
          <Tag x={80} y={120.5} label="SSO" />
          <Tag x={280} y={120.5} label="Audit log" />
          <Tag x={80} y={296.5} label="Roles" />
          <Tag x={280} y={296.5} label="Regions" />
        </g>
      )}

      {PROVIDERS.map((name, j) => {
        const p = T_PROV[j];
        const more = j === 4;
        return (
          <g key={name}>
            <rect className={clsx(styles.box, more && styles.boxMore)} x={p.x - p.w / 2 + 0.5} y={p.y - 15.5} width={p.w} height="31" rx="6" />
            <text className={clsx(styles.boxTextSm, more && styles.boxTextMore)} x={p.x} y={p.y + 4.5} textAnchor="middle">
              {name}
            </text>
            <rect className={clsx(styles.stn, more && styles.stnMore)} x={p.x - 5.5} y={p.y - 21.5} width="11" height="11" rx="3" />
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The gateway map: one interchange, three lines out. The AI Gateway line runs
// to model providers, the MCP Gateway line to MCP tools, and the Agent Gateway
// line to other agents. The three pills under the interchange name the lines;
// hovering or focusing one (or tapping it on a phone) lights its route and
// dims the other two.

export const GATEWAYS = [
  {id: 'llm', pill: 'AI Gateway', group: 'Models', items: ['OpenAI', 'Anthropic', 'Bedrock'], more: '100+ more'},
  {id: 'mcp', pill: 'MCP Gateway', group: 'MCP tools', items: ['GitHub', 'Jira'], more: 'Any MCP server'},
  {id: 'a2a', pill: 'Agent Gateway', group: 'Agents', items: ['LangGraph', 'Pydantic AI'], more: 'Any A2A agent'},
];

const CALLERS = {
  gateway: ['Python service', 'Node.js app', 'AI agents', 'Claude Code'],
  enterprise: ['Search team', 'Support team', 'Internal agents', 'Every employee'],
};

const MAP_TITLES = {
  gateway:
    'Apps, AI agents, and coding agents call one LiteLLM Gateway. Its AI Gateway routes to model providers, its MCP Gateway to MCP tools, and its Agent Gateway to other agents, with the same keys, budgets, guardrails, and spend logs.',
  enterprise:
    'Every team, internal agent, and employee calls the LiteLLM Gateway inside your organization, with SSO, audit logs, roles, and regions on its edge. It routes to model providers, MCP tools, and other agents.',
};

// A transit line whose 45-degree run ends exactly at (x2, y2): level first,
// then the run. Used where the usual centered run would cross the pills.
function routeLate(x1, y1, x2, y2) {
  const a = Math.abs(y2 - y1);
  const xa = Math.max(x1, x2 - a);
  return `M${x1} ${y1} H${xa} L${x2} ${y2}`;
}

// A car's path from the interchange to one stop: the trunk, then its branch.
const joined = (trunk, branch) => `${trunk} ${branch.replace(/^M\S+ \S+ ?/, '')}`;

// Which line is lit: hover and keyboard focus preview it, a click or tap pins it.
function useActiveLine() {
  const [hover, setHover] = useState(null);
  const [pinned, setPinned] = useState(null);
  const pillProps = (id) => ({
    role: 'button',
    tabIndex: 0,
    'aria-pressed': (hover ?? pinned) === id,
    'aria-label': `Highlight the ${GATEWAYS.find((g) => g.id === id).pill} route`,
    onPointerEnter: (e) => e.pointerType === 'mouse' && setHover(id),
    onPointerLeave: (e) => e.pointerType === 'mouse' && setHover(null),
    onFocus: () => setHover(id),
    onBlur: () => setHover(null),
    onClick: () => setPinned((p) => (p === id ? null : id)),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setPinned((p) => (p === id ? null : id));
      }
    },
  });
  return [hover ?? pinned, pillProps];
}

function routeClass(active, id) {
  return clsx(styles.route, active && (active === id ? styles.routeOn : styles.routeDim));
}

function Pill({x, y, w, label, on, props}) {
  return (
    <g className={clsx(styles.pill, on && styles.pillOn)} {...props}>
      <rect x={x + 0.5} y={y + 0.5} width={w} height="20" rx="4" />
      <text x={x + w / 2} y={y + 14} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

const pillW = (label) => label.length * 6.1 + 14;

// Wide layout ---------------------------------------------------------------

const G_HUB = {x: 262, y: 120, s: 110};
const G_CX = G_HUB.x + G_HUB.s / 2;
const G_CY = G_HUB.y + G_HUB.s / 2;
const G_CALLER_Y = [85, 145, 205, 265];
const G_JX = 520; // where each line splits to its stops
const G_BX = 572; // stop boxes
const G_BW = 136;
const G_STEP = 31;
const G_FIRST = [40, 184, 300]; // first stop of each group
const G_TRUNK_Y = [145, 175, 205];

function groupStops(g, first) {
  const labels = g.more ? [...g.items, g.more] : g.items;
  return labels.map((label, i) => ({label, y: first + i * G_STEP, more: g.more && i === labels.length - 1}));
}

export function GatewayMap({path = 'gateway'}) {
  const reduced = usePrefersReducedMotion();
  const [active, pillProps] = useActiveLine();
  const ent = path === 'enterprise';
  const callers = CALLERS[ent ? 'enterprise' : 'gateway'];
  const inbound = G_CALLER_Y.map((y, i) => route(BOX_W + 18, y, G_HUB.x, G_CY + (i - 1.5) * 16));
  const lines = GATEWAYS.map((g, gi) => {
    const stops = groupStops(g, G_FIRST[gi]);
    const jy = (stops[0].y + stops[stops.length - 1].y) / 2;
    const x1 = G_HUB.x + G_HUB.s;
    const trunk = gi === 2 ? routeLate(x1, G_TRUNK_Y[gi], G_JX, jy) : route(x1, G_TRUNK_Y[gi], G_JX, jy);
    const branches = stops.map((st) => route(G_JX, jy, G_BX - 6, st.y));
    return {...g, stops, jy, trunk, branches};
  });
  const widths = GATEWAYS.map((g) => pillW(g.pill));
  let px = G_CX - (widths.reduce((a, b) => a + b, 0) + 5 * (widths.length - 1)) / 2;
  const pillY = G_HUB.y + G_HUB.s + 32;

  return (
    <svg className={styles.svg} viewBox="0 0 720 380" role="img" aria-label={MAP_TITLES[path]}>
      <defs>
        <pattern id="gm-dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className={styles.dot} />
        </pattern>
      </defs>
      <rect width="720" height="380" fill="url(#gm-dots)" />

      {ent && (
        <g className={styles.fadeIn}>
          {/* The label sits bottom-left, the one corner no line crosses */}
          <rect className={styles.zone} x="176.5" y="96.5" width="282" height="214" rx="18" />
          <text className={styles.zoneText} x="192" y="302">
            Your organization
          </text>
        </g>
      )}

      <g key={path}>
        {inbound.map((d, i) => (
          <path key={`in${i}`} d={d} className={clsx(styles.line, styles.draw)} pathLength="1" />
        ))}
        {!reduced && (
          <g className={styles.cars}>
            {inbound.map((d, i) => (
              <Car key={`ci${i}`} d={d} dur="2.2s" begin={`${0.8 + i * 0.6}s`} />
            ))}
          </g>
        )}
      </g>

      {lines.map((l, li) => (
        <g key={`${path}-${l.id}`} className={routeClass(active, l.id)}>
          <path d={l.trunk} className={clsx(styles.line, styles.draw)} pathLength="1" />
          {l.branches.map((d, i) => (
            <path key={i} d={d} className={clsx(styles.line, styles.lineBranch, l.stops[i].more ? styles.lineMore : styles.draw)} pathLength="1" />
          ))}
          <circle className={styles.junction} cx={G_JX} cy={l.jy} r="5.5" />
          {!reduced && (
            <g className={styles.cars}>
              {l.branches
                .filter((_, i) => !l.stops[i].more)
                .map((d, i) => (
                  <Car key={i} d={joined(l.trunk, d)} dur="2.6s" begin={`${1.3 + li * 0.45 + i * 0.9}s`} />
                ))}
            </g>
          )}
          <g className={styles.fadeIn}>
            <text className={styles.grp} x={G_BX + 2} y={l.stops[0].y - 21}>
              {l.group}
            </text>
            {l.stops.map((st) => (
              <g key={st.label}>
                <rect className={clsx(styles.box, st.more && styles.boxMore)} x={G_BX + 0.5} y={st.y - 12.5} width={G_BW} height="25" rx="6" />
                <text className={clsx(styles.boxTextSm, st.more && styles.boxTextMore)} x={G_BX + 14} y={st.y + 4.5}>
                  {st.label}
                </text>
                <rect className={clsx(styles.stn, st.more && styles.stnMore)} x={G_BX - 5.5} y={st.y - 5.5} width="11" height="11" rx="3" />
              </g>
            ))}
          </g>
        </g>
      ))}

      <g className={styles.fadeIn}>
        {callers.map((label, i) => (
          <AppBox key={label} y={G_CALLER_Y[i]} label={label} />
        ))}
        <rect className={styles.hub} x={G_HUB.x + 0.5} y={G_HUB.y + 0.5} width={G_HUB.s} height={G_HUB.s} rx="14" />
        <Monogram x={G_CX - 28} y={G_CY - 28} size={56} />
        <text className={styles.hubLabel} x={G_CX} y={G_HUB.y + G_HUB.s + 22} textAnchor="middle">
          LiteLLM Gateway
        </text>
        {GATEWAYS.map((g, i) => {
          const x = px;
          px += widths[i] + 5;
          return <Pill key={g.id} x={x} y={pillY} w={widths[i]} label={g.pill} on={active === g.id} props={pillProps(g.id)} />;
        })}
      </g>

      {ent && (
        <g className={styles.fadeIn}>
          <Tag x={176.5} y={128} label="SSO" />
          <Tag x={400} y={96.5} label="Audit log" />
          <Tag x={330} y={310.5} label="Roles" />
          <Tag x={405} y={310.5} label="Regions" />
        </g>
      )}
    </svg>
  );
}

// Phone layout: callers across the top, the interchange in the middle with
// its name on the left and the pills on the right, and the three lines
// running down into three columns of stops.

const GT_HUB = {x: 125, y: 110, s: 110};
const GT_CX = GT_HUB.x + GT_HUB.s / 2;
const GT_COLS = [62, 180, 298];
const GT_TOP = 330; // where each line turns down its column
const GT_FIRST = 364;
const GT_STEP = 40;
const GT_BW = 108;

export function GatewayMapTall({path = 'gateway'}) {
  const reduced = usePrefersReducedMotion();
  const [active, pillProps] = useActiveLine();
  const ent = path === 'enterprise';
  // Three callers fit across a phone
  const callers = CALLERS[ent ? 'enterprise' : 'gateway'].filter((_, i) => i !== 1);
  const hubBottom = GT_HUB.y + GT_HUB.s;
  const inbound = T_APPS_X.map((x, i) => vroute(x, 64, GT_CX + (i - 1) * 15, GT_HUB.y));
  const lines = GATEWAYS.map((g, gi) => {
    const cx = GT_COLS[gi];
    const labels = g.more ? [...g.items, g.more] : g.items;
    const stops = labels.map((label, i) => ({label, y: GT_FIRST + i * GT_STEP, more: g.more && i === labels.length - 1}));
    const trunk = vroute(GT_CX + (gi - 1) * 15, hubBottom, cx, GT_TOP);
    const last = stops[stops.length - 1].y;
    const firstReal = stops.filter((st) => !st.more);
    const down = `M${cx} ${GT_TOP} V${firstReal[firstReal.length - 1].y - 15}`;
    const toMore = g.more ? `M${cx} ${firstReal[firstReal.length - 1].y + 14} V${last - 15}` : null;
    return {...g, cx, stops, trunk, down, toMore};
  });
  const height = 520;

  return (
    <svg className={styles.svg} viewBox={`0 0 360 ${height}`} role="img" aria-label={MAP_TITLES[path]}>
      <defs>
        <pattern id="gm-dots-tall" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className={styles.dot} />
        </pattern>
      </defs>
      <rect width="360" height={height} fill="url(#gm-dots-tall)" />

      {ent && (
        <g className={styles.fadeIn}>
          <rect className={styles.zone} x="8.5" y="88.5" width="343" height="156" rx="18" />
          <text className={styles.zoneText} x="22" y="108">
            Your organization
          </text>
        </g>
      )}

      <g key={path}>
        {inbound.map((d, i) => (
          <path key={`in${i}`} d={d} className={clsx(styles.line, styles.draw)} pathLength="1" />
        ))}
        {!reduced && (
          <g className={styles.cars}>
            {inbound.map((d, i) => (
              <Car key={`ci${i}`} d={d} dur="1.8s" begin={`${0.8 + i * 0.6}s`} />
            ))}
          </g>
        )}
      </g>

      {lines.map((l, li) => (
        <g key={`${path}-${l.id}`} className={routeClass(active, l.id)}>
          <path d={`${l.trunk} ${l.down.replace(/^M\S+ \S+ ?/, '')}`} className={clsx(styles.line, styles.draw)} pathLength="1" />
          {l.toMore && <path d={l.toMore} className={clsx(styles.line, styles.lineMore)} pathLength="1" />}
          {!reduced && (
            <g className={styles.cars}>
              <Car d={`${l.trunk} ${l.down.replace(/^M\S+ \S+ ?/, '')}`} dur="2.4s" begin={`${1.3 + li * 0.5}s`} />
            </g>
          )}
          <g className={styles.fadeIn}>
            <text className={styles.grp} x={l.cx + 9} y={GT_TOP + 12}>
              {l.group}
            </text>
            {l.stops.map((st) => (
              <g key={st.label}>
                <rect
                  className={clsx(styles.box, st.more && styles.boxMore)}
                  x={l.cx - GT_BW / 2 + 0.5}
                  y={st.y - 13.5}
                  width={GT_BW}
                  height="27"
                  rx="6"
                />
                <text className={clsx(styles.boxTextSm, st.more && styles.boxTextMore)} x={l.cx} y={st.y + 4.5} textAnchor="middle">
                  {st.label}
                </text>
              </g>
            ))}
          </g>
        </g>
      ))}

      <g className={styles.fadeIn}>
        {callers.map((label, i) => (
          <g key={label}>
            <rect className={styles.box} x={T_APPS_X[i] - 55 + 0.5} y="20.5" width="110" height="34" rx="6" />
            <text className={styles.boxTextSm} x={T_APPS_X[i]} y="42" textAnchor="middle">
              {label}
            </text>
            <rect className={styles.stn} x={T_APPS_X[i] - 5.5} y="52.5" width="11" height="11" rx="3" />
          </g>
        ))}
        <rect className={styles.hub} x={GT_HUB.x + 0.5} y={GT_HUB.y + 0.5} width={GT_HUB.s} height={GT_HUB.s} rx="13" />
        <Monogram x={GT_HUB.x + 27} y={GT_HUB.y + 27} size={56} />
        <text className={styles.hubLabel} x={GT_HUB.x - 12} y={GT_HUB.y + 50} textAnchor="end">
          LiteLLM
        </text>
        <text className={styles.hubLabel} x={GT_HUB.x - 12} y={GT_HUB.y + 68} textAnchor="end">
          Gateway
        </text>
        {GATEWAYS.map((g, i) => (
          <Pill
            key={g.id}
            x={GT_HUB.x + GT_HUB.s + 12}
            y={GT_HUB.y + 18 + i * 26}
            w={pillW(g.pill)}
            label={g.pill}
            on={active === g.id}
            props={pillProps(g.id)}
          />
        ))}
      </g>

      {ent && (
        <g className={styles.fadeIn}>
          <Tag x={80} y={88.5} label="SSO" />
          <Tag x={280} y={88.5} label="Audit log" />
          <Tag x={70} y={244.5} label="Roles" />
          <Tag x={290} y={244.5} label="Regions" />
        </g>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// The system map: every LiteLLM product as a line, meeting at the gateway.

const MAP_LINES = [
  {
    id: 'gateway',
    d: 'M470 235 H900',
    stops: [
      [535, 235, 'Virtual keys', 'below', '/docs/proxy/virtual_keys'],
      [610, 235, 'Budgets', 'below', '/docs/proxy/users'],
      [685, 235, 'Spend logs', 'below', '/docs/proxy/cost_tracking'],
      [760, 235, 'Guardrails', 'below', '/docs/proxy/guardrails/quick_start'],
      [835, 235, 'Load balancing', 'above', '/docs/proxy/load_balancing'],
    ],
  },
  {
    id: 'tools',
    d: 'M40 235 H370',
    terminus: [40, 235, 'Your apps', 'above', '/docs/proxy/client_setup/overview'],
    stops: [
      [130, 235, 'Claude Code', 'above', '/docs/proxy/client_setup/claude_code'],
      [210, 235, 'Codex', 'above', '/docs/proxy/client_setup/codex_cli'],
      [290, 235, 'Cursor', 'above', '/docs/proxy/client_setup/overview'],
    ],
  },
  {
    id: 'sdk',
    d: 'M40 420 H790 L940 270',
    terminus: [40, 420, 'Python app', 'below', '/docs/'],
    stops: [
      [170, 420, 'litellm SDK', 'below', '/docs/#installation'],
      [320, 420, 'Router and fallbacks', 'below', '/docs/routing'],
      [470, 420, 'Cost per call', 'below', '/docs/completion/token_usage'],
    ],
  },
  {
    id: 'mcp',
    d: 'M455 185 L505 135 H850',
    terminus: [850, 135, 'MCP Gateway', 'above', '/docs/mcp'],
    stops: [
      [580, 135, 'MCP servers', 'above', '/docs/mcp'],
      [670, 135, 'Tool permissions', 'above', '/docs/mcp_control'],
      [760, 135, 'Cost tracking', 'above', '/docs/mcp_cost'],
    ],
  },
  {
    id: 'agents',
    d: 'M385 185 L335 135 H90',
    terminus: [90, 135, 'Agent Gateway', 'above', '/docs/a2a'],
    stops: [
      [260, 135, 'Agent cards', 'above', '/docs/a2a_agent_card'],
      [180, 135, 'Permissions', 'above', '/docs/a2a_agent_permissions'],
    ],
  },
  {
    id: 'autorouter',
    d: 'M470 272 L533 335 H650',
    terminus: [650, 335, 'Auto Router', 'below', '/docs/auto_router/'],
    stops: [[575, 335, 'Setup', 'below', '/docs/auto_router/setup']],
  },
];


function StopLabel({x, y, label, pos, to, bold}) {
  const ty = pos === 'above' ? y - 14 : y + 23;
  return (
    <Link to={to} className={styles.stopLink}>
      <text className={clsx(styles.stopText, bold && styles.stopTextBold)} x={x} y={ty} textAnchor="middle">
        {label}
      </text>
    </Link>
  );
}

export function SystemMap({source = 'docs-home'}) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(null);
  const lineClass = (id) => clsx(styles[`l_${id}`], active && active !== id && styles.dim);

  return (
    <section className={styles.map} aria-labelledby="system-map-title">
      <div className={styles.mapHead}>
        <div>
          <h2 id="system-map-title" className={styles.mapTitle}>
            Every LiteLLM product, on one map
          </h2>
          <p className={styles.mapLead}>
            Each line is a product and each stop is its guide. Every line meets at the gateway, except the Python SDK, which runs inside your
            app and goes straight to the providers.
          </p>
        </div>
      </div>

      <div className={styles.mapScroll}>
        <svg
          className={clsx(styles.svg, styles.mapSvg)}
          viewBox="0 95 1000 375"
          role="img"
          aria-label="LiteLLM system map. Your apps and AI tools feed the AI Gateway, which reaches 100+ providers through virtual keys, budgets, spend logs, guardrails, and load balancing. The MCP Gateway, the Agent Gateway, and the Auto Router branch off the gateway. Enterprise surrounds the gateway. The Python SDK runs in your app and reaches providers directly.">
          <defs>
            <pattern id="map-dots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" className={styles.dot} />
            </pattern>
          </defs>
          <rect y="95" width="1000" height="375" fill="url(#map-dots)" />

          {/* Enterprise zone around the interchange */}
          <g className={clsx(styles.l_enterprise, active && active !== 'enterprise' && styles.dim)}>
            <rect className={styles.zone} x="350.5" y="160.5" width="140" height="156" rx="16" />
            <Link to="/docs/enterprise" className={styles.stopLink}>
              <rect className={styles.tag} x="175" y="322" width="170" height="17" rx="4" />
              <text className={styles.tagText} x="260" y="334" textAnchor="middle">
                Enterprise: SSO, audit, roles
              </text>
            </Link>
          </g>

          {MAP_LINES.map((l) => (
            <g key={l.id} className={lineClass(l.id)} onMouseEnter={() => setActive(l.id)} onMouseLeave={() => setActive(null)}>
              <path d={l.d} className={styles.mapLine} />
              {!reduced && (
                <rect className={styles.mapCar} x="-8" y="-3.5" width="16" height="7" rx="2.5">
                  <animateMotion dur={`${Math.max(3, l.d.length / 7)}s`} repeatCount="indefinite" path={l.d} rotate="auto" />
                </rect>
              )}
              {l.stops.map(([x, y, label, pos, to]) => (
                <g key={label}>
                  <rect className={styles.mapStn} x={x - 5.5} y={y - 5.5} width="11" height="11" rx="3" />
                  <StopLabel x={x} y={y} label={label} pos={pos} to={to} />
                </g>
              ))}
              {l.terminus && (
                <g>
                  <rect className={styles.mapTerminus} x={l.terminus[0] - 7.5} y={l.terminus[1] - 7.5} width="15" height="15" rx="4" />
                  <StopLabel x={l.terminus[0]} y={l.terminus[1]} label={l.terminus[2]} pos={l.terminus[3]} to={l.terminus[4]} bold />
                </g>
              )}
            </g>
          ))}

          {/* Interchange: the gateway, with the real monogram */}
          <Link to="/docs/simple_proxy" className={styles.stopLink}>
            <rect className={styles.hub} x="370.5" y="185.5" width="100" height="100" rx="12" />
            <Monogram x={395} y={210} size={50} />
          </Link>
          <text className={styles.hubLabel} x="420.5" y="304" textAnchor="middle">
            LiteLLM Gateway
          </text>

          {/* Terminus for every provider */}
          <Link to="/docs/providers" className={styles.stopLink}>
            <rect className={styles.provTerminus} x="900.5" y="200.5" width="90" height="70" rx="10" />
            <text className={styles.provBig} x="945.5" y="232" textAnchor="middle">
              100+
            </text>
            <text className={styles.provSmall} x="945.5" y="250" textAnchor="middle">
              providers
            </text>
          </Link>
        </svg>
      </div>

      <ul className={clsx('lite-cardgrid', styles.legend)}>
        {PRODUCTS.map((l) => (
          <li
            key={l.id}
            className={clsx('lite-cardgrid__cell', styles.legendRow, styles[`l_${l.id}`])}
            onMouseEnter={() => setActive(l.id)}
            onMouseLeave={() => setActive(null)}>
            <span className={clsx(styles.swatch, l.id === 'enterprise' && styles.swatchZone)} aria-hidden="true" />
            <span className={styles.legendBody}>
              <Link to={l.to} className={styles.legendName}>
                {l.name}
              </Link>
              <span className={styles.legendText}>{l.text}</span>
            </span>
            <PromptButton id={l.prompt} source={`${source}-map-${l.id}`} label="Copy prompt" />
          </li>
        ))}
      </ul>
    </section>
  );
}

