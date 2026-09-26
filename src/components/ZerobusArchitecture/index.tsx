import React from 'react';
import useBaseUrl from '@docusaurus/useBaseUrl';
import styles from './styles.module.css';

function Logo({ name }: { name: string }) {
  return (
    <img
      src={useBaseUrl(`/img/zerobus/logos/${name}.svg`)}
      className={styles.logo}
      alt=""
      role="presentation"
    />
  );
}

export default function ZerobusArchitecture() {
  return (
    <div className={styles.wrapper}>
      <div
        className={styles.diagram}
        role="img"
        aria-label="Application requests flow through LiteLLM Gateway to model providers such as OpenAI, Anthropic, and Google. The gateway sends request logs to Databricks Zerobus Ingest, which writes them to a Unity Catalog Delta table."
      >
        <div className={`${styles.node} ${styles.application}`}>
          <svg className={styles.appIcon} viewBox="0 0 32 32" aria-hidden="true">
            <rect x="3" y="5" width="26" height="22" rx="3" />
            <path d="M3 11h26M9 17l-3 3 3 3m14-6 3 3-3 3m-5-7-4 10" />
            <path d="M7 8h.01M11 8h.01" />
          </svg>
          <span className={styles.label}>Application</span>
        </div>

        <div className={`${styles.arrow} ${styles.applicationArrow}`} aria-hidden="true" />

        <div className={`${styles.node} ${styles.gateway}`}>
          <span className={styles.train} aria-hidden="true">🚅</span>
          <span className={styles.label}>LiteLLM Gateway</span>
        </div>

        <div className={`${styles.arrow} ${styles.providerArrow}`} aria-hidden="true" />

        <div className={`${styles.node} ${styles.providers}`}>
          <div className={styles.providerLogos}>
            <Logo name="openai" />
            <Logo name="anthropic" />
            <Logo name="google" />
          </div>
          <span className={styles.label}>Model providers</span>
        </div>

        <div className={styles.logArrow} aria-hidden="true">
          <span>Request logs</span>
        </div>

        <div className={`${styles.node} ${styles.zerobus}`}>
          <Logo name="databricks" />
          <span className={styles.label}>Zerobus Ingest</span>
        </div>

        <div className={`${styles.arrow} ${styles.tableArrow}`} aria-hidden="true" />

        <div className={`${styles.node} ${styles.table}`}>
          <Logo name="databricks" />
          <span className={styles.label}>Unity Catalog<br />Delta table</span>
        </div>
      </div>
    </div>
  );
}
