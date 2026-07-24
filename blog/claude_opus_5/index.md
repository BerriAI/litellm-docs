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

Opus 5 lands near Fable 5's frontier quality at half the price, and keeps Opus 4.8's per-token rates. A few things stand out for teams running it through a gateway:

- **Frontier coding at Opus prices.** Anthropic reports Opus 5 surpasses every other model on Frontier-Bench v0.1, more than doubling Opus 4.8's score at a lower cost per task, and lands within 0.5% of Fable 5's peak CursorBench 3.2 score at max effort for half the cost per task. It also scores three times the next-best model on ARC-AGI 3. ([details from Anthropic](https://www.anthropic.com/news/claude-opus-5))
- **Thinking is on by default.** Requests that omit `thinking` now run with adaptive thinking, where the same request on Opus 4.8 ran without it. `max_tokens` still caps thinking plus response text together, so budget accordingly.
- **The full effort ladder, per request.** `low`, `medium`, `high` (default), `xhigh`, and `max`, set per call via `reasoning_effort` or `output_config`. Anthropic recommends re-sweeping effort rather than carrying over an Opus 4.8 setting, and giving `xhigh` and `max` at least 64K `max_tokens`.
- **$5 / MTok input and $25 / MTok output**, unchanged from Opus 4.8, with prompt caching at $0.50 / MTok (read) and $6.25 / MTok (5-minute write). The prompt cache minimum drops to 512 tokens, so shorter system prompts now qualify. On Bedrock, the `us.`, `eu.`, `au.`, and `jp.` inference profiles carry the usual 10% regional premium while `global.` stays at base price; LiteLLM tracks every variant automatically.
- **Fast mode at 2x, not 6x.** Pass `speed: "fast"` on the Anthropic provider for roughly 2.5x faster output at $10 / MTok input and $50 / MTok output. LiteLLM sets the beta header and prices the premium for you.
- **A May 2026 knowledge cutoff**, the most recent of any Claude model, with a 1M-token context window and up to 128K output tokens.
- **One gateway, every surface.** Vision, PDF input, computer use, tool calling, prompt caching, adaptive thinking, and structured output, all available across Anthropic, Azure, Vertex AI, and Bedrock with unified spend tracking, logging, and fallbacks.

## Before you switch from Opus 4.8

Opus 5 is not a drop-in swap for every workload. Four behaviors change:

- **Disabling thinking is capped at `high` effort.** `thinking: {type: "disabled"}` combined with `xhigh` or `max` returns a 400. Either drop the `thinking` field and let adaptive thinking run, or keep it disabled and stay at `high` or below.
- **Priority Tier is not supported.** If you rely on it for Opus 4.8 capacity, plan that capacity separately.
- **Web fetch is unavailable** on Opus 5; pick an alternative tool if your agents depend on it.
- **Cybersecurity classifiers can decline a request** with `stop_reason: "refusal"` and a category in `stop_details`. Handle that stop reason, or use LiteLLM [fallbacks](../../docs/proxy/reliability) to route refused requests to another model.

Sampling parameters (`temperature`, `top_p`, `top_k`), fixed thinking budgets, and assistant message prefill remain unsupported, same as Opus 4.8.

## Enabling Opus 5

Opus 5 ships in the **`v1.95.0-dev.2`** image (and every release after it). How you pick it up depends on where your proxy reads pricing from:

- **Default (remote cost map): no upgrade needed.** In the LiteLLM UI, open the **Price Data** tab under **Models + Endpoints** and click **Reload Price Data** (or, as a proxy admin, `POST /reload/model_cost_map`). This refetches the latest pricing from LiteLLM's cost map **and** re-registers provider routing in one step, so `claude-opus-5` becomes available across Anthropic, Azure, Vertex AI, and Bedrock, even if you're on an older proxy version.
- **Running `LITELLM_LOCAL_MODEL_COST_MAP=true`?** The cost map is baked into the image, so the Reload button won't reach it. Pull `v1.95.0-dev.2` or later to get the bundled Opus 5 metadata:

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

Claude Opus 5 supports the full effort ladder: `low`, `medium`, `high` (default), `xhigh`, and `max`. These give you finer-grained control over how much reasoning the model applies to a task. Pass the effort level via the `output_config` parameter.

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

**Effort level guide:**

| Effort | When to use |
|--------|-------------|
| `low` | Short, fast responses for simple lookups, formatting, and classification |
| `medium` | Balanced tradeoff for everyday Q&A and light reasoning |
| `high` (default) | Complex reasoning, code generation, analysis |
| `xhigh` | Hard problems like multi-step math, deep research, and agentic planning |
| `max` | The hardest tasks where you want maximum reasoning depth regardless of latency |

At `xhigh` or `max`, give the request at least 64K `max_tokens` so thinking and the final response both fit.

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
