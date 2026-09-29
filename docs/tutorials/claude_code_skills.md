# LiteLLM Skills

[litellm-skills](https://github.com/BerriAI/litellm-skills) is a set of [Agent Skills](https://agentskills.io) that teach coding agents to run, connect to, and administer a LiteLLM proxy. Once installed, Claude Code, Codex, OpenCode, Cursor, or any agent that reads `SKILL.md` can stand up a gateway, point itself or other tools at it, and manage keys, users, teams, models, MCP servers, agents, guardrails, budgets, and spend by calling the proxy's HTTP API with `curl`.

## Install

In Claude Code, add the repo as a plugin marketplace and install the plugin:

```
/plugin marketplace add BerriAI/litellm-skills
/plugin install litellm@litellm
```

For other agents, use the [skills CLI](https://github.com/vercel-labs/skills):

```bash
npx skills add BerriAI/litellm-skills
```

Or clone the repo and symlink every skill into `~/.claude/skills`. Set `SKILLS_DIR` to install into a different agent's skills directory; re-running the script updates the skills and removes links left by older versions.

```bash
curl -fsSL https://raw.githubusercontent.com/BerriAI/litellm-skills/main/install.sh | sh
```

Then export your proxy's URL and a key so every skill can find them:

```bash
export LITELLM_BASE_URL=https://litellm.example.com
export LITELLM_API_KEY=sk-...
```

Admin skills need a proxy admin key (a team admin key works inside its own team). `litellm-connect` only needs a regular [virtual key](../proxy/virtual_keys.md).

## Available skills

| Skill | What it does |
|-------|-------------|
| `litellm-setup` | Runs a proxy with Docker Compose, `docker run`, or uv, with Postgres and a safe master key and salt key |
| `litellm-connect` | Points Claude Code, Codex, Gemini CLI, OpenCode, Cursor, the OpenAI and Anthropic SDKs, and MCP clients at the gateway |
| `litellm-doctor` | Checks health and version and explains 401, 403, 422, 429, and 500 responses, including why a key cannot call a model |
| `litellm-keys` | Creates, updates, rotates, blocks, and deletes virtual keys with budgets, rate limits, and model access |
| `litellm-users` | Creates, updates, invites, and deletes users, including bulk onboarding and offboarding |
| `litellm-teams` | Manages teams, members, per-member budgets, and team model access |
| `litellm-orgs` | Manages organizations and org admins (Enterprise) |
| `litellm-models` | Adds, tests, updates, pauses, and deletes models, plus reusable credentials, access groups, and fallbacks |
| `litellm-mcp` | Registers, tests, and updates MCP servers (HTTP, SSE, stdio, OAuth), builds toolsets, and grants MCP access |
| `litellm-agents` | Registers A2A agents, tests them, controls access, and uses the kill switch |
| `litellm-guardrails` | Creates guardrails, attaches them to teams, keys, or tags through policies, and tests them |
| `litellm-budgets` | Manages reusable budgets and customer budgets and finds who is close to their limit |
| `litellm-usage` | Reports spend, tokens, and requests by user, team, org, key, tag, model, customer, or agent |

The skills are written against LiteLLM v1.103 and name the version where recent behavior changed, so the agent can tell when a proxy is too old for a feature. Features that need an Enterprise license, such as organizations, key tags, guardrails on keys, and key regeneration, are marked in the skill.

## How it works

You don't need to name a skill. Ask for the outcome and the agent picks the right one, collects what it needs, runs the `curl` calls, and verifies the result. For example, "give the billing agent a key that can only call gpt-5.5, capped at $50 a month" loads `litellm-keys`, creates a key with `models`, `max_budget`, and `budget_duration`, and shows the secret once. "Hook up our GitHub MCP server" loads `litellm-mcp`, registers the server with the right transport and credentials, and lists its tools to confirm it works. "Set up Claude Code to use our gateway" loads `litellm-connect`, checks which models your key can reach, and prints the environment variables to paste.

Destructive operations (deleting keys, users, teams, orgs, models, or MCP servers) always show what will be affected, including cascades such as a team's keys, and wait for confirmation. Where a reversible option exists, like blocking a key or pausing a model, the skill offers it first.

## Upgrading from the v1 skills

The first release shipped one skill per action (`/add-key`, `/update-key`, `/delete-key`, and so on). Each area is now a single skill that covers every action, so `/add-key` becomes `/litellm-keys`. Re-run `install.sh` and it removes the old links.

## Related

- [litellm-skills on GitHub](https://github.com/BerriAI/litellm-skills)
- [Virtual Keys](../proxy/virtual_keys.md)
- [Model Management](../proxy/model_management.md)
- [Claude Code with LiteLLM](../proxy/client_setup/claude_code.md)
- [MCP Gateway](../mcp.md)
