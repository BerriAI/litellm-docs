---
title: Autorouter SDK
sidebar_label: Autorouter SDK
description: Build an auto router in Python that chooses a model for each request. Install LiteLLM, configure two models, and see which model answers.
---

Build an auto router inside your Python application with `litellm.Router`. It classifies each request and sends it to a model you choose for that complexity level. Direct SDK use does not require a proxy server or an Enterprise license.

This example uses two OpenAI models and a local heuristic classifier, so you need one OpenAI API key. Classification does not make an extra model call; the selected model's response uses your provider account.

## Install and set your API key

Run this in your project directory:

```bash
python -m pip install --upgrade litellm
```

Create an API key in the [OpenAI dashboard](https://platform.openai.com/api-keys). Set it in the same terminal where you will run the script (macOS or Linux):

```bash
export OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
```

Replace `YOUR_OPENAI_API_KEY` with your key. Your account needs access to both models in the example.

## Build your router

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

`fast` and `capable` are names you define in `model_list`. The four tiers map the classifier's decision to those names; multiple tiers can use the same model. `auto` is the name your application calls on every request. The default model is the fallback when the router cannot classify a request.

`return_raw_model_name=True` lets you see the selected model in `response.model`.

## Run it

```bash
python autorouter.py
```

You should see `Selected model:` followed by the model that handled the request, then its answer. Change the message and run it again to try your own prompts. The heuristic uses prompt signals to estimate complexity; it does not guarantee that every difficult question goes to the larger model.

If authentication fails, check that `OPENAI_API_KEY` is set in this terminal. If a model is unavailable to your account, replace its `litellm_params.model` value with an OpenAI model you can access.

## Use your own models

Change the two provider model names and the tier assignments to fit your application. To use another provider, set that provider's credentials and use its `provider/model` name; see [supported providers](/docs/providers).

For LLM classifiers, keyword rules, and other options, see the [auto-routing configuration reference](/docs/proxy/auto_routing#full-config). To run routing as an HTTP service for multiple applications, see [gateway setup](/docs/auto_router/setup).
