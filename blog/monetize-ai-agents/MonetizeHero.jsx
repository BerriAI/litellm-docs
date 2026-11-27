import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import MonetizeScene from './MonetizeScene';
import {useLoopClock} from './useLoopClock';
import styles from './monetize-hero.module.css';

export default function MonetizeHero() {
  const {ref, elapsed, compact} = useLoopClock({fps: 30, threshold: 0.04, initial: 0, still: 10.5});
  const logoHref = useBaseUrl('/img/brand/litellm-logo-white.png');

  return <section ref={ref} className={styles.hero} data-full-width aria-labelledby="monetize-agents-title">
    <div className={styles.canvas}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>LiteLLM Customer Management</p>
        <h1 id="monetize-agents-title">Monetize your AI agent</h1>
        <p className={styles.subtitle}>Keep every customer's model cost under what they pay you.</p>
      </header>
      <MonetizeScene
        elapsed={elapsed}
        compact={compact}
        logoHref={logoHref}
        className={styles.scene}
        style={{display: 'block', width: '100%', height: 'auto'}}
      />
    </div>
    <p className={styles.screenReaderOnly}>Illustrative agent traffic flows through LiteLLM. Three customers on prepaid credits, per-seat, and usage plans each show what they paid, their model cost, and their margin. The prepaid customer reaches a $60 cap and its requests pause.</p>
  </section>;
}
