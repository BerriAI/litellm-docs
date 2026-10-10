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

To call Jev through your `model_list` with load balancing, fallbacks and per-deployment keys, or to send the same request to OpenAI, Perplexity, OpenRouter, Cloudflare or Strands Decider, use the unified [`/v1/systemone` endpoint](../decisions.md#v1systemone) instead. It takes the same System One body, and [`/v1/decisions`](../decisions.md#v1decisions) takes the OpenAI Decisions format

To let JEV pick the model for a completion, configure the [JEV Auto Router](/docs/auto_router/setup#jev-classifier-typesafe-ai) with `classifier_type: jev` and `jev_classifier_config`. It uses one System One Choice question for the configured tiers, then dispatches to the selected completion model. See [routing context, fallback and accounting](/docs/proxy/auto_routing#jev-classifier) and the [measured classifier comparison](/blog/jev-auto-router-benchmark)

The [OSS classifier guide](/docs/auto_router/decision_classifiers) documents the canonical `classifier_type: oss_classifier` and `opensource_classifier_config.provider: jev` names, which require a gateway build containing [backend #43626](https://github.com/BerriAI/litellm/pull/43626). Both configurations use the TypeSafe transport; the new backend continues to accept the existing Jev names.

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

## Try it in the Admin UI

The Playground has a **System One** tab (Beta) for sending Jev requests without curl. Open `LITELLM_PROXY_BASE_URL/ui/?page=llm-playground&tab=system-one`, or go to **Playground** and pick **System One**. The proxy still needs `TYPESAFE_API_KEY`; without it the upstream error shows inline

The left side holds a request preloaded with an issue triage example that asks one question of each type: `area` (choice), `has_repro_steps` (noul) and `severity` (score). The `model` is set in the request (for example `jev-latest`) rather than picked from the model list, and **Reset example** restores the example

The editor opens on a **Form** tab, so you can build a request without writing JSON. Type the text the model should read into **Input**, then edit each question card: its name, its type (**Choice**, **Yes / no** or **Score**), its **Instructions**, and its criteria. A choice takes options with descriptions, a yes / no question takes **Yes means** and **No means**, and a score takes levels numbered from 0. **Add question**, **Add option** and **Add level** add rows, and the trash buttons remove them

The **JSON** tab edits the same request as raw JSON, so a change in either tab shows up in the other, and fields the form has no input for, such as `metadata`, are kept. A request the form cannot show, such as JSON with a syntax error, gets an **Edit in JSON** button instead. **Format JSON** on that tab reindents the request. Releases without the **Form** tab show only the JSON editor

The request is checked as you type. `state` and a non-empty `questions` object are required, every question needs `instructions`, choice `criteria` must map 1 to 255 labels to descriptions, noul `criteria` is optional with `true` and `false` descriptions, and score `criteria` is a list of at least 2 levels. Errors are listed by JSON path and disable **Send**; more than 10 score levels only shows a warning. Fields outside these are forwarded to TypeSafe unchanged

**Virtual Key Source** picks the key: **Current UI Session** uses your dashboard login, and **Virtual Key** lets you paste one so the call is attributed and budgeted against that key. **Send** posts to `/typesafe/v1/systemone`, the same endpoint as the curl above, so spend and logs land the same way

The right side shows a **Question breakdown** of the state and each question's criteria, and once the call returns, the answers above it: the picked choice with confidence and a probability bar per option, the noul probability, and the score with its legend and per-level probabilities. The model TypeSafe reports, input and output tokens, latency and the raw JSON response are shown under the answers. Auth and upstream errors, such as a 401 for an unknown key, show inline

## Cost Tracking

Spend uses `usage.input_tokens` and `usage.output_tokens` from the response and the `typesafe/<model>` entry in LiteLLM's model registry (`jev-1.13.0`, `jev-latest`, `jev-preview`). The request is logged under the versioned model TypeSafe reports, for example `typesafe/jev-1.13.0`, even when the request used an alias.
