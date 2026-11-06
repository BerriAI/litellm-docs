import React, {useMemo, useState} from 'react';
import Link from '@docusaurus/Link';
import {useAllDocsData} from '@docusaurus/plugin-content-docs/client';
import {Search} from 'lucide-react';
import {CATEGORIES, ENDPOINTS, PASS_THROUGH} from '@site/src/data/endpoints';
import capabilityData from '@site/src/data/providerCapabilities.json';
import styles from './styles.module.css';

// Cards come from src/data/endpoints.js. Doc ids resolve to real permalinks
// through the docs plugin, so custom slugs and index pages link correctly.

const PROVIDER_COUNTS = {};
for (const entry of Object.values(capabilityData)) {
  for (const c of entry.capabilities ?? []) PROVIDER_COUNTS[c] = (PROVIDER_COUNTS[c] ?? 0) + 1;
}

function useDocUrl() {
  const all = useAllDocsData();
  const paths = useMemo(() => {
    const map = new Map();
    for (const doc of all?.default?.versions?.[0]?.docs ?? []) map.set(doc.id, doc.path);
    return map;
  }, [all]);
  return id => paths.get(id) ?? `/docs/${id}`.replace(/\/index$/, '');
}

function methodClass(method) {
  if (method === 'SDK') return styles.methodSdk;
  if (method.startsWith('WS')) return styles.methodWs;
  if (method.startsWith('GET')) return styles.methodGet;
  return styles.methodPost;
}

function searchText(e) {
  return [e.name, e.path, e.description, e.sdk, ...(e.keywords ?? [])].filter(Boolean).join(' ').toLowerCase();
}

// Stable anchor for each card, e.g. #chat-completions, for deep links and citations.
const anchorId = endpoint => endpoint.id.replace(/_/g, '-');

// Let long paths wrap after a slash instead of inside a word.
const breakablePath = path =>
  path.split('/').map((part, i) => (i === 0 ? part : <React.Fragment key={i}><wbr />/{part}</React.Fragment>));



function EndpointCard({endpoint, docUrl}) {
  const count = endpoint.capability ? PROVIDER_COUNTS[endpoint.capability] : null;
  const anchor = anchorId(endpoint);
  return (
    <div className={styles.card} id={anchor}>
      <div className={styles.route}>
        <span className={`${styles.method} ${methodClass(endpoint.method)}`}>{endpoint.method}</span>
        <code className={styles.path}>{breakablePath(endpoint.path)}</code>
      </div>
      <h3 className={styles.name}>
        <Link to={docUrl(endpoint.doc)} className={styles.mainLink}>
          {endpoint.name}
        </Link>
        <a href={`#${anchor}`} className={styles.anchor} aria-label={`Link to ${endpoint.name}`}>
          #
        </a>
      </h3>
      <p className={styles.description}>{endpoint.description}</p>
      <div className={styles.footer}>
        {endpoint.bridged && <span className={styles.bridged}>Any chat provider</span>}
        {count ? <span>{count} providers</span> : null}
        {endpoint.sdk && <span>Python: {endpoint.sdk}</span>}
      </div>
    </div>
  );
}

export default function EndpointCatalog() {
  const docUrl = useDocUrl();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);

  const q = query.trim().toLowerCase();
  const sections = useMemo(
    () =>
      CATEGORIES.filter(c => !category || c.id === category)
        .map(c => ({
          ...c,
          endpoints: ENDPOINTS.filter(e => e.category === c.id && (!q || searchText(e).includes(q))),
        }))
        .filter(c => c.endpoints.length > 0),
    [q, category],
  );
  const counts = useMemo(() => {
    const m = {};
    for (const e of ENDPOINTS) m[e.category] = (m[e.category] ?? 0) + 1;
    return m;
  }, []);

  return (
    <div className={styles.catalog}>
      <div className={styles.controls}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={`Search ${ENDPOINTS.length} endpoints`}
            aria-label="Search endpoints"
          />
        </label>
        <div className={styles.chips} role="group" aria-label="Filter by category">
          <button type="button" className={styles.chip} aria-pressed={!category} onClick={() => setCategory(null)}>
            All ({ENDPOINTS.length})
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.id}
              type="button"
              className={styles.chip}
              aria-pressed={category === c.id}
              onClick={() => setCategory(category === c.id ? null : c.id)}
            >
              {c.label} ({counts[c.id] ?? 0})
            </button>
          ))}
        </div>
      </div>

      {sections.map(section => (
        <section key={section.id} className={styles.group}>
          <h3 className={styles.groupLabel}>{section.label}</h3>
          <p className={styles.blurb}>{section.blurb}</p>
          <div className={styles.grid}>
            {section.endpoints.map(e => (
              <EndpointCard key={e.id} endpoint={e} docUrl={docUrl} />
            ))}
          </div>
        </section>
      ))}

      {sections.length === 0 && (
        <p className={styles.empty}>
          No endpoint matches. Try a path such as <code>/v1/embeddings</code>, or{' '}
          <a href="https://github.com/BerriAI/litellm/issues/new">open an issue</a> for a missing endpoint.
        </p>
      )}

    </div>
  );
}

// Pass-through providers, rendered separately so the page can place them
// after the comparison of request paths.
// Provider pages are pills; feature pages that apply to every pass-through
// route (cost tracking, guardrails, custom routes) are a separate line.
export function PassThroughList() {
  const docUrl = useDocUrl();
  const providers = PASS_THROUGH.filter(p => p.route).sort((a, b) => a.label.localeCompare(b.label));
  const features = PASS_THROUGH.filter(p => !p.route);
  return (
    <>
      <ul className={styles.ptList}>
        {providers.map(p => (
          <li key={p.doc}>
            <Link to={docUrl(p.doc)} className={styles.ptRow}>
              <span className={styles.ptName}>{p.label}</span>
              <code className={styles.ptRoute}>{p.route}</code>
            </Link>
          </li>
        ))}
      </ul>
      {features.length > 0 && (
        <p className={styles.passFeatures}>
          <span>For every pass-through route:</span>
          {features.map(p => (
            <Link key={p.doc} to={docUrl(p.doc)}>
              {p.label}
            </Link>
          ))}
        </p>
      )}
    </>
  );
}
