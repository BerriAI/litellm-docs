import React from 'react';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import workspace from './workspace.png';
import styles from './styles.module.css';

const sections = [
  ['1-main-architecture', 'Main architecture'],
  ['2-main-challenges', 'Main challenges'],
  ['3-whats-next-and-what-id-recommend', "What's next"],
];

export default function MoyaiHero() {
  const {metadata} = useBlogPost();
  return (
    <>
      <header className={styles.hero}>
        <div className={styles.heading}>
          <time className={styles.date} dateTime="2026-10-01">October 1, 2026</time>
          <h1 className={styles.title}>{metadata.title}</h1>
          <p className={styles.subtitle}>An engineering agent our team can use from Slack or the web.</p>
        </div>
        <figure className={styles.product}>
          <div className={styles.window}>
            <img src={workspace} width="2400" height="1350" fetchPriority="high"
              alt="Moyai Devin's web interface with a chat, five worker sessions in the sidebar, and tool activity." />
          </div>
          <figcaption>The Moyai Devin interface, shown with an example session.</figcaption>
        </figure>
        <div className={styles.stack} aria-label="The five services">
          <span>Render</span><span>Modal</span><span>Hermes</span><span>Temporal</span><span>LiteLLM</span>
        </div>
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
