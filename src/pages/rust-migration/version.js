import React from 'react';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import VersionTimeline, {VersionPicker, useChosenVersion} from '@site/src/components/RustMigration/VersionImpact';
import impact from '@site/src/components/RustMigration/VersionImpact.module.css';
import styles from '../rust-migration.module.css';

export default function RustMigrationVersionPage() {
  const [version, choose] = useChosenVersion();
  return (
    <Layout
      title="Rust Migration Impact by Version"
      description="See what runs on Rust in your LiteLLM version and what changes when you upgrade."
    >
      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>
            <Link to="/rust-migration">Rust Migration</Link>
          </p>
          <h1 className={styles.title}>
            {'What changes in '}
            <VersionPicker version={version} onChange={choose} className={impact.titlePicker} />
          </h1>
          <p className={styles.description}>
            Changes above the marker are already in this version. Upgrading brings the ones below it.
          </p>
        </header>
        <section className={styles.section}>
          <VersionTimeline version={version} />
        </section>
      </main>
    </Layout>
  );
}
