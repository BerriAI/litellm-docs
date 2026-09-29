---
slug: claude_sonnet_5_5
title: "Day 0 Support: Claude Sonnet 5.5"
date: 2026-09-28T10:00:00
authors:
  - misbah
  - mateo
  - kerry
description: "Day 0 support for Claude Sonnet 5.5 on the LiteLLM AI Gateway. Use it across Anthropic, Bedrock, Gemini Enterprise Agent Platform, and Azure."
tags: [anthropic, claude, sonnet 5.5, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

![LiteLLM x Claude Sonnet 5.5](/img/litellm_claude_sonnet_5_5_announcement.png)

LiteLLM now supports [Claude Sonnet 5.5](https://www.anthropic.com/claude-sonnet-5-5) on Day 0. Use it across Anthropic, Bedrock, Gemini Enterprise Agent Platform, and Azure through the LiteLLM AI Gateway, with spend, rate limits, and logging in one place.

{/* truncate */}

## What's new in Sonnet 5.5

- **Same price as Sonnet 5:** $2 / MTok input, $10 / MTok output, $0.20 / MTok cache reads
- **30%+ faster**, and up to 30% less per task, per Anthropic
- **70.6% on Terminal-Bench 4.0**, up from Sonnet 5's 10.3%
- **1M-token context**, up to 128K output tokens

## Enabling Sonnet 5.5

Pricing landed in [PR #43586](https://github.com/BerriAI/litellm/pull/43586). No upgrade needed: open **Price Data** under **Models + Endpoints** in the UI and click **Reload Price Data** (or `POST /reload/model_cost_map`), on `v1.76.0` and above.

## Usage

<Tabs>
<TabItem value="anthropic" label="Anthropic">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-sonnet-5-5
    litellm_params:
      model: anthropic/claude-sonnet-5-5
      api_key: os.environ/ANTHROPIC_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.103.0 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="bedrock" label="Bedrock">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-sonnet-5-5
    litellm_params:
      model: bedrock/anthropic.claude-sonnet-5-5
      aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY
      aws_region_name: us-east-1
```

:::note
For cross-region routing, use a regional inference profile such as `bedrock/converse/us.anthropic.claude-sonnet-5-5`. Regional profiles carry a 10% premium and `global.` stays at base price; LiteLLM tracks each variant.
:::

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.103.0 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="gemini-enterprise" label="Gemini Enterprise Agent Platform">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-sonnet-5-5
    litellm_params:
      model: vertex_ai/claude-sonnet-5-5
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
  ghcr.io/berriai/litellm:v1.103.0 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="azure" label="Azure">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-sonnet-5-5
    litellm_params:
      model: azure_ai/claude-sonnet-5-5
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
  ghcr.io/berriai/litellm:v1.103.0 \
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
  "model": "claude-sonnet-5-5",
  "messages": [
    {
      "role": "user",
      "content": "what llm are you"
    }
  ]
}'
```

## Worth knowing

**Forced tool use returns a 400.** Use `tool_choice: "auto"` and say in the prompt when the tool applies.

**`thinking: {"type": "disabled"}` returns a 400.** Anthropic's replacement is `between_tools`; see their [migration guide](https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide).

## Feedback

Running Claude Sonnet 5.5 through LiteLLM and hitting something unexpected? Share it on [GitHub discussion #43590](https://github.com/BerriAI/litellm/discussions/43590).
