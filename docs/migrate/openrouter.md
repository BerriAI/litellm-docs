---
title: Migrate from OpenRouter to LiteLLM
sidebar_label: From OpenRouter
description: Put LiteLLM in front of OpenRouter with no change in model behavior, then move models to direct provider contracts at your own pace. A skill writes the LiteLLM config from the model IDs your apps already send.
---

import {Command, OneClickDeploy} from '@site/src/components/Conversion';

# Migrate from OpenRouter to LiteLLM

LiteLLM can call OpenRouter as an upstream. That means you can switch gateways in an afternoon, with the same model IDs and the same responses. Then, if you want, you can move your highest-spend models to direct provider contracts one at a time.

## Why LiteLLM

**Requests go straight to the provider.** LiteLLM runs in your VPC and calls OpenAI, Anthropic, Azure, Bedrock, Vertex, and 100+ other providers directly, using your own credentials. There's no third party in the request path, and LiteLLM itself receives no data or telemetry ([Data Privacy and Security](../data_security.md)).

**Your contracts and discounts apply.** Every token is billed to your own provider accounts. That means it counts toward your Azure, AWS, or GCP commitments, gets your negotiated rates, and is covered by your existing data agreements. Add your discounts with [provider discounts](../proxy/provider_discounts.md) so the spend dashboards show what you actually pay.

**No platform fee.** The open-source gateway has no per-token or per-request cost. OpenRouter charges 5.5% on credit purchases on its Standard plan and 8% on Business.

**You choose exactly what serves each model.** Each model name maps to the deployments you configure, down to the provider, region, and version. Fallbacks run in the order you set, and data stays in the regions you deploy to.

**Governance is built in.** Virtual keys carry budgets and rate limits per key, team, user, and end customer. Spend tracking and the Admin UI are included, along with exact-match and semantic caching, guardrails, logging to Langfuse, OpenTelemetry, Datadog, or S3, and gateways for MCP tools and A2A agents.

## Set it up with an agent

The OpenRouter migration skill finds the model IDs and OpenRouter-specific fields your code sends, writes a LiteLLM `config.yaml` that serves every one of them, and, if you want, moves your highest-spend models to direct providers with OpenRouter kept as the fallback. Tell Claude Code, Codex, or Cursor:

<Command code="curl -fsSL https://docs.litellm.ai/skills/openrouter-migration" id="skill-openrouter-migration" note="Prints the skill. Save it to your agent's skills folder or paste it into the chat." />

Or run `curl -fsSL https://docs.litellm.ai/skills/openrouter-migration and follow the instructions` as a prompt. The rest of this page is the same migration done by hand.

## Switch in three steps

### 1. Put LiteLLM in front of OpenRouter

One wildcard entry makes every OpenRouter model available under the ID you already use:

```yaml
model_list:
  - model_name: "*"
    litellm_params:
      model: "openrouter/*"
      api_key: os.environ/OPENROUTER_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
```

Start the gateway. `DATABASE_URL` points at your Postgres, and `LITELLM_MASTER_KEY` and `LITELLM_SALT_KEY` must be set first (for example `sk-` followed by the output of `openssl rand -hex 32`):

```bash
docker run -d -p 4000:4000 -v $(pwd)/config.yaml:/app/config.yaml \
  -e LITELLM_MASTER_KEY -e LITELLM_SALT_KEY -e DATABASE_URL -e OPENROUTER_API_KEY \
  docker.litellm.ai/berriai/litellm:latest --config /app/config.yaml
```

<OneClickDeploy source="migrate-openrouter" />

Requests pass through to OpenRouter unchanged, including variant suffixes such as `:nitro` and OpenRouter-specific fields such as `models` and `transforms`. LiteLLM records the cost OpenRouter reports for each request, so your spend data matches your OpenRouter bill.

### 2. Point clients at LiteLLM

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://litellm.example.com",   # was https://openrouter.ai/api/v1
    api_key=os.environ["LITELLM_API_KEY"],    # was OPENROUTER_API_KEY
)
```

Model IDs, tools, structured outputs, and streaming all work as before. Issue a virtual key for each app or team:

```bash
curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" -H "Content-Type: application/json" \
  -d '{"key_alias": "my-app", "max_budget": 1000, "budget_duration": "30d", "rpm_limit": 300}'
```

The response contains the virtual key your app sends as its API key. You can do the same from **Virtual Keys** in the Admin UI at `/ui`. At this point you're on LiteLLM, and nothing about model behavior has changed.

### 3. Move high-spend models to direct providers (optional)

Add a direct deployment under the same model ID your apps already send. Keep OpenRouter as the fallback until you're confident in the direct route:

```yaml
model_list:
  - model_name: anthropic/claude-sonnet-4.5          # the ID your apps already send
    litellm_params:
      model: anthropic/claude-sonnet-4-5             # direct, billed to your Anthropic account
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-sonnet-bedrock
    litellm_params:
      model: bedrock/us.anthropic.claude-sonnet-4-5-20250929-v1:0
      aws_region_name: us-east-1
  - model_name: claude-sonnet-openrouter
    litellm_params:
      model: openrouter/anthropic/claude-sonnet-4.5
      api_key: os.environ/OPENROUTER_API_KEY

  - model_name: "*"                                  # everything else still goes through OpenRouter
    litellm_params: { model: "openrouter/*", api_key: os.environ/OPENROUTER_API_KEY }

router_settings:
  fallbacks:
    - {"anthropic/claude-sonnet-4.5": ["claude-sonnet-bedrock", "claude-sonnet-openrouter"]}
```

An exact `model_name` always wins over the `"*"` wildcard, so apps keep sending `anthropic/claude-sonnet-4.5`, but those requests now go to Anthropic first, then Bedrock, then OpenRouter. Once you're confident in the direct path, remove the OpenRouter fallback. Keep the wildcard entry for any long-tail models you'd rather leave on OpenRouter.

Models served directly don't understand OpenRouter-only request fields. Switch those fields to the LiteLLM equivalents in the table below.

## Feature mapping

| OpenRouter | LiteLLM |
|---|---|
| `models: [...]` fallback array | `router_settings.fallbacks`, or `"fallbacks": [...]` per request |
| `provider.order` / `only` / `ignore` | The deployments you list under a model name, with optional `order:` priority |
| `provider.sort: price / latency` | `routing_strategy: cost-based-routing` / `latency-based-routing` |
| `:nitro` / `:floor` variants | Separate model names, for example `chat-fast` and `chat-cheap` |
| `openrouter/auto` | [Auto Router](../auto_router/index.md) |
| `reasoning: {effort}` | `reasoning_effort`, mapped to each provider's own thinking settings |
| Web search plugin or tool | `web_search_options`, or [web search interception](../integrations/websearch_interception.md) for any model |
| Context compression | `context_window_fallbacks` to a model with a larger context window |
| `usage.cost` | `x-litellm-response-cost` header, the Admin UI, `/spend/logs/v2` |
| Keys with credit limits | Virtual keys with `max_budget` and `budget_duration` |
| Workspaces | Teams |
| `HTTP-Referer` / `X-OpenRouter-Title` | `x-litellm-tags` for spend attribution |
| Broadcast | Logging callbacks (`langfuse`, `otel`, `datadog`, `s3_v2`) |

## Good to know

**The wildcard can stay.** It gives you OpenRouter's whole catalog through a single account, and you can keep using it for as long as you like.

**You run it yourself.** LiteLLM needs Postgres, and Redis once you run more than one replica ([Production deployment](../proxy/prod.md)).

**Some features need an Enterprise license:** SSO for more than 5 users, audit logs, per-model key budgets, and tag-based budgets ([LiteLLM Enterprise](../enterprise.md)).

Questions? Ask on [Discord](https://discord.com/invite/wuPM9dRgDw), or [talk to us](https://www.litellm.ai/enterprise#talk-to-sales) about help with a larger migration.
