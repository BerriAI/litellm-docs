import React from 'react';
import clsx from 'clsx';
import styles from './blog.module.css';

// A post's own hero image. Posts without one render as text cards instead;
// nothing is generated in its place.
export default function Cover({image, size = 'md', className}) {
  if (!image) return null;
  return (
    <div className={clsx(styles.cover, styles[`cover_${size}`], className)}>
      <img src={image} alt="" loading="lazy" className={styles.coverImg} />
    </div>
  );
}
