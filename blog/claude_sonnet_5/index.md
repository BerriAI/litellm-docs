---
slug: claude_sonnet_5
title: "Day 0 Support: Claude Sonnet 5"
date: 2026-06-30T10:00:00
authors:
  - mateo
  - krrish
  - ishaan-alt
description: "Day 0 support for Claude Sonnet 5 on the LiteLLM AI Gateway. Use it across Anthropic, Azure, Vertex AI, and Bedrock."
tags: [anthropic, claude, sonnet 5, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

![LiteLLM x Claude Sonnet 5](/img/litellm_claude_sonnet_5_announcement.png)

LiteLLM now supports [Claude Sonnet 5](https://www.anthropic.com/news/claude-sonnet-5) on Day 0. Use it across Anthropic, Azure, Vertex AI, and Bedrock through the LiteLLM AI Gateway. Call it with the same OpenAI-compatible request you already use, and track spend, rate limits, and logging in one place.

{/* truncate */}

## What's new in Sonnet 5

Sonnet 5 is the most agentic Sonnet model yet, with performance close to Opus 4.8 at a fraction of the price. A few things stand out for teams running it through a gateway:

- **Opus-class quality, Sonnet pricing.** Anthropic reports Sonnet 5 performs close to Opus 4.8 while costing far less, and is a substantial step up from Sonnet 4.6 on reasoning, tool use, coding, and knowledge work. ([details from Anthropic](https://www.anthropic.com/news/claude-sonnet-5))
- **Built to run agents.** It plans, drives tools like browsers and terminals, runs autonomously, and checks its own output without being asked, finishing complex tasks where earlier Sonnet models would stop short. Anthropic highlights gains on BrowseComp (agentic search) and OSWorld-Verified (computer use).
- **Adaptive thinking only.** Sonnet 5 decides how deeply to think on its own. You steer it per request with `reasoning_effort` or `output_config.effort`; fixed thinking budgets, `temperature`, `top_p`, and assistant message prefill are not supported by the model.
- **$3 / MTok input and $15 / MTok output**, with prompt caching at $0.30 / MTok (read) and $3.75 / MTok (write). Anthropic is running introductory pricing of $2 / MTok input and $10 / MTok output through August 31, 2026. On Bedrock, the `us.`, `eu.`, `au.`, and `jp.` inference profiles carry the usual 10% regional premium while `global.` stays at base price; LiteLLM tracks every variant automatically.
- **1M-token context**, up to 128K output tokens.
- **One gateway, every surface.** Vision, PDF input, computer use, tool calling, prompt caching, adaptive thinking, and structured output, all available across Anthropic, Azure, Vertex AI, and Bedrock with unified spend tracking, logging, and fallbacks.

## Enabling Sonnet 5

Sonnet 5 ships in the **`v1.92.0-dev.1`** image (and every release after it). How you pick it up depends on where your proxy reads pricing from:

- **Default (remote cost map): no upgrade needed.** In the LiteLLM UI, open the **Price Data** tab under **Models + Endpoints** and click **Reload Price Data** (or, as a proxy admin, `POST /reload/model_cost_map`). This refetches the latest pricing from LiteLLM's cost map **and** re-registers provider routing in one step, so `claude-sonnet-5` becomes available across Anthropic, Azure, Vertex AI, and Bedrock, even if you're on an older proxy version.
- **Running `LITELLM_LOCAL_MODEL_COST_MAP=true`?** The cost map is baked into the image, so the Reload button won't reach it. Pull `v1.92.0-dev.1` or later to get the bundled Sonnet 5 metadata:

  ```bash
  docker pull ghcr.io/berriai/litellm:v1.92.0-dev.1
  ```

## Usage - Anthropic

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-sonnet-5
    litellm_params:
      model: anthropic/claude-sonnet-5
      api_key: os.environ/ANTHROPIC_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.92.0-dev.1 \
  --config /app/config.yaml
```

**3. Test it!**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-sonnet-5",
  "messages": [
    {
      "role": "user",
      "content": "what llm are you"
    }
  ]
}'
```

</TabItem>
</Tabs>

## Usage - Azure

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-sonnet-5
    litellm_params:
      model: azure_ai/claude-sonnet-5
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
  ghcr.io/berriai/litellm:v1.92.0-dev.1 \
  --config /app/config.yaml
```

**3. Test it!**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-sonnet-5",
  "messages": [
    {
      "role": "user",
      "content": "what llm are you"
    }
  ]
}'
```

</TabItem>
</Tabs>

## Usage - Vertex AI

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-sonnet-5
    litellm_params:
      model: vertex_ai/claude-sonnet-5
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
  ghcr.io/berriai/litellm:v1.92.0-dev.1 \
  --config /app/config.yaml
```

**3. Test it!**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-sonnet-5",
  "messages": [
    {
      "role": "user",
      "content": "what llm are you"
    }
  ]
}'
```

</TabItem>
</Tabs>

## Usage - Bedrock

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-sonnet-5
    litellm_params:
      model: bedrock/anthropic.claude-sonnet-5
      aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY
      aws_region_name: us-east-1
```

:::note
For cross-region routing, swap the model ID for a regional inference profile (`us.`, `eu.`, `au.`, or `jp.` prefix), e.g. `bedrock/converse/us.anthropic.claude-sonnet-5`. These carry a 10% regional premium; the `global.` profile stays at base price. LiteLLM tracks the cost of each variant automatically.
:::

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.92.0-dev.1 \
  --config /app/config.yaml
```

**3. Test it!**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-sonnet-5",
  "messages": [
    {
      "role": "user",
      "content": "what llm are you"
    }
  ]
}'
```

</TabItem>
</Tabs>

## Advanced Features

### Adaptive Thinking

:::note
When using `reasoning_effort` with Claude Sonnet 5, all values (`low`, `medium`, `high`, `xhigh`, `max`) are mapped to `thinking: {type: "adaptive"}`. Sonnet 5 only supports adaptive thinking; explicit budgets via `thinking: {type: "enabled", budget_tokens: ...}` are rejected by the Anthropic API with a 400 error. To control thinking depth, pair adaptive thinking with `output_config.effort` (see [Effort Levels](#effort-levels) below) rather than a fixed budget.
:::

<Tabs>
<TabItem value="completions" label="/chat/completions">

LiteLLM supports adaptive thinking through the `reasoning_effort` parameter:

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-sonnet-5",
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
    "model": "claude-sonnet-5",
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

Claude Sonnet 5 supports the full effort ladder: `low`, `medium`, `high` (default), `xhigh`, and `max`. These give you finer-grained control over how much reasoning the model applies to a task. Pass the effort level via the `output_config` parameter.

On Bedrock, `output_config.effort` caps at `xhigh`; the other providers accept the full ladder up to `max`.

<Tabs>
<TabItem value="completions" label="/chat/completions">

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-sonnet-5",
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
    model="claude-sonnet-5",
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    extra_body={"output_config": {"effort": "max"}}
)
```

**Using LiteLLM SDK:**

```python
from litellm import completion

response = completion(
    model="anthropic/claude-sonnet-5",
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    output_config={"effort": "max"},
)
```

You can combine `reasoning_effort` with `output_config` for even more fine-grained control over the model's behavior.

</TabItem>
<TabItem value="messages" label="/v1/messages">

```bash
curl --location 'http://0.0.0.0:4000/v1/messages' \
--header 'x-api-key: sk-12345' \
--header 'content-type: application/json' \
--data '{
    "model": "claude-sonnet-5",
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
| `max` | The hardest tasks where you want maximum reasoning depth regardless of latency (not available on Bedrock) |
