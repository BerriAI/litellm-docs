---
slug: typesafe_jev
title: "TypeSafe Jev on LiteLLM"
date: 2026-09-20T10:00:00
authors:
  - kerry
description: "TypeSafe AI's Jev lands in LiteLLM v1.103.0-rc: call it through the proxy with logging and cost tracking."
tags: [typesafe, jev, product]
hide_table_of_contents: false
---

[TypeSafe AI's Jev](https://docs.typesafe.ai/api) launches on LiteLLM today in `v1.103.0-rc`. Jev is a decision model: it returns a choice, a score, or a yes/no probability instead of text, so it has its own evaluate endpoint rather than `/chat/completions`. LiteLLM proxies that endpoint with logging and cost tracking.

{/* truncate */}

## Pricing

$0.042 per 1M input tokens, no output charge. Spend is logged under the versioned model TypeSafe reports (`typesafe/jev-1.13.0` today), even when you request `jev-latest`.

## Usage

Set your TypeSafe key once on the proxy, then replace `https://api.typesafe.ai` with `LITELLM_PROXY_BASE_URL/typesafe`. Clients only need a LiteLLM virtual key.

```bash
export TYPESAFE_API_KEY="your-typesafe-api-key"
```

```bash
curl -X POST "http://0.0.0.0:4000/typesafe/v1/systemone" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "state": "Help! My payouts have been failing for 3 days.",
    "model": "jev-latest",
    "questions": {
      "department": {
        "type": "choice",
        "instructions": "Which team should handle this?",
        "criteria": {
          "billing": "Payments, invoicing, refunds",
          "technical": "Bugs, outages, integrations"
        }
      }
    }
  }'
```

The response is TypeSafe's own, unchanged. Any path under `/typesafe/` is forwarded, so `GET /typesafe/v1/models` lists the available models. Full details in the [TypeSafe pass-through docs](/docs/pass_through/typesafe).

## Feedback

Running Jev through LiteLLM and hitting something unexpected? Open a [GitHub discussion](https://github.com/BerriAI/litellm/discussions).
