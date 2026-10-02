import React, {useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import SubscribeForm from '@site/src/components/SubscribeForm';
import styles from './styles.module.css';

const TABS = [
  {id: 'all', label: 'All'},
  {id: 'autorouter', label: 'Auto Router'},
  {id: 'engineering', label: 'Engineering'},
  {id: 'ideas', label: 'Ideas'},
  {id: 'security', label: 'Security'},
  {id: 'infrastructure', label: 'Performance / Reliability'},
];

const SECURITY_TAGS = ['security', 'incident-report'];
const INFRA_TAGS = ['performance', 'reliability', 'infrastructure'];
const IDEAS_TAGS = ['ideas', 'thesis'];
const AUTOROUTER_TAGS = ['complexity-router', 'auto-router'];

function hasTag(item, tagSet) {
  const tags = item.content?.metadata?.tags || [];
  return tags.some(t => tagSet.includes(t.label));
}

function filterItems(items, tab) {
  if (tab === 'all') return items;
  if (tab === 'autorouter') return items.filter(i => hasTag(i, AUTOROUTER_TAGS));
  if (tab === 'security') return items.filter(i => hasTag(i, SECURITY_TAGS));
  if (tab === 'infrastructure') return items.filter(i => hasTag(i, INFRA_TAGS));
  if (tab === 'ideas') return items.filter(i => hasTag(i, IDEAS_TAGS));
  return items.filter(i =>
    !hasTag(i, SECURITY_TAGS) &&
    !hasTag(i, INFRA_TAGS) &&
    !hasTag(i, IDEAS_TAGS)
  );
}

function searchableText(item) {
  const metadata = item.content?.metadata || {};
  return [
    metadata.title,
    metadata.description,
    ...(metadata.frontMatter?.keywords || []),
    ...(metadata.tags || []).map(tag => tag.label),
    ...(metadata.authors || []).map(author => author.name),
  ].filter(Boolean).join(' ').toLowerCase();
}

function queryTokens(query) {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function maxEditDistance(token) {
  if (token.length <= 3) return 0;
  if (token.length <= 5) return 1;
  return 2;
}

function levenshteinDistance(first, second, maxDistance) {
  if (Math.abs(first.length - second.length) > maxDistance) return maxDistance + 1;

  let previous = Array.from({length: second.length + 1}, (_, index) => index);
  for (let firstIndex = 1; firstIndex <= first.length; firstIndex++) {
    const current = [firstIndex];
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex++) {
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + (first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1)
      );
    }
    previous = current;
  }

  return previous[second.length];
}

function isSubsequence(token, word) {
  let tokenIndex = 0;
  for (const character of word) {
    if (character === token[tokenIndex]) tokenIndex++;
  }
  return tokenIndex === token.length;
}

function tokenScore(word, token) {
  if (word === token) return 4;
  if (word.startsWith(token)) return 3;
  if (word.includes(token)) return 2;
  if (levenshteinDistance(word, token, maxEditDistance(token)) <= maxEditDistance(token)) return 1;
  if (token.length >= 4 && isSubsequence(token, word)) return 0.5;
  return null;
}

function itemScore(item, tokens) {
  if (tokens.length === 0) return 0;

  const words = searchableText(item).match(/[\p{L}\p{N}]+/gu) || [];
  return tokens.reduce((score, token) => {
    const bestTokenScore = words.reduce((best, word) => {
      const current = tokenScore(word, token);
      return current !== null && current > best ? current : best;
    }, null);

    return score === null || bestTokenScore === null ? null : score + bestTokenScore;
  }, 0);
}

// ── Cards ─────────────────────────────────────────────────────────────────
// Same anatomy as the litellm.ai/blog cards: a 1200:630 cover, a mono
// "TAG · DATE" line, the title and a three-line excerpt.

// The grid shows this many posts after the featured one, then "Load more"
// reveals the next batch, like the website. Hidden cards stay in the HTML so
// every post is still linked from /blog for crawlers.
const PAGE_SIZE = 12;

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    timeZone: 'UTC',
  });
}

function CardImage({item, title}) {
  const image = item.content?.assets?.image || item.content?.metadata?.frontMatter?.image;
  const resolved = useBaseUrl(typeof image === 'string' ? image : '');
  const src = typeof image === 'string' && /^(https?:)?\/\//.test(image) ? image : image ? resolved : null;
  return (
    <div className={styles.cover}>
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" />
      ) : (
        <div className={styles.coverTitle} aria-hidden="true">{title}</div>
      )}
    </div>
  );
}

function PostCard({item, featured = false, hidden = false}) {
  const {title, permalink, date, description, tags} = item.content.metadata;
  const tag = tags && tags[0] ? tags[0].label : '';
  return (
    <Link to={permalink} className={featured ? styles.featured : styles.tile} hidden={hidden}>
      <CardImage item={item} title={title} />
      <div className={styles.tileBody}>
        <div className={styles.tileMeta}>
          {tag && <span>{tag}</span>}
          <time dateTime={date}>{formatDate(date)}</time>
        </div>
        <h2 className={styles.tileTitle}>{title}</h2>
        {description && <p className={styles.tileDesc}>{description}</p>}
      </div>
    </Link>
  );
}

function Pagination({metadata}) {
  const {previousPage, nextPage} = metadata;
  if (!previousPage && !nextPage) return null;
  return (
    <nav className={styles.pagination} aria-label="Blog list pagination">
      {previousPage ? <Link to={previousPage} className={styles.moreBtn}>&larr; Newer posts</Link> : <span />}
      {nextPage ? <Link to={nextPage} className={styles.moreBtn}>Older posts &rarr;</Link> : <span />}
    </nav>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function BlogListPage(props) {
  const items = props.items || [];
  const metadata = props.metadata || {};
  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE_SIZE);
  const tokens = queryTokens(query);
  const filtered = filterItems(items, activeTab)
    .map((item, index) => ({item, index, score: itemScore(item, tokens)}))
    .filter(({score}) => score !== null)
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .map(({item}) => item);

  // The newest post is featured only on the unfiltered first page.
  const featured = !query && activeTab === 'all' && !metadata.previousPage ? filtered[0] : null;
  const rest = featured ? filtered.slice(1) : filtered;

  return (
    <Layout
      title="Engineering Blog"
      description="How we build the world's most widely used open-source AI Gateway. Routing, reliability, observability, and what we learn along the way."
    >
      <div className={styles.page}>
        <div className={styles.frame}>
          <header className={styles.hero}>
            <h1 className={styles.heroTitle}>Blog</h1>
            <p className={styles.heroSub}>
              Insights on routing, reliability, and observability from the team building the most widely used open-source AI gateway.
            </p>
            <div className={styles.subscribe}>
              <SubscribeForm />
              <p className={styles.subscribeNote}>
                <span>Get new posts in your inbox, or follow the <a href="/blog/rss.xml">RSS feed</a>.</span>
                <a href="https://jobs.ashbyhq.com/litellm" target="_blank" rel="noopener noreferrer" className={styles.hiring}>
                  We're hiring
                </a>
              </p>
            </div>
          </header>

          <div className={styles.body}>
            <div className={styles.inner}>
              <div className={styles.bar}>
                <label className={styles.search}>
                  <SearchIcon />
                  <input
                    type="search"
                    value={query}
                    onChange={event => {
                      setQuery(event.target.value);
                      setShown(PAGE_SIZE);
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Escape') setQuery('');
                    }}
                    placeholder="Search posts"
                    aria-label="Search posts"
                    autoComplete="off"
                  />
                </label>
                <nav className={styles.chips} aria-label="Filter posts by category">
                  {TABS.map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      className={styles.chip}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setShown(PAGE_SIZE);
                      }}
                      aria-pressed={activeTab === tab.id}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>

              <p className={styles.resultCount} role="status" aria-live="polite">
                {query ? `${filtered.length} of ${items.length} posts` : ''}
              </p>

              <main>
                {filtered.length === 0 && (
                  <p className={styles.empty}>
                    {query ? `No posts match “${query}”.` : 'No posts on this page match the selected filter.'}
                  </p>
                )}
                {featured && <PostCard item={featured} featured />}
                {rest.length > 0 && (
                  <div className={styles.tiles}>
                    {rest.map((item, index) => (
                      <PostCard key={item.content.metadata.permalink} item={item} hidden={index >= shown} />
                    ))}
                  </div>
                )}
                {rest.length > shown && (
                  <button type="button" className={styles.moreBtn} onClick={() => setShown(shown + PAGE_SIZE)}>
                    Load more posts
                  </button>
                )}
              </main>

              <Pagination metadata={metadata} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
