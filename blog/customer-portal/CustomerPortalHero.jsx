import React, {useEffect, useRef, useState} from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import CustomerPortalScene from './CustomerPortalScene';
import styles from './customer-portal-hero.module.css';

export default function CustomerPortalHero() {
  const sectionRef = useRef(null);
  const elapsedRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [compact, setCompact] = useState(false);
  const logoHref = useBaseUrl('/img/brand/litellm-logo-white.png');
  const playing = visible && !hidden && !reducedMotion;

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const compactQuery = window.matchMedia('(max-width: 760px)');
    const updateMotion = () => setReducedMotion(motionQuery.matches);
    const updateCompact = () => setCompact(compactQuery.matches);
    const updateVisibility = () => setHidden(document.hidden);
    updateMotion();
    updateCompact();
    updateVisibility();
    motionQuery.addEventListener('change', updateMotion);
    compactQuery.addEventListener('change', updateCompact);
    document.addEventListener('visibilitychange', updateVisibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {threshold: 0.04});
    observer.observe(sectionRef.current);
    return () => {
      observer.disconnect();
      motionQuery.removeEventListener('change', updateMotion);
      compactQuery.removeEventListener('change', updateCompact);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!playing) return undefined;
    let animationId;
    let previousTime;
    let lastRender = 0;
    const animate = now => {
      const delta = previousTime === undefined ? 0 : Math.min((now - previousTime) / 1000, 0.1);
      previousTime = now;
      elapsedRef.current += delta;
      if (now - lastRender >= 1000 / 30) {
        setElapsed(elapsedRef.current);
        lastRender = now;
      }
      animationId = window.requestAnimationFrame(animate);
    };
    animationId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationId);
  }, [playing]);

  return <section ref={sectionRef} className={styles.hero} data-full-width aria-labelledby="customer-portal-title">
    <div className={styles.canvas}>
      <header className={styles.heading}>
        <p className={styles.eyebrow}>LiteLLM AI Gateway</p>
        <h1 id="customer-portal-title">Customer Portal</h1>
        <p className={styles.subtitle}>Budget and charge your agent's customers.</p>
      </header>
      <CustomerPortalScene
        elapsed={elapsed}
        compact={compact}
        logoHref={logoHref}
        showTitle={false}
        className={styles.scene}
        style={{display: 'block', width: '100%', height: 'auto'}}
      />
    </div>
    <p className={styles.screenReaderOnly}>Illustrative customer traffic flows through LiteLLM into your customer portal. Organization, team, and member budgets use three views of the same request cost.</p>
  </section>;
}
