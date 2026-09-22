import React from 'react';
import Layout from '@theme/Layout';
import {usePluginData} from '@docusaurus/useGlobalData';
import {PostRow} from '@theme/BlogListPage';
import styles from './rust-migration.module.css';

export default function RustMigrationPage() {
  // Collected at build time from every blog post tagged `rust-migration`.
  const {posts = []} = usePluginData('rust-migration-posts') || {};

  return (
    <Layout
      title="LiteLLM Rust Migration"
      description="Updates from LiteLLM's migration to Rust."
    >
      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Rust Migration</p>
          <h1 className={styles.title}>LiteLLM is moving to Rust 🦀</h1>
          <p className={styles.description}>Read the latest engineering updates, benchmarks, and rollout notes.</p>
        </header>

        <section className={styles.list} aria-label="Rust migration posts">
          {posts.map(post => <PostRow key={post.permalink} post={post} />)}
        </section>
      </main>
    </Layout>
  );
}
