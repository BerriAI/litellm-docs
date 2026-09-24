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

“Create a key for Engineering with a $100 monthly budget.”

With **LiteLLM Admin MCP**, you can give that request to an agent in your MCP client. Ask it to look up the team, create the key with the budget you specify, and return the settings for you to review.

We’ve released LiteLLM Admin MCP as a standalone, open-source connector for managing your LiteLLM gateway. You can connect it to an MCP client or build it into an agent of your own.

{/* truncate */}

You can handle a project’s model access in one conversation. Ask your agent to create a virtual key with the models and spend limit the project needs. For a model rollout, ask it to add a deployment using a credential you configured on the gateway, then retrieve the deployment’s settings.

You can use the same tools to investigate spending. Ask which teams account for this month’s usage, inspect a key’s budget, or look up request logs before changing a limit. Follow a budget question with a request to update that budget.

The connector covers 65 administrative operations across models, keys, teams, budgets and reporting. You can limit an agent to lookups or choose the actions it can use. Developers can reuse that management integration across MCP clients and custom agents.

[Try LiteLLM Admin MCP on GitHub](https://github.com/BerriAI/litellm-admin-mcp).

You can bring these workflows into Slack with the **LiteLLM Admin App**. Your team can ask for model access or check a budget from a DM with **LiteLLM Admin**, using a personal LiteLLM admin account.

Ask, “Show Engineering’s spending this week,” or “Increase Engineering’s monthly budget to $500.” You can ask follow-up questions about the team’s model access and use the conversation to request changes. For a model rollout, give the app the deployment name and a gateway credential reference.

The Admin App handles the Slack conversation and account connection. Your team hosts it for your gateway and workspace. The app uses the standalone Admin MCP for gateway operations, so you can use the same management tools through Slack or another MCP client.

[Try the LiteLLM Admin App on GitHub](https://github.com/BerriAI/litellm-admin-agent).
