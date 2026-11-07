import React from 'react';
import styles from './styles.module.css';

export default function SinceVersion({ v }) {
  if (!v) return null;

  const version = String(v).trim().replace(/^v/i, '');

  return (
    <span className={styles.badge} data-since-version={version} title={`Available in LiteLLM v${version} and later`}>
      {`Since v${version}`}
    </span>
  );
}
