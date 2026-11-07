---
title: Choose a classifier
sidebar_label: Choose a classifier
description: Use heuristics, an LLM, keyword rules, or your own Python classifier to choose a model with the LiteLLM SDK.
---

A classifier picks a tier for a request. Your `tiers` mapping decides which model serves that tier.

Start with `autorouter.py` from the [quickstart](../autorouter_sdk.md). Add each example below **after `routing_config` and before `router = Router(...)`**, then run `python autorouter.py`. Try one classifier at a time.

## Use the local heuristic

The quickstart uses this setting:

```python
routing_config["classifier_type"] = "heuristic"
```

The heuristic scores signals such as prompt length, code, and reasoning terms. It runs locally without a classifier API call. Start here to avoid an extra model request, then check its choices against your own prompts.

## Use an LLM classifier

Use a model to judge the prompt's complexity:

```python
routing_config.update({
    "classifier_type": "llm",
    "classifier_llm_config": {
        "model": "fast",
        "timeout_ms": 2000,
    },
    "classifier_fallback": "heuristic",
})
```

`fast` refers to the model you defined in `model_list`. The router calls it to choose a tier, then calls the model assigned to that tier to answer. You pay for both calls. If classification times out or returns an invalid result, this configuration uses the heuristic.

To use your default model on classifier failure instead, set:

```python
routing_config["classifier_fallback"] = "default_model"
```

The quickstart's `complexity_router_default_model` is `capable`.

## Route matching keywords to a tier

Add keyword rules when you know which tier should handle a topic:

```python
routing_config["keyword_tier_rules"] = [
    {"keywords": ["kubernetes", "k8s"], "tier": "REASONING"},
    {"keywords": ["hello", "thanks"], "tier": "SIMPLE"},
]
```

Rules run before the classifier. If several rules match, the highest matched tier wins. Without a match, the configured classifier runs. This example uses literal matching, with no embedding call.

Change the quickstart's message to `"Explain Kubernetes deployments"` and run it. The keyword rule selects `REASONING`, which maps to `capable`.

## Write a classifier in Python

Return a tier name based on the message or metadata. Add this after `routing_config` and before `router = Router(...)` in the [quickstart](../autorouter_sdk.md):

```python
class TaskClassifier:
    async def classify(self, context):
        message = context.structured_messages[-1]["content"]
        if context.metadata.get("agent_name") == "summarizer":
            return "quick"
        if len(message) > 1000:
            return "careful"
        if "kubernetes" in message.lower():
            return "careful"
        return "quick"


routing_config.update({
    "classifier_type": "custom",
    "classifier_plugin": TaskClassifier(),
    "tiers": {"quick": "fast", "careful": "capable"},
    "classifier_fallback": "default_model",
})
```

This example reads the last message as text. The first matching rule wins. Change the rules and tier names to suit your application.

Pass metadata with the request when you need it:

```python
response = await router.acompletion(
    model="auto",
    messages=[{"role": "user", "content": "Summarize this document: ..."}],
    metadata={"agent_name": "summarizer"},
)
```

Run `python autorouter.py`. The summarizer uses `fast`. Without that metadata, long messages and Kubernetes questions use `capable`; other messages use `fast`.

If your classifier raises an error, times out, or returns an unknown tier, this configuration uses the quickstart's default model, `capable`.

Next, [configure routing](./routing.md) or [inspect your classifier's decisions](./evaluation.md). For hosted decision classifiers and semantic keyword matching, see the [classification reference](/docs/proxy/auto_routing#classification).
