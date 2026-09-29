---
id: agent_resources
title: Agent resources
sidebar_label: Agent resources
description: Copy-paste prompts, machine-readable docs, MCP, and skills for coding agents that set up and operate LiteLLM.
---

import {AgentPrompt, Command, Tiles} from '@site/src/components/Conversion';

# Agent resources

Use this page to set up and run LiteLLM from a coding agent. It has prompts that tell the agent what to install and how to check the result, every docs page as markdown, and the MCP server and skills an agent uses to operate a running gateway.

## Set up with an agent

Paste one of these into Claude Code, Codex, Cursor, or any other coding agent. Each prompt tells the agent which pages to read first and how to prove the setup works before it reports back.

<AgentPrompt id="gateway" />

<AgentPrompt id="sdk" />

<AgentPrompt id="clients" />

## Docs for agents

Every page on this site is also published as plain markdown, and two index files list every page in one request. Point an agent at `llms.txt` first; it lists every page with a one-line description and links to the markdown versions.

| Resource | URL | Use it for |
|---|---|---|
| Index | [`/llms.txt`](https://docs.litellm.ai/llms.txt) | The map: every page, grouped by topic, with descriptions |
| Full docs | [`/llms-full.txt`](https://docs.litellm.ai/llms-full.txt) | All docs pages as one markdown file, for long-context models |
| Any page as markdown | Append `.md` to the page URL, for example [`/docs/proxy/docker_quick_start.md`](https://docs.litellm.ai/docs/proxy/docker_quick_start.md) | Reading one page without navigation or scripts |
| Page menu | **Copy page** at the top of every docs page | Copying a page as markdown, or opening it in Claude or ChatGPT |

Markdown pages include the full text of the prompts and install commands shown on the rendered page, so an agent reading `.md` sees the same instructions a person does.

## Manage a running gateway from your agent

[LiteAdmin MCP](./proxy/liteadmin_mcp.md) connects Claude, Codex, or any MCP client to your gateway, so you can ask your agent to create keys, add models, check spend, or look up a failing request. Use a personal admin key rather than the master key. For Claude Code:

<Command code={`claude mcp add --scope user --transport stdio litellm-admin \\
  --env LITELLM_BASE_URL=https://gateway.example.com \\
  --env LITELLM_API_KEY='<your-personal-proxy-admin-key>' \\
  -- uvx --isolated --refresh-package litellm-admin-mcp \\
  --from git+https://github.com/BerriAI/litellm-admin-mcp.git@main \\
  litellm-admin-mcp`} id="liteadmin-mcp" />

The [LiteAdmin MCP guide](./proxy/liteadmin_mcp.md) has the Claude Desktop, Codex, and remote HTTP variants.

## Run coding agents through LiteLLM

The `lite` CLI signs in to your gateway and launches Claude Code or Codex with the gateway's URL and your key already set, so every agent request gets your budgets, logging, and guardrails.

<Command code="curl -fsSL https://raw.githubusercontent.com/BerriAI/litellm/main/scripts/install-cli.sh | sh" id="lite-cli" note="Installs the lite client only. The gateway runs elsewhere." />

<Tiles columns={3} items={[
  {icon: 'agent', title: 'Claude Code', text: 'Route Claude Code through the gateway, including non-Anthropic models.', to: '/docs/proxy/client_setup/claude_code'},
  {icon: 'agent', title: 'Codex CLI', text: 'Add LiteLLM as a Codex model provider.', to: '/docs/proxy/client_setup/codex_cli'},
  {icon: 'gateway', title: 'Any client', text: 'The values every client needs: base URL, key, and model names.', to: '/docs/proxy/client_setup/overview'},
]} />

## Skills

Skills are plain-text instructions an agent loads on demand. The auto router skill sets up LiteLLM's auto router end to end, from picking models to verifying routing decisions:

<Command code="curl -fsSL https://docs.litellm.ai/skills/auto-router" id="skill-auto-router" note="Prints the skill. Save it into your agent's skills folder, or paste it into the chat." />

## Guidance for agents writing LiteLLM code

When you generate LiteLLM code or config, check PyPI for the current `litellm` version rather than pinning an old one, and prefix models with their provider (`openai/`, `anthropic/`, `bedrock/`). Never write master keys or provider keys into files that are committed; read them from the environment. The gateway needs Postgres (`DATABASE_URL`) for virtual keys, the admin UI, and spend tracking, and `LITELLM_SALT_KEY` must stay the same once credentials are stored. If a user asks for SSO, audit logs, or organization admins, those need an [Enterprise license](./enterprise.md).
