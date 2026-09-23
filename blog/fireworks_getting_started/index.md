---
slug: fireworks-getting-started
title: "Getting Started with Fireworks AI on LiteLLM"
date: 2026-09-22T10:00:00
authors:
  - misbah
description: "A beginner tutorial: run an open model on Fireworks AI behind a LiteLLM gateway, call it with the OpenAI SDK you already use, then add a second model and a fallback."
keywords: [fireworks ai, litellm tutorial, ai gateway, open models, getting started, openai compatible, llm proxy]
tags: [tutorial, providers, fireworks, getting-started]
hide_table_of_contents: false
---

Fireworks AI is one of the largest open model inference platforms, serving more than 40 trillion tokens a day for companies including Uber, Notion, DoorDash, and Cursor. LiteLLM is the most widely used open source AI gateway, with over 240 million Docker pulls. Together they give you fast, low-cost open models behind a single OpenAI-compatible endpoint that tracks every token you spend.

{/* truncate */}

## What Fireworks AI gives you

Fireworks AI serves open models on fast inference infrastructure. Families like DeepSeek, Qwen, GLM, Kimi, MiniMax, and GPT-OSS are available as serverless endpoints you can call immediately with an API key. As your needs grow you can host a model inside your own Fireworks account, reserve a dedicated deployment for consistent throughput, or point at a Fireworks router that keeps you on the current version of a model family. Open models run fast on Fireworks and cost a fraction of frontier pricing, and because the weights are open you can fine-tune one on your own data and serve the result from the same platform.

## What LiteLLM gives you

LiteLLM is an open source AI gateway. You run it in front of your models, and it gives every provider one OpenAI-compatible API. Your application sends a normal OpenAI request to one endpoint, and the gateway handles the provider-specific details. It also tracks token usage and cost for every request, issues keys with budgets attached, and can fall back to another model when one is busy.

## What you get together

Your application code speaks OpenAI format to a single endpoint and never learns that Fireworks is behind it. Changing which model serves a route becomes a line in a config file, so you can move traffic to a cheaper or faster model without a deploy. Spend shows up per key and per team from the first request. When Fireworks adds a model you want, or you move a route onto a version fine-tuned on your own data, you pick it up by editing that one line.

## What you need

A Fireworks API key from the [Fireworks dashboard](https://fireworks.ai), Python 3.10 or newer, and a couple of minutes. Install the gateway with `pip install 'litellm[proxy]'`.

## 1. Write a config file

Create `config.yaml` with one model. The `model_name` is the name your application will use. The `model` underneath it is the real Fireworks model, and the `fireworks_ai/` prefix tells the gateway which provider to route to.

```yaml title="config.yaml"
model_list:
  - model_name: my-model
    litellm_params:
      model: fireworks_ai/deepseek-v4p1-flash
      api_key: os.environ/FIREWORKS_AI_API_KEY
```

Writing `os.environ/FIREWORKS_AI_API_KEY` keeps the key out of the file. The gateway reads it from the environment at startup.

## 2. Start the gateway

```bash
export FIREWORKS_AI_API_KEY="your-key-here"
litellm --config config.yaml
```

The gateway comes up on `http://0.0.0.0:4000`.

## 3. Send a request

Any OpenAI-compatible client works. With curl:

```bash
curl http://0.0.0.0:4000/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "my-model",
    "messages": [{"role": "user", "content": "what llm are you"}]
  }'
```

Or with the OpenAI Python SDK, changing only the `base_url`:

```python
import openai

client = openai.OpenAI(
    api_key="anything",
    base_url="http://0.0.0.0:4000",
)

response = client.chat.completions.create(
    model="my-model",
    messages=[{"role": "user", "content": "write a haiku about gateways"}],
)

print(response.choices[0].message.content)
```

Note the model name in the request is `my-model`, the alias you chose, and added earlier in the config.yaml file.

## 4. Add a second model and a fallback

You can add as many models as you like. In this tutorial they live in `config.yaml`, so add another entry to `model_list`, then tell the router to try the second model when the first is unavailable. Once you connect a database you can also add and edit models from the gateway dashboard without restarting.

```yaml title="config.yaml"
model_list:
  - model_name: my-model
    litellm_params:
      model: fireworks_ai/deepseek-v4p1-flash
      api_key: os.environ/FIREWORKS_AI_API_KEY

  - model_name: my-backup
    litellm_params:
      model: fireworks_ai/glm-5p3-flash
      api_key: os.environ/FIREWORKS_AI_API_KEY

router_settings:
  fallbacks: [{"my-model": ["my-backup"]}]
```

Restart the gateway and your application keeps calling `my-model`. Rate limits and transient errors now route to the backup automatically.

## Where to go next

Once the basics are running, the same config file is where you reach the rest of the platform. Account-hosted models use their full `accounts/fireworks/models/...` path, dedicated deployments add an `api_base`, and Fireworks routers take a `routers/` prefix. Requests to `/v1/responses` reach the native Fireworks Responses API, so server-side MCP tools and response chaining work through the gateway. Document inlining lets models without vision support read documents and images. Embeddings, reranking, and audio transcription route through the same key and the same spend tracking.

To hand out scoped keys with their own budgets, connect a Postgres database and set a master key; see [virtual keys](/docs/proxy/virtual_keys). The full provider reference lives in the [Fireworks AI docs](/docs/providers/fireworks_ai).
