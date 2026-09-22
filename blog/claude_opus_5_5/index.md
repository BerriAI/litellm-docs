---
slug: claude_opus_5_5
title: "Day 0 Support: Claude Opus 5.5"
date: 2026-09-22T10:00:00
authors:
  - misbah
  - mateo
  - kerry
description: "Day 0 support for Claude Opus 5.5 on the LiteLLM AI Gateway. Use it across Anthropic, Bedrock, Gemini Enterprise Agent Platform, and Azure."
tags: [anthropic, claude, opus 5.5, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

![LiteLLM x Claude Opus 5.5](/img/litellm_claude_opus_5_5_announcement.png)

LiteLLM now supports [Claude Opus 5.5](https://www.anthropic.com/claude-opus-5-5) on Day 0. Use it across Anthropic, Bedrock, Gemini Enterprise Agent Platform, and Azure through the LiteLLM AI Gateway. Call it with the same OpenAI-compatible request you already use, and track spend, rate limits, and logging in one place.

{/* truncate */}

## What's new in Opus 5.5

Key changes ([details from Anthropic](https://www.anthropic.com/claude-opus-5-5)):

- **20% cheaper than Opus 5:** $4 / MTok input and $20 / MTok output, down from $5 and $25
- **Cheaper cache reads:** $0.20 / MTok, with 5-minute writes at $5 and 1-hour writes at $8
- **Stronger agentic coding:** Terminal-Bench 4.0 at 66.4% and OSWorld 2.0 at 81.8%
- **Faster and leaner:** Anthropic reports output more than 30% faster, using fewer tokens per task
- **Thinking is always on:** effort is the only control, and its default is `medium`
- **Fast mode:** about 2x the base price, down from Opus 5's $10 / $50

Context window and max output are unchanged from Opus 5 at 1M and 128K.

## Enabling Opus 5.5

Pricing landed in [PR #42489](https://github.com/BerriAI/litellm/pull/42489), and most proxies do not need to upgrade at all. On the default remote cost map, open the **Price Data** tab under **Models + Endpoints** in the UI and click **Reload Price Data** (or `POST /reload/model_cost_map` as a proxy admin), on any version `v1.76.0` or newer.

The exception is `LITELLM_LOCAL_MODEL_COST_MAP=true`, which bakes the cost map into the image and puts it out of the Reload button's reach. That path needs an image built after #42489 merged.

## Usage

Pick your provider below. Each tab wires up `claude-opus-5-5` for that provider; the request you send afterward is identical everywhere.

<Tabs>
<TabItem value="anthropic" label="Anthropic">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-opus-5-5
    litellm_params:
      model: anthropic/claude-opus-5-5
      api_key: os.environ/ANTHROPIC_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.103.0-rc.1 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="bedrock" label="Bedrock">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-opus-5-5
    litellm_params:
      model: bedrock/anthropic.claude-opus-5-5
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
  ghcr.io/berriai/litellm:v1.103.0-rc.1 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="gemini-enterprise" label="Gemini Enterprise Agent Platform">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-opus-5-5
    litellm_params:
      model: vertex_ai/claude-opus-5-5
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
  ghcr.io/berriai/litellm:v1.103.0-rc.1 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="azure" label="Azure">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-opus-5-5
    litellm_params:
      model: azure_ai/claude-opus-5-5
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
  ghcr.io/berriai/litellm:v1.103.0-rc.1 \
  --config /app/config.yaml
```

</TabItem>
</Tabs>

:::note
PR #42489 priced the first-party route. The Bedrock, Gemini Enterprise Agent Platform, and Azure ids route and run, but are not in the cost map yet, so spend on those logs as $0 until their rows land.
:::

**3. Test it!**

The request is the same regardless of which provider you configured above:

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-opus-5-5",
  "messages": [
    {
      "role": "user",
      "content": "what llm are you"
    }
  ]
}'
```

## Fast Mode

:::info
Fast mode is **only supported on the Anthropic provider** (`anthropic/claude-opus-5-5`). It is not available on Bedrock, Gemini Enterprise Agent Platform, or Azure, and it cannot be combined with the Batch API.
:::

Opus 5.5 runs faster with `speed: "fast"`, billed at $8 / MTok input and $40 / MTok output, 2x the standard rate and down from the $10 / $50 on Opus 5. LiteLLM adds the `fast-mode-2026-02-01` beta header and tracks the premium in cost calculations automatically.

```bash
curl --location 'http://0.0.0.0:4000/v1/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-opus-5-5",
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

## Worth knowing

**Forced tool use returns a 400.** With `drop_params` on, LiteLLM downgrades `tool_choice` to `auto` and logs a warning, so the call succeeds and the model is free not to call your tool.

**Thinking cannot be disabled, and the default effort is now `medium`** where Opus 5's was `high`, so a request that never set effort thinks less than it used to.

**Thinking blocks are tied to the model.** Only Fable 5.1 and Mythos 5.1 read Opus 5.5's, so a fallback to Sonnet or Haiku runs those turns without the reasoning.

## Feedback

Running Claude Opus 5.5 through LiteLLM and hitting something unexpected? Share it on [GitHub discussion #42494](https://github.com/BerriAI/litellm/discussions/42494).
