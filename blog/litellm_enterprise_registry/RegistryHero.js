import React, {useState} from 'react';
import animation from './cover.gif';
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
        <img
          src={imageUrl(paused ? poster : animation)}
          width="1600"
          height="800"
          alt="The LiteLLM Enterprise Registry runs on Amazon ECR. An OAuth token from Cognito is exchanged through the registry credentials API for direct package pulls. A separate IAM route fills your Amazon ECR cache and serves later pulls from the cached copy."
        />
      </picture>
      <button type="button" className={styles.control} onClick={() => setPaused(value => !value)}>
        {paused ? 'Play animation' : 'Pause animation'}
      </button>
    </div>
  );
}
