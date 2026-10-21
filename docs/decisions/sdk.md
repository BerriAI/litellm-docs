---
sidebar_label: "Python SDK"
---

# SDK usage

The SDK has one function per request format. `litellm.decisions` takes the OpenAI Decisions shape (`input`, a `questions` list and an optional `safety_identifier`) and returns the OpenAI response, with `answers` as a list. `litellm.systemone` takes the System One shape (`state` and a `questions` mapping keyed by question name) and returns the System One response, with `answers` keyed by question name. Both work with every supported provider, so you pick the function by the request shape you write, not by the provider you call.

```python showLineNumbers title="OpenAI Decisions format" keep-model-ids
import os
import litellm

os.environ["OPENAI_API_KEY"] = ""

response = litellm.decisions(
    model="openai/gpt-6-luna",
    input="Customer wrote: I was charged twice for my order #4411 and want one of the charges refunded today.",
    questions=[
        {"type": "predicate", "name": "is_refund_request", "instructions": "Is the customer asking for a refund?"},
    ],
)
print(response.answers[0].probability)
print(response.usage)
```

```python showLineNumbers title="System One format"
import os
import litellm

os.environ["TYPESAFE_API_KEY"] = ""

response = litellm.systemone(
    model="typesafe/jev-latest",
    state="Customer wrote: I was charged twice for my order #4411 and want one of the charges refunded today.",
    questions={
        "is_refund_request": {"type": "noul", "instructions": "Is the customer asking for a refund?"},
    },
)
print(response.answers["is_refund_request"].noul)
```

The async versions are `litellm.adecisions` and `litellm.asystemone` and take the same arguments.

```python showLineNumbers
import asyncio
import os
import litellm

os.environ["TYPESAFE_API_KEY"] = ""

async def main():
    response = await litellm.asystemone(
        model="typesafe/jev-latest",
        state="Customer wrote: I was charged twice for my order #4411 and want one of the charges refunded today.",
        questions={
            "is_refund_request": {"type": "noul", "instructions": "Is the customer asking for a refund?"},
        },
    )
    print(response.answers["is_refund_request"].noul)

asyncio.run(main())
```

All four functions also accept `safety_identifier`, `api_key`, `api_base`, `timeout`, `custom_llm_provider` and `extra_headers`. `litellm.systemone` and `litellm.asystemone` also take `images`, a list of image URLs or data URLs, and `assets`, the TypeSafe image map described in [TypeSafe images, box questions and long context](./typesafe_images.md). Passing `images` to `litellm.decisions` raises a `BadRequestError` unless `drop_params` is on, since the OpenAI format carries images as `input_image` parts. Passing `input` to `litellm.systemone` raises a `BadRequestError` that points at `litellm.decisions`. Passing `state` to `litellm.decisions` still works for existing callers, it sends the System One format and emits a `UserWarning` that points at `litellm.systemone`. A model whose prefix is not one of the supported providers fails with a `BadRequestError` that lists the supported ones.

Through the Router the same split applies: `router.decisions` and `router.adecisions` take the OpenAI shape, `router.systemone` and `router.asystemone` take the System One shape. On the proxy, `/v1/systemone` requests are logged with call type `asystemone` and `/v1/decisions` requests with `adecisions`.

:::info Upgrading from v1.104.x
In v1.104.2 through v1.104.x, `litellm.decisions` accepted both shapes and picked the format from whether you passed `input` or `state`. Those calls keep working unchanged, with a `UserWarning`. Rename `litellm.decisions(state=...)` to `litellm.systemone(state=...)` when convenient, the arguments stay the same.
:::
