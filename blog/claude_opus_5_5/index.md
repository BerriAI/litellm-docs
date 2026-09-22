---
slug: claude_opus_5_5
title: "Day 0 Support: Claude Opus 5.5"
date: 2026-09-22T10:00:00
authors:
  - misbah
  - mateo
  - kerry
description: "Day 0 support for Claude Opus 5.5 on the LiteLLM AI Gateway, at 20% less than Opus 5."
tags: [anthropic, claude, opus 5.5, day 0 support]
hide_table_of_contents: false
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

![LiteLLM x Claude Opus 5.5](/img/litellm_claude_opus_5_5_announcement.png)

LiteLLM supports `claude-opus-5-5` on day 0. It costs $4 input and $20 output per 1M tokens, down from Opus 5's $5 and $25, and keeps the 1M context window and 128K max output.

{/* truncate */}

Cached input reads at $0.20 per 1M, so the model gets cheaper in three places at once: input, output and the cache.

## Usage

<Tabs>
<TabItem value="anthropic" label="Anthropic">

```python
from litellm import completion

response = completion(
    model="anthropic/claude-opus-5-5",
    messages=[{"role": "user", "content": "Refactor this migration script."}],
    reasoning_effort="high",   # default is now medium
)

print(response.choices[0].message.content)
```

</TabItem>
<TabItem value="bedrock" label="Bedrock">

```python
response = completion(
    model="bedrock/anthropic.claude-opus-5-5",
    messages=[{"role": "user", "content": "Refactor this migration script."}],
)
```

</TabItem>
<TabItem value="gemini-enterprise" label="Gemini Enterprise Agent Platform">

```python
response = completion(
    model="vertex_ai/claude-opus-5-5",
    messages=[{"role": "user", "content": "Refactor this migration script."}],
)
```

</TabItem>
<TabItem value="azure" label="Azure">

```python
response = completion(
    model="azure_ai/claude-opus-5-5",
    messages=[{"role": "user", "content": "Refactor this migration script."}],
)
```

</TabItem>
</Tabs>

```yaml
model_list:
  - model_name: claude-opus-5-5
    litellm_params:
      model: anthropic/claude-opus-5-5
      api_key: os.environ/ANTHROPIC_API_KEY
```

Pricing landed in [PR #42489](https://github.com/BerriAI/litellm/pull/42489) for the first-party route. Hit **Reload Model Cost Map** in the Admin UI, or `POST /reload/model_cost_map`, to pick it up without a redeploy on `v1.76.0` and above.

## Worth knowing

**Forced tool use returns a 400.** With `drop_params` on, LiteLLM downgrades `tool_choice` to `auto` and logs a warning, so the call succeeds and the model is free not to call your tool.

**Thinking cannot be disabled, and the default effort is now `medium`** where Opus 5's was `high`, so a request that never set effort thinks less than it used to.

**Thinking blocks are tied to the model.** Only Fable 5.1 and Mythos 5.1 read Opus 5.5's, so a fallback to Sonnet or Haiku runs those turns without the reasoning.

## Feedback

Running Claude Opus 5.5 through LiteLLM and hitting something unexpected? Share it on [GitHub discussion #42494](https://github.com/BerriAI/litellm/discussions/42494).
