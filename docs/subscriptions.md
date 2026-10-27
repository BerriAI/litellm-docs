---
title: Claude, Codex, and Copilot subscriptions
sidebar_label: Claude, Codex & Copilot subscriptions
description: Use your ChatGPT, Claude, or GitHub Copilot subscription through LiteLLM. Choose your subscription and follow the setup guide.
hide_table_of_contents: true
hide_title: true
---

import SubscriptionCards from '@site/src/components/SubscriptionCards';
import styles from '@site/src/components/SubscriptionCards/styles.module.css';

<div className={styles.page}>

<p className={styles.eyebrow}>Claude, Codex &amp; Copilot</p>

<h1 className={styles.heading} id="use-your-claude-codex-or-copilot-subscription">Use your subscription<br />with LiteLLM.</h1>

<p className={styles.intro}>Keep your coding client and your plan's allowance.<br />Get LiteLLM access controls and request logs.</p>

<p className={styles.prerequisite}>Before you start, you need a running <a href="/docs/proxy/docker_quick_start">LiteLLM proxy</a>.</p>

<div className={styles.choicesHeading}>
  <h2>Choose your subscription</h2>
  <p>Each developer connects their own account</p>
</div>

<SubscriptionCards
  items={[
    {
      title: 'ChatGPT / Codex',
      description: 'Sign in with ChatGPT in your client.',
      listDescription: [
        'ChatGPT account with access to your chosen model',
        'Codex CLI, Codex app, or Pi',
      ],
      version: 'LiteLLM v1.108.0+',
      ctaLabel: 'Set up Codex',
      icon: '/img/integrations/openai.svg',
      to: '/docs/tutorials/openai_codex_byok',
    },
    {
      title: 'Claude',
      description: 'Sign in with Claude in Claude Code.',
      listDescription: [
        'Claude Pro, Max, Team, or Enterprise',
        'Claude Code installed',
      ],
      version: 'LiteLLM v1.81.14+',
      ctaLabel: 'Set up Claude',
      icon: '/img/integrations/anthropic.svg',
      to: '/docs/tutorials/claude_code_max_subscription',
    },
    {
      title: 'GitHub Copilot',
      description: 'Connect GitHub in the LiteLLM dashboard.',
      listDescription: [
        'GitHub account with Copilot access',
        'LiteLLM dashboard access',
        'An app that connects to LiteLLM',
      ],
      version: 'LiteLLM v1.108.0+',
      ctaLabel: 'Set up Copilot',
      icon: '/img/integrations/github-copilot.svg',
      to: '/docs/providers/github_copilot',
    },
  ]}
/>

</div>
