---
slug: claude-haiku-5-5
title: "Claude Haiku 5.5 API Pricing and Day 0 Support on LiteLLM"
date: 2026-10-07T10:00:00
authors:
  - misbah
  - mateo
  - kerry
description: "Claude Haiku 5.5 costs $0.10 per 1M input tokens and $0.50 per 1M output tokens. LiteLLM supports it on day 0 on Anthropic, AWS, Google Cloud and Azure."
image: /img/litellm_claude_haiku_5_5_announcement.png
tags: [anthropic, claude, claude haiku, haiku 5.5, pricing, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

![Claude Haiku 5.5 on LiteLLM](/img/litellm_claude_haiku_5_5_announcement.png)

LiteLLM now supports [Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5) on Day 0. Use it across Anthropic, Bedrock, Gemini Enterprise Agent Platform, and Azure through the LiteLLM AI Gateway, with spend, rate limits, and logging in one place.

{/* truncate */}

## Claude Haiku 5.5 pricing

- **Input:** $0.10 / MTok for prompts up to 100K tokens, $0.50 / MTok above
- **Output:** $0.50 / MTok, or $2.50 / MTok above 100K
- **Cache read:** $0.01 / MTok, or $0.05 / MTok above 100K
- **Batch:** 50% off input and output

Prices on every provider: https://models.litellm.ai/models

## What's new in Claude Haiku 5.5

- **90% cheaper than Haiku 4.5** for prompts up to 100K tokens, and around 75% less to run on average, per Anthropic
- **72.4% on OSWorld 2.1**, up from Haiku 4.5's 15.7%
- **1M-token context**, up to 128K output tokens

## Use Claude Haiku 5.5 with LiteLLM

Pricing landed in [PR #45108](https://github.com/BerriAI/litellm/pull/45108). No upgrade needed: open **Price Data** under **Models + Endpoints** in the UI and click **Reload Price Data** (or `POST /reload/model_cost_map`), on `v1.76.0` and above.

<Tabs>
<TabItem value="anthropic" label="Anthropic">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-haiku-5-5
    litellm_params:
      model: anthropic/claude-haiku-5-5
      api_key: os.environ/ANTHROPIC_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.104.0 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="bedrock" label="Bedrock">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-haiku-5-5
    litellm_params:
      model: bedrock/anthropic.claude-haiku-5-5
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
  ghcr.io/berriai/litellm:v1.104.0 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="gemini-enterprise" label="Gemini Enterprise Agent Platform">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-haiku-5-5
    litellm_params:
      model: vertex_ai/claude-haiku-5-5
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
  ghcr.io/berriai/litellm:v1.104.0 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="azure" label="Azure">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-haiku-5-5
    litellm_params:
      model: azure_ai/claude-haiku-5-5
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
  ghcr.io/berriai/litellm:v1.104.0 \
  --config /app/config.yaml
```

</TabItem>
</Tabs>

**3. Test it!**

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-haiku-5-5",
  "messages": [
    {
      "role": "user",
      "content": "what llm are you"
    }
  ]
}'
```

## FAQ

### How much does Claude Haiku 5.5 cost?

$0.10 per 1M input tokens and $0.50 per 1M output tokens for prompts up to 100K tokens, and $0.50 and $2.50 above that. Cache reads cost $0.01 per 1M tokens.

### What is the context window of Claude Haiku 5.5?

1M tokens, with up to 128K output tokens per request.

### How do I call Claude Haiku 5.5 with an OpenAI-compatible API?

Add `anthropic/claude-haiku-5-5` to your LiteLLM config, then send a standard `/chat/completions` request to the proxy with `"model": "claude-haiku-5-5"`.

## Feedback

Questions and feedback go in [GitHub discussion #45133](https://github.com/BerriAI/litellm/discussions/45133).
