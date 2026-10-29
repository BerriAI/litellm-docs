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

Your classifier can read the messages, inspect conversation history, call an LLM, or use application metadata. Return a tier name; `tiers` maps it to a model.

### Route by message content

Add this before you create the router. This example reads the latest user message and sends escalation requests, Kubernetes questions, and longer prompts to `capable`.

```python
from litellm.types.router import RoutingContext


class TaskClassifier:
    async def classify(self, context: RoutingContext) -> str | None:
        text = next(
            (m["content"] for m in reversed(context.structured_messages) if m.get("role") == "user"),
            None,
        )
        if not isinstance(text, str):
            return None
        if text.startswith("ESCALATE") or "kubernetes" in text.lower():
            return "careful"
        return "quick" if len(text) < 500 else "careful"


routing_config.update({
    "classifier_type": "custom",
    "classifier_plugin": TaskClassifier(),
    "tiers": {"quick": "fast", "careful": "capable"},
    "classifier_fallback": "default_model",
})
```

Run `python autorouter.py`. The quickstart's `"What is 2+2?"` uses `fast`. Change that message to `"Explain Kubernetes deployments"` or `"ESCALATE: check this calculation"` to use `capable`. The 500-character threshold is your rule; change it to fit your application.

`context.structured_messages` contains the conversation in OpenAI message format, including message roles. You can also branch on the last message's role or inspect previous turns. This example handles string content; it returns `None` for images or other content blocks.

### Ask an LLM only for longer prompts

Keep the checks above, but replace the final `return` in `classify()` with:

```python
        if len(text) < 500:
            return "quick"
        response = await router.acompletion(
            model="fast",
            messages=[
                {"role": "system", "content": "Classify the task. Reply quick for routine work or careful for difficult reasoning. Reply with only the label."},
                {"role": "user", "content": text},
            ],
        )
        return response.choices[0].message.content.strip()
```

Before creating the router, allow up to 10 seconds for your classifier:

```python
routing_config["classifier_plugin_timeout_ms"] = 10000
```

Short prompts use local rules. Longer prompts make one classification call to `fast`, then one call to the selected answering model. The `ESCALATE` and Kubernetes checks still take precedence. Use `fast` for the classification call; calling `auto` here would invoke your classifier again.

### Include application metadata

Metadata is useful for information outside the messages, such as the current agent step. To route reviews to `careful`, add this at the start of `classify()`:

```python
        if context.metadata.get("agent_step") == "review":
            return "careful"
```

Your application supplies that value when it calls the router:

```python
response = await router.acompletion(
    model="auto",
    messages=[{"role": "user", "content": "Check this deployment plan for errors."}],
    metadata={"agent_step": "review"},
)
```

Without that metadata, the message-based rules still run. You choose the metadata keys and values.

Return `None` to use `classifier_fallback`. Exceptions, timeouts, and unknown tier names also use that fallback; here, the quickstart's default model is `capable`. Keyword rules run before your classifier, so omit them when your Python code should make the decision.

Next, [configure routing](./routing.md) or [inspect your classifier's decisions](./evaluation.md). For hosted decision classifiers and semantic keyword matching, see the [classification reference](/docs/proxy/auto_routing#classification).
