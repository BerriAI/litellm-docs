---
slug: latest-model-aliases
title: "LiteLLM now supports -latest model aliases"
date: 2026-11-06T09:00:00+08:00
authors: [moe]
description: "Keep the same model name as newer versions arrive. Use -latest aliases in the LiteLLM SDK and AI Gateway."
tags: [models]
hide_table_of_contents: true
image: ./hero.png
---

You can now use names like `openai/gpt-luna-latest` and `anthropic/claude-opus-latest` in LiteLLM.

A `-latest` alias is a stable name for a model family. We maintain its target. As we move the alias to a newer model, your application uses that model without changing the name in your code or gateway configuration.

<!-- truncate -->

## Use it in Python

With `litellm` installed and `OPENAI_API_KEY` set, run:

```python
from litellm import completion

response = completion(
    model="openai/gpt-luna-latest",
    messages=[{"role": "user", "content": "Say hello."}],
)
print(response.choices[0].message.content)
```

LiteLLM resolves the alias before calling OpenAI. You get a response from the model behind it, with cost calculated for that model.

## Use it on your gateway

Set `litellm_params.model` to the full alias, then keep calling the same model name from your client. An existing `openai/*` wildcard route also accepts `openai/gpt-luna-latest` without another model entry. The [model aliases guide](https://docs.litellm.ai/docs/model_latest_aliases) has the config and a request you can copy.

The new aliases cover OpenAI, Anthropic, xAI, Moonshot, Z.AI, DeepSeek, DashScope, and MiniMax through their own APIs. Gemini and Mistral already offer provider-managed latest names, which LiteLLM passes through.

Use a specific model ID if you want to choose when you switch. A newer model can change pricing and behavior.
