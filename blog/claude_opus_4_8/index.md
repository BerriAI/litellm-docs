---
slug: claude_opus_4_8
title: "Day 0 Support: Claude Opus 4.8"
date: 2026-05-28T10:00:00
authors:
  - mateo
  - krrish
  - ishaan-alt
description: "Day 0 support for Claude Opus 4.8 on LiteLLM AI Gateway - use across Anthropic, Azure, Vertex AI, and Bedrock."
tags: [anthropic, claude, opus 4.8, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

LiteLLM now supports [Claude Opus 4.8](https://www.anthropic.com/news/claude-opus-4-8) on Day 0. Use it across Anthropic, Azure, Vertex AI, and Bedrock through the LiteLLM AI Gateway — call it with the same OpenAI-compatible request you already use, and track spend, rate limits, and logging in one place.

{/* truncate */}

## What's new in Opus 4.8

- **Same per-token price as Opus 4.7** — $5 / MTok input and $25 / MTok output, with prompt caching at $0.50 / MTok (read) and $6.25 / MTok (write).
- **Full effort ladder** — Opus 4.8 supports `low`, `medium`, `high` (default), `xhigh`, and `max`, giving you finer-grained control over how much reasoning the model applies.
- **1M-token context** with up to 128K output tokens.
- Vision, PDF input, computer use, tool calling, prompt caching, adaptive thinking, and structured output — all supported through LiteLLM.

## Enabling Opus 4.8

Opus 4.8 is already in the LiteLLM model cost map on `main`, so most deployments **do not need a redeploy** to start using it:

- **Reload the model cost map.** In the LiteLLM UI, go to **Models + Endpoints → Price Data** and click **Reload Price Data** — or, as a proxy admin, call `POST /reload/model_cost_map`. By default the cost map is fetched from the `main` branch of the LiteLLM repo, so this refetches the latest pricing **and** re-registers provider routing in one step: `claude-opus-4-8` becomes available across Anthropic, Azure, Vertex AI, and Bedrock with no rebuild.
- **Pinned to a local cost map, or using the SDK?** If you run with `LITELLM_LOCAL_MODEL_COST_MAP=true` (or a pinned `LITELLM_MODEL_COST_MAP_URL`), or you call LiteLLM through the Python SDK, upgrade to the latest LiteLLM release to pick up the bundled Opus 4.8 metadata. Basic completions route through on passthrough either way; the reload/upgrade is what enables accurate cost tracking and the full effort ladder.

## Usage - Anthropic

<Tabs>
<TabItem value="proxy" label="LiteLLM Proxy">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-opus-4-8
    litellm_params:
      model: anthropic/claude-opus-4-8
      api_key: os.environ/ANTHROPIC_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:main-stable \
  --config /app/config.yaml
```

**3. Test it!**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-opus-4-8",
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
  - model_name: claude-opus-4-8
    litellm_params:
      model: azure_ai/claude-opus-4-8
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
  ghcr.io/berriai/litellm:main-stable \
  --config /app/config.yaml
```

**3. Test it!**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-opus-4-8",
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
  - model_name: claude-opus-4-8
    litellm_params:
      model: vertex_ai/claude-opus-4-8
      vertex_project: os.environ/VERTEX_PROJECT
      vertex_location: us-east5
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e VERTEX_PROJECT=$VERTEX_PROJECT \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/credentials.json \
  -v $(pwd)/config.yaml:/app/config.yaml \
  -v $(pwd)/credentials.json:/app/credentials.json \
  ghcr.io/berriai/litellm:main-stable \
  --config /app/config.yaml
```

**3. Test it!**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-opus-4-8",
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
  - model_name: claude-opus-4-8
    litellm_params:
      model: bedrock/anthropic.claude-opus-4-8
      aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY
      aws_region_name: us-east-1
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:main-stable \
  --config /app/config.yaml
```

**3. Test it!**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-opus-4-8",
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
When using `reasoning_effort` with Claude Opus 4.8, all values (`low`, `medium`, `high`, `xhigh`) are mapped to `thinking: {type: "adaptive"}`. To use explicit thinking budgets with `type: "enabled"`, pass the native `thinking` parameter directly.
:::

<Tabs>
<TabItem value="completions" label="/chat/completions">

LiteLLM supports adaptive thinking through the `reasoning_effort` parameter:

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-opus-4-8",
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
    "model": "claude-opus-4-8",
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

Claude Opus 4.8 supports five effort levels: `low`, `medium`, `high` (default), `xhigh`, and `max`. These give you finer-grained control over how much reasoning the model applies to a task. Pass the effort level via the `output_config` parameter.

Opus 4.8 supports the full effort ladder — both `xhigh` (introduced with Opus 4.7) and `max` (previously Opus 4.6 only) are available.

<Tabs>
<TabItem value="completions" label="/chat/completions">

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-opus-4-8",
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
    model="claude-opus-4-8",
    messages=[{"role": "user", "content": "Explain quantum computing"}],
    extra_body={"output_config": {"effort": "max"}}
)
```

**Using LiteLLM SDK:**

```python
from litellm import completion

response = completion(
    model="anthropic/claude-opus-4-8",
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
    "model": "claude-opus-4-8",
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
| `low` | Short, fast responses — simple lookups, formatting, classification |
| `medium` | Balanced tradeoff for everyday Q&A and light reasoning |
| `high` (default) | Complex reasoning, code generation, analysis |
| `xhigh` | Hard problems — multi-step math, deep research, agentic planning |
| `max` | The hardest tasks where you want maximum reasoning depth regardless of latency |
