---
title: Migrate from Portkey to LiteLLM
sidebar_label: From Portkey
description: Move from Portkey to a self-hosted LiteLLM gateway. In most apps you change only the base URL and API key, and a skill converts your Portkey configs into a LiteLLM config.yaml.
---

import {Command} from '@site/src/components/Conversion';

# Migrate from Portkey to LiteLLM

LiteLLM is an open-source AI gateway that runs in your own infrastructure. For most Portkey users, the switch means changing two values in client code, the base URL and the API key. Your providers, configs, and routing all move into one `config.yaml` file.

## Why LiteLLM

**Your requests stay with you.** The gateway, the database that holds your keys and budgets, and your logs all run in your VPC. LiteLLM has no vendor control plane. No prompts, responses, credentials, or telemetry are ever sent to LiteLLM ([Data Privacy and Security](../data_security.md)), and prompts are only stored in your own spend logs if you turn that on.

**Governance comes with the open-source build.** Virtual keys carry budgets and RPM/TPM limits per key, team, user, and end customer, adjustable at any time. Spend tracking and the Admin UI are included, as are exact-match and semantic caching (Redis, Valkey, Qdrant) and guardrails from Presidio, Lakera, Bedrock Guardrails, or your own code.

**No per-log pricing.** Logs go to your own Postgres, S3 bucket, or observability tool, kept for as long as you choose. The open-source gateway costs nothing per request.

**Works with your existing stack.** LiteLLM supports 100+ providers and plugs into tools you probably already run: Okta or Entra for SSO, Datadog, Langfuse, OpenTelemetry, Prometheus, and more.

**Low overhead.** The LiteLLM Rust gateway (beta) adds about 0.7 ms p99 latency in our [AI Gateway Bench](/blog/rust-ai-gateway-benchmarks), against 2.3 ms for Portkey.

## Convert your configs with an agent

The Portkey migration skill reads your Portkey configs (exported JSON, or pulled from the Portkey Admin API), asks where each provider's credentials should come from, and writes a LiteLLM `config.yaml` plus the team and key commands for step 2. Tell Claude Code, Codex, or Cursor:

<Command code="curl -fsSL https://docs.litellm.ai/skills/portkey-migration" id="skill-portkey-migration" note="Prints the skill. Save it to your agent's skills folder or paste it into the chat." />

Or run `curl -fsSL https://docs.litellm.ai/skills/portkey-migration and follow the instructions` as a prompt. The rest of this page is the same migration done by hand.

## Switch in four steps

### 1. Recreate providers and configs

Each Portkey AI Provider becomes a deployment in `config.yaml`. Name each deployment after the model string your code already sends, so nothing changes on the client side:

```yaml
model_list:
  # Apps that send a plain model name and pick routing with x-portkey-config
  - model_name: gpt-4o
    litellm_params: { model: openai/gpt-4o, api_key: os.environ/OPENAI_KEY_PROD, weight: 7 }
  - model_name: gpt-4o
    litellm_params: { model: openai/gpt-4o, api_key: os.environ/OPENAI_KEY_BACKUP, weight: 3 }
  - model_name: claude-sonnet
    litellm_params: { model: "anthropic/{{anthropic}}", api_key: os.environ/ANTHROPIC_API_KEY }

  # Apps that send Model Catalog strings such as "@openai-prod/gpt-4o"
  - model_name: "@openai-prod/*"
    litellm_params: { model: "openai/*", api_key: os.environ/OPENAI_KEY_PROD }

router_settings:
  num_retries: 3                               # retry.attempts
  timeout: 30                                  # request_timeout, in seconds instead of ms
  fallbacks: [{"gpt-4o": ["claude-sonnet"]}]   # strategy.mode: fallback

litellm_settings:
  cache: true
  cache_params: { type: redis, ttl: 3600 }     # cache.max_age; reads REDIS_HOST and REDIS_PORT

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
```

Deployments that share a `model_name` are load-balanced by `weight`, which replaces `strategy.mode: loadbalance`. A request for `@openai-prod/gpt-4o` matches the wildcard and is sent to `openai/gpt-4o` with the `OPENAI_KEY_PROD` key. Azure, Bedrock, Vertex, and other providers follow the same pattern; see [Providers](../providers).

Start the gateway. `DATABASE_URL` points at your Postgres, and `REDIS_HOST` and `REDIS_PORT` at the Redis the cache uses; drop those two and the `cache` lines if you are not caching yet.

```bash
docker run -d -p 4000:4000 -v $(pwd)/config.yaml:/app/config.yaml \
  -e LITELLM_MASTER_KEY -e LITELLM_SALT_KEY -e DATABASE_URL -e REDIS_HOST -e REDIS_PORT \
  -e OPENAI_KEY_PROD -e OPENAI_KEY_BACKUP -e ANTHROPIC_API_KEY \
  docker.litellm.ai/berriai/litellm:latest --config /app/config.yaml
```

### 2. Create teams and keys

Create one team per Portkey workspace, then issue a key for each service:

```bash
curl -X POST http://localhost:4000/team/new \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" -H "Content-Type: application/json" \
  -d '{"team_alias": "search-prod", "max_budget": 2000, "budget_duration": "30d"}'

curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" -H "Content-Type: application/json" \
  -d '{"team_id": "<team_id>", "key_alias": "search-api", "rpm_limit": 600, "tpm_limit": 400000}'
```

The first call returns the `team_id` to use in the second, and the second returns the virtual key your service will send. You can do the same from **Teams** and **Virtual Keys** in the Admin UI at `/ui`.

### 3. Point clients at LiteLLM

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://litellm.example.com",   # was PORTKEY_GATEWAY_URL
    api_key=os.environ["LITELLM_API_KEY"],    # was PORTKEY_API_KEY
)
```

You can keep model strings and request bodies as they are. LiteLLM ignores any leftover `x-portkey-*` headers, so you can remove them whenever it suits you.

If you use the Portkey SDK, swap it for the OpenAI SDK. The calls are the same: replace `Portkey(api_key=...)` with `OpenAI(base_url=..., api_key=...)`.

### 4. Cut over one service at a time

Send some traffic to LiteLLM first. Every response includes `x-litellm-overhead-duration-ms` (latency LiteLLM itself adds) and `x-litellm-response-cost` (spend), so you can compare against Portkey. Then move services over one by one. Before you close your Portkey account, export any Portkey logs you want to keep.

## Feature mapping

| Portkey | LiteLLM |
|---|---|
| Workspace | Team |
| Portkey API key | Virtual key (`/key/generate`) |
| Budgets and rate limits on keys | `max_budget`, `budget_duration`, `rpm_limit`, `tpm_limit` on keys, teams, users, or customers |
| `strategy.mode: conditional` | [Tag routing](../proxy/tag_routing.md): callers send `x-litellm-tags`, or set `metadata.tags` on their key |
| Fallback on context-length or content-policy errors | `context_window_fallbacks`, `content_policy_fallbacks` |
| `retry.on_status_codes` | `retry_policy` (per error type) |
| `cb_config` (circuit breaker) | `allowed_fails` and `cooldown_time` |
| Semantic cache | `cache_params.type: redis-semantic` or `qdrant-semantic` |
| `x-portkey-cache-force-refresh` | `"cache": {"no-cache": true}` in the body |
| `override_params` | `litellm_params` on the deployment |
| `input_guardrails` and `output_guardrails` | [`guardrails:`](../proxy/guardrails/quick_start.md) with `mode: pre_call` or `post_call` |
| `x-portkey-metadata` (`_user`, custom keys) | `user` field or `x-litellm-customer-id`; `x-litellm-tags` or `metadata` |
| `x-portkey-trace-id` | `x-litellm-trace-id` |
| Prompt templates | `prompt_id` and `prompt_variables`, stored in dotprompt, Langfuse, Humanloop, and others ([Prompt Management](../proxy/prompt_management.md)) |
| Logs and analytics | Admin UI, `/spend/logs/v2`, and callbacks such as `langfuse`, `otel`, `datadog`, `s3_v2` |

## Good to know

**You run it yourself.** LiteLLM needs Postgres, and Redis once you run more than one replica ([Production deployment](../proxy/prod.md)). [LiteLLM Enterprise](../enterprise.md) adds support and SLAs.

**Some features need an Enterprise license:** SSO for more than 5 users, audit logs, organizations and RBAC, per-key guardrails, and key rotation.

**Guardrail failures look different.** Portkey signals guardrail results with status codes `246` and `446`. LiteLLM returns a standard error response, so update any code that checks for those codes.

Questions? Ask on [Discord](https://discord.com/invite/wuPM9dRgDw), or [talk to us](https://www.litellm.ai/enterprise#talk-to-sales) about help with a larger migration.
