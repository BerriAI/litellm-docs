import React, {useEffect, useRef, useState} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import SalesButton from './SalesButton';
import {IconEnterprise, IconGateway, IconSdk} from './icons';
import {ENTERPRISE_HERO, TIERS as TIER_DATA} from './content';

const TIER_ICONS = {enterprise: IconEnterprise, gateway: IconGateway, sdk: IconSdk};
const TIERS = TIER_DATA.map((t) => ({...t, Icon: TIER_ICONS[t.id]}));
import styles from './enterprise.module.css';
import shared from './styles.module.css';

export function EnterpriseHero({source = 'enterprise-page'}) {
  return (
    <header className={styles.hero}>
      <p className={styles.heroEyebrow}>LiteLLM Enterprise</p>
      <h1 className={styles.heroTitle}>{ENTERPRISE_HERO.title}</h1>
      <p className={styles.heroText}>{ENTERPRISE_HERO.text}</p>
      <div className={styles.heroActions}>
        <SalesButton source={source} />
        <span className={shared.salesNote}>Includes a free 30-day trial</span>
      </div>
      <ul className={styles.proof}>
        <li>
          <Link to="https://trust.litellm.ai/">SOC 2 Type II</Link>
        </li>
        <li>
          <Link to="/docs/data_security#legalcompliance-faqs">AWS and Azure Marketplace</Link>
        </li>
        <li>Self-hosted in your VPC</li>
        <li>For teams with 100+ users or 10+ production AI use cases</li>
      </ul>
    </header>
  );
}

// Three slabs stacked like the layers they are: each tier contains the one
// below it. The stack assembles once, bottom up, when it scrolls into view.
export function TierStack({highlight = 'enterprise'}) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      {threshold: 0.25},
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={clsx(styles.stack, shown && styles.stackShown)}>
      {TIERS.map((t, i) => (
        <section
          key={t.id}
          className={clsx(styles.slab, styles[`slab_${t.id}`], t.id === highlight && styles.slabOn)}
          style={{'--i': TIERS.length - 1 - i}}
          aria-label={`${t.name}: ${t.how}`}>
          <div className={styles.slabHead}>
            <span className={styles.slabIcon}>
              <t.Icon size={28} />
            </span>
            <span>
              <span className={styles.slabName}>{t.name}</span>
              <span className={styles.slabHow}>{t.how}</span>
            </span>
          </div>
          <ul className={styles.slabItems}>
            {t.items.map(([label, to]) => (
              <li key={label}>
                <Link to={to}>{label}</Link>
              </li>
            ))}
          </ul>
          {i < TIERS.length - 1 && <span className={styles.slabPlus}>includes everything below</span>}
        </section>
      ))}
    </div>
  );
}
