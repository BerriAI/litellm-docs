---
slug: muse-wonder-1-0
title: "Meta Muse Wonder API Pricing and Day 0 Support on LiteLLM"
date: 2026-10-12T12:00:00
authors:
  - misbah
  - mateo
  - kerry
description: "Muse Wonder 1.0 costs $4 per 1M input tokens and $20 per 1M output tokens. LiteLLM supports it on day 0 on the Meta Model API."
image: ./hero.png
tags: [meta, muse, muse-wonder-1.0, pricing, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import MuseWonderHero from './Hero';

export const Hero = MuseWonderHero;

LiteLLM now supports [Muse Wonder](https://about.fb.com/news/2026/10/introducing-muse-wonder-models/), Meta's most capable model, on Day 0 through the `meta/` route on the Meta Model API. Switching from Muse Spark is a model ID change, with spend, rate limits, and logging in one place.

{/* truncate */}

## Muse Wonder 1.0 pricing

- **Input:** $4.00 / MTok
- **Cached input:** $0.20 / MTok
- **Output:** $20.00 / MTok
- **Web search:** $2.50 per 1,000 queries

The rate is the same at any context length, and Muse Wonder has no contributor tier. Prices on every provider: https://models.litellm.ai/models

## What's new in Muse Wonder 1.0

- **Meta's most capable model**, built for complex software engineering and long-horizon agentic work, per Meta
- **Reasoning effort from `minimal` to `max`**; `none` is not supported
- **1M-token context** with text, image, video, audio, and PDF input
- **In preview** on the Meta Model API, Standard mode only

## Use Muse Wonder 1.0 with LiteLLM

Pricing landed in [PR #46072](https://github.com/BerriAI/litellm/pull/46072). No upgrade needed: open **Price Data** under **Models + Endpoints** in the UI and click **Reload Price Data** (or `POST /reload/model_cost_map`), on `v1.76.0` and above.

<Tabs>
<TabItem value="proxy" label="PROXY">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: muse-wonder-1.0
    litellm_params:
      model: meta/muse-wonder-1.0
      api_key: os.environ/META_API_KEY
```

**2. Start the proxy**

```bash
litellm --config /path/to/config.yaml
```

**3. Test it**

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{
    "model": "muse-wonder-1.0",
    "messages": [{"role": "user", "content": "Plan the refactor of a 20-file payments module."}],
    "reasoning_effort": "max"
  }'
```

</TabItem>

<TabItem value="sdk" label="SDK">

```python
from litellm import completion

response = completion(
    model="meta/muse-wonder-1.0",
    messages=[{"role": "user", "content": "Plan the refactor of a 20-file payments module."}],
    reasoning_effort="max",
)

print(response.choices[0].message.content)
```

</TabItem>
</Tabs>

## FAQ

### How much does Muse Wonder 1.0 cost?

$4 per 1M input tokens, $0.20 per 1M cached input tokens, and $20 per 1M output tokens, with reasoning tokens billed as output.

### What is the context window of Muse Wonder 1.0?

1,048,576 tokens, the same as Muse Spark 1.3.

### How do I call Muse Wonder 1.0 with an OpenAI-compatible API?

Add `meta/muse-wonder-1.0` to your LiteLLM config, then send a standard `/chat/completions` request to the proxy with `"model": "muse-wonder-1.0"`.

## Feedback

Questions and feedback go in [GitHub discussion #46080](https://github.com/BerriAI/litellm/discussions/46080).
