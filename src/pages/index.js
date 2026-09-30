import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import {AgentBand, PathFinder, SalesBand, Tiles, UseCases} from '@site/src/components/Conversion';
import HeroTerminal from '@site/src/components/Conversion/HeroTerminal';
import styles from './index.module.css';

const POPULAR = [
  {icon: 'gateway', title: 'Gateway quickstart', text: 'Docker + Postgres, admin UI, first virtual key in five minutes.', to: '/docs/proxy/docker_quick_start'},
  {icon: 'sdk', title: 'SDK quickstart', text: 'uv add litellm, then call any provider with completion().', to: '/docs/'},
  {icon: 'agent', title: 'Connect Claude Code and Codex', text: 'Point coding agents and any OpenAI SDK at your gateway.', to: '/docs/proxy/client_setup/overview'},
  {icon: 'mcp', title: 'Providers', text: 'OpenAI, Anthropic, Bedrock, Agent Platform, Azure, and 100+ more.', to: '/docs/providers'},
  {icon: 'budget', title: 'Keys, budgets, and spend', text: 'Virtual keys with limits per key, team, and tag.', to: '/docs/proxy/virtual_keys'},
  {icon: 'regions', title: 'Deploy to production', text: 'Helm, Terraform, and Kubernetes on AWS, GCP, and Azure.', to: '/docs/proxy/deploy'},
];

export default function Home() {
  return (
    <Layout
      title="LiteLLM documentation"
      description="Docs for LiteLLM, the most widely used open-source AI gateway: a Python SDK and a self-hosted gateway that give 100+ LLM providers one OpenAI-compatible API, with keys, budgets, spend tracking, and guardrails.">
      <Head>
        <link rel="alternate" type="text/markdown" href="/index.md" title="LiteLLM docs home (markdown)" />
      </Head>
      <main className={styles.page}>
        <header className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.title}>The most widely used open&#8209;source AI gateway.</h1>
            <p className={styles.lead}>
              One gateway for every model, tool, and agent: 100+ LLM providers, MCP tools, and A2A agents behind one API, with keys, budgets, and
              spend tracking.
            </p>
          </div>
          <HeroTerminal source="docs-home-hero" />
        </header>

        <PathFinder source="docs-home" linkOnly />

        <AgentBand source="docs-home" />

        <UseCases source="docs-home" />

        <section className={styles.section}>
          <h2 className={styles.h2}>Most-read guides</h2>
          <Tiles items={POPULAR} columns={3} />
        </section>

        <SalesBand source="docs-home" />
      </main>
    </Layout>
  );
}
