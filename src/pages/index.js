import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import {AgentBand, SalesBand, Tiles, UseCases} from '@site/src/components/Conversion';
import LiteLLMFlow from '@site/src/components/LiteLLMFlow';
import QuickStartBox from '@site/src/components/QuickStartBox';
import styles from './index.module.css';

const POPULAR = [
  {icon: 'gateway', title: 'Gateway quickstart', text: 'Docker and Postgres, the admin UI, and your first virtual key in 5 minutes.', to: '/docs/proxy/docker_quick_start'},
  {icon: 'sdk', title: 'SDK quickstart', text: 'Run uv add litellm. Then call a provider with completion().', to: '/docs/'},
  {icon: 'agent', title: 'Connect Claude Code and Codex', text: 'Connect coding agents and OpenAI SDKs to your gateway.', to: '/docs/proxy/client_setup/overview'},
  {icon: 'mcp', title: 'Providers', text: 'OpenAI, Anthropic, Bedrock, Agent Platform, Azure, and 100+ more.', to: '/docs/providers'},
  {icon: 'budget', title: 'Keys, budgets, and costs', text: 'Virtual keys with limits for each key, team, and tag.', to: '/docs/proxy/virtual_keys'},
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
              LiteLLM is one gateway for all your models, tools, and agents. It gives one API to 100+ LLM providers, MCP tools, and A2A agents.
              It controls keys and budgets, and it records the cost of each request.
            </p>
          </div>
        </header>

        <LiteLLMFlow copyCommand={false} agentPrompt={false} />

        <QuickStartBox source="docs-home" />

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
