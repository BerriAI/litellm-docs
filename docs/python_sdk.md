---
id: python_sdk
title: LiteLLM Python SDK
sidebar_label: Overview
description: The LiteLLM Python SDK gives you one interface to call 100+ LLM providers from Python, with the same input and output format for each provider.
---

import NavigationCards from '@site/src/components/NavigationCards';

# LiteLLM Python SDK

The LiteLLM Python SDK is a Python library. It gives you one interface to call 100+ LLM providers, such as OpenAI, Anthropic, Vertex AI, and Bedrock, in the OpenAI format.

You import the SDK into your application code. You do not operate a server.

## Install the SDK

```shell
uv add litellm
```

You can also use `pip install litellm`.

For a leaner default installation, use [LiteLLM Core](./litellm_core.md) in a fresh environment. It keeps the same `litellm` imports and makes AWS and Python Hugging Face tokenizer dependencies optional. Install one distribution per environment: `litellm` and `litellm-core` cannot coexist

## Make a request

Set the API key of your provider. Then call `completion()` with a model name in the format `provider/model`:

```python
from litellm import completion
import os

os.environ["ANTHROPIC_API_KEY"] = "your-api-key"

response = completion(
    model="anthropic/{{anthropic}}",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)
print(response.choices[0].message.content)
```

To use a different provider, change the model name and the API key. The code for the request and the response stays the same. For a full procedure, refer to the [Quickstart](/docs/learn/sdk_quickstart).

## What the SDK does

- **One interface.** Each provider uses the same `completion()` function and the same parameters.
- **One output format.** Each response has the OpenAI format, for all providers.
- **Exception mapping.** The SDK changes provider errors into the OpenAI exception types. Your code that catches OpenAI exceptions also catches the errors of each provider.
- **Routing.** The [Router](/docs/routing) gives you retries, fallbacks, and load balancing across deployments.
- **Callbacks.** Send logs and costs to Langfuse, MLflow, Helicone, and other tools with one line of code.

## SDK functions

Each function has an async version with the prefix `a`. For example, the async version of `completion()` is `acompletion()`.

| Function | Use it to | Reference |
|---|---|---|
| `completion()` | Send chat messages to a model | [completion()](/docs/completion/input) |
| `responses()` | Use the OpenAI Responses API format | [responses()](/docs/response_api) |
| `embedding()` | Get vector embeddings for text | [embedding()](/docs/embedding/supported_embedding) |
| `image_generation()` | Make images from a text prompt | [image_generation()](/docs/image_generation) |
| `transcription()` | Change speech audio into text | [transcription()](/docs/audio_transcription) |
| `speech()` | Change text into speech audio | [speech()](/docs/text_to_speech) |
| `rerank()` | Put documents in order of relevance to a query | [rerank()](/docs/rerank) |

For all the endpoints that LiteLLM supports, refer to [Supported Endpoints](/docs/supported_endpoints).

## Frequent tasks

| Task | Page |
|---|---|
| Set API keys, API base URLs, and API versions | [Set keys](/docs/set_keys) |
| Get responses as a stream | [Streaming](/docs/completion/stream) |
| Catch provider errors | [Exception mapping](/docs/exception_mapping) |
| Send logs to observability tools | [Callbacks](/docs/observability/callbacks) |
| Calculate token usage and cost | [Token usage](/docs/completion/token_usage) |
| Add retries, fallbacks, and load balancing | [Router](/docs/routing) |
| Cache responses | [Caching](/docs/caching/all_caches) |
| Run coding agents from Python | [Agent harnesses](/docs/harness) |

## SDK or AI Gateway

Use the SDK if you send requests to LLMs from one Python application. Use the [AI Gateway](/docs/simple_proxy) if more than one application sends requests, or if virtual keys, spend tracking, or logs in one location are necessary.

The SDK can also send requests to an AI Gateway. Add the prefix `litellm_proxy/` to the model name. Refer to [LiteLLM Proxy as a provider](/docs/providers/litellm_proxy).

## Next steps

<NavigationCards
columns={3}
items={[
{
title: "Quickstart",
description: "Install the SDK and make your first request.",
to: "/docs/learn/sdk_quickstart",
},
{
title: "Providers",
description: "Find the model names, credentials, and parameters for each provider.",
to: "/docs/providers",
},
{
title: "Router",
description: "Add retries, fallbacks, and load balancing in your application code.",
to: "/docs/routing",
},
]}
/>
