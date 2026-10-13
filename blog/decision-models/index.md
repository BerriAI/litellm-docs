---
slug: decision-models
title: "Decision models on LiteLLM: /v1/decisions and /v1/systemone"
date: 2026-10-14T10:00:00
authors:
  - kerry
description: "Call decision models from OpenAI, TypeSafe, Perplexity, Cloudflare, Databricks, Microsoft Foundry and self-hosted servers through one gateway, with cost tracking, keys and budgets."
card_title: "Decision Models"
card_summary: "Typed yes/no, choice and score answers as probabilities, from 9 providers on /v1/decisions and /v1/systemone."
draft: true
tags: [openai, typesafe, decisions, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

Decision models answer typed questions about an input and return probabilities instead of text: a yes/no probability, a pick from a fixed list, or a score on a scale. LiteLLM now serves them on `POST /v1/decisions` (OpenAI's Decisions format) and `POST /v1/systemone` (TypeSafe's System One format), with the same virtual keys, budgets, spend logs, load balancing and fallbacks as `/chat/completions`.

{/* truncate */}

## What's new

- **One request shape, nine providers.** OpenAI (`gpt-6-luna`), TypeSafe Jev, Fireworks AI, Perplexity, Cloudflare Clef, Databricks (including `ai_decide`), Microsoft Foundry Decision-1, Strands Decider and vLLM. LiteLLM translates between the two formats, so the route you call does not limit the provider you use.
- **Probabilities, not prose.** A `predicate` returns `probability`, a `choice` returns the picked value with per-option probabilities, a `score` returns a value on your scale. No parsing of model text, no retries on malformed JSON.
- **Cost tracking from the first call.** Every answer carries `x-litellm-response-cost` and lands in the spend logs, so decision traffic shows up in the same budgets and dashboards as chat.
- **Image input on OpenAI.** Send `input_image` parts with the question set. Other providers return a 400 on images, so the gateway tells you instead of silently dropping them.
- **Decisions playground in the Admin UI.** Pick either route, fill the form or paste JSON, and read the probabilities back. Add a decision model from **Models + Endpoints** like any other model.

Available in `v1.104.2` and later on the `1.104.x` line and in `v1.105.0-rc.3` and later. The Playground tab is in releases after `v1.105.0`.

## Usage

<Tabs>
<TabItem value="openai" label="OpenAI">

```yaml showLineNumbers
model_list:
  - model_name: luna
    litellm_params:
      model: openai/gpt-6-luna
      api_key: os.environ/OPENAI_API_KEY
```

</TabItem>
<TabItem value="typesafe" label="TypeSafe Jev">

```yaml showLineNumbers
model_list:
  - model_name: jev
    litellm_params:
      model: typesafe/jev-latest
      api_key: os.environ/TYPESAFE_API_KEY
```

</TabItem>
<TabItem value="azure_ai" label="Microsoft Foundry">

```yaml showLineNumbers
model_list:
  - model_name: decision-1
    litellm_params:
      model: azure_ai/decision-1
      api_base: https://<resource>.services.ai.azure.com
      api_key: os.environ/AZURE_AI_API_KEY
    model_info:
      base_model: azure_ai/Microsoft-Decision-1
```

</TabItem>
</Tabs>

Ask one question of each type. Change `"model"` to `"jev"` or `"decision-1"` and the same request goes to TypeSafe or Foundry and comes back in the same shape.

```bash showLineNumbers
curl -X POST 'http://0.0.0.0:4000/v1/decisions' \
-H "Authorization: Bearer $LITELLM_API_KEY" \
-H 'Content-Type: application/json' \
-d '{
  "model": "luna",
  "input": "Customer wrote: I was charged twice for my order #4411 and want one of the charges refunded today.",
  "questions": [
    {"type": "predicate", "name": "is_refund_request", "instructions": "Is the customer asking for a refund?"},
    {"type": "choice", "name": "needs_human", "instructions": "Should a human agent take over?",
     "choices": [{"value": true, "description": "billing dispute that needs a person"}, {"value": false}]},
    {"type": "score", "name": "frustration", "instructions": "How frustrated is the customer?",
     "levels": [{"label": "calm"}, {"label": "mildly annoyed"}, {"label": "angry"}]}
  ]
}'
```

```json
{
  "model": "gpt-6-luna",
  "answers": [
    {"type": "predicate", "name": "is_refund_request", "probability": 1.0},
    {"type": "choice", "name": "needs_human", "choice": true,
     "probabilities": [{"value": true, "probability": 0.99}, {"value": false, "probability": 0.01}], "confidence": 0.98},
    {"type": "score", "name": "frustration", "score": 0.74, "confidence": 0.61,
     "probabilities": [{"value": 0, "label": "calm", "probability": 0.26}, {"value": 1, "label": "mildly annoyed", "probability": 0.74}, {"value": 2, "label": "angry", "probability": 0.0}]}
  ],
  "usage": {"input_tokens": 401, "output_tokens": 0, "total_tokens": 401}
}
```

Full reference, the System One format, SDK usage and the provider table are in the [decisions docs](/docs/decisions).

## Feedback

Tell us which decision providers you want next in [GitHub Discussions](https://github.com/BerriAI/litellm/discussions).
