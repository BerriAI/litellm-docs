import React from 'react';
import ControlPlaneIllustration from './cover.svg';
import styles from './hero.module.css';

export default function GlobalControlPlaneHero() {
  return (
    <div className={styles.hero}>
      <ControlPlaneIllustration
        role="img"
        aria-label="The LiteLLM Global Control Plane API manages AWS EKS with Aurora and ElastiCache, Azure AKS with Azure Database for PostgreSQL and Azure Redis, GCP GKE with Cloud SQL and Memorystore, and on-premises Kubernetes with PostgreSQL and Redis. Each deployment has its own database and cache."
      />
    </div>
  );
}
