import React from 'react';
import {useBlogPost} from '@docusaurus/plugin-content-blog/client';
import {PostByline} from '@theme/BlogPostPage';
import styles from './styles.module.css';

export default function LatestAliasesHeader() {
  const {metadata, assets} = useBlogPost();
  return (
    <header data-full-width className={styles.header}>
      <div className={styles.artwork}>
        <img className={styles.cover} src={assets.image} width="1200" height="630" alt="-latest. Same model name. Newer models." />
      </div>
      <div className={styles.heading}>
        <h1>{metadata.title.split(/(-latest)/).map((text, index) =>
          text === '-latest' ? <span key={index} className={styles.alias}>{text}</span> : text,
        )}</h1>
        <PostByline horizontal />
      </div>
    </header>
  );
}
