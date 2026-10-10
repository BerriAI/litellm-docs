---
title: Migrate from Bifrost to LiteLLM
sidebar_label: From Bifrost
description: Move from Bifrost to LiteLLM, keeping your provider/model names and sk-bf- virtual key values, and run multiple nodes on the open-source build. A skill converts your Bifrost config.json into a LiteLLM config.yaml.
---

import {Command, OneClickDeploy} from '@site/src/components/Conversion';

# Migrate from Bifrost to LiteLLM

Teams usually move from Bifrost to LiteLLM for one of three reasons: they need to run more than one node, they need guardrails, or they need more providers and endpoints. You can keep your `provider/model` names and your `sk-bf-*` virtual key values, so most clients only change the base URL.

## Why LiteLLM

### Multiple nodes on the open-source build

You can run as many LiteLLM replicas as you need behind a load balancer, all sharing one Postgres and one Redis. Keys, budgets, rate limits, cooldowns, and the cache are shared across every replica, and Admin UI changes reach all of them without a restart ([What needs Redis](../proxy/redis_requirements.md)).

### What's included in the open-source build

| Capability | Bifrost OSS | LiteLLM OSS |
|---|---|---|
| Multiple nodes sharing keys, budgets, and limits | Enterprise (cluster mode) | Yes, with Postgres and Redis |
| Guardrails | Enterprise | Yes: Presidio, Lakera, Bedrock, Aporia, custom |
| Adaptive load balancing | Enterprise | Yes: routing by latency, cost, or usage, with cooldowns |
| Circuit breaker | Enterprise | Yes: `allowed_fails` and `cooldown_time` |
| Datadog | Enterprise | Yes |
| Virtual keys, budgets, rate limits | Yes | Yes, plus budgets per user, team, and end customer |
| Semantic cache | Yes | Yes: Redis, Valkey, Qdrant |
| MCP gateway | Yes | Yes |
| A2A agent gateway | No | Yes |
| SSO | Enterprise | Up to 5 users, then Enterprise |
| RBAC, audit logs | Enterprise | Enterprise |

### More providers and endpoints

LiteLLM supports 100+ providers out of the box ([list](/docs/providers)), including DeepSeek, Together, Fireworks, Groq, vLLM, Ollama, SageMaker, Databricks, and watsonx. Beyond chat, it also serves fine-tuning, vector stores, moderations, and batches. Anthropic's `/v1/messages` is served at the root path, so Claude Code and the Anthropic SDK connect directly ([Supported endpoints](/docs/supported_endpoints)).

### Rust gateway for latency-sensitive routes

In our [AI Gateway Bench](/blog/rust-ai-gateway-benchmarks), the LiteLLM Rust gateway (beta) added about 0.7 ms of p99 overhead against 4.5 ms for Bifrost, and peaked at 21.8 MB of memory. You turn it on per model with `rust: true`. Routes the Rust gateway doesn't cover yet run on the Python proxy automatically ([Rust gateway](../proxy/rust_gateway.md)). This is our own benchmark, run against a mock upstream, so test it on your own workload.

### Works with your observability stack

LiteLLM has built-in callbacks for Langfuse, Arize Phoenix, Datadog, OpenTelemetry, Langsmith, Prometheus, and S3.

## Convert your config with an agent

The Bifrost migration skill reads your Bifrost `config.json`, writes a LiteLLM `config.yaml` that keeps your `provider/model` names, and turns your governance section into the team, customer, and key commands for step 2, carrying over each `sk-bf-*` value. Tell Claude Code, Codex, or Cursor:

<Command code="curl -fsSL https://docs.litellm.ai/skills/bifrost-migration" id="skill-bifrost-migration" note="Prints the skill. Save it to your agent's skills folder or paste it into the chat." />

Or run `curl -fsSL https://docs.litellm.ai/skills/bifrost-migration and follow the instructions` as a prompt. The rest of this page is the same migration done by hand.

## Switch in four steps

### 1. Convert `config.json` to `config.yaml`

If you name models the way Bifrost does (`openai/{{openai_small}}`), clients don't need to change their model strings.

Bifrost:

```json
{
  "providers": {
    "openai": {
      "keys": [
        { "name": "primary", "value": "env.OPENAI_KEY_1", "models": ["*"], "weight": 2.0 },
        { "name": "secondary", "value": "env.OPENAI_KEY_2", "models": ["*"], "weight": 1.0 }
      ],
      "network_config": { "default_request_timeout_in_seconds": 120, "max_retries": 3 }
    },
    "anthropic": { "keys": [{ "name": "anthropic", "value": "env.ANTHROPIC_API_KEY", "models": ["*"], "weight": 1.0 }] }
  },
  "governance": {
    "routing_rules": [{ "id": "fb", "name": "fallback", "cel_expression": "true",
      "targets": [{ "provider": "openai", "weight": 1.0 }], "fallbacks": ["anthropic/{{anthropic}}"] }]
  }
}
```

LiteLLM:

```yaml
model_list:
  - model_name: "openai/*"
    litellm_params: { model: "openai/*", api_key: os.environ/OPENAI_KEY_1, weight: 2 }
  - model_name: "openai/*"
    litellm_params: { model: "openai/*", api_key: os.environ/OPENAI_KEY_2, weight: 1 }
  - model_name: "anthropic/*"
    litellm_params: { model: "anthropic/*", api_key: os.environ/ANTHROPIC_API_KEY }

router_settings:
  num_retries: 3
  timeout: 120
litellm_settings:
  default_fallbacks: ["anthropic/{{anthropic}}"]   # routing rule with cel_expression "true"

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
```

A request for `openai/{{openai_small}}` matches the `openai/*` wildcard and is split across the two keys by `weight`. If it still fails after retries, LiteLLM sends it to `anthropic/{{anthropic}}`.

Start the gateway. `DATABASE_URL` points at your Postgres, and `LITELLM_MASTER_KEY` and `LITELLM_SALT_KEY` must be set first (for example `sk-` followed by the output of `openssl rand -hex 32`):

```bash
docker run -d -p 4000:4000 -v $(pwd)/config.yaml:/app/config.yaml \
  -e LITELLM_MASTER_KEY -e LITELLM_SALT_KEY -e DATABASE_URL \
  -e OPENAI_KEY_1 -e OPENAI_KEY_2 -e ANTHROPIC_API_KEY \
  docker.litellm.ai/berriai/litellm:latest --config /app/config.yaml
```

<OneClickDeploy source="migrate-bifrost" />

### 2. Import virtual keys with the same values

LiteLLM accepts custom key values that start with `sk-`, so your existing `sk-bf-*` keys work unchanged. Create teams first, then import each key:

```bash
curl -X POST http://localhost:4000/team/new \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" -H "Content-Type: application/json" \
  -d '{"team_alias": "platform", "max_budget": 1000, "budget_duration": "30d"}'

curl -X POST http://localhost:4000/key/generate \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" -H "Content-Type: application/json" \
  -d '{"key": "sk-bf-your-existing-key", "key_alias": "platform-key", "team_id": "<team_id>",
       "models": ["openai/*", "anthropic/*"],
       "max_budget": 1000, "budget_duration": "30d", "rpm_limit": 600, "tpm_limit": 400000}'
```

The first call returns the `team_id` to use in the second. Customers map to `POST /customer/new`. Budget windows convert directly: Bifrost's `1M` is `1mo` or `30d` in LiteLLM, `1w` is `7d`, and `1d` and `1h` stay the same. In LiteLLM you can also put rate limits on teams and users, not just on keys.

### 3. Point clients at LiteLLM

```python
from openai import OpenAI

client = OpenAI(base_url="http://litellm:4000", api_key="sk-bf-...")   # was http://bifrost:8080/openai
```

| Bifrost | LiteLLM |
|---|---|
| `/v1/...`, `/openai`, `/litellm` | `http://litellm:4000` |
| `/anthropic` | `http://litellm:4000` (native `/v1/messages`) |
| `/genai` | `http://litellm:4000/gemini` ([Google AI Studio pass-through](../pass_through/google_ai_studio.md)) |
| `x-bf-vk: sk-bf-...` | `Authorization: Bearer sk-bf-...` or `x-api-key: sk-bf-...` (the OpenAI and Anthropic SDKs already send these) |
| `"fallbacks": ["provider/model"]` in the body | Unchanged |

LiteLLM does not read the `x-bf-vk` header, so clients that set only that header must send the key as a bearer token instead. If you embed Bifrost's Go SDK, call LiteLLM over HTTP with any OpenAI-compatible Go client.

### 4. Scale out

Point every replica at the same Postgres and Redis:

```yaml
router_settings:
  redis_host: os.environ/REDIS_HOST
  redis_port: os.environ/REDIS_PORT
  redis_password: os.environ/REDIS_PASSWORD
```

Rate limits and budgets are then enforced across all replicas together: a key with `rpm_limit: 600` gets 600 requests per minute in total, not 600 per node.

For latency-critical Anthropic models, add `rust: true` to `litellm_params` and set `LITELLM_RUST=true` in the gateway's environment; responses served by the Rust core carry an `x-litellm-rust: true` header. Shadow some traffic first and compare `x-litellm-overhead-duration-ms` and `x-litellm-response-cost` against Bifrost before you move each service over.

## Feature mapping

| Bifrost | LiteLLM |
|---|---|
| key `weight` | `weight` in `litellm_params` |
| key `models` (allowlist) | One deployment per model instead of a `provider/*` wildcard, or `models` on the virtual key |
| key `aliases` | `model_name`, or `router_settings.model_group_alias` |
| `env.VAR` | `os.environ/VAR` |
| `network_config.base_url` / `extra_headers` | `api_base` / `extra_headers` in `litellm_params` |
| `azure_key_config` / `bedrock_key_config` / `vertex_key_config` | `api_base` + `api_version` / `aws_region_name` / `vertex_project` + `vertex_location` |
| `budgets[]` (`max_limit`, `reset_duration`) | `max_budget`, `budget_duration` on the key, team, or customer |
| `rate_limits[]` (`request_max_limit`, `token_max_limit`) | `rpm_limit`, `tpm_limit` |
| Virtual key `provider_configs[].allowed_models` | `models` on the key |
| Routing rules (CEL on headers or metadata) | [Tag routing](../proxy/tag_routing.md) or per-team model lists |
| `plugins: semantic_cache` | `cache_params.type: redis-semantic` / `qdrant-semantic` |
| `plugins: otel`, `datadog`, `maxim` | `callbacks: ["otel"]`, `["datadog"]`, or any logging callback |
| `mcp.client_configs[]` | `mcp_servers:` ([MCP gateway](../mcp.md)) |
| `config_store: postgres` | `DATABASE_URL` |

## Good to know

**The Rust gateway is still beta.** Routes it doesn't cover run on the Python proxy, which adds more overhead than Bifrost.

**No embedded Go SDK.** LiteLLM is called over HTTP.

**Some features need an Enterprise license:** organizations and RBAC, audit logs, per-key model budgets, key rotation, SSO for more than 5 users, and secret managers ([LiteLLM Enterprise](../enterprise.md)).

Questions? Ask on [Discord](https://discord.com/invite/wuPM9dRgDw), or [talk to us](https://www.litellm.ai/enterprise#talk-to-sales) about help with a larger migration.
