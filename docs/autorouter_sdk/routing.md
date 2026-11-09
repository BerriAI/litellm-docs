---
title: Configure routing
sidebar_label: Configure routing
description: Assign models to tiers, use model pools, keep sessions on one model, and enable context-window escalation in Python.
---

Start with `autorouter.py` from the [quickstart](../autorouter_sdk.md). Add the configuration snippets below **after `routing_config` and before `router = Router(...)`**. Then run `python autorouter.py` to try the change.

## Assign models to tiers

Map each tier to a `model_name` from your `model_list`:

```python
routing_config["tiers"] = {
    "SIMPLE": "fast",
    "MEDIUM": "capable",
    "COMPLEX": "capable",
    "REASONING": "capable",
}
```

This sends medium-complexity prompts to `capable` instead of `fast`. You can map several tiers to one model. To use another provider, add its model to `model_list`, set its credentials, and use that entry's `model_name` here.

Keep the tier mapping separate from `complexity_router_default_model`: the default handles requests the router cannot classify; it does not replace the tiers.

## Choose from a pool

Use a list when more than one model can handle a tier:

```python
routing_config["tiers"]["MEDIUM"] = ["fast", "capable"]
```

The router chooses a model at random from that pool when it selects `MEDIUM`. List only models you are willing to use for that tier. A pool does not mean “try the first model, then fall back to the second.”

To try adaptive selection within the pool, add:

```python
routing_config["adaptive"] = True
```

Adaptive selection uses Thompson sampling and feedback from later conversation turns. It starts by exploring the pool; it does not guarantee that the first choice is the cheapest or best model. Compare it with random selection on your own traffic using the [evaluation guide](./evaluation.md).

## Keep a conversation on one model

Enable session affinity when you want follow-up turns to reuse the first turn's model:

```python
routing_config.update({
    "session_affinity": True,
    "session_affinity_ttl_seconds": 3600,
})
```

Replace `main()` with this two-turn conversation:

```python
async def main():
    messages = [{"role": "user", "content": "What is 2+2?"}]
    for turn in range(2):
        response = await router.acompletion(
            model="auto",
            messages=messages,
            metadata={"session_id": "arithmetic-demo"},
        )
        print("Selected model:", response.model)
        print(response.choices[0].message.content)
        if turn == 0:
            messages.append({
                "role": "assistant",
                "content": response.choices[0].message.content,
            })
            messages.append({"role": "user", "content": "And what is twice that?"})
```

Both turns use the same session ID and should print the same model. Choose a different ID for each conversation and reuse the `Router` instance. Without `session_id`, the router classifies each request even when affinity is enabled.

Affinity can preserve provider prompt caches, but it also keeps cheap follow-up questions on an expensive model if the first turn chose it. Escalation can change the pin. Routing `plugins` disable this shortcut so their policies still run; a `classifier_plugin` does not.

## Handle prompts that exceed a model's context window

Enable context-window escalation to move a request to a higher tier when the selected tier cannot fit it:

```python
routing_config.update({
    "enable_context_window_escalation": True,
    "context_window_escalation_buffer": 0.95,
})
```

The router estimates the input size and looks for a higher tier with enough room. It reads each target model's context window from LiteLLM's model data or that deployment's `model_info.max_input_tokens`. The buffer reserves 5% of the input window. A higher tier needs a larger context window for this to help.

Unknown windows do not trigger escalation. If no tier is known to fit, the request stays on its selected tier and can still fail at the provider. This option does not truncate your prompt or guarantee that it will fit. See the [context-window reference](/docs/proxy/auto_routing#context-window-escalation) for the full behavior.

Next, [inspect and evaluate routing](./evaluation.md) before using the configuration for your application.
