import React from 'react';
import Layout from '@theme/Layout';
import {RustMigrationVersion} from '@site/rust-migration';
import '@site/rust-migration/styles.css';

// Docusaurus route for the per-version view. The page itself lives in /rust-migration.
export default function RustMigrationVersionPage() {
  return (
    <Layout
      title="Rust Migration Impact by Version"
      description="See what runs on Rust in your LiteLLM version and what changes when you upgrade."
    >
      <RustMigrationVersion />
    </Layout>
  );
}
