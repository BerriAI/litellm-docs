import React from 'react';
import Link from '@docusaurus/Link';
import Head from '@docusaurus/Head';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {usePluginData} from '@docusaurus/useGlobalData';
import {useAllDocsData} from '@docusaurus/plugin-content-docs/client';
import styles from './styles.module.css';

const anchorOf = (version) => version.replace(/\./g, '-');

const dateFormat = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});

// Titles and points keep the backticks from summaries.json, so render those as code.
function Inline({text}) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part,
  );
}

export default function ReleaseFeed() {
  const {entries = []} = usePluginData('release-feed') || {};
  const docs = useAllDocsData()['release-notes']?.versions?.[0]?.docs || [];
  const pathById = Object.fromEntries(docs.map((d) => [d.id, d.path]));
  const site = useDocusaurusContext().siteConfig.url.replace(/\/$/, '');

  // schema.org ItemList, so search and answer engines can read each release's
  // title, date and page without parsing the layout.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'LiteLLM Changelog',
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: entries.map((e, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'TechArticle',
        headline: e.title.replace(/`/g, ''),
        description: e.points.join(' ').replace(/`/g, ''),
        datePublished: e.date,
        url: site + (pathById[e.versions[0].id] || e.versions[0].permalink),
      },
    })),
  };

  return (
    <div className={styles.feed}>
      <Head>
        <link rel="alternate" type="application/rss+xml" title="LiteLLM Changelog" href={`${site}/release_notes/rss.xml`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Head>
      {entries.map((e) => {
        const versions = e.versions.filter((v) => pathById[v.id]);
        if (!versions.length) return null;
        const to = pathById[versions[0].id];
        return (
          <article key={versions[0].id} id={anchorOf(versions[0].version)} className={styles.entry}>
            <time className={styles.date} dateTime={e.date}>{dateFormat.format(new Date(e.date))}</time>
            <div className={styles.body}>
              <div className={styles.versions}>
                {versions.map((v) => (
                  <Link key={v.id} to={pathById[v.id]} className={styles.version}>{v.version}</Link>
                ))}
              </div>
              <h2 className={styles.headline}>
                <Link to={to}><Inline text={e.title} /></Link>
              </h2>
              {e.points.length > 0 && (
                <ul className={styles.points}>
                  {e.points.map((p) => <li key={p}><Inline text={p} /></li>)}
                </ul>
              )}
              <Link to={to} className={styles.more}>Read the release notes →</Link>
            </div>
          </article>
        );
      })}
      <p className={styles.older}>Older releases are listed in the sidebar.</p>
    </div>
  );
}
