import React, {useState} from 'react';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import CloudWorkstationHero from './CloudWorkstationHero';
import styles from './styles.module.css';

const sections = [
  ['1-main-architecture', 'Main architecture'],
  ['2-main-challenges', 'Main challenges'],
  ['3-whats-next-and-what-id-recommend', "What's next"],
];

export default function MoyaiHero() {
  const {metadata} = useBlogPost();
  const [paused, setPaused] = useState(false);
  const publishedDate = new Date(metadata.date).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });

  return (
    <>
      <header className={styles.hero}>
        <div className={styles.heading}>
          <time className={styles.date} dateTime={metadata.date}>{publishedDate}</time>
          <h1 className={styles.title}>{metadata.title}</h1>
          <p className={styles.subtitle}>Our team's cloud coding agent, built with Render and Temporal.</p>
        </div>
        <CloudWorkstationHero paused={paused} setPaused={setPaused} />
      </header>
      <nav className={styles.contents} aria-label="In this post">
        <ol>
          {sections.map(([id, label], index) => (
            <li key={id}>
              <a href={`#${id}`}>
                <span>[{index + 1}]</span>
                <span className={styles.dots} aria-hidden="true" />
                <span>{label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
