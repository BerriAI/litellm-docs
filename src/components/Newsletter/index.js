import React from 'react';
import SubscribeForm from '@site/src/components/SubscribeForm';
import styles from './styles.module.css';

// "Get the latest LiteLLM updates" with the email field, for the end of blog
// posts, release notes, and the quickstart's next steps.
export default function Newsletter({source}) {
  return (
    <aside className={styles.band} aria-labelledby={`newsletter-${source}`}>
      <div className={styles.copy}>
        <p id={`newsletter-${source}`} className={styles.title}>
          Get the latest LiteLLM updates
        </p>
        <p className={styles.text}>New model support, product launches, and release notes, in your inbox.</p>
      </div>
      <SubscribeForm source={source} className={styles.form} />
    </aside>
  );
}
