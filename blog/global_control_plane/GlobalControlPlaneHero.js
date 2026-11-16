import React from 'react';
import ControlPlaneIllustration from './cover.svg';
import styles from './hero.module.css';

export default function GlobalControlPlaneHero() {
  return (
    <div className={styles.hero}>
      <ControlPlaneIllustration
        role="img"
        aria-label="The LiteLLM Global Control Plane API manages three independent regional deployments, each with its own gateway and storage."
      />
    </div>
  );
}
