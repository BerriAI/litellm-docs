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

As providers release smarter, faster, cheaper models, you shouldn't have to update every app by hand.

LiteLLM now supports `-latest` aliases. Pick a model family once. We update the model behind the alias as newer versions arrive, so you can keep the same name in your code.

<!-- truncate -->

With `litellm` installed and `OPENAI_API_KEY` set:

```python
from litellm import completion

response = completion(
    model="openai/gpt-luna-latest",
    messages=[{"role": "user", "content": "Say hello."}],
)
```

The same aliases work in the Python SDK and AI Gateway.

## Supported models

Use the provider prefix with any of its aliases below, as in `openai/gpt-luna-latest`.

- **OpenAI** (`openai/`): `gpt-luna-latest`, `gpt-sol-latest`, `gpt-terra-latest`, `gpt-astra-latest`, `gpt-mini-latest`
- **Anthropic** (`anthropic/`): `claude-opus-latest`, `claude-sonnet-latest`, `claude-haiku-latest`, `claude-fable-latest`
- **xAI** (`xai/`): `grok-latest`
- **Moonshot** (`moonshot/`): `kimi-latest`
- **Z.AI** (`zai/`): `glm-latest`, `glm-flash-latest`
- **DeepSeek** (`deepseek/`): `deepseek-pro-latest`, `deepseek-flash-latest`
- **DashScope** (`dashscope/`): `qwen-max-latest`, `qwen-flash-latest`
- **MiniMax** (`minimax/`): `minimax-latest`

These aliases call each provider's own API. Gemini and Mistral already offer provider-managed latest names, which LiteLLM passes through.

[Get started with latest aliases](https://docs.litellm.ai/docs/model_latest_aliases).
