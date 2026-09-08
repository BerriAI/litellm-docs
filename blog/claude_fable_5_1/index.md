---
slug: claude_fable_5_1
title: "Day 0 Support: Claude Fable 5.1"
date: 2026-09-01T10:00:00
authors:
  - misbah
  - mateo
  - krrish
  - ishaan-alt
description: "Day 0 support for Claude Fable 5.1 on the LiteLLM AI Gateway, with the 0.025x cache read price tracked from the first call."
tags: [anthropic, claude, fable 5.1, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

![LiteLLM x Claude Fable 5.1](/img/litellm_claude_fable_5_1_announcement.png)

LiteLLM supports [Claude Fable 5.1](https://www.anthropic.com/claude-fable-and-mythos-5-1) on Day 0 across Anthropic, Bedrock, Gemini Enterprise Agent Platform, and Azure, with spend, rate limits, fallbacks, and logging in one place.

{/* truncate */}

## What's new in Fable 5.1

Pricing, the 1M-token context window, the 128K output ceiling, and always-on adaptive thinking carry over from Fable 5. What changed, in the order it costs a gateway work:

- **Cache reads cost $0.25 / MTok, down from $1.00.** That is 0.025x base input, where every other Claude model sits at 0.1x. LiteLLM reads the rate from the cost map and falls back to base input without it, a 40x overcount.
- **Forced tool use returns a 400.** Thinking is always on, and a forced call would skip it. LiteLLM maps OpenAI's `tool_choice: "required"` to Anthropic's `any`, so a request that worked on Fable 5 fails here unchanged. Keep `auto` with `strict: true` for schema-valid JSON, or name the tool in the prompt to force a call.
- **Thinking blocks are bound to the model that wrote them.** Fable 5.1 reads earlier models' blocks; none of them read its own.
- **Editing earlier turns invalidates thinking blocks.** Rebuilding `system` or `tools` mid-conversation errors with `The block is bound to a different conversation`, on accounts created from August 31, 2026.
- **Effort is steerable per message** behind the `mid-conversation-output-config-2026-07-01` beta header, without invalidating the prompt cache.

Anthropic's [what's new page](https://platform.claude.com/docs/en/models/fable-5-1/whats-new-fable-5-1) has the benchmarks and capability gains.

## Usage

<Tabs>
<TabItem value="anthropic" label="Anthropic">

```yaml
model_list:
  - model_name: claude-fable-5-1
    litellm_params:
      model: anthropic/claude-fable-5-1
      api_key: os.environ/ANTHROPIC_API_KEY
```

</TabItem>
<TabItem value="bedrock" label="Bedrock">

```yaml
model_list:
  - model_name: claude-fable-5-1
    litellm_params:
      model: bedrock/converse/us.anthropic.claude-fable-5-1
      aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY
      aws_region_name: us-east-1
```

Bedrock serves it through inference profiles. `us.` and `eu.` carry the 10% regional premium, `global.` stays at base.

</TabItem>
<TabItem value="gemini-enterprise" label="Gemini Enterprise Agent Platform">

```yaml
model_list:
  - model_name: claude-fable-5-1
    litellm_params:
      model: vertex_ai/claude-fable-5-1
      vertex_project: os.environ/VERTEX_PROJECT
      vertex_location: global
```

Google renamed Vertex AI to Gemini Enterprise Agent Platform; the LiteLLM prefix is still `vertex_ai/`. Pinned regions carry a 10% premium over global, which LiteLLM applies.

</TabItem>
<TabItem value="azure" label="Azure">

```yaml
model_list:
  - model_name: claude-fable-5-1
    litellm_params:
      model: azure_ai/claude-fable-5-1
      api_key: os.environ/AZURE_AI_API_KEY
      api_base: os.environ/AZURE_AI_API_BASE  # https://<resource>.services.ai.azure.com
```

</TabItem>
</Tabs>

```bash
curl --location 'http://0.0.0.0:4000/chat/completions' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer $LITELLM_KEY' \
--data '{
  "model": "claude-fable-5-1",
  "messages": [{"role": "user", "content": "what llm are you"}],
  "reasoning_effort": "xhigh"
}'
```

`reasoning_effort` maps to adaptive thinking, the only mode Fable 5.1 accepts. Fixed budgets, assistant prefill, and non-default `temperature` or `top_p` return a 400. Pass `output_config: {"effort": "max"}` for the full ladder [Fable 5 uses](../claude_fable_5/index.md).

## Feedback

Hitting something unexpected? Share it on [GitHub discussion #39163](https://github.com/BerriAI/litellm/discussions/39163).
