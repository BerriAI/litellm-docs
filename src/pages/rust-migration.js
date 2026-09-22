import React from 'react';
import Layout from '@theme/Layout';
import {PostRow} from '@theme/BlogListPage';
import styles from './rust-migration.module.css';

const POSTS = [
  {
    title: 'OCR uses Rust by default starting with v1.102.0-rc.1',
    permalink: '/blog/litellm-rust-ocr',
    date: '2026-09-13T10:00:00.000Z',
    description: 'Starting with v1.102.0-rc.1, OCR calls use the Rust implementation by default while preserving the existing API.',
    authors: [{name: 'Yujong Lee', url: 'mailto:yujong@berri.ai'}],
  },
  {
    title: 'Benchmarking the LiteLLM Rust AI Gateway: Overhead, Memory, and Cost',
    permalink: '/blog/rust-ai-gateway-benchmarks',
    date: '2026-07-22T09:00:00.000Z',
    description: 'AIGatewayBench measures gateway overhead against a deterministic mock. The LiteLLM Rust gateway has the lowest overhead and memory footprint of the four gateways tested.',
    authors: [{name: 'Ishaan Jaffer', url: 'https://www.linkedin.com/in/reffajnaahsi/'}],
  },
  {
    title: 'Migrating LiteLLM to Rust - Building the Fastest and Litest AI Gateway',
    permalink: '/blog/litellm-rust-launch',
    date: '2026-06-22T09:00:00.000Z',
    description: 'LiteLLM is moving its AI gateway to Rust: 15x throughput, 11x less memory, and sub-1ms per-request overhead. No v2, no migration, your config stays the same.',
    authors: [{name: 'Ishaan Jaffer', url: 'https://www.linkedin.com/in/reffajnaahsi/'}],
  },
];

export default function RustMigrationPage() {
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
          {POSTS.map(post => <PostRow key={post.permalink} post={post} />)}
        </section>
      </main>
    </Layout>
  );
}
