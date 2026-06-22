# Hlido Agent Trust

Use [Hlido](https://hlido.eu) as a LiteLLM proxy guardrail to gate requests on independent trust scores for third party AI agents.

**Supported endpoints:** The Hlido integration supports the chat completions endpoint (`/v1/chat/completions`).

Hlido is an independent review platform for AI agent products. Each reviewed agent gets a trust score (0 to 100), a tier, a claim by claim audit, and a public machine readable scorecard. This guardrail checks the agents your request depends on against your trust policy before the request reaches the model. It does not scan message content; it verifies counterparties.

A typical use case: an org routes LLM traffic for workflows that call third party agent vendors. Platform teams pin the vendors a route uses in the guardrail config, or callers pass them per request, and the gateway blocks the call when a vendor's independently tested score is below the configured minimum.

## Overview

| Property | Details |
|----------|---------|
| Provider | [Hlido](https://hlido.eu) |
| LiteLLM guardrail value | `hlido` |
| Supported modes | `pre_call`, `during_call` |
| Supported behavior | Allow or block based on agent trust score, tier, or review status |
| Default failure behavior | Allow on API errors and unreviewed agents (configurable) |
| Required credentials | None; the free tier needs no API key |

## Quick Start

### 1. Define the guardrail in `config.yaml`

```yaml
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: hlido-trust
    litellm_params:
      guardrail: hlido
      mode: pre_call
      default_on: true
      optional_params:
        min_score: 60
```

### 2. Start the proxy

```shell
litellm --config config.yaml
```

### 3. Make a request that declares its agent dependencies

```shell
curl -s http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Draft the outreach email"}],
    "metadata": {"hlido_slugs": ["klariqo"]}
  }'
```

If the agent's trust score is below `min_score`, the request is blocked before any provider call and the error names the agent, its score, the required minimum, and a link to the evidence page on hlido.eu.

## Configuration

All parameters are optional.

| Parameter | Where | Default | Description |
|-----------|-------|---------|-------------|
| `api_base` | `litellm_params` | `https://hlido.eu` | Hlido API base URL; env fallback `HLIDO_API_BASE` |
| `api_key` | `litellm_params` | none | Optional `hlk_live_*` key for higher rate limits; env fallback `HLIDO_API_KEY`. The free tier needs no key |
| `min_score` | `optional_params` | `60` | Minimum trust score (0 to 100). Applied when set, or when neither `min_score` nor `allowed_tiers` is configured |
| `allowed_tiers` | `optional_params` | none | Tiers the agent must be in, for example `["VITAL", "STRONG"]` |
| `slugs` | `optional_params` | none | Agent slugs verified on every request through this guardrail |
| `on_unverified` | `optional_params` | `allow` | What to do when a slug has no Hlido review: `allow` or `block` |
| `on_error` | `optional_params` | `allow` | What to do when the Hlido API is unreachable: `allow` or `block` |
| `cache_ttl` | `optional_params` | `300` | Seconds to cache trust lookups per slug |

Slugs come from two places and are merged: the static `slugs` list in the guardrail config, and the per request `metadata.hlido_slugs` list. Slugs are the identifiers used on hlido.eu review pages, for example `https://hlido.eu/reviews/klariqo/` has slug `klariqo`. Browse reviewed agents at [hlido.eu](https://hlido.eu) or query the registry at `https://hlido.eu/data/review-registry.json`.

### Strict policy example

Block anything that is not a top tier agent, including agents Hlido has not reviewed:

```yaml
guardrails:
  - guardrail_name: hlido-strict
    litellm_params:
      guardrail: hlido
      mode: pre_call
      default_on: true
      optional_params:
        allowed_tiers: ["VITAL", "STRONG"]
        on_unverified: block
        on_error: block
        slugs: ["try-sanebox", "lindy"]
```

## How it works

For each slug, the guardrail calls `GET https://hlido.eu/v1/agents/{slug}`, a public endpoint returning the agent's current score, tier, and evidence URL. Results are cached in memory per slug for `cache_ttl` seconds, so steady state traffic adds no per request latency. A blocked request raises the standard LiteLLM guardrail error before any tokens are spent.

For Hlido product information visit [https://hlido.eu](https://hlido.eu). For support contact `ankit@hlido.eu`.
