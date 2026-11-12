---
title: Claude, Codex, Copilot, and Cursor subscriptions
sidebar_label: Coding subscriptions
description: Use your ChatGPT, Claude, GitHub Copilot, or Cursor subscription through LiteLLM. Choose your subscription and follow the setup guide.
hide_table_of_contents: true
---

import SubscriptionCards from '@site/src/components/SubscriptionCards';

# Use your subscription with LiteLLM {#use-your-claude-codex-or-copilot-subscription}

Keep your coding client and your plan's allowance. Available LiteLLM controls and request logs depend on the integration.

Before you start, you need a running [LiteLLM proxy](./proxy/docker_quick_start.md).

## Choose your subscription

Each developer connects their own account.

<SubscriptionCards
  items={[
    {
      title: 'ChatGPT / Codex',
      description: 'Sign in with ChatGPT in your client.',
      listDescription: [
        'ChatGPT account with access to your chosen model',
        'Codex CLI, Codex app, or Pi',
      ],
      since: '1.109.0',
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
      since: '1.81.14',
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
      since: '1.108.0',
      ctaLabel: 'Set up Copilot',
      icon: '/img/integrations/github-copilot.svg',
      to: '/docs/providers/github_copilot',
    },
    {
      title: 'Cursor CLI',
      description: 'Sign in with Cursor in the CLI. Requires the unreleased relay in PR #51402.',
      listDescription: [
        'Cursor account with model access',
        'Cursor CLI with HTTP/1.1 agent transport',
        'Proxy with the Cursor CLI relay enabled',
      ],
      ctaLabel: 'Set up Cursor CLI',
      icon: '/img/integrations/cursor.svg',
      to: '/docs/tutorials/cursor_cli_subscription',
    },
  ]}
/>
