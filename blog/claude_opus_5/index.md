---
slug: claude_opus_5
title: "Day 0 Support: Claude Opus 5"
date: 2026-07-24T10:00:00
authors:
  - mateo
  - krrish
  - ishaan-alt
description: "Day 0 support for Claude Opus 5 on the LiteLLM AI Gateway. Use it across Anthropic, Azure, Vertex AI, and Bedrock."
tags: [anthropic, claude, opus 5, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

![LiteLLM x Claude Opus 5](/img/litellm_claude_opus_5_announcement.png)

LiteLLM now supports [Claude Opus 5](https://www.anthropic.com/news/claude-opus-5) on Day 0. Use it across Anthropic, Azure, Vertex AI, and Bedrock through the LiteLLM AI Gateway. Call it with the same OpenAI-compatible request you already use, and track spend, rate limits, and logging in one place.

{/* truncate */}

## What's new in Opus 5

Opus 5 holds Opus 4.8's price, $5 / MTok in and $25 / MTok out, and spends the generation on closing the gap to Fable 5. Anthropic reports it beats every other model on Frontier-Bench v0.1 at more than double Opus 4.8's score and a lower cost per task, triples the next-best score on ARC-AGI 3, and at `max` effort lands within 0.5% of Fable 5's peak CursorBench 3.2 result for half the cost per task ([details from Anthropic](https://www.anthropic.com/news/claude-opus-5)). If you route a tier of work to Fable 5 today purely because Opus 4.8 could not carry it, that split is now worth re-measuring.

The specs are familiar: a 1M-token context window, up to 128K output tokens, and vision, PDF input, computer use, tool calling, prompt caching, and structured output on every provider LiteLLM supports. Two numbers did move. The knowledge cutoff is May 2026, the most recent of any Claude model, and the prompt cache minimum drops from 1,024 tokens to 512, which pulls shorter system prompts into the $0.50 / MTok read rate that previously did not qualify. Fast mode also got cheap enough to consider for interactive work: `speed: "fast"` on the Anthropic provider buys roughly 2.5x faster output at a 2x premium, down from 6x on Opus 4.6.

## Before you switch from Opus 4.8

The swap is not free. Requests that omit `thinking` now run with adaptive thinking where the same request on Opus 4.8 ran without it, so latency and output cost both move on workloads you never tuned for reasoning; `max_tokens` still caps thinking and response text together. Priority Tier and web fetch are gone, so plan that capacity and tooling separately. Opus 5's cybersecurity classifiers can also decline a request outright with `stop_reason: "refusal"` and a category in `stop_details`, which is worth handling explicitly or routing around with LiteLLM [fallbacks](../../docs/proxy/reliability).

Sampling parameters (`temperature`, `top_p`, `top_k`), fixed thinking budgets, and assistant message prefill remain unsupported, same as Opus 4.8.

## Enabling Opus 5

Opus 5 ships in the **`v1.95.0-dev.2`** image, but most proxies do not need to upgrade at all. On the default remote cost map, open the **Price Data** tab under **Models + Endpoints** in the UI and click **Reload Price Data** (or `POST /reload/model_cost_map` as a proxy admin). That refetches pricing and re-registers provider routing in one step, so `claude-opus-5` becomes available across Anthropic, Azure, Vertex AI, and Bedrock even on an older version.

The exception is `LITELLM_LOCAL_MODEL_COST_MAP=true`, which bakes the cost map into the image and puts it out of the Reload button's reach. Pull `v1.95.0-dev.2` or later for the bundled Opus 5 metadata:

```bash
docker pull ghcr.io/berriai/litellm:v1.95.0-dev.2
```

## Usage

Pick your provider below. Each tab wires up `claude-opus-5` for that provider; the request you send afterward is identical everywhere.

<Tabs>
<TabItem value="anthropic" label="Anthropic">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-opus-5
    litellm_params:
      model: anthropic/claude-opus-5
      api_key: os.environ/ANTHROPIC_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.95.0-dev.2 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="azure" label="Azure">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-opus-5
    litellm_params:
      model: azure_ai/claude-opus-5
      api_key: os.environ/AZURE_AI_API_KEY
      api_base: os.environ/AZURE_AI_API_BASE  # https://<resource>.services.ai.azure.com
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e AZURE_AI_API_KEY=$AZURE_AI_API_KEY \
  -e AZURE_AI_API_BASE=$AZURE_AI_API_BASE \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.95.0-dev.2 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="vertex" label="Vertex AI">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-opus-5
    litellm_params:
      model: vertex_ai/claude-opus-5
      vertex_project: os.environ/VERTEX_PROJECT
      vertex_location: global
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e VERTEX_PROJECT=$VERTEX_PROJECT \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/credentials.json:/app/credentials.json \
  ghcr.io/berriai/litellm:v1.95.0-dev.2 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="bedrock" label="Bedrock">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-opus-5
    litellm_params:
      model: bedrock/anthropic.claude-opus-5
      aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY
      aws_region_name: us-east-1
```

:::note
For cross-region routing, swap the model ID for a regional inference profile (`us.`, `eu.`, `au.`, or `jp.` prefix), e.g. `bedrock/converse/us.anthropic.claude-opus-5`. These carry a 10% regional premium; the `global.` profile stays at base price. LiteLLM tracks the cost of each variant automatically.
:::

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.95.0-dev.2 \
  --config /app/config.yaml
```

</TabItem>
</Tabs>

**3. Test it!**

The request is the same regardless of which provider you configured above:

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-opus-5",
  "messages": [
    {
      "role": "user",
      "content": "what llm are you"
    }
  ]
}'
```

## Advanced Features

### Adaptive Thinking

:::note
When using `reasoning_effort` with Claude Opus 5, all values (`low`, `medium`, `high`, `xhigh`, `max`) are mapped to `thinking: {type: "adaptive"}`. Opus 5 only supports adaptive thinking; explicit budgets via `thinking: {type: "enabled", budget_tokens: ...}` are rejected by the Anthropic API with a 400 error. To control thinking depth, pair adaptive thinking with `output_config.effort` (see [Effort Levels](#effort-levels) below) rather than a fixed budget.
:::

<Tabs>
<TabItem value="completions" label="/chat/completions">

LiteLLM supports adaptive thinking through the `reasoning_effort` parameter:

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-opus-5",
  "messages": [
    {
      "role": "user",
      "content": "Solve this complex problem: What is the optimal strategy for..."
    }
  ],
  "reasoning_effort": "high"
}'
```

</TabItem>
<TabItem value="messages" label="/v1/messages">

Use the `thinking` parameter with `type: "adaptive"` to enable adaptive thinking mode:

```bash
curl --location 'http://0.0.0.0:4000/v1/messages' \
--header 'x-api-key: sk-12345' \
--header 'content-type: application/json' \
--data '{
    "model": "claude-opus-5",
    "max_tokens": 16000,
    "thinking": {
        "type": "adaptive"
    },
    "messages": [
        {
            "role": "user",
            "content": "Explain why the sum of two even numbers is always even."
        }
    ]
}'
```

</TabItem>
</Tabs>

### Effort Levels

Opus 5 takes the full ladder, `low` through `max`, with `high` as the default, set per request through `output_config.effort`.

Treat it as a cost dial rather than a quality knob. Effort buys thinking tokens, and thinking tokens bill at the $25 / MTok output rate, so the only honest way to pick a level is to sweep it against your own evals and read the per-request spend back out of LiteLLM's logs. Two things make that sweep worth redoing instead of inheriting: Anthropic explicitly warns that Opus 4.8's effort tuning does not carry over, and Opus 5's headline result against Fable 5 was measured at `max`, so the top of the ladder is doing real work this generation.

<Tabs>
<TabItem value="completions" label="/chat/completions">

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-opus-5",
  "messages": [
    {
      "role": "user",
      "content": "Explain quantum computing"
    }
  ],
  "output_config": {
    "effort": "max"
  }
}'
```

**Using OpenAI SDK:**

```python
import openai

client = openai.OpenAI(
    api_key="your-litellm-key",
    base_url="http://0.0.0.0:4000"
)

response = client.chat.completions.create(
    model="claude-opus-5",
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    extra_body={"output_config": {"effort": "max"}}
)
```

**Using LiteLLM SDK:**

```python
from litellm import completion

response = completion(
    model="anthropic/claude-opus-5",
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    output_config={"effort": "max"},
)
```

</TabItem>
<TabItem value="messages" label="/v1/messages">

```bash
curl --location 'http://0.0.0.0:4000/v1/messages' \
--header 'x-api-key: sk-12345' \
--header 'content-type: application/json' \
--data '{
    "model": "claude-opus-5",
    "max_tokens": 4096,
    "messages": [
        {
            "role": "user",
            "content": "Explain quantum computing"
        }
    ],
    "output_config": {
        "effort": "max"
    }
}'
```

</TabItem>
</Tabs>

The top two rungs have hard edges. Give `xhigh` and `max` at least 64K `max_tokens` or thinking will crowd out the response, and never pair them with `thinking: {type: "disabled"}`, which returns a 400 on Opus 5.

### Fast Mode

:::info
Fast mode is **only supported on the Anthropic provider** (`anthropic/claude-opus-5`). It is not available on Azure AI, Vertex AI, or Bedrock, and it cannot be combined with the Batch API.
:::

Opus 5 runs roughly 2.5x faster with `speed: "fast"`, billed at $10 / MTok input and $50 / MTok output (2x the standard rate, down from the 6x premium on Opus 4.6). LiteLLM adds the `fast-mode-2026-02-01` beta header and tracks the premium in cost calculations automatically.

<Tabs>
<TabItem value="completions" label="/chat/completions">

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-opus-5",
  "messages": [
    {
      "role": "user",
      "content": "Refactor this module..."
    }
  ],
  "max_tokens": 4096,
  "speed": "fast"
}'
```

</TabItem>
<TabItem value="messages" label="/v1/messages">

```bash
curl --location 'http://0.0.0.0:4000/v1/messages' \
--header 'x-api-key: sk-12345' \
--header 'content-type: application/json' \
--data '{
    "model": "claude-opus-5",
    "max_tokens": 4096,
    "speed": "fast",
    "messages": [
        {
            "role": "user",
            "content": "Refactor this module..."
        }
    ]
}'
```

</TabItem>
</Tabs>

## Feedback

Running Opus 5 through LiteLLM and hitting something unexpected? Share it on [GitHub discussion #34517](https://github.com/BerriAI/litellm/discussions/34517).
