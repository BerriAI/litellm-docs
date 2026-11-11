import React, {useState} from 'react';
import animation from './cover.gif';
import poster from './cover.png';
import styles from './hero.module.css';

export default function RegistryHero() {
  const [paused, setPaused] = useState(false);
  return (
    <div className={styles.hero}>
      <picture>
        <source media="(prefers-reduced-motion: reduce)" srcSet={poster} />
        <img
          src={paused ? poster : animation}
          width="1600"
          height="900"
          alt="Packages move from the LiteLLM Enterprise Registry to a deployment after Cognito authorization. A separate IAM route fills an Amazon ECR cache and serves a later pull from the cached copy."
        />
      </picture>
      <button type="button" className={styles.control} onClick={() => setPaused(value => !value)}>
        {paused ? 'Play animation' : 'Pause animation'}
      </button>
    </div>
  );
}
