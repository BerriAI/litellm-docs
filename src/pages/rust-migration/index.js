import React from 'react';
import Layout from '@theme/Layout';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import {RustMigrationHub, STAGE_ANCHORS} from '@site/rust-migration';
import '@site/rust-migration/styles.css';

// Docusaurus route for the Rust migration hub. The page itself lives in /rust-migration.
export default function RustMigrationPage() {
  // Other pages link to the stage cards, so the build's anchor check must know them.
  const brokenLinks = useBrokenLinks();
  STAGE_ANCHORS.forEach(anchor => brokenLinks.collectAnchor(anchor));
  return (
    <Layout title="LiteLLM Rust Migration" description="Updates from LiteLLM's migration to Rust.">
      <RustMigrationHub />
    </Layout>
  );
}
