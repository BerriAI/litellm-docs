import React from 'react';
import Layout from '@theme/Layout';
import useBrokenLinks from '@docusaurus/useBrokenLinks';
import PlaygroundShell from '@site/src/components/RouterPlayground/Guided';
import {CASES} from '@site/src/components/RouterPlayground/cases';
import styles from './router-playground.module.css';

// The playground lives in src/components/RouterPlayground; this page only frames it. The guided path
// and the sandbox switch live in RouterPlayground/Guided.

export default function RouterPlaygroundPage() {
  // Docs pages link to #case=<id>; the playground reads that hash itself, so each one is a real anchor.
  const brokenLinks = useBrokenLinks();
  CASES.forEach(item => brokenLinks.collectAnchor(`case=${item.id}`));
  return (
    <Layout
      title="Router playground"
      description="Run the LiteLLM router core in your browser and watch how it picks, retries, cools down and falls back.">
      <main className={styles.page}>
        <header className={styles.hero}>
          <h1 className={styles.title}>Router playground</h1>
          <p className={styles.lead}>
            Learn how the LiteLLM router picks a deployment, retries, benches a failing one and falls back. Every
            step runs the real router core in your browser, on simulated traffic.
          </p>
        </header>
        <PlaygroundShell />
        <details className={styles.about}>
          <summary className={styles.aboutSummary}>How it works</summary>
          <p className={styles.description}>
            This page runs the router core that <code>litellm.Router</code> uses, compiled to WebAssembly, in your
            browser. No request leaves the page: the playground answers each attempt from its script, and retry waits
            move a simulated clock forward instead of waiting.
          </p>
          <p className={styles.description}>
            It covers <code>simple-shuffle</code> with weights and <code>order</code>, retries, fallbacks, cooldowns and
            allowed fails. Strategies that still run in Python, such as <code>least-busy</code>,{' '}
            <code>usage-based-routing-v2</code> and <code>latency-based-routing</code>, are not offered until they run
            in the Rust core.
          </p>
        </details>
      </main>
    </Layout>
  );
}
