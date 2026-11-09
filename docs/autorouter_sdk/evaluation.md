---
title: Inspect and evaluate
sidebar_label: Inspect and evaluate
description: See the model selected by your Python auto router, read decision logs, and compare responses with a fixed model.
---

Start with `autorouter.py` from the [quickstart](../autorouter_sdk.md). Check both the model selected and the answer it produces. Choosing a cheaper model only helps if its answer meets your needs.

## See the selected model

The quickstart sets `return_raw_model_name=True` in `routing_config`. After a request, print:

```python
print("Selected model:", response.model)
print(response.choices[0].message.content)
```

The model name can include a provider's version suffix. Keep this setting enabled while you test; the alias `auto` alone would not tell you which model answered.

## Read the routing decision

Add this before creating the router:

```python
import logging

logging.getLogger("LiteLLM Router").setLevel(logging.INFO)
```

Run `python autorouter.py`. Look for `ComplexityRouter: routing decision` in the logs. The line includes the selected model and a cause such as `heuristic_scorer`, `literal_keyword_match`, `llm_classifier`, or `session_affinity_pin`. Classification decisions also report the tier; heuristic decisions include the score and signals.

Use these logs with test prompts. They can include matched terms and other request-derived details.

## Compare with a fixed model

Save this as `evaluate_router.py` beside `autorouter.py`. It imports the configured router without running the quickstart's `main()`.

Each prompt makes two answer requests: one through `auto` and one directly to `capable`. An LLM classifier adds its own classification request. All provider calls use your account.

```python
import asyncio
from time import perf_counter

from autorouter import router

prompts = [
    "What is 2+2?",
    "Explain when to use a database index and when it can slow writes down.",
    "Review this function: def add(a, b): return a - b",
]


async def main():
    for prompt in prompts:
        print("\nPrompt:", prompt)
        for target in ("auto", "capable"):
            start = perf_counter()
            response = await router.acompletion(
                model=target,
                messages=[{"role": "user", "content": prompt}],
            )
            elapsed = perf_counter() - start
            print(f"{target}: {response.model} ({elapsed:.2f}s)")
            print(response.choices[0].message.content)


if __name__ == "__main__":
    asyncio.run(main())
```

Run it from that directory:

```bash
python evaluate_router.py
```

For each prompt, you will see the selected model, elapsed time, and answer for both paths. Replace these samples with requests from your application. Check correctness and task completion before comparing latency or price. The elapsed time includes routing and the answer request; one run is a spot check, not a benchmark.

If `auto` chooses a model that cannot do the task, change the [classifier](./classifiers.md) or [tier mapping](./routing.md#assign-models-to-tiers), then rerun the same prompts. For pool selection, repeat requests to sample its choices. To test session affinity, use the [two-turn example](./routing.md#keep-a-conversation-on-one-model); this script sends independent requests without session IDs.

For costs across providers, see [SDK cost tracking](/docs/completion/token_usage). Include classifier calls when you compare total cost; answer tokens alone do not capture them.
