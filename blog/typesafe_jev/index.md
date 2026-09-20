---
slug: typesafe_jev
title: "Day 0 Support: TypeSafe Jev"
date: 2026-09-20T10:00:00
authors:
  - misbah
  - mateo
description: "Day 0 support for TypeSafe AI's Jev on LiteLLM v1.103.0-rc: call it through the proxy, use it as the Auto Router classifier, or let it compact agent tool history."
tags: [typesafe, jev, auto router, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

LiteLLM supports [TypeSafe AI's Jev](https://docs.typesafe.ai/api) on day 0, launching today in `v1.103.0-rc`. Jev is a decision model: it returns a choice, a score, or a yes/no probability instead of text. LiteLLM wires it in three places: a pass-through endpoint, an Auto Router classifier, and a compaction guardrail.

{/* truncate */}

## Pricing

$0.042 per 1M input tokens, no output charge. Spend is logged under the versioned model TypeSafe reports (`typesafe/jev-1.13.0` today), even when you request `jev-latest`.

## Usage

Set your TypeSafe key once on the proxy. Clients only need a LiteLLM virtual key.

```bash
export TYPESAFE_API_KEY="your-typesafe-api-key"
```

<Tabs>
<TabItem value="passthrough" label="Pass-through">

Replace `https://api.typesafe.ai` with `LITELLM_PROXY_BASE_URL/typesafe`. Any path under `/typesafe/` is forwarded, with logging and cost tracking.

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

</TabItem>
<TabItem value="autorouter" label="Auto Router classifier">

`classifier_type: jev` sends each request to Jev as one `choice` question whose criteria are your tier labels.

```yaml
model_list:
  - model_name: smart-router
    litellm_params:
      model: auto_router/complexity_router
      complexity_router_config:
        tiers:
          SIMPLE: gpt-5.6-mini
          COMPLEX: claude-opus-5
        classifier_type: jev
      complexity_router_default_model: gpt-5.6-mini
```

</TabItem>
<TabItem value="compaction" label="Compaction guardrail">

Jev judges whether each older tool result is still relevant to the latest user message; LiteLLM blanks the ones that are not before calling your model.

```yaml
guardrails:
  - guardrail_name: jev-compaction
    litellm_params:
      guardrail: typesafe
      mode: pre_call
      api_key: os.environ/TYPESAFE_API_KEY
```

</TabItem>
</Tabs>

Docs: [TypeSafe pass-through](/docs/pass_through/typesafe), [Auto Router setup](/docs/auto_router/setup#jev-classifier-typesafe-ai), [compaction deep dive](/blog/typesafe-jev-compaction).

## Feedback

Running Jev through LiteLLM and hitting something unexpected? Open a [GitHub discussion](https://github.com/BerriAI/litellm/discussions).
