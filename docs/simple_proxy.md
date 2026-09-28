---
id: simple_proxy
title: LiteLLM AI Gateway
slug: /simple_proxy
description: A self-hosted, OpenAI-compatible gateway for 100+ LLMs with virtual keys, budgets, spend tracking, guardrails, and an admin UI.
---

import DocCardList from '@theme/DocCardList';
import {InstallBox, Tiles, SalesBand} from '@site/src/components/Conversion';

# LiteLLM AI Gateway

One OpenAI-compatible endpoint for every model and every app. Point any OpenAI or Anthropic SDK, Claude Code, Codex, or curl at the gateway, and it handles provider keys, virtual keys with budgets, spend tracking, fallbacks, guardrails, and logging. It runs in Docker with Postgres and ships with an admin UI.

<InstallBox variant="gateway" title="Run it locally" />

## What the gateway handles for you

<Tiles columns={3} items={[
  {icon: 'budget', title: 'Virtual keys and budgets', text: 'Hand out keys with spend caps and rate limits per key, team, or tag.', to: '/docs/proxy/virtual_keys'},
  {icon: 'spend', title: 'Spend tracking', text: 'Cost per request, key, team, and model across every provider.', to: '/docs/proxy/cost_tracking'},
  {icon: 'gateway', title: 'Routing and fallbacks', text: 'Load balance deployments and fail over between providers.', to: '/docs/proxy/load_balancing'},
  {icon: 'guardrails', title: 'Guardrails', text: 'PII masking, prompt injection checks, and custom rules on every call.', to: '/docs/proxy/guardrails/quick_start'},
  {icon: 'mcp', title: 'MCP and agents', text: 'Serve MCP tools and A2A agents behind the same keys and logs.', to: '/docs/mcp'},
  {icon: 'agent', title: 'Connect your tools', text: 'Claude Code, Codex, Cursor, and any OpenAI SDK.', to: '/docs/proxy/client_setup/overview'},
]} />

## Browse the gateway docs

<DocCardList />

<SalesBand source="gateway-overview" title="Running the gateway for your whole company?" />
