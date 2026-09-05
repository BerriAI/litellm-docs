import React, {useState} from 'react';
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
    metadata.keywords,
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

// ── Provider marquee ──────────────────────────────────────────────────────
const PROVIDERS = [
  { name: 'OpenAI',        img: 'https://www.google.com/s2/favicons?domain=openai.com&sz=64' },
  { name: 'Anthropic',     img: 'https://www.google.com/s2/favicons?domain=claude.ai&sz=64' },
  { name: 'Google Gemini', img: 'https://www.google.com/s2/favicons?domain=ai.google.dev&sz=64' },
  { name: 'AWS Bedrock',   img: 'https://www.google.com/s2/favicons?domain=aws.amazon.com&sz=64' },
  { name: 'Azure OpenAI',  img: 'https://www.google.com/s2/favicons?domain=azure.microsoft.com&sz=64' },
  { name: 'Mistral AI',    img: 'https://www.google.com/s2/favicons?domain=mistral.ai&sz=64' },
  { name: 'Meta Llama',    img: 'https://www.google.com/s2/favicons?domain=meta.com&sz=64' },
  { name: 'Groq',          img: 'https://www.google.com/s2/favicons?domain=groq.com&sz=64' },
  { name: 'Hugging Face',  img: 'https://www.google.com/s2/favicons?domain=huggingface.co&sz=64' },
  { name: 'Perplexity',    img: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=64' },
  { name: 'DeepSeek',      img: 'https://www.google.com/s2/favicons?domain=deepseek.com&sz=64' },
  { name: 'Cohere',        img: 'https://www.google.com/s2/favicons?domain=cohere.com&sz=64' },
  { name: 'Together AI',   img: 'https://www.google.com/s2/favicons?domain=together.ai&sz=64' },
  { name: 'Vertex AI',     img: 'https://www.google.com/s2/favicons?domain=cloud.google.com&sz=64' },
];

const DOUBLED = [...PROVIDERS, ...PROVIDERS];

function ProviderMarquee() {
  return (
    <div className={styles.marqueeWrap}>
      <p className={styles.marqueeLabel}>Routing to 100+ providers</p>
      <div className={styles.marqueeOuter}>
        <div className={styles.fadeLeft} />
        <div className={styles.fadeRight} />
        <div className={styles.marqueeTrack}>
          {DOUBLED.map((p, i) => (
            <span key={i} className={styles.marqueeItem}>
              <img src={p.img} alt={p.name} width={18} height={18} className={styles.marqueeIcon} />
              <span>{p.name}</span>
              <span className={styles.marqueeSep}>|</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Post row ──────────────────────────────────────────────────────────────
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function AuthorList({authors}) {
  if (!authors || authors.length === 0) return null;
  return (
    <>
      {authors.map((a, i) => (
        <React.Fragment key={a.name}>
          {i > 0 && <span className={styles.authorSep}> </span>}
          {a.url ? (
            <a href={a.url} target="_blank" rel="noopener" className={styles.authorLink}>{a.name}</a>
          ) : (
            <span className={styles.authorName}>{a.name}</span>
          )}
        </React.Fragment>
      ))}
    </>
  );
}

function PostRow({post}) {
  const {title, permalink, date, description, authors} = post;
  return (
    <article className={styles.post}>
      <Link to={permalink} className={styles.titleLink}>
        <h2 className={styles.title}>{title}</h2>
      </Link>
      {description && <p className={styles.desc}>{description}</p>}
      <div className={styles.meta}>
        <AuthorList authors={authors} />
        {authors && authors.length > 0 && <span className={styles.metaDash}> — </span>}
        <time className={styles.date} dateTime={date}>{formatDate(date)}</time>
      </div>
    </article>
  );
}

function Pagination({metadata}) {
  const {previousPage, nextPage} = metadata;
  if (!previousPage && !nextPage) return null;
  return (
    <nav className={styles.pagination} aria-label="Blog list pagination">
      {previousPage ? <Link to={previousPage} className={styles.pageLink}>&larr; Newer posts</Link> : <span />}
      {nextPage ? <Link to={nextPage} className={styles.pageLink}>Older posts &rarr;</Link> : <span />}
    </nav>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function BlogListPage(props) {
  const items = props.items || [];
  const metadata = props.metadata || {};
  const [activeTab, setActiveTab] = useState('all');
  const [query, setQuery] = useState('');
  const tokens = queryTokens(query);
  const filtered = filterItems(items, activeTab)
    .map((item, index) => ({item, index, score: itemScore(item, tokens)}))
    .filter(({score}) => score !== null)
    .sort((first, second) => second.score - first.score || first.index - second.index)
    .map(({item}) => item);

  return (
    <Layout
      title="Engineering Blog"
      description="How we build the world's most widely used open-source AI Gateway. Routing, reliability, observability, and what we learn along the way."
    >
      <div className={styles.page}>
        {/* Hero */}
        <header className={styles.hero}>
          <p className={styles.eyebrow}>AI Gateway</p>
          <h1 className={styles.heroTitle}>Engineering</h1>
          <p className={styles.heroSub}>
            How we build the world's most widely used open-source AI Gateway.
            Routing, reliability, observability, and what we learn along the way.
          </p>
          <a href="https://jobs.ashbyhq.com/litellm" target="_blank" rel="noopener noreferrer" className={styles.hiringBtn}>
            We're hiring!
          </a>
          <div className={styles.subscribeSection}>
            <p className={styles.subscribeLabel}>Get new posts in your inbox</p>
            <SubscribeForm />
          </div>
        </header>

        <ProviderMarquee />

        <div className={styles.searchRow}>
          <input
            type="search"
            className={styles.searchInput}
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Escape') setQuery('');
            }}
            placeholder="Search posts"
            aria-label="Search posts"
            autoComplete="off"
          />
        </div>

        {/* Tabs */}
        <nav className={styles.tabs} aria-label="Filter posts by category">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <p className={styles.resultCount} role="status" aria-live="polite">
          {query ? `${filtered.length} of ${items.length} posts` : ''}
        </p>

        {/* Post list */}
        <main className={styles.list}>
          {filtered.length === 0 && (
            <p className={styles.emptyMsg}>
              {query ? `No posts match "${query}".` : 'No posts on this page match the selected filter.'}
            </p>
          )}
          {filtered.map(({content}) => (
            <PostRow key={content.metadata.permalink} post={content.metadata} />
          ))}
        </main>

        <Pagination metadata={metadata} />
      </div>
    </Layout>
  );
}
