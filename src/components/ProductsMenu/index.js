import React, {useEffect, useRef, useState} from 'react';
import Link from '@docusaurus/Link';
import {useLocation} from '@docusaurus/router';
import styles from './styles.module.css';

const icon = (paths) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {paths}
  </svg>
);

const ICONS = {
  home: icon(<>
    <path d="M3 11l9-8 9 8" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-6h4v6" />
  </>),
  gateway: icon(<>
    <rect x="3" y="4" width="18" height="7" rx="2" />
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 7.5h.01M7 16.5h.01" />
  </>),
  mcp: icon(<>
    <path d="M9 3v4M15 3v4" />
    <path d="M6 7h12v4a6 6 0 0 1-12 0V7z" />
    <path d="M12 17v4" />
  </>),
  agent: icon(<>
    <circle cx="12" cy="5" r="2.2" />
    <circle cx="5" cy="19" r="2.2" />
    <circle cx="19" cy="19" r="2.2" />
    <path d="M12 7.2v4.3M12 11.5l-5.6 5.4M12 11.5l5.6 5.4" />
  </>),
  router: icon(<>
    <circle cx="5" cy="12" r="2" />
    <circle cx="19" cy="5" r="2" />
    <circle cx="19" cy="19" r="2" />
    <path d="M7 12h3c2.5 0 3-7 7-7M10 12c3 0 3.5 7 7 7" />
  </>),
  sdk: icon(<>
    <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />
  </>),
  logs: icon(<>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-5 3 3 5-7" />
  </>),
  models: icon(<>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </>),
  subscriptions: icon(<>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18M7 15h4" />
  </>),
};

const HOME = {id: 'home', icon: 'home', title: 'Home', desc: 'Get started with LiteLLM', to: '/docs/'};

// Each column holds one or more groups. A group's `featured` items sit first,
// in a highlighted box.
const COLUMNS = [
  [
    {
      featured: [
        {id: 'gateway', icon: 'gateway', title: 'AI Gateway', desc: 'Route and control LLM traffic', to: '/docs/simple_proxy'},
        {id: 'router', icon: 'router', title: 'Auto Router', desc: 'Best model for each request', to: '/docs/autorouter_sdk'},
        {id: 'subscriptions', icon: 'subscriptions', title: 'Claude, Codex & Copilot', desc: 'Use your existing subscriptions', to: '/docs/subscriptions'},
      ],
      items: [
        {id: 'logs', icon: 'logs', title: 'Logging & Observability', short: 'Logging', desc: 'Logs, spend, and callbacks', to: '/docs/proxy/logging'},
      ],
    },
  ],
  [
    {
      items: [
        {id: 'mcp', icon: 'mcp', title: 'MCP Gateway', desc: 'Give agents governed access to tools', to: '/docs/mcp'},
        {id: 'agent', icon: 'agent', title: 'Agent Gateway', desc: 'Register and invoke A2A agents', to: '/docs/a2a'},
        {id: 'sdk', icon: 'sdk', title: 'Python SDK', desc: 'Call 100+ LLMs with one interface', to: '/docs/python_sdk'},
        {id: 'models', icon: 'models', title: 'Model Catalog', desc: 'Pricing and context windows', to: 'https://models.litellm.ai'},
      ],
    },
  ],
];

// Every item gets a cell on one grid, so the rows of both columns line up.
// Row 1 is Home. On desktop each column fills rows 2 and down; on phones the
// columns stack, so the second column continues below the first.
const CELLS = (() => {
  let phoneRow = 2;
  return COLUMNS.flatMap((groups, col) => {
    let row = 2;
    return groups.flatMap((g) => [
      ...(g.featured || []).map((item) => ({item, featured: true})),
      ...g.items.map((item) => ({item, featured: false})),
    ]).map((cell) => ({...cell, col: col + 1, row: row++, phoneRow: phoneRow++}));
  });
})();
const FEATURED_ROWS = CELLS.filter((c) => c.featured).length;
const ROWS = Math.max(...CELLS.map((c) => c.row)) - 1;

const ALL_ITEMS = [HOME, ...COLUMNS.flat().flatMap((g) => [...(g.featured || []), ...g.items])];

// Ordered most-specific first: /docs/proxy/lens must win over the /docs/proxy prefix.
// Lens and Moyai have no menu entry, so their pages show Home.
const SECTION_MATCHERS = [
  ['subscriptions', ({pathname}) => pathname.startsWith('/docs/subscriptions')],
  ['home', ({pathname}) => pathname.startsWith('/docs/self_hosted_coding_agents') || pathname.startsWith('/docs/proxy/lens')],
  ['logs', ({pathname}) => pathname.startsWith('/docs/proxy/logging')],
  ['mcp', ({pathname}) => pathname.startsWith('/docs/mcp')],
  ['agent', ({pathname}) => pathname.startsWith('/docs/a2a')],
  ['sdk', ({pathname, hash}) => pathname.startsWith('/docs/python_sdk') || hash === '#litellm-python-sdk'],
  ['router', ({pathname}) => pathname.startsWith('/docs/auto_router') || pathname.startsWith('/docs/autorouter_sdk')],
  ['gateway', ({pathname}) => pathname.startsWith('/docs/proxy') || pathname.startsWith('/docs/simple_proxy')],
];

function currentItem(location) {
  const hit = SECTION_MATCHERS.find(([, matches]) => matches(location));
  return ALL_ITEMS.find((item) => item.id === (hit ? hit[0] : 'home'));
}

function MenuLink({item, active, onNavigate, className = '', style}) {
  return (
    <Link className={`${styles.item} ${active ? styles.itemActive : ''} ${className}`} style={style}
      to={item.to} onClick={onNavigate}>
      <span className={styles.icon}>{ICONS[item.icon]}</span>
      <span className={styles.text}>
        <span className={styles.title}>{item.title}</span>
        <span className={styles.desc}>{item.desc}</span>
      </span>
      {active && (
        <svg className={styles.check} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </Link>
  );
}

export default function ProductsMenu({mobile}) {
  const location = useLocation();
  const current = currentItem(location);
  const [open, setOpen] = useState(false);
  const leaveTimer = useRef();
  const close = () => {
    clearTimeout(leaveTimer.current);
    setOpen(false);
  };

  useEffect(close, [location.pathname, location.hash]);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  if (mobile) {
    return (
      <li className="menu__list-item">
        <span className="menu__link">{current.title}</span>
        <ul className="menu__list">
          {ALL_ITEMS.map((item) => (
            <li key={item.id} className="menu__list-item">
              <Link className={`menu__link ${item.id === current.id ? 'menu__link--active' : ''}`} to={item.to}>
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </li>
    );
  }

  return (
    <div
      className={`${styles.root} ${open ? styles.open : ''}`}
      // Hover opens it for a mouse only; on touch screens a tap would fire
      // the hover and then the click, opening and closing it at once
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return;
        clearTimeout(leaveTimer.current);
        setOpen(true);
      }}
      // A short grace period, so a pointer cutting across the gap on its way
      // to the panel doesn't close it
      onPointerLeave={(e) => {
        if (e.pointerType === 'mouse') leaveTimer.current = setTimeout(close, 200);
      }}
      onKeyDown={(e) => e.key === 'Escape' && close()}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Products: ${current.title}`}
        title={current.title}
        onClick={() => setOpen((v) => !v)}>
        <span className={styles.triggerIcon}>{ICONS[current.icon]}</span>
        {/* A long name gets a short form on narrower screens */}
        <span className={styles.triggerLabel}>
          {current.short ? (
            <>
              <span className={styles.labelFull}>{current.title}</span>
              <span className={styles.labelShort}>{current.short}</span>
            </>
          ) : (
            current.title
          )}
        </span>
        <svg className={styles.chevron} viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
          <path d="M2 4.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className={styles.panel} role="menu">
        <div className={styles.home}>
          <MenuLink item={HOME} active={current.id === HOME.id} onNavigate={close} />
        </div>
        <span className={styles.featuredBox} style={{gridRow: `2 / span ${FEATURED_ROWS}`}} aria-hidden="true" />
        <span className={styles.divider} style={{gridRow: `2 / span ${ROWS}`}} aria-hidden="true" />
        {CELLS.map(({item, featured, col, row, phoneRow}) => (
          <MenuLink
            key={item.id}
            item={item}
            active={current.id === item.id}
            onNavigate={close}
            className={`${styles.cell} ${col === 1 ? styles.cellLeft : styles.cellRight} ${featured ? styles.itemFeatured : ''}`}
            style={{'--col': col, '--row': row, '--phone-row': phoneRow}}
          />
        ))}
      </div>
    </div>
  );
}
