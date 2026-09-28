import React, {useId, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import AgentPrompt from './AgentPrompt';
import Command from './Command';
import SalesButton from './SalesButton';
import {GATEWAY_COMPOSE} from './content';
import {IconAudit, IconEnterprise, IconGateway, IconRegions, IconRoles, IconSdk, IconSso, IconSupport} from './icons';
import {track, usePrefersReducedMotion} from './shared';
import styles from './styles.module.css';

const PATHS = [
  {
    id: 'sdk',
    Icon: IconSdk,
    label: 'Just my code',
    hint: 'One Python app, provider keys in your own environment',
  },
  {
    id: 'gateway',
    Icon: IconGateway,
    label: 'My team or several apps',
    hint: 'More than one app or person, any language, and you need to know who spent what',
  },
  {
    id: 'enterprise',
    Icon: IconEnterprise,
    label: 'My whole organization',
    hint: 'Hundreds of users, an identity provider, and a security review',
  },
];

// ---------------------------------------------------------------------------
// Diagram: apps on the left, providers on the right, and what sits between
// them for each path. Geometry is in one 560 x 300 viewBox.

const PROVIDERS = ['OpenAI', 'Anthropic', 'Bedrock', 'Vertex AI', '100+ more'];
const PY = [28, 86, 144, 202, 260]; // provider box tops, 36 tall
const PX = 440; // provider box left
const APP_W = 150;
const GW = {x: 222, y: 84, w: 132, h: 132};
const GW_MID = GW.y + GW.h / 2;

const APPS = {
  sdk: [{label: 'Your Python app', y: 132}],
  gateway: [
    {label: 'Python service', y: 46},
    {label: 'Node.js app', y: 132},
    {label: 'Claude Code', y: 218},
  ],
  enterprise: [
    {label: 'Search team', y: 46},
    {label: 'Support team', y: 132},
    {label: 'Every employee', y: 218},
  ],
};

const curve = (x1, y1, x2, y2) => {
  const mx = (x1 + x2) / 2;
  return `M${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
};

function Flow({d, dur, begin, reduced}) {
  return (
    <>
      <path d={d} className={styles.dgLine} pathLength="1" />
      {!reduced && (
        <circle r="3.2" className={styles.dgDot}>
          <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={d} />
        </circle>
      )}
    </>
  );
}

function Diagram({path, titleId}) {
  const reduced = usePrefersReducedMotion();
  const apps = APPS[path];
  const direct = path === 'sdk';
  const ent = path === 'enterprise';

  return (
    <svg className={styles.diagram} viewBox="0 0 560 300" role="img" aria-labelledby={titleId}>
      <title id={titleId}>
        {direct
          ? 'Your app calls every provider directly through the LiteLLM SDK.'
          : ent
            ? 'Every team and employee reaches every provider through one LiteLLM Gateway with SSO, audit logs, roles, and regions around it.'
            : 'Several apps reach every provider through one LiteLLM Gateway that issues keys and tracks spend.'}
      </title>

      {/* flows are keyed by path so they redraw on every change */}
      <g key={path} className={styles.dgFlows}>
        {direct
          ? PY.map((py, i) => (
              <Flow
                key={i}
                d={curve(16 + APP_W, 150, PX, py + 18)}
                dur="2.6s"
                begin={`${i * 0.45}s`}
                reduced={reduced}
              />
            ))
          : [
              ...apps.map((a, i) => (
                <Flow key={`a${i}`} d={curve(16 + APP_W, a.y + 18, GW.x, GW_MID)} dur="1.6s" begin={`${i * 0.5}s`} reduced={reduced} />
              )),
              ...PY.map((py, i) => (
                <Flow key={`p${i}`} d={curve(GW.x + GW.w, GW_MID, PX, py + 18)} dur="1.6s" begin={`${0.8 + i * 0.35}s`} reduced={reduced} />
              )),
            ]}
      </g>

      {/* apps */}
      {apps.map((a) => (
        <g key={`${path}-${a.label}`} className={styles.dgAppIn}>
          <rect x="16" y={a.y} width={APP_W} height="36" rx="8" className={styles.dgApp} />
          <text x="30" y={a.y + 23} className={styles.dgText}>
            {a.label}
          </text>
          {direct && (
            <>
              <rect x={16 + APP_W - 62} y={a.y + 44} width="62" height="24" rx="6" className={styles.dgChipStrong} />
              <text x={16 + APP_W - 31} y={a.y + 60} textAnchor="middle" className={styles.dgChipTextStrong}>
                litellm
              </text>
            </>
          )}
        </g>
      ))}

      {/* gateway */}
      <g className={clsx(styles.dgGateway, direct && styles.dgHidden)}>
        <rect x={GW.x - 16} y={GW.y - 30} width={GW.w + 32} height={GW.h + 60} rx="18" className={clsx(styles.dgRing, !ent && styles.dgHidden)} />
        {ent &&
          [
            ['SSO', GW.x - 4, GW.y - 30],
            ['Audit log', GW.x + 58, GW.y - 30],
            ['Roles', GW.x - 4, GW.y + GW.h + 30],
            ['Regions', GW.x + 60, GW.y + GW.h + 30],
          ].map(([label, x, y]) => (
            <g key={label} className={styles.dgAppIn}>
              <rect x={x} y={y - 11} width={label.length * 7.4 + 18} height="22" rx="11" className={styles.dgPill} />
              <text x={x + 9} y={y + 4.5} className={styles.dgPillText}>
                {label}
              </text>
            </g>
          ))}
        <rect x={GW.x} y={GW.y} width={GW.w} height={GW.h} rx="14" className={styles.dgGw} />
        <text x={GW.x + GW.w / 2} y={GW.y + 26} textAnchor="middle" className={styles.dgGwTitle}>
          LiteLLM Gateway
        </text>
        {['Virtual keys', 'Budgets', 'Spend logs'].map((c, i) => (
          <g key={c}>
            <rect x={GW.x + 14} y={GW.y + 40 + i * 28} width={GW.w - 28} height="22" rx="6" className={styles.dgChip} />
            <text x={GW.x + GW.w / 2} y={GW.y + 55 + i * 28} textAnchor="middle" className={styles.dgChipText}>
              {c}
            </text>
          </g>
        ))}
      </g>

      {/* providers */}
      {PROVIDERS.map((p, i) => (
        <g key={p}>
          <rect x={PX} y={PY[i]} width="104" height="36" rx="8" className={clsx(styles.dgProvider, i === 4 && styles.dgProviderMore)} />
          <text x={PX + 52} y={PY[i] + 23} textAnchor="middle" className={styles.dgText}>
            {p}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------

// Each path has a short description beside the diagram (side) and the one
// thing to do next across the full width below it (main).
function actionFor(path, source) {
  if (path === 'sdk') {
    return {
      side: <p className={styles.pfLead}>Call any model from Python with one function. Responses come back in the OpenAI format whichever provider you use, with retries and fallbacks built in.</p>,
      main: (
        <>
          <Command code="uv add litellm" id="pathfinder:sdk" small />
          <AgentPrompt id="sdk" compact />
          <div className={styles.pfLinks}>
            <Link className={styles.btnSecondary} to="/docs/#quick-start">
              SDK quickstart
            </Link>
          </div>
        </>
      ),
    };
  }
  if (path === 'gateway') {
    return {
      side: (
        <p className={styles.pfLead}>
          One OpenAI-compatible endpoint for every app and every model, with virtual keys, budgets, spend tracking, and an admin UI.
          Runs on your machine in about five minutes.
        </p>
      ),
      main: (
        <>
          <Command code={GATEWAY_COMPOSE} id="pathfinder:gateway" note="Gateway + Postgres on :4000, admin UI at /ui" small />
          <AgentPrompt id="gateway" compact />
          <div className={styles.pfLinks}>
            <Link className={styles.btnSecondary} to="/docs/proxy/docker_quick_start">
              Gateway quickstart
            </Link>
          </div>
        </>
      ),
    };
  }
  const items = [
    [IconSso, 'Sign in with Okta, Entra ID, Google, or any OIDC and SAML provider'],
    [IconAudit, 'Audit logs of every admin action and key change'],
    [IconRoles, 'Delegated admins, so no one shares the master key'],
    [IconRegions, 'Multi-region deployment under one license'],
    [IconSupport, 'A support channel with the engineers, 24/7 SLAs available'],
  ];
  return {
    side: (
      <>
        <p className={styles.pfLead}>The same Gateway, plus what a security review asks for. Self-hosted, so prompts never leave your environment.</p>
        <ul className={styles.pfList}>
          {items.map(([Icon, text]) => (
            <li key={text}>
              <Icon size={20} />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </>
    ),
    main: (
      <div className={styles.pfLinks}>
        <SalesButton source={`${source}-pathfinder`} />
        <SalesButton kind="trial" variant="secondary" source={`${source}-pathfinder`} />
        <Link className={styles.textLink} to="/docs/enterprise">
          Compare open source and Enterprise
        </Link>
      </div>
    ),
  };
}

export default function PathFinder({initial = 'gateway', question = 'Who is calling the models?', source = 'docs'}) {
  const [path, setPath] = useState(initial);
  const action = actionFor(path, source);
  const baseId = useId();
  const refs = useRef([]);

  const choose = (id) => {
    setPath(id);
    track('docs_path_selected', {path: id, source});
  };
  const onKey = (e, i) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = (i + dir + PATHS.length) % PATHS.length;
    choose(PATHS[next].id);
    refs.current[next]?.focus();
  };

  return (
    <section className={styles.pf} aria-labelledby={`${baseId}-q`}>
      <p id={`${baseId}-q`} className={styles.pfQuestion}>
        {question}
      </p>
      <div className={styles.pfOptions} role="radiogroup" aria-labelledby={`${baseId}-q`}>
        {PATHS.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={path === p.id}
            tabIndex={path === p.id ? 0 : -1}
            className={clsx(styles.pfOption, path === p.id && styles.pfOptionOn)}
            onClick={() => choose(p.id)}
            onKeyDown={(e) => onKey(e, i)}>
            <span className={styles.pfOptionIcon}>
              <p.Icon size={26} />
            </span>
            <span className={styles.pfOptionLabel}>{p.label}</span>
            <span className={styles.pfOptionHint}>{p.hint}</span>
          </button>
        ))}
      </div>
      <div className={styles.pfStage}>
        <div className={styles.pfDiagram}>
          <Diagram path={path} titleId={`${baseId}-dg`} />
        </div>
        <div key={`${path}-side`} className={clsx(styles.pfPanel, styles.pfSide)}>
          {action.side}
        </div>
        <div key={`${path}-main`} className={clsx(styles.pfPanel, styles.pfMain)}>
          {action.main}
        </div>
      </div>
      <p className={styles.pfFoot}>
        Paths connect. The SDK can call a Gateway as just another provider, and Enterprise is a license key on the same Gateway image.
      </p>
    </section>
  );
}
