---
slug: litellm-admin-mcp
title: "Manage your gateway with LiteLLM Admin MCP"
date: 2026-09-23T10:00:00
authors: [tin]
description: "Create virtual keys and add model deployments with LiteLLM Admin MCP, and manage your gateway from the LiteLLM Admin Slack app."
tags: [mcp, agents, ai-gateway]
hide_table_of_contents: true
image: ./hero.png
---

import ThemedImage from '@theme/ThemedImage';
import HeroLight from './hero.png';
import HeroDark from './hero-dark.png';

<ThemedImage
  alt="Manage your gateway with LiteLLM Admin MCP. Create virtual keys and add model deployments from your MCP client."
  sources={{
    light: typeof HeroLight === 'string' ? HeroLight : HeroLight.src.images.at(-1).path,
    dark: typeof HeroDark === 'string' ? HeroDark : HeroDark.src.images.at(-1).path,
  }}
  style={{width: '100%'}}
/>

Manage your LiteLLM gateway through an agent with **LiteLLM Admin MCP**, or from Slack with the **LiteLLM Admin App**.

{/* truncate */}

## LiteLLM Admin MCP

Use 65 admin operations from your MCP client or custom agent:

- **Create keys:** Set model access and project budgets.
- **Add models:** Register deployments using existing gateway credentials.
- **Manage spend:** Check usage by team or key and update budgets.
- **Investigate requests:** Inspect request logs to troubleshoot usage.
- **Control agent access:** Choose allowed tools or restrict the agent to lookups.

**[Try LiteLLM Admin MCP →](https://github.com/BerriAI/litellm-admin-mcp)**

## LiteLLM Admin App for Slack

Use the same Admin MCP tools from a Slack DM, with your personal LiteLLM admin account:

- “Create a key for Engineering with a $100 monthly budget.”
- “Show Engineering’s spending this week.”
- “Increase Engineering’s monthly budget to $500.”

**[Try the LiteLLM Admin App →](https://github.com/BerriAI/litellm-admin-agent)**
