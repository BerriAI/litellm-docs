import React from 'react';
import ControlPlaneIllustration from './cover.svg';
import styles from './hero.module.css';

export default function GlobalControlPlaneHero() {
  return (
    <div className={styles.hero}>
      <ControlPlaneIllustration
        role="img"
        aria-label="A central LiteLLM control plane manages three independent regional deployments, each with its own gateway and storage."
      />
    </div>
  );
}
