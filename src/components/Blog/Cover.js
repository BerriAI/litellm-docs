import React from 'react';
import clsx from 'clsx';
import {launchInfo} from './categories';
import styles from './blog.module.css';

// Deterministic 0..1 numbers from a string, so a post's cover never changes
// between builds but two posts in the same category still look different.
function seeded(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}

// One drawn motif per category, in a 400 x 225 frame. Strokes use
// currentColor, which the cover sets to the category's accent.
function Motif({category, seed}) {
  const r = seeded(seed);
  switch (category) {
    case 'launches': {
      // Orbits rising from the lower right: something new coming into view.
      const cx = 330 + r() * 40;
      return (
        <g fill="none" strokeWidth="1.4">
          {[60, 105, 150, 195, 240].map((rad, i) => (
            <circle key={rad} cx={cx} cy={235} r={rad} opacity={0.5 - i * 0.07} />
          ))}
          <circle cx={cx - 105 * Math.cos(0.9 + r() * 0.5)} cy={235 - 105 * Math.sin(0.9 + r() * 0.5)} r="5" fill="currentColor" stroke="none" />
        </g>
      );
    }
    case 'autorouter': {
      // One path splitting into three tiers.
      const y = 70 + r() * 90;
      const ends = [40 + r() * 20, 112 + r() * 10, 180 + r() * 20];
      return (
        <g fill="none" strokeWidth="2" strokeLinecap="round">
          <path d={`M-10 ${y} H150`} opacity="0.7" />
          {ends.map((ey, i) => (
            <path key={i} d={`M150 ${y} C 220 ${y}, 230 ${ey}, 300 ${ey} H410`} opacity={i === 1 ? 0.8 : 0.35} />
          ))}
          <circle cx="150" cy={y} r="7" fill="currentColor" stroke="none" />
        </g>
      );
    }
    case 'engineering': {
      // A latency trace over a grid.
      const pts = Array.from({length: 11}, (_, i) => [i * 40, 150 - r() * 70 - (i > 6 ? 30 : 0)]);
      return (
        <g fill="none">
          {[45, 90, 135, 180].map((gy) => (
            <path key={gy} d={`M0 ${gy} H400`} strokeWidth="1" opacity="0.18" />
          ))}
          <path d={`M${pts.map((p) => p.join(' ')).join(' L')}`} strokeWidth="2.2" strokeLinejoin="round" opacity="0.75" />
        </g>
      );
    }
    case 'incidents': {
      // Concentric rings around one point, like a shield or a blast radius.
      const cx = 290 + r() * 60;
      const cy = 90 + r() * 50;
      return (
        <g fill="none" strokeWidth="1.4">
          {[20, 45, 70, 95, 120].map((rad, i) => (
            <circle key={rad} cx={cx} cy={cy} r={rad} opacity={0.6 - i * 0.1} strokeDasharray={i % 2 ? '3 5' : undefined} />
          ))}
          <circle cx={cx} cy={cy} r="6" fill="currentColor" stroke="none" />
        </g>
      );
    }
    case 'rust': {
      // Interlocking hexagons.
      const hex = (x, y, s) =>
        Array.from({length: 6}, (_, i) => {
          const a = (Math.PI / 3) * i + Math.PI / 6;
          return `${x + s * Math.cos(a)},${y + s * Math.sin(a)}`;
        }).join(' ');
      const ox = 250 + r() * 40;
      return (
        <g fill="none" strokeWidth="1.6">
          <polygon points={hex(ox, 100, 48)} opacity="0.75" />
          <polygon points={hex(ox + 83, 100, 48)} opacity="0.4" />
          <polygon points={hex(ox + 41, 172, 48)} opacity="0.4" />
          <polygon points={hex(ox + 41, 28, 48)} opacity="0.25" />
        </g>
      );
    }
    case 'townhall': {
      // Rows of seats facing one stage.
      const seats = [];
      for (let row = 0; row < 4; row++) {
        for (let i = 0; i < 9 - row; i++) {
          seats.push(<circle key={`${row}-${i}`} cx={190 + i * 24 + row * 12} cy={80 + row * 30} r="5" opacity={0.25 + row * 0.12} fill="currentColor" stroke="none" />);
        }
      }
      return (
        <g>
          {seats}
          <path d="M200 205 H400" strokeWidth="3" opacity="0.6" />
        </g>
      );
    }
    case 'customers': {
      return (
        <g fill="none" strokeWidth="1.6">
          <circle cx={270 + r() * 20} cy="112" r="70" opacity="0.6" />
          <circle cx={340 + r() * 20} cy="112" r="70" opacity="0.35" />
        </g>
      );
    }
    default: {
      // Gateway: many lines funnel through one arch.
      const n = 7;
      return (
        <g fill="none" strokeWidth="1.5" strokeLinecap="round">
          {Array.from({length: n}, (_, i) => {
            const y = 20 + i * (185 / (n - 1));
            return <path key={i} d={`M170 ${y} C 240 ${y}, 250 112, 300 112 H410`} opacity={0.25 + 0.5 * r()} />;
          })}
          <rect x="292" y="92" width="26" height="40" rx="13" fill="currentColor" stroke="none" opacity="0.85" />
        </g>
      );
    }
  }
}

export default function Cover({post, category, image, size = 'md', className}) {
  const isLaunch = category.id === 'launches';
  if (image) {
    return (
      <div className={clsx(styles.cover, styles[`cover_${size}`], className)}>
        <img src={image} alt="" loading="lazy" className={styles.coverImg} />
      </div>
    );
  }
  const {model, provider} = isLaunch ? launchInfo(post.title, post.tags) : {};
  return (
    <div
      className={clsx(styles.cover, styles.coverDrawn, styles[`cover_${size}`], styles[`cat_${category.id}`], className)}
      aria-hidden="true">
      <svg className={styles.coverArt} viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice" stroke="currentColor">
        <Motif category={category.id} seed={post.permalink} />
      </svg>
      {isLaunch ? (
        <div className={styles.coverLaunch}>
          <span className={styles.coverKicker}>
            <span className={styles.coverPill}>Day 0</span>
            {provider}
          </span>
          <span className={styles.coverModel}>{model}</span>
        </div>
      ) : (
        <span className={styles.coverLabel}>{category.label}</span>
      )}
    </div>
  );
}
