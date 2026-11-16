import React from 'react';
import ControlPlaneIllustration from './cover.svg';
import styles from './hero.module.css';

export default function GlobalControlPlaneHero() {
  return (
    <div className={styles.hero}>
      <ControlPlaneIllustration
        role="img"
        aria-label="The LiteLLM Global Control Plane API manages an Amazon EKS deployment with Aurora and ElastiCache, and a Kubernetes deployment with PostgreSQL and Redis. Each deployment has its own database and cache."
      />
    </div>
  );
}
