import React from 'react';
import RegistryIllustration from './cover.svg';
import styles from './hero.module.css';

export default function RegistryHero() {
  return (
    <div className={styles.hero}>
      <RegistryIllustration
        role="img"
        aria-label="Pull artifacts from the LiteLLM Private Registry on Amazon ECR into your LiteLLM deployment. Amazon Cognito provides OAuth authentication."
      />
    </div>
  );
}
