import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

export default function IdJagScreenshot({ src, alt, caption, width, height }) {
  const imageUrl = useBaseUrl(src);

  return (
    <figure className={styles.figure}>
      <a
        className={styles.frame}
        href={imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Open full-size screenshot"
      >
        <img
          className={styles.image}
          src={imageUrl}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
        />
      </a>
      {caption && <figcaption className={styles.caption}>{caption}</figcaption>}
    </figure>
  );
}
