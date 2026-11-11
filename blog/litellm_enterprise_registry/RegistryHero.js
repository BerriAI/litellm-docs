import React, {useState} from 'react';
import animation from './cover.gif';
import smoothAnimation from './cover.webp';
import poster from './cover.png';
import styles from './hero.module.css';

const imageUrl = image => typeof image === 'string'
  ? image
  : image.src.images.find(variant => variant.width >= 1280)?.path ?? image.src.src;

export default function RegistryHero() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={styles.hero}>
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet={imageUrl(poster)} />
        <source type="image/webp" srcSet={imageUrl(paused ? poster : smoothAnimation)} />
        <img
          src={imageUrl(paused ? poster : animation)}
          width="1600"
          height="800"
          alt="A broad pulse of light travels slowly from the LiteLLM logo to a flowing field of varied gateway pods. The field is sparse at the top, widens toward the bottom, and spills leftward. Workloads glow in sequence to represent a rolling deployment."
        />
      </picture>
      <button type="button" className={styles.control} aria-label={paused ? 'Play animation' : 'Pause animation'} onClick={() => setPaused(value => !value)}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
          {paused ? <path d="M6 3l11 7-11 7z" fill="currentColor" /> : <path d="M5 4h3v12H5zM12 4h3v12h-3z" fill="currentColor" />}
        </svg>
      </button>
    </div>
  );
}
