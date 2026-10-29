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

Read the request and return a tier name. You can use message content, metadata, or an LLM to make that decision.

In the [quickstart](../autorouter_sdk.md), add this after `routing_config` and before `router = Router(...)`:

```python
from litellm.types.router import RoutingContext


class TaskClassifier:
    async def classify(self, context: RoutingContext) -> str | None:
        if context.metadata.get("agent_step") == "review":
            return "careful"

        text = next(
            (m.get("content") for m in reversed(context.structured_messages) if m.get("role") == "user"),
            None,
        )
        if not isinstance(text, str):
            return None
        if text.startswith("ESCALATE") or "kubernetes" in text.lower():
            return "careful"
        if len(text) < 500:
            return "quick"

        response = await router.acompletion(
            model="fast",
            messages=[
                {"role": "system", "content": "Reply quick for routine tasks or careful for difficult reasoning. Return only the label."},
                {"role": "user", "content": text},
            ],
        )
        return response.choices[0].message.content.strip()


routing_config.update({
    "classifier_type": "custom",
    "classifier_plugin": TaskClassifier(),
    "tiers": {"quick": "fast", "careful": "capable"},
    "classifier_plugin_timeout_ms": 10000,
    "classifier_fallback": "default_model",
})
```

Run `python autorouter.py`. Change the quickstart's user message to try each rule:

| Message | Route |
| --- | --- |
| `What is 2+2?` | `quick` → `fast` |
| `Explain Kubernetes deployments` | `careful` → `capable` |
| `ESCALATE: check this calculation` | `careful` → `capable` |
| Any other message of 500 or more characters | Ask `fast` to choose `quick` or `careful`, then call that tier's model. |

Choose your own names, rules, and threshold. Only the last branch makes an extra LLM call. It calls `fast`; calling `auto` inside the classifier would call the classifier again.

To use metadata, pass it with the request. This triggers the first rule, regardless of message length:

```python
response = await router.acompletion(
    model="auto",
    messages=[{"role": "user", "content": "Check this deployment plan."}],
    metadata={"agent_step": "review"},
)
```

You supply the metadata keys and values. Without `agent_step="review"`, the classifier checks the message.

Return `None` when your code cannot choose a tier. Exceptions, timeouts, and unknown names also use the configured default model, `capable`. This example falls back for non-text content. If you added keyword rules earlier, remove them to let this classifier handle the request.

Next, [configure routing](./routing.md) or [inspect your classifier's decisions](./evaluation.md). For hosted decision classifiers and semantic keyword matching, see the [classification reference](/docs/proxy/auto_routing#classification).
