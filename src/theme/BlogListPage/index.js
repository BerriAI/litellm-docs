import React, {useEffect, useMemo, useState} from 'react';
import clsx from 'clsx';
import Head from '@docusaurus/Head';
import Layout from '@theme/Layout';
import SubscribeForm from '@site/src/components/SubscribeForm';
import PostCard from '@site/src/components/Blog/PostCard';
import {CATEGORIES, categoryOf} from '@site/src/components/Blog/categories';
import {itemScore, queryTokens} from '@site/src/components/Blog/search';
import styles from '@site/src/components/Blog/blog.module.css';

// Sections on the front page, in order, and how many posts each shows.
const SECTIONS = [
  {id: 'launches', count: 4},
  {id: 'autorouter', count: 3},
  {id: 'gateway', count: 3},
  {id: 'engineering', count: 3},
  {id: 'incidents', count: 4, rows: true},
];

// Chip order for readers; categories.js order is matching priority instead.
const CHIP_ORDER = ['launches', 'autorouter', 'gateway', 'engineering', 'incidents', 'rust', 'townhall', 'customers'];

// Pin a post to the top with `featured: true` in its front matter. Otherwise
// the newest post with a cover image that is not a model launch is featured,
// since launches have their own section.
function pickFeatured(items) {
  const pinned = items.find((i) => i.content.metadata.frontMatter?.featured);
  if (pinned) return pinned;
  return (
    items.find((i) => {
      const fm = i.content.metadata.frontMatter || {};
      return fm.image && categoryOf(i.content.metadata.tags).id !== 'launches';
    }) || items[0]
  );
}

function monthKey(date) {
  return new Date(date).toLocaleDateString('en-US', {month: 'long', year: 'numeric', timeZone: 'UTC'});
}

function Archive({items}) {
  const groups = [];
  for (const item of items) {
    const key = monthKey(item.content.metadata.date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({key, items: [item]});
  }
  return (
    <div className={styles.archive}>
      {groups.map((g) => (
        <section key={g.key} className={styles.archiveMonth}>
          <h3 className={styles.archiveHeading}>{g.key}</h3>
          <div className={styles.rows}>
            {g.items.map((item) => (
              <PostCard key={item.content.metadata.permalink} item={item} variant="row" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function readCategoryFromUrl() {
  if (typeof window === 'undefined') return 'all';
  const c = new URLSearchParams(window.location.search).get('c');
  return CATEGORIES.some((cat) => cat.id === c) ? c : 'all';
}

export default function BlogListPage(props) {
  const items = props.items || [];
  const [active, setActive] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => setActive(readCategoryFromUrl()), []);

  const choose = (id) => {
    setActive(id);
    const url = new URL(window.location.href);
    if (id === 'all') url.searchParams.delete('c');
    else url.searchParams.set('c', id);
    window.history.replaceState(null, '', url);
  };

  const byCategory = useMemo(() => {
    const map = Object.fromEntries(CATEGORIES.map((c) => [c.id, []]));
    for (const item of items) map[categoryOf(item.content.metadata.tags).id].push(item);
    return map;
  }, [items]);

  const tokens = queryTokens(query);
  const filtering = active !== 'all' || tokens.length > 0;
  const pool = active === 'all' ? items : byCategory[active];
  const results = filtering
    ? pool
        .map((item, index) => ({item, index, score: itemScore(item, tokens)}))
        .filter(({score}) => score !== null)
        .sort((a, b) => b.score - a.score || a.index - b.index)
        .map(({item}) => item)
    : [];

  const featured = pickFeatured(items);
  const latest = items.filter((i) => i !== featured).slice(0, 4);
  const activeCategory = CATEGORIES.find((c) => c.id === active);

  return (
    <Layout
      title="Blog"
      description="Model launches, Auto Router research, gateway features, and engineering notes from the team building the LiteLLM AI Gateway.">
      <Head>
        <link rel="alternate" type="text/markdown" href="/blog.md" title="LiteLLM blog index (markdown)" />
      </Head>
      <div className={styles.page}>
        <header className={styles.masthead}>
          <div>
            <h1 className={styles.mastTitle}>LiteLLM Blog</h1>
            <p className={styles.mastSub}>
              Model launches on day 0, Auto Router research, gateway features, and what we learn running the most widely used open-source AI
              Gateway.
            </p>
          </div>
          <div className={styles.mastAside}>
            <p className={styles.mastLabel}>New posts in your inbox</p>
            <SubscribeForm />
            <p className={styles.mastLinks}>
              <a href="/blog/rss.xml">RSS</a>
              <a href="/blog.md" title="Every post as a markdown index for coding agents">
                Markdown for agents
              </a>
              <a href="https://jobs.ashbyhq.com/litellm" target="_blank" rel="noopener noreferrer">
                We're hiring
              </a>
            </p>
          </div>
        </header>

        {featured && (
          <section className={styles.lead} aria-label="Featured and latest posts">
            <PostCard item={featured} variant="feature" />
            <div className={styles.latest}>
              <h2 className={styles.latestHeading}>Latest</h2>
              {latest.map((item) => (
                <PostCard key={item.content.metadata.permalink} item={item} variant="compact" />
              ))}
            </div>
          </section>
        )}

        <div className={styles.toolbar}>
          <nav className={styles.chips} aria-label="Filter posts by category">
            <button
              type="button"
              className={clsx(styles.chip, active === 'all' && styles.chipOn)}
              aria-pressed={active === 'all'}
              onClick={() => choose('all')}>
              All <span className={styles.chipCount}>{items.length}</span>
            </button>
            {CHIP_ORDER.map((id) => CATEGORIES.find((c) => c.id === id)).filter((c) => c && byCategory[c.id].length > 1).map((c) => (
              <button
                key={c.id}
                type="button"
                className={clsx(styles.chip, styles[`cat_${c.id}`], active === c.id && styles.chipOn)}
                aria-pressed={active === c.id}
                onClick={() => choose(c.id)}>
                <span className={styles.chipDot} aria-hidden="true" />
                {c.label} <span className={styles.chipCount}>{byCategory[c.id].length}</span>
              </button>
            ))}
          </nav>
          <input
            type="search"
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
            placeholder="Search posts"
            aria-label="Search posts"
            autoComplete="off"
          />
        </div>

        {filtering ? (
          <section className={styles.section} aria-live="polite">
            <div className={styles.sectionHead}>
              <h2 className={clsx(styles.sectionTitle, activeCategory && styles[`cat_${activeCategory.id}`])}>
                {activeCategory && <span className={styles.chipDot} aria-hidden="true" />}
                {activeCategory ? activeCategory.label : 'Search results'}
              </h2>
              <p className={styles.sectionBlurb}>
                {activeCategory?.blurb ? `${activeCategory.blurb} ` : ''}
                {results.length} {results.length === 1 ? 'post' : 'posts'}
                {query ? ` matching "${query}"` : ''}
              </p>
            </div>
            {results.length === 0 ? (
              <p className={styles.empty}>
                No posts match.{' '}
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => {
                    setQuery('');
                    choose('all');
                  }}>
                  Show all posts
                </button>
              </p>
            ) : (
              <div className={styles.grid}>
                {results.map((item) => (
                  <PostCard key={item.content.metadata.permalink} item={item} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {SECTIONS.map(({id, count, rows}) => {
              const cat = CATEGORIES.find((c) => c.id === id);
              const posts = byCategory[id].filter((i) => i !== featured).slice(0, count);
              if (!posts.length) return null;
              return (
                <section key={id} className={styles.section}>
                  <div className={styles.sectionHead}>
                    <h2 className={clsx(styles.sectionTitle, styles[`cat_${id}`])}>
                      <span className={styles.chipDot} aria-hidden="true" />
                      {cat.label}
                    </h2>
                    <p className={styles.sectionBlurb}>{cat.blurb}</p>
                    <button
                      type="button"
                      className={styles.seeAll}
                      onClick={() => {
                        choose(id);
                        window.scrollTo({top: 0});
                      }}>
                      All {byCategory[id].length} posts
                    </button>
                  </div>
                  {rows ? (
                    <div className={styles.rows}>
                      {posts.map((item) => (
                        <PostCard key={item.content.metadata.permalink} item={item} variant="row" />
                      ))}
                    </div>
                  ) : (
                    <div className={clsx(styles.grid, count === 4 && styles.grid4)}>
                      {posts.map((item) => (
                        <PostCard key={item.content.metadata.permalink} item={item} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Every post</h2>
                <p className={styles.sectionBlurb}>Newest first.</p>
              </div>
              <Archive items={items} />
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
