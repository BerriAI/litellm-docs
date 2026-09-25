---
slug: litellm-admin-mcp
title: "Manage your gateway with LiteLLM Admin MCP"
date: 2026-09-23T10:00:00
authors: [tin]
description: "Create keys, add models, and manage team budgets through your agent with LiteLLM Admin MCP, or from Slack with the LiteLLM Admin Agent."
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

An engineer asks for an API key for a new project. You need to choose which models it can use, set a budget, and put it under the right team. As the project grows, you may need to raise that budget or check which keys account for the team's spending.

With **LiteLLM Admin MCP**, you can handle these tasks by describing what you need to an agent. Connect it to your MCP client, or use the **LiteLLM Admin Agent**, our Slack app built on the same connector, to manage your gateway from a DM.

{/* truncate */}

## Connect your agent to your gateway

LiteLLM Admin MCP gives your agent tools to work with your gateway through the Model Context Protocol (MCP). Your MCP client provides the conversation and the model. The connector calls LiteLLM's management API using your own admin credential.

You can create and manage virtual keys, add model deployments, and update teams and budgets. You can also inspect spending and request logs to investigate usage. The connector includes 65 reviewed admin operations and exposes the ones your gateway supports.

You can use it from an MCP client you work in, such as Claude Code or Cursor, or connect it to a custom agent. That puts gateway administration in the same conversation where you're working on an application.

## Set up access for a project

Suppose you're setting up a new project for Engineering. You could ask:

> Create a key for Engineering with a $100 monthly budget.

Include the models the project should have access to and an alias to help identify the key. The agent can look up the team and create the key through the gateway's management API with the budget and model restrictions you specify.

You can return to that work after the project starts making requests. Ask for the team's recorded spend or inspect a particular key. If you need to change a limit, specify whether you want to update that key's budget or the budget for the whole team.

You can add a model deployment through the same connection. For example:

> Add a model named support-chat using openai/gpt-4.1 and the existing gateway credential openai-production.

Here, you provide the public model name, the provider's model ID, and a credential reference your gateway already knows. Keep provider API keys out of chat. The agent registers the deployment in LiteLLM; you still need provider access and a gateway configured to store models in its database. You can follow the [model setup requirements](https://github.com/BerriAI/litellm-admin-agent/blob/main/docs/compatibility.md#model-creation) and test inference after adding it.

## Work from a Slack DM

The **LiteLLM Admin Agent** brings these tools into Slack. You host the agent, connect it to your gateway, and install the Slack app in your workspace. You also choose which model the agent uses through your gateway.

Open **LiteLLM Admin** in Slack, send **connect**, and follow the private sign-in link to connect your admin account. Then ask a question:

> Show Engineering's current spend and budget.

After reviewing the answer, you can request a change:

> Increase Engineering's monthly budget to $500.

The agent uses the Admin MCP connector to look up the team and carry out your request. You can continue with questions about its keys or usage in the same DM. Handle a teammate's request from Slack on your laptop or phone, then return to the conversation with the result.

The Slack agent includes the MCP connector, so you can deploy the app without setting up a separate MCP service. Each installation connects one LiteLLM gateway to one Slack workspace.

## Choose the access you give the agent

Both options require a LiteLLM proxy-admin account. In Slack, each admin connects their own account using the deployment's configured login method: SSO or a personal admin key entered on a private browser page. The gateway checks the caller's permissions for management requests.

You can restrict the deployment to specific tools or enable read-only mode. For example, you could start with team and spend lookups, then enable key creation once you're ready to use the agent for changes.

## Get started

To connect your own agent, follow the [LiteLLM Admin MCP setup guide](https://github.com/BerriAI/litellm-admin-mcp#readme). You can run the connector with a local MCP client or host it for remote connections.

To work from Slack, follow the [LiteLLM Admin Agent setup guide](https://github.com/BerriAI/litellm-admin-agent#readme) for Docker Compose or Render. Both projects are open source. Once connected, start with **“List my teams and their current budgets.”**
