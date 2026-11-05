import React from 'react';
import Layout from '@theme/Layout';
import RouterPlayground from '@site/src/components/RouterPlayground';
import styles from './router-playground.module.css';

// The playground lives in src/components/RouterPlayground; this page only frames it.

export default function RouterPlaygroundPage() {
  return (
    <Layout
      title="Router playground"
      description="Run the LiteLLM router core in your browser and watch how it picks, retries, cools down and falls back.">
      <main className={styles.page}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Proof of concept</p>
          <h1 className={styles.title}>Router playground</h1>
          <p className={styles.description}>
            This page runs the router core that <code>litellm.Router</code> uses, compiled to WebAssembly, in your browser.
            Paste a <code>model_list</code> and <code>router_settings</code>, choose how each deployment answers, and send
            requests. No request leaves the page: the playground answers each attempt from its script, and retry waits
            move a simulated clock forward instead of waiting.
          </p>
          <p className={styles.description}>
            It covers <code>simple-shuffle</code> with weights and <code>order</code>, retries, fallbacks, cooldowns and
            allowed fails. Strategies and filters that still run in Python, such as <code>least-busy</code>,{' '}
            <code>usage-based-routing-v2</code>, <code>latency-based-routing</code> and tag routing, show up in the trace as
            a <code>host.select</code> step that leaves the candidates unchanged.
          </p>
        </header>
        <RouterPlayground />
      </main>
    </Layout>
  );
}
