---
title: "compache: Compaction and Prompt Caching Fitted to Your Traffic"
sidebar_label: "Compaction and Caching (compache)"
description: "Record LiteLLM traffic without text, fit what to keep of the history and when the prompt cache pays, then apply it in the SDK or in front of the proxy."
---

# Compaction and Prompt Caching (compache)

{/* keep-version-note */}

[compache](https://github.com/BarendPotijk/compache) learns from your own conversations which parts of the history later turns still need and when your users come back. It then trims the request once the prompt cache has expired, when the history has to be paid for in full anyway, and keeps the cache warm where that costs less than losing it. It is open source under Apache-2.0, has no dependencies, and runs in your own process.

## Record

Add the callback to the proxy you already run. It changes no request and works with every provider. The record holds sizes, times and token usage, never text.

```shell
pip install compache
export COMPACHE_RECORD=/data/compache-record
```

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: {{anthropic}}
    litellm_params:
      model: anthropic/{{anthropic}}
      api_key: os.environ/ANTHROPIC_API_KEY

litellm_settings:
  callbacks: ["compache.litellm.callback"]
```

Name each conversation in the request, with `"metadata": {"session_id": "conversation-17"}`.

Set `COMPACHE_SAMPLE=0.1` and the model is asked, after one reply in ten, which earlier parts that reply needed. This request is compache's own, and your application never sees it. It adds about 5% to the bill while you record.

## Fit

```shell
compache fit /data/compache-record --model claude-haiku-5-5 -o policy.json
```

The command prices every candidate on your traffic and prints what you would save before anything changes.

## Apply

### In front of the LiteLLM proxy

```shell
compache proxy --policy policy.json --upstream http://localhost:4000 --port 8787
```

Point clients at `http://localhost:8787` instead. Their LiteLLM keys pass through. Send the header `x-compache-thread` to name a conversation. Without it, compache recognizes a conversation by what it has said so far.

### In the SDK

```python
import compache
import litellm

compache.litellm.install(compache.Live("policy.json"))

with compache.thread("conversation-17"):
    litellm.completion(model="openrouter/anthropic/claude-haiku-5.5", messages=messages)
```

From compache 0.15.2 on, this covers every provider that LiteLLM calls in Python, through the OpenAI SDK or through its own HTTP clients. Its native Messages passthrough and requests it signs, as for Bedrock, pass unchanged: run those through `compache proxy` and pass `api_base="http://127.0.0.1:8787"`.

## What the model sees

A trimmed part leaves a short notice in its place, and the model can read it back with a `reopen` tool. compache answers that call before your application sees the reply. A request that the provider refuses after compache changed it goes out again as your application wrote it.
