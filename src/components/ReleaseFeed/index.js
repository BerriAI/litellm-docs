import React, {useState} from 'react';
import Link from '@docusaurus/Link';
import {usePluginData} from '@docusaurus/useGlobalData';
import {useAllDocsData} from '@docusaurus/plugin-content-docs/client';
import styles from './styles.module.css';

const PAGE = 12;

const dateFormat = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'});

// Points keep the backticks from the release note, so render those as code.
function Inline({text}) {
  return text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part,
  );
}

function Authors({authors}) {
  if (!authors.length) return null;
  const names = authors.length > 2
    ? `${authors.slice(0, 2).map((a) => a.name).join(', ')}, and ${authors.length - 2} other${authors.length > 3 ? 's' : ''}`
    : authors.map((a) => a.name).join(' and ');
  return (
    <div className={styles.authors}>
      <span className={styles.avatars} aria-hidden="true">
        {authors.slice(0, 3).map((a) => (a.image ? <img key={a.name} src={a.image} alt="" loading="lazy" /> : null))}
      </span>
      <span>{names}</span>
    </div>
  );
}

export default function ReleaseFeed() {
  const {releases = []} = usePluginData('release-feed') || {};
  const docs = useAllDocsData()['release-notes']?.versions?.[0]?.docs || [];
  const pathById = Object.fromEntries(docs.map((d) => [d.id, d.path]));
  const [shown, setShown] = useState(PAGE);

  const items = releases.filter((r) => pathById[r.id]);
  return (
    <div className={styles.feed}>
      {items.slice(0, shown).map((r) => {
        const to = pathById[r.id];
        return (
          <article key={r.id} className={styles.entry}>
            <time className={styles.date} dateTime={r.date}>{dateFormat.format(new Date(r.date))}</time>
            <div className={styles.body}>
              <Link to={to} className={styles.version}>{r.version}</Link>
              <h2 className={styles.headline}>
                <Link to={to}><Inline text={r.headline} /></Link>
              </h2>
              {r.points.length > 0 && (
                <ul className={styles.points}>
                  {r.points.map((p) => <li key={p}><Inline text={p} /></li>)}
                </ul>
              )}
              <div className={styles.meta}>
                <Authors authors={r.authors} />
                <Link to={to} className={styles.more}>Read the release notes →</Link>
              </div>
            </div>
          </article>
        );
      })}
      {shown < items.length && (
        <button type="button" className={styles.older} onClick={() => setShown((n) => n + PAGE)}>
          Show older releases
        </button>
      )}
    </div>
  );
}
