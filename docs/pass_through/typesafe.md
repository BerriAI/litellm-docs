# TypeSafe AI (Jev)

Pass-through endpoint for the [TypeSafe AI](https://docs.typesafe.ai/api) System One API. Jev returns typed decisions (a choice, a score, or a yes/no probability) instead of text, so it is called through its own evaluate endpoint rather than `/chat/completions`.

| Feature | Supported | Notes |
|-------|-------|-------|
| Cost Tracking | ✅ | Priced from the response `usage` and the model registry |
| Logging | ✅ | works across all integrations |
| End-user Tracking | ❌ | [Tell us if you need this](https://github.com/BerriAI/litellm/issues/new) |
| Streaming | ❌ | Not offered by the TypeSafe API |

Just replace `https://api.typesafe.ai` with `LITELLM_PROXY_BASE_URL/typesafe` 🚀

LiteLLM adds the TypeSafe API key from the proxy environment, so clients only need a LiteLLM virtual key. If that key, its team, or its project restricts `models`, the Jev model has to be on those lists too; see [Model Access](#model-access).

To let JEV pick the model for a completion, configure the [JEV Auto Router](/docs/auto_router/setup#jev-classifier-typesafe-ai) with `classifier_type: jev` and `jev_classifier_config`. It uses one System One Choice question for the configured tiers, then dispatches to the selected completion model. See [routing context, fallback and accounting](/docs/proxy/auto_routing#jev-classifier) and the [measured classifier comparison](/blog/jev-auto-router-benchmark)

## Quick Start

1. Set the TypeSafe API key in the proxy environment

```bash showLineNumbers
export TYPESAFE_API_KEY=""
# optional, defaults to https://api.typesafe.ai
export TYPESAFE_API_BASE="https://api.typesafe.ai"
```

2. Start the proxy

```bash showLineNumbers
litellm

# RUNNING on http://0.0.0.0:4000
```

3. Ask Jev a question through the proxy

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/typesafe/v1/systemone' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "state": "Help! My payouts have been failing for 3 days.",
  "model": "jev-latest",
  "questions": {
    "department": {
      "type": "choice",
      "instructions": "Which team should handle this?",
      "criteria": {
        "billing": "Payments, invoicing, refunds",
        "technical": "Bugs, outages, integrations",
        "sales": "Pricing, upgrades, new accounts"
      }
    }
  }
}'
```

The response is TypeSafe's own, unchanged:

```json
{
  "model": "jev-1.13.0",
  "answers": {
    "department": {
      "type": "choice",
      "choice": "technical",
      "probabilities": {"billing": 0.08, "technical": 0.85, "sales": 0.07},
      "confidence": 0.82
    }
  },
  "usage": {"input_tokens": 312, "output_tokens": 48}
}
```

Any path under `/typesafe/` is forwarded, so `GET /typesafe/v1/models` lists the available models. [See the TypeSafe API reference](https://docs.typesafe.ai/api)

## Model Access

`/typesafe` runs the same model access check as `/chat/completions`. The `model` field in the request body is checked against the virtual key's `models` list and against the `models` lists of the team and project it belongs to. A key with no restrictions can call any Jev model, while a key whose team or project only lists chat deployments gets a 403 `team_model_access_denied` for `jev-latest` until you add it. Custom pass-through endpoints defined under `pass_through_endpoints` in your config skip this check; built-in provider routes like `/typesafe` do not.

Jev models are not router deployments, so they do not appear in the model picker or in `all-team-models`, and you have to type the name in. Adding the wildcard `jev-*` covers `jev-latest`, `jev-preview`, and every versioned model in one entry. Add it to the team first, then to the project if the key belongs to one:

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/team/model/add' \
-H "Authorization: Bearer $LITELLM_MASTER_KEY" \
-H 'Content-Type: application/json' \
-d '{"team_id": "my-team-id", "models": ["jev-*"]}'
```

See [Restrict Model Access](/docs/proxy/model_access) for how key, team, and project lists combine.

## Cost Tracking

Spend uses `usage.input_tokens` and `usage.output_tokens` from the response and the `typesafe/<model>` entry in LiteLLM's model registry (`jev-1.13.0`, `jev-latest`, `jev-preview`). The request is logged under the versioned model TypeSafe reports, for example `typesafe/jev-1.13.0`, even when the request used an alias.
