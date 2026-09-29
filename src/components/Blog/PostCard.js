import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Cover from './Cover';
import {categoryOf} from './categories';
import styles from './blog.module.css';

export function formatDate(date, long = false) {
  return new Date(date).toLocaleDateString('en-US', {
    month: long ? 'long' : 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// Cover image for a list item: the resolved asset when Docusaurus provides
// one, else an absolute front matter path. Relative paths without a resolved
// asset are skipped so the drawn cover is used instead of a broken image.
export function coverImage(item) {
  const fm = item.content.metadata.frontMatter || {};
  const asset = item.content.assets?.image;
  if (asset) return asset;
  if (typeof fm.image === 'string' && /^(\/|https?:)/.test(fm.image)) return fm.image;
  return null;
}

function Authors({authors, avatars}) {
  if (!authors?.length) return null;
  return (
    <span className={styles.authors}>
      {avatars && (
        <span className={styles.avatars} aria-hidden="true">
          {authors.slice(0, 3).map((a) =>
            a.imageURL ? <img key={a.name} src={a.imageURL} alt="" width="22" height="22" loading="lazy" /> : null,
          )}
        </span>
      )}
      <span>{authors.map((a) => a.name).join(', ')}</span>
    </span>
  );
}

export default function PostCard({item, variant = 'card'}) {
  const post = item.content.metadata;
  const category = categoryOf(post.tags);
  const image = coverImage(item);

  if (variant === 'row') {
    return (
      <Link to={post.permalink} className={styles.row}>
        <time className={styles.rowDate} dateTime={post.date}>
          {formatDate(post.date)}
        </time>
        <span className={styles.rowMain}>
          <span className={styles.rowTitle}>{post.title}</span>
          {post.description && <span className={styles.rowDesc}>{post.description}</span>}
        </span>
        <span className={clsx(styles.catTag, styles[`cat_${category.id}`])}>{category.label}</span>
      </Link>
    );
  }

  if (variant === 'compact') {
    return (
      <Link to={post.permalink} className={clsx(styles.compact, !image && styles.compactText)}>
        <Cover image={image} size="sm" />
        <span className={styles.compactBody}>
          <span className={clsx(styles.catText, styles[`cat_${category.id}`])}>{category.label}</span>
          <span className={styles.compactTitle}>{post.title}</span>
          <time className={styles.meta} dateTime={post.date}>
            {formatDate(post.date)}
          </time>
        </span>
      </Link>
    );
  }

  const feature = variant === 'feature';
  return (
    <Link to={post.permalink} className={clsx(!feature && 'lite-cardgrid__cell', styles.card, feature && styles.cardFeature, !image && styles.cardText)}>
      <Cover image={image} size={feature ? 'lg' : 'md'} />
      <span className={styles.cardBody}>
        <span className={clsx(styles.catText, styles[`cat_${category.id}`])}>{category.label}</span>
        <span className={styles.cardTitle}>{post.title}</span>
        {post.description && <span className={styles.cardDesc}>{post.description}</span>}
        <span className={styles.meta}>
          <Authors authors={post.authors} avatars={feature} />
          <time dateTime={post.date}>{formatDate(post.date, feature)}</time>
        </span>
      </span>
    </Link>
  );
}
