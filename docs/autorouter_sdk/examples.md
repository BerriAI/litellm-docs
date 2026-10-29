---
title: Routing examples
sidebar_label: Routing examples
description: Choose a model from an HTTP header, an agent step, or a failed check with a small Python classifier and custom tiers.
---

Choose a model using information your application already has. These examples pass that information in `metadata`, then read it in a Python classifier. LiteLLM does not invent these fields or read your web server's headers for you.

## Set up once

Install `litellm` and set `OPENAI_API_KEY` as shown in the [quickstart](../autorouter_sdk.md#1-install-and-set-your-api-key). Each request below calls a model and incurs provider charges.

Save this as `routing.py`. The tiers are named `quick` and `careful`; you can choose your own names. `tiers` maps each name to a model, and `fallback_tier` handles classifier errors or invalid results.

```python title="routing.py"
from litellm import Router


class Classifier:
    async def classify(self, context):
        return context.metadata.get("route", "quick")


router = Router(model_list=[
    {"model_name": "fast", "litellm_params": {"model": "openai/{{openai_small}}"}},
    {"model_name": "capable", "litellm_params": {"model": "openai/{{openai_large}}"}},
    {
        "model_name": "auto",
        "litellm_params": {
            "model": "auto_router/complexity_router",
            "complexity_router_default_model": "capable",
            "complexity_router_config": {
                "classifier_type": "custom",
                "classifier_plugin": Classifier(),
                "tiers": {"quick": "fast", "careful": "capable"},
                "tier_definitions": [
                    {"name": "quick", "description": "Routine work."},
                    {"name": "careful", "description": "Work that needs a stronger model."},
                ],
                "fallback_tier": "careful",
                "escalation_keywords": [],
                "return_raw_model_name": True,
            },
        },
    },
])


async def ask(prompt, **metadata):
    response = await router.acompletion(
        model="auto",
        messages=[{"role": "user", "content": prompt}],
        metadata=metadata,
    )
    print("Model:", response.model)
    return response.choices[0].message.content
```

Replace the two provider models if your account uses different ones. Keep `routing.py` next to each file below. The classifier runs locally; only the selected answering model gets a model call.

## Route by an HTTP header

Let a caller request a more thorough answer with `X-Answer-Mode: thorough`. Your HTTP handler reads the header and passes a route to the SDK.

Install `fastapi` and `uvicorn` with `python -m pip install fastapi uvicorn`. Save this as `app.py`:

```python title="app.py"
from fastapi import FastAPI, Request
from routing import ask

app = FastAPI()


@app.post("/ask")
async def answer(request: Request):
    body = await request.json()
    route = "careful" if request.headers.get("x-answer-mode") == "thorough" else "quick"
    return {"answer": await ask(body["prompt"], route=route)}
```

Run `uvicorn app:app`, then send a request from another terminal:

```bash
curl http://localhost:8000/ask \
  -H 'Content-Type: application/json' \
  -H 'X-Answer-Mode: thorough' \
  -d '{"prompt":"Explain Python generators in two sentences."}'
```

The server prints the `capable` model's name. Remove `X-Answer-Mode` to use `fast`. This example lets the caller choose the more expensive route; use your authenticated account settings instead for paid-plan access.

## Route by an agent step

Use the fast model to draft, then the stronger model to review. Your agent owns the step and supplies the route; there is no extra classification call.

```python title="agent.py"
import asyncio
from routing import ask


async def main():
    draft = await ask("Draft a Python function that parses a CSV row.", route="quick")
    review = await ask(f"Review this code for bugs:\n{draft}", route="careful")
    print(review)


asyncio.run(main())
```

Run `python agent.py`. You should see `fast`'s model name, then `capable`'s model name and its review.

## Adapt after a failed check

Start with the fast model. If its output fails a check, retry once with the stronger model and include the failure. Here the check is Python's JSON parser; an agent could use a schema validator or test result.

```python title="retry.py"
import asyncio
import json
from routing import ask


async def main():
    prompt = 'Return only JSON with a "colors" list containing three colors.'
    for route in ("quick", "careful"):
        answer = await ask(prompt, route=route)
        try:
            print(json.loads(answer))
            return
        except json.JSONDecodeError as error:
            prompt = f"{prompt}\nPrevious answer: {answer}\nFix this JSON error: {error}"
    raise ValueError("Both models returned invalid JSON")


asyncio.run(main())
```

Run `python retry.py`. Valid JSON ends the loop after one call. Invalid JSON triggers one `careful` call; a second failure raises an error. This checks JSON syntax, not the answer's content.

This rule adapts within one task and keeps no learning history. For model selection that learns across requests, see the separate [Adaptive Router](../adaptive_router.md).

You can move these decisions into `Classifier.classify()` when several callers share the same rules. Pass the inputs you need, such as `metadata={"step": "review", "failed_checks": 1}`, and read those same keys from `context.metadata`. For custom-tier constraints, see [tier configuration](../auto_router/optimize_classifier.md#customize-tiers-or-use-a-plugin).
