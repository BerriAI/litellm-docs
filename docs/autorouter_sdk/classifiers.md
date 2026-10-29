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

Use your own code when application metadata should decide the tier. `metadata` is a dictionary your application passes to `router.acompletion()`; you choose the keys and values. Here, your code marks a request as `code_review`.

Add this class and configuration before you create the router:

```python
from litellm.types.router import RoutingContext


class TaskClassifier:
    async def classify(self, context: RoutingContext) -> str | None:
        if context.metadata.get("task_type") == "code_review":
            return "review"
        return "routine"


routing_config.update({
    "classifier_type": "custom",
    "classifier_plugin": TaskClassifier(),
    "tiers": {"routine": "fast", "review": "capable"},
    "classifier_plugin_timeout_ms": 3000,
    "classifier_fallback": "default_model",
})
```

Inside `main()`, replace the `router.acompletion(...)` call with:

```python
response = await router.acompletion(
    model="auto",
    messages=[{"role": "user", "content": "Review this function: def add(a, b): return a - b"}],
    metadata={"task_type": "code_review"},
)
```

Run the script. You should see the model assigned to `capable`. Without `task_type="code_review"`, this classifier returns `routine` and uses `fast`.

Choose your own tier names in `tiers`. Return one of those names from `classify()`, or `None` to use `classifier_fallback`. Exceptions, timeouts, and invalid tier names also use that fallback. Keyword rules still run before this classifier, so omit them when you want your Python logic to make the decision.

Next, [configure routing](./routing.md) or [inspect your classifier's decisions](./evaluation.md). For hosted decision classifiers and semantic keyword matching, see the [classification reference](/docs/proxy/auto_routing#classification).
