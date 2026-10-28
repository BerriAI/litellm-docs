---
title: Autorouter SDK
sidebar_label: Autorouter SDK
description: Build an auto router in Python that chooses a model for each request. Install LiteLLM, configure two models, and see which model answers.
---

Choose a model for each prompt with `litellm.Router`. You define the models and routing rules in Python. No proxy server or Enterprise license is required.

This example routes between two OpenAI models using a local heuristic classifier. You need Python and an OpenAI API key; you pay for the model responses.

## 1. Install and set your API key

Run this in your project directory:

```bash
python -m pip install --upgrade litellm
```

Create an API key in the [OpenAI dashboard](https://platform.openai.com/api-keys). Set it in the same terminal where you will run the script (macOS or Linux):

```bash
export OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
```

Replace `YOUR_OPENAI_API_KEY` with your key. Your account needs access to both models in the example.

## 2. Create your router

Save this as `autorouter.py`:

```python
import asyncio

from litellm import Router

router = Router(
    model_list=[
        {
            "model_name": "fast",
            "litellm_params": {"model": "openai/{{openai_small}}"},
        },
        {
            "model_name": "capable",
            "litellm_params": {"model": "openai/{{openai_large}}"},
        },
        {
            "model_name": "auto",
            "litellm_params": {
                "model": "auto_router/complexity_router",
                "complexity_router_config": {
                    "classifier_type": "heuristic",
                    "tiers": {
                        "SIMPLE": "fast",
                        "MEDIUM": "fast",
                        "COMPLEX": "capable",
                        "REASONING": "capable",
                    },
                    "return_raw_model_name": True,
                },
                "complexity_router_default_model": "capable",
            },
        },
    ]
)


async def main():
    response = await router.acompletion(
        model="auto",
        messages=[{"role": "user", "content": "What is 2+2?"}],
    )
    print("Selected model:", response.model)
    print(response.choices[0].message.content)


if __name__ == "__main__":
    asyncio.run(main())
```

Call `auto` from your application. The classifier assigns a complexity tier to the prompt: `SIMPLE` and `MEDIUM` use `fast`; `COMPLEX` and `REASONING` use `capable`. If it cannot classify the request, the router uses `capable` as the default.

## 3. Send a request

```bash
python autorouter.py
```

The script prints the selected model and its answer. Example output:

```text
Selected model: {{openai_small}}
4
```

`return_raw_model_name=True` exposes the selected model in `response.model`. Change the message to try your own prompts. Heuristic classification estimates complexity from prompt signals, so check its choices on your own requests before relying on it.

If authentication fails, check that `OPENAI_API_KEY` is set in this terminal. If a model is unavailable to your account, replace its `litellm_params.model` value with an OpenAI model you can access.

## Use your own models

Change the two provider model names and the tier assignments to fit your application. To use another provider, set that provider's credentials and use its `provider/model` name; see [supported providers](/docs/providers).

For LLM classifiers, keyword rules, and other options, see the [auto-routing configuration reference](/docs/proxy/auto_routing#full-config). To run routing as an HTTP service for multiple applications, see [gateway setup](/docs/auto_router/setup).
