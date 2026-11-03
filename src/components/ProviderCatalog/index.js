import React, {useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import {useDocsSidebar} from '@docusaurus/plugin-content-docs/client';
import {Search} from 'lucide-react';
import capabilityData from '@site/src/data/providerCapabilities.json';
import logos from './logos';
import styles from './styles.module.css';

// The grid is built from providersSidebar (sidebars.js): each "sidebar-group-label"
// starts a section and each top-level doc or category under it is a card, so
// the landing page and the sidebar never disagree. Capabilities come from
// src/data/providerCapabilities.json (scripts/update-provider-capabilities.mjs).

const CAPABILITIES = [
  {id: 'chat', label: 'Chat'},
  {id: 'embeddings', label: 'Embeddings'},
  {id: 'images', label: 'Images'},
  {id: 'audio', label: 'Audio'},
  {id: 'video', label: 'Video'},
  {id: 'rerank', label: 'Rerank'},
  {id: 'vector_stores', label: 'Vector stores'},
];
const CAPABILITY_LABEL = Object.fromEntries(CAPABILITIES.map(c => [c.id, c.label]));
// Groups below this label are guides about providers, not providers.
const GUIDES_LABEL = 'Guides';

const docIdFromHref = href => href.replace(/^\/docs\//, '').replace(/\/$/, '');

// A page named like its folder (azure/azure.md) is served at the folder's URL.
function lookup(map, href) {
  const id = docIdFromHref(href);
  return map[id] ?? map[`${id}/index`] ?? map[`${id}/${id.split('/').pop()}`];
}

function countPages(item) {
  if (item.type !== 'category') return 1;
  return 1 + item.items.reduce((n, child) => n + countPages(child), 0);
}

function summary(capabilities) {
  const names = capabilities.map((c, i) => (i === 0 ? CAPABILITY_LABEL[c] : CAPABILITY_LABEL[c].toLowerCase()));
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function useProviderGroups() {
  const sidebar = useDocsSidebar();
  return useMemo(() => {
    const groups = [];
    let current = null;
    for (const item of sidebar?.items ?? []) {
      if (item.type === 'html') {
        current = {label: item.value, cards: []};
        groups.push(current);
        continue;
      }
      if (!current || !item.href || item.href.startsWith('http')) continue;
      const data = lookup(capabilityData, item.href) ?? {capabilities: []};
      current.cards.push({
        label: item.label,
        href: item.href,
        logo: lookup(logos, item.href),
        prefix: data.prefix,
        capabilities: data.capabilities,
        pages: countPages(item),
        group: current.label,
      });
    }
    return groups;
  }, [sidebar]);
}

function ProviderLogo({logo, label}) {
  const src = useBaseUrl(logo ? `/img/providers/${logo}` : '');
  return (
    <span className={styles.logo} aria-hidden="true">
      {logo ? <img src={src} alt="" loading="lazy" /> : <span className={styles.initial}>{label.charAt(0)}</span>}
    </span>
  );
}

function ProviderCard({card}) {
  return (
    <Link to={card.href} className={styles.card}>
      <ProviderLogo logo={card.logo} label={card.label} />
      <span className={styles.body}>
        <span className={styles.name}>{card.label}</span>
        <span className={styles.meta}>
          {card.capabilities.length > 0 ? summary(card.capabilities) : card.group}
          {card.pages > 1 && <span className={styles.pages}>{card.pages} pages</span>}
        </span>
        {card.prefix && <code className={styles.prefix}>{card.prefix}/</code>}
      </span>
    </Link>
  );
}

export default function ProviderCatalog() {
  const groups = useProviderGroups();
  const [query, setQuery] = useState('');
  const [capability, setCapability] = useState(null);

  const providerGroups = groups.filter(g => g.label !== GUIDES_LABEL);
  const guides = groups.find(g => g.label === GUIDES_LABEL);
  const total = providerGroups.reduce((n, g) => n + g.cards.length, 0);

  const q = query.trim().toLowerCase();
  const matches = card =>
    (!capability || card.capabilities.includes(capability)) &&
    (!q || card.label.toLowerCase().includes(q) || (card.prefix ?? '').toLowerCase().includes(q));
  const filtering = Boolean(q || capability);
  const found = filtering
    ? providerGroups.flatMap(g => g.cards).filter(matches).sort((a, b) => a.label.localeCompare(b.label))
    : [];
  const results = filtering
    ? [{label: `${found.length} matching ${found.length === 1 ? 'provider' : 'providers'}`, cards: found}]
    : providerGroups;

  return (
    <div className={styles.catalog}>
      <div className={styles.controls}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${total} providers`}
            aria-label="Search providers"
          />
        </label>
        <div className={styles.chips} role="group" aria-label="Filter by capability">
          <button type="button" className={styles.chip} aria-pressed={!capability} onClick={() => setCapability(null)}>
            All
          </button>
          {CAPABILITIES.map(c => (
            <button
              key={c.id}
              type="button"
              className={styles.chip}
              aria-pressed={capability === c.id}
              onClick={() => setCapability(capability === c.id ? null : c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {results.map(group => (
        <section key={group.label} className={styles.group}>
          <h2 className={styles.groupLabel}>{group.label}</h2>
          {group.cards.length > 0 ? (
            <div className={styles.grid}>
              {group.cards.map(card => (
                <ProviderCard key={card.href} card={card} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              No provider matches. Any OpenAI-compatible endpoint works through the{' '}
              <Link to="/docs/providers/openai_compatible">OpenAI-compatible provider</Link>.
            </p>
          )}
        </section>
      ))}

      {guides && !filtering && (
        <section className={styles.group}>
          <h2 className={styles.groupLabel}>{guides.label}</h2>
          <ul className={styles.guides}>
            {guides.cards.map(card => (
              <li key={card.href}>
                <Link to={card.href}>{card.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
