---
slug: claude-fable-5-2
title: "Claude Fable 5.2 API Pricing and Day 0 Support on LiteLLM"
date: 2026-11-09T18:00:00
authors:
  - misbah
  - mateo
  - kerry
description: "Claude Fable 5.2 costs $8 per 1M input tokens and $40 per 1M output tokens, 20% below Fable 5.1. LiteLLM supports it on day 0."
card_title: "Claude Fable 5.2"
card_summary: "$8 / $40 per 1M tokens, 20% below Fable 5.1, cache reads at $0.20. 1M context, adaptive thinking, default effort high."
image: ./hero.png
tags: [anthropic, claude, claude fable, fable 5.2, pricing, day 0 support]
hide_table_of_contents: false
---

import Head from '@docusaurus/Head';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import ClaudeFableHero from './Hero';

<Head>
  <meta property="og:video" content="https://docs.litellm.ai/img/blog/claude-fable-5-2/hero.mp4" />
  <meta property="og:video:secure_url" content="https://docs.litellm.ai/img/blog/claude-fable-5-2/hero.mp4" />
  <meta property="og:video:type" content="video/mp4" />
  <meta property="og:video:width" content="1280" />
  <meta property="og:video:height" content="720" />
</Head>

export const Hero = ClaudeFableHero;

LiteLLM now supports [Claude Fable 5.2](https://platform.claude.com/docs/en/models/fable-5-2/whats-new-fable-5-2) on Day 0. Call it through the LiteLLM AI Gateway and track spend, rate limits and logs in one place.

{/* truncate */}

## Claude Fable 5.2 pricing

- **Input:** $8.00 / MTok
- **Output:** $40.00 / MTok
- **Cache read:** $0.20 / MTok
- **Cache write:** $10.00 / MTok for 5 minutes, $16.00 / MTok for 1 hour
- **Batch:** $4.00 / MTok input and $20.00 / MTok output

Input and output both cost 20% less than Claude Fable 5.1.

| Model | Input / MTok | Output / MTok | Cache read / MTok |
|---|---|---|---|
| **Claude Fable 5.2** | **$8.00** | **$40.00** | **$0.20** |
| Claude Fable 5.1 | $10.00 | $50.00 | $0.25 |
| Claude Opus 5.5 | $4.00 | $20.00 | $0.20 |

Prices on every provider: https://models.litellm.ai/models

## What's new in Claude Fable 5.2

- **20% cheaper than Fable 5.1** on input and output, with cache reads down from $0.25 to $0.20
- **1M-token context window** and up to 128K output tokens
- **Adaptive thinking is always on**, with five effort levels from `low` to `max` and `high` as the default
- **Fast mode** is available on the Claude API at $16 / MTok input and $80 / MTok output

## Use Claude Fable 5.2 with LiteLLM

Pricing landed in [PR #50715](https://github.com/BerriAI/litellm/pull/50715). No upgrade needed: open **Price Data** under **Models + Endpoints** in the UI and click **Reload Price Data** (or `POST /reload/model_cost_map`), on `v1.76.0` and above.

<Tabs>
<TabItem value="anthropic" label="Anthropic">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-fable-5-2
    litellm_params:
      model: anthropic/claude-fable-5-2
      api_key: os.environ/ANTHROPIC_API_KEY
```

**2. Start the proxy**

```bash
docker run -d \
  -p 4000:4000 \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -v $(pwd)/config.yaml:/app/config.yaml \
  ghcr.io/berriai/litellm:v1.106.2 \
  --config /app/config.yaml
```

</TabItem>
<TabItem value="claude-platform-aws" label="Claude Platform on AWS">

**1. Setup config.yaml**

```yaml
model_list:
  - model_name: claude-fable-5-2
    litellm_params:
      model: bedrock/claude_platform/claude-fable-5-2
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
  ghcr.io/berriai/litellm:v1.106.2 \
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
  "model": "claude-fable-5-2",
  "messages": [
    {
      "role": "user",
      "content": "what llm are you"
    }
  ]
}'
```

Anthropic also serves Fable 5.2 on Amazon Bedrock as `anthropic.claude-fable-5-2`, on Google Cloud and in Microsoft Foundry as `claude-fable-5-2`. Cost map entries for those routes are in flight in [PR #50713](https://github.com/BerriAI/litellm/pull/50713) and [PR #50707](https://github.com/BerriAI/litellm/pull/50707); until one of them merges, requests on those routes bill at $0 in the gateway.

## FAQ

### How much does Claude Fable 5.2 cost?

$8 per 1M input tokens and $40 per 1M output tokens. Cache reads cost $0.20 per 1M tokens and batch requests cost $4 and $20.

### Is Claude Fable 5.2 cheaper than Fable 5.1?

Yes, by 20% on both input and output. Fable 5.1 costs $10 and $50 per 1M tokens.

### What is the context window of Claude Fable 5.2?

1M tokens, with up to 128K output tokens per request.

### How do I call Claude Fable 5.2 with an OpenAI-compatible API?

Add `anthropic/claude-fable-5-2` to your LiteLLM config, then send a standard `/chat/completions` request to the proxy with `"model": "claude-fable-5-2"`.

### Which models can read Claude Fable 5.2 thinking blocks?

Only Fable 5.2 and Mythos 5.2. A fallback onto it keeps the conversation's reasoning; a fallback off it drops it, Opus 5.5 and Fable 5.1 included.

### Why does Claude Fable 5.2 return "The block is bound to a different conversation"?

Editing `system`, `tools` or an earlier message after a thinking block trips the prefix check, which now applies to every account.

### Does Claude Fable 5.2 support the `computer_20251124` tool?

No. Use `computer_toolset_20260801`; the earlier tool returns a 400 everywhere except Bedrock.

### Can I force a tool call on Claude Fable 5.2?

No, `tool_choice` of `any` or `tool` returns a 400. LiteLLM maps `tool_choice: "required"` onto `any`, so keep it at `auto` and use `strict: true`.

## Feedback

Questions and feedback go in [GitHub discussions](https://github.com/BerriAI/litellm/discussions).
