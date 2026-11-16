import React from 'react';
import ControlPlaneIllustration from './cover.svg';
import MobileControlPlaneIllustration from './cover-mobile.svg';
import styles from './hero.module.css';

export default function GlobalControlPlaneHero() {
  return (
    <div className={styles.hero}>
      <ControlPlaneIllustration
        className={styles.desktop}
        role="img"
        aria-label="One Global Control Plane management API connects to independent LiteLLM gateways in US, EU, and APAC regions."
      />
      <MobileControlPlaneIllustration
        className={styles.mobile}
        role="img"
        aria-label="One Global Control Plane management API connects to independent LiteLLM gateways in US, EU, and APAC regions."
      />
    </div>
  );
}
