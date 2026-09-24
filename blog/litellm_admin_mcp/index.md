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
    light: HeroLight,
    dark: HeroDark,
  }}
  style={{width: '100%'}}
/>

“Create a key for Engineering with a $100 monthly budget.”

You can give that request to an agent connected to LiteLLM Admin MCP. The agent can look up Engineering’s team and create a virtual key with the budget you specify. You can ask it to add a model deployment or check the team’s spending from the same conversation.

We’ve released [LiteLLM Admin MCP](https://github.com/BerriAI/litellm-admin-mcp) as a standalone, MIT-licensed MCP server. You connect your MCP client to your LiteLLM gateway using a proxy-admin credential. Your client supplies the agent and model; through the connector, your agent calls LiteLLM’s management API.

{/* truncate */}

```text
Your MCP client → LiteLLM Admin MCP → Your LiteLLM gateway
```

You can run the connector as a local process or host it for remote MCP clients. You keep your existing gateway.

The v0.1.0 catalog includes 65 administrative operations. Your agent can create and rotate virtual keys, manage team membership, or change a budget. You can inspect spending and request logs without giving the agent write tools. For model management, you can add a deployment and retrieve its configuration.

You choose the tools your agent can call. The connector discovers request schemas from your gateway’s OpenAPI specification and exposes the reviewed operations that your gateway supports.

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then add this configuration to an MCP client that supports local processes:

```json
{
  "mcpServers": {
    "litellm-admin": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/BerriAI/litellm-admin-mcp.git@v0.1.0",
        "litellm-admin-mcp"
      ],
      "env": {
        "LITELLM_BASE_URL": "https://your-gateway.example.com",
        "LITELLM_API_KEY": "<your-personal-proxy-admin-key>"
      }
    }
  }
}
```

You need Python 3.12 or later; {/* keep-python-version */} uv can install a compatible version. Store the credential in your client’s secret storage if it supports one, and keep the configuration private.

Start with a read request: “List my teams and their budgets.” To enable read-only mode, add `LITELLM_ADMIN_READ_ONLY=true` to the connector’s environment.

For an agent that needs to create keys, configure an explicit tool list with write access:

```text
LITELLM_ADMIN_READ_ONLY=false
LITELLM_ADMIN_TOOLS=create_key,list_keys,list_teams
```

With that list, your agent can look up a team and create a key. Choose the tool set for the work you want it to do; your gateway’s permissions and feature entitlements apply to those calls.

To add a model, give your agent the deployment alias, provider/model ID, and gateway credential name:

> Add a model named support-chat using openai/gpt-4.1 and the gateway credential openai-production.

Use the exact provider/model ID and a credential you configured on the gateway. You need a database and `STORE_MODEL_IN_DB=True` to add deployments through the management API. Keep provider API keys out of the conversation; reference a stored credential or a gateway environment variable.

After creating the deployment, verify that you can send an inference request through it. You need provider access and credits for that request. During our live tests, we waited between creation and successful inference while the gateway loaded the new deployment.

For a shared installation, you can host the connector with Streamable HTTP behind HTTPS. Each caller supplies a personal gateway credential, and the connector checks that caller’s admin status against the gateway. You configure the hosted process with the gateway URL, without a shared admin key. See the [HTTP setup instructions](https://github.com/BerriAI/litellm-admin-mcp#host-an-http-connector) for the server command and client configuration.

You can manage your gateway from a Slack DM with the [LiteLLM Admin Agent](https://github.com/BerriAI/litellm-admin-agent), the application behind the **LiteLLM Admin** Slack app. Ask it to create a key for a team or add a model using the gateway credential name from the example above. You can check budgets and spending in the same conversation.

Your team hosts the agent for one gateway and one Slack workspace, then installs the app using the repository’s [Slack manifest and setup guide](https://github.com/BerriAI/litellm-admin-agent#2-install-your-slack-app). Each user connects a personal LiteLLM proxy-admin account. Your Slack profile email must match that account.

Open **LiteLLM Admin** under Slack Apps and send `connect`. Follow the private browser link to enter your gateway key or sign in with SSO, depending on your deployment’s login method. Keep credentials out of Slack messages. Return to the DM and ask, “List my teams and their current budgets.” Send `disconnect` to remove the saved connection; revoke the credential in LiteLLM if you need to invalidate the key itself.

We extracted the management API integration from the Admin Agent into the standalone MCP server. In the [Slack agent integration PR](https://github.com/BerriAI/litellm-admin-agent/pull/9), we connect the agent to that server as its tool provider:

```text
Slack DM → LiteLLM Admin Agent → LiteLLM Admin MCP → Your gateway
```

That migration remains in review. The Slack app is available with its current setup; follow the [Admin Agent README](https://github.com/BerriAI/litellm-admin-agent#readme) for the version you deploy. After the migration, the agent will handle the Slack conversation and sign-in while using the same connector you can run from other MCP clients.

We tested the published v0.1.0 package against a live LiteLLM deployment. We invoked all 65 tools, added a model using an existing OpenRouter credential, and created a restricted key that could call the new deployment. We tested read-only restrictions and HTTP caller isolation, then deleted the temporary resources and verified cleanup.

Those tests exposed a gateway issue: after blocking or unblocking a key, we saw inference results that disagreed with the stored state. We reproduced the issue through direct gateway API calls, bypassing MCP. We have not established the cause. Treat immediate block/unblock enforcement as an open validation item on that deployment.

You can install [v0.1.0](https://github.com/BerriAI/litellm-admin-mcp/releases/tag/v0.1.0) and start with read-only access on your test gateway. The [repository](https://github.com/BerriAI/litellm-admin-mcp) includes the tool catalog and deployment instructions. Verify a temporary create/read/delete workflow against your gateway before expanding the agent’s access.
