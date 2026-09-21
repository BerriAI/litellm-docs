# TypeSafe AI (Jev)

Pass-through endpoint for the [TypeSafe AI](https://docs.typesafe.ai/api) System One API. Jev returns typed decisions (a choice, a score, or a yes/no probability) instead of text, so it is called through its own evaluate endpoint rather than `/chat/completions`.

| Feature | Supported | Notes |
|-------|-------|-------|
| Cost Tracking | ✅ | Priced from the response `usage` and the model registry |
| Logging | ✅ | works across all integrations |
| End-user Tracking | ❌ | [Tell us if you need this](https://github.com/BerriAI/litellm/issues/new) |
| Streaming | ❌ | Not offered by the TypeSafe API |

Just replace `https://api.typesafe.ai` with `LITELLM_PROXY_BASE_URL/typesafe` 🚀

LiteLLM adds the TypeSafe API key from the proxy environment, so clients only need a LiteLLM virtual key.

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

## Cost Tracking

Spend uses `usage.input_tokens` and `usage.output_tokens` from the response and the `typesafe/<model>` entry in LiteLLM's model registry (`jev-1.13.0`, `jev-latest`, `jev-preview`). The request is logged under the versioned model TypeSafe reports, for example `typesafe/jev-1.13.0`, even when the request used an alias.
