import React from 'react';
import wide from './cover.png';
import wideDark from './cover-dark.png';
import mobile from './cover-mobile.png';
import mobileDark from './cover-mobile-dark.png';
import styles from './hero.module.css';
import {CONFIG} from './scene.mjs';

const imageUrl = value => {
  if (typeof value === 'string') return value;
  const variants = value?.src?.images;
  if (variants?.length) return variants.reduce((largest, item) => item.width > largest.width ? item : largest).path;
  return value?.src?.src || value?.src;
};

export default function CopilotHero() {
  return (
    <div className={styles.hero}>
      {[[wide,mobile,styles.light],[wideDark,mobileDark,styles.dark]].map(([desktop,narrow,className]) => (
        <picture className={className} key={className}>
          <source media="(max-width: 600px)" srcSet={imageUrl(narrow)} />
          <img src={imageUrl(desktop)} alt={CONFIG.alt} width={CONFIG.width} height={CONFIG.height} decoding="async" />
        </picture>
      ))}
    </div>
  );
}
