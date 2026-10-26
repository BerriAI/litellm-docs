---
title: Claude, Codex, and Copilot subscriptions
sidebar_label: Claude, Codex & Copilot subscriptions
description: Use your ChatGPT, Claude, or GitHub Copilot subscription through LiteLLM. Choose your subscription and follow the setup guide.
hide_table_of_contents: true
---

import NavigationCards from '@site/src/components/NavigationCards';

# Use your Claude, Codex, or Copilot subscription

Keep using your subscription in your coding client, with LiteLLM access controls and request logs. Each developer connects their own account and uses their plan's allowance.

Start with a running [LiteLLM proxy](./proxy/docker_quick_start.md), then choose your subscription:

<NavigationCards
  variant="cards"
  columns={3}
  items={[
    {
      title: 'ChatGPT / Codex',
      description: 'Sign in with ChatGPT in your client.',
      listDescription: [
        'ChatGPT account with access to your chosen model',
        'Codex CLI, Codex app, or Pi',
        'LiteLLM v1.108.0+',
      ],
      icon: <img src="/img/integrations/openai.svg" alt="" />,
      to: '/docs/tutorials/openai_codex_byok',
    },
    {
      title: 'Claude',
      description: 'Sign in with Claude in Claude Code.',
      listDescription: [
        'Claude Pro, Max, Team, or Enterprise',
        'Claude Code installed',
        'LiteLLM v1.81.14+',
      ],
      icon: <img src="/img/integrations/anthropic.svg" alt="" />,
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
      icon: <img src="/img/integrations/github-copilot.svg" alt="" />,
      to: '/docs/providers/github_copilot',
    },
  ]}
/>
