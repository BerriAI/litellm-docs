import React from 'react';
import Layout from '@theme/Layout';
import Head from '@docusaurus/Head';
import Link from '@docusaurus/Link';
import {AgentPrompt, PathFinder, SalesBand, Tiles} from '@site/src/components/Conversion';
import styles from './index.module.css';

const POPULAR = [
  {icon: 'gateway', title: 'Gateway quickstart', text: 'Docker + Postgres, admin UI, first virtual key in five minutes.', to: '/docs/proxy/docker_quick_start'},
  {icon: 'sdk', title: 'SDK quickstart', text: 'uv add litellm, then call any provider with completion().', to: '/docs/'},
  {icon: 'agent', title: 'Connect Claude Code and Codex', text: 'Point coding agents and any OpenAI SDK at your gateway.', to: '/docs/proxy/client_setup/overview'},
  {icon: 'mcp', title: 'Providers', text: 'OpenAI, Anthropic, Bedrock, Vertex AI, Azure, and 100+ more.', to: '/docs/providers'},
  {icon: 'budget', title: 'Keys, budgets, and spend', text: 'Virtual keys with limits per key, team, and tag.', to: '/docs/proxy/virtual_keys'},
  {icon: 'regions', title: 'Deploy to production', text: 'Helm, Terraform, and Kubernetes on AWS, GCP, and Azure.', to: '/docs/proxy/deploy'},
];

export default function Home() {
  return (
    <Layout
      title="LiteLLM documentation"
      description="Docs for LiteLLM: a Python SDK and a self-hosted AI Gateway that give 100+ LLM providers one OpenAI-compatible API, with keys, budgets, spend tracking, and guardrails.">
      <Head>
        <link rel="alternate" type="text/markdown" href="/index.md" title="LiteLLM docs home (markdown)" />
      </Head>
      <main className={styles.page}>
        <header className={styles.hero}>
          <h1 className={styles.title}>One API for every model, in your code or behind your own gateway.</h1>
          <p className={styles.lead}>
            LiteLLM is an open-source Python SDK and a self-hosted AI Gateway. Call OpenAI, Anthropic, Bedrock, Vertex AI, and 100+ other
            providers in the OpenAI format, with keys, budgets, spend tracking, and fallbacks built in.
          </p>
        </header>

        <PathFinder source="docs-home" />

        <section className={styles.section}>
          <h2 className={styles.h2}>Most-read guides</h2>
          <Tiles items={POPULAR} columns={3} />
        </section>

        <section className={styles.agent}>
          <div className={styles.agentCopy}>
            <h2 className={styles.h2}>Setting up with a coding agent?</h2>
            <p>
              Hand this prompt to Claude Code, Codex, or Cursor. Every docs page is also published as markdown for agents: start from{' '}
              <Link to="https://docs.litellm.ai/llms.txt">llms.txt</Link>, or see <Link to="/docs/agent_resources">Agent resources</Link> for
              prompts, MCP, and skills.
            </p>
          </div>
          <AgentPrompt id="gateway" />
        </section>

        <SalesBand source="docs-home" />
      </main>
    </Layout>
  );
}
