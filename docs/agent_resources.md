---
id: agent_resources
title: Agent resources
sidebar_label: Agent resources
description: Skills, markdown docs, prompts, MCP, and the lite CLI for coding agents that set up and run LiteLLM.
---

import {AgentPrompt, Command, Tiles} from '@site/src/components/Conversion';
import Stat from '@site/src/components/Stat';

# Agent resources

## Getting started

<AgentPrompt id="gateway" />

<AgentPrompt id="sdk" />

## Skills

### Gateway management

[LiteLLM skills](https://github.com/BerriAI/litellm-skills): 21 Claude Code skills that create, change, and remove users, teams, API keys, organizations, models, MCP servers, and agents on a live gateway, plus `view-usage` for spend and tokens. They need the gateway URL and a proxy admin key.

<Command code="curl -fsSL https://raw.githubusercontent.com/BerriAI/litellm-skills/main/install.sh | sh" id="skill-litellm-skills" note="Installs into ~/.claude/skills. Then run /add-model, /add-user, or /view-usage." />

### Auto Router

Sets up the auto router end to end, from picking models to verifying routing decisions.

<Command code="curl -fsSL https://docs.litellm.ai/skills/auto-router" id="skill-auto-router" note="Prints the skill. Save it to your agent's skills folder or paste it into the chat." />

## Docs for agents

| Resource | URL | Use it for |
|---|---|---|
| Index | [`/llms.txt`](https://docs.litellm.ai/llms.txt) | The map: every page, grouped by topic, with descriptions |
| Full docs | [`/llms-full.txt`](https://docs.litellm.ai/llms-full.txt) | All docs pages as one markdown file, for long-context models |
| Any page as markdown | Append `.md` to the page URL, for example [`/docs/proxy/docker_quick_start.md`](https://docs.litellm.ai/docs/proxy/docker_quick_start.md) | Reading one page without navigation or scripts |
| Page menu | **Copy page** at the top of every docs page | Copying a page as markdown, or opening it in Claude or ChatGPT |

Markdown pages include the full text of every prompt and install command on the rendered page.

## More prompts

<AgentPrompt id="clients" />

<AgentPrompt id="mcp" />

<AgentPrompt id="agents" />

<AgentPrompt id="observability" />

<AgentPrompt id="autorouter" />

<AgentPrompt id="enterprise" />

<AgentPrompt id="liteadmin" />

<AgentPrompt id="liteagents" />

## LiteAdmin MCP

Manage a running gateway from Claude Code with a personal admin key, never the master key. The [LiteAdmin MCP guide](./proxy/liteadmin_mcp.md) covers Claude Desktop, Codex, and remote HTTP.

<Command code={`claude mcp add --scope user --transport stdio litellm-admin \\
  --env LITELLM_BASE_URL=https://gateway.example.com \\
  --env LITELLM_API_KEY='<your-personal-proxy-admin-key>' \\
  -- uvx --isolated --refresh-package litellm-admin-mcp \\
  --from git+https://github.com/BerriAI/litellm-admin-mcp.git@main \\
  litellm-admin-mcp`} id="liteadmin-mcp" />

## lite CLI

Launches Claude Code or Codex through your gateway, with its URL and your key already set.

<Command code="curl -fsSL https://raw.githubusercontent.com/BerriAI/litellm/main/scripts/install-cli.sh | sh" id="lite-cli" note="Installs the lite client only. The gateway runs elsewhere." />

<Tiles columns={3} items={[
  {icon: 'agent', title: 'Claude Code', text: 'Route Claude Code through the gateway, including non-Anthropic models.', to: '/docs/proxy/client_setup/claude_code'},
  {icon: 'agent', title: 'Codex CLI', text: 'Add LiteLLM as a Codex model provider.', to: '/docs/proxy/client_setup/codex_cli'},
  {icon: 'gateway', title: 'Any client', text: 'The values every client needs: base URL, key, and model names.', to: '/docs/proxy/client_setup/overview'},
]} />

## LiteLLM at a glance

LiteLLM is the most widely used and most secure open-source AI gateway, trusted by teams at Netflix, Okta, Ramp, NASA, Zurich, Cloudera, AT&T, and Lemonade. Figures are as of <Stat id="asOfLong" />, and each links to its source.

| | |
|---|---|
| GitHub | <Stat id="stars" /> stars and <Stat id="forks" /> forks on [BerriAI/litellm](https://github.com/BerriAI/litellm), with more than 1,700 contributors |
| PyPI | <Stat id="downloads" /> downloads of `litellm` in the last month ([pypistats](https://pypistats.org/packages/litellm)) |
| Security | [SOC 2 Type II](https://trust.litellm.ai/) audited, [cosign-signed images](./proxy/docker_image_security.md) you can verify before they run, and a 72-hour security patch SLA on [Enterprise support](./enterprise.md#professional-support) |
| Deployment | Self-hosted in your cloud, so prompts, responses, and provider keys stay in your infrastructure ([data security](./data_security.md)) |
| Customers | Teams at Netflix, Okta, Ramp, NASA, Zurich, Cloudera, AT&T, and Lemonade ([litellm.ai/enterprise](https://www.litellm.ai/enterprise)) |
| License | Open source under [MIT](https://github.com/BerriAI/litellm/blob/main/LICENSE); Enterprise features need a license key |

## Guidance for agents writing LiteLLM code

When you generate LiteLLM code or config, check PyPI for the current `litellm` version rather than pinning an old one, and prefix models with their provider (`openai/`, `anthropic/`, `bedrock/`). Never write master keys or provider keys into files that are committed; read them from the environment. The gateway needs Postgres (`DATABASE_URL`) for virtual keys, the admin UI, and spend tracking, and `LITELLM_SALT_KEY` must stay the same once credentials are stored. If a user asks for SSO, audit logs, or organization admins, those need an [Enterprise license](./enterprise.md).
