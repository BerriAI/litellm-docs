import React from 'react';
import RegistryIllustration from './cover.svg';
import styles from './hero.module.css';

export default function RegistryHero() {
  return (
    <div className={styles.hero}>
      <RegistryIllustration
        role="img"
        aria-label="Artifact pulls from the LiteLLM Private Registry on Amazon ECR into a LiteLLM deployment, with OAuth authentication through Amazon Cognito."
      />
    </div>
  );
}
