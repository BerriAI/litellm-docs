---
title: "Sarvam AI API with LiteLLM: Python SDK and Gateway"
sidebar_label: "Sarvam.ai"
description: "Send chat requests to Sarvam 105B and the GLM, Gemma, and DeepSeek models Sarvam serves with the sarvam/ prefix, then serve them to OpenAI clients and curl through the AI Gateway."
---

# Sarvam.ai

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

LiteLLM supports Sarvam's OpenAI-compatible chat API, including Sarvam 105B and the open-weight models served on Sarvam infrastructure (GLM, Gemma, and DeepSeek).

## Supported models

<SinceVersion v="1.112.0" />

| Model | Context | Max output | Input | USD per 1M in / out |
| --- | --- | --- | --- | --- |
| `sarvam/sarvam-105b` | 128K | 128K | Text | $0.11 / $0.27 |
| `sarvam/sarvam-105b-conversations` | 32K | 8K | Text | $0.11 / $0.27 |
| `sarvam/glm5.3` | 1M | 1M | Text | $1.34 / $4.15 |
| `sarvam/glm5.3-flash` | 1M | 1M | Text, image | $0.14 / $0.48 |
| `sarvam/gemma4` | 256K | 256K | Text, image | $0.37 / $0.96 |
| `sarvam/deepseekv4.1-flash-1017` | 1M | 1M | Text, image | $0.15 / $0.59 |
| `sarvam/deepseekv4.1-flash-1017-interactive` | 1M | 1M | Text, image | $0.27 / $1.12 |

Except on `sarvam-105b-conversations`, Max output is the whole context window, which the prompt and `max_tokens` share. Sarvam rejects a request whose prompt tokens plus `max_tokens` exceed the context.

USD values are converted from Sarvam's INR rates at ₹94 per USD. `sarvam-105b`, `sarvam-105b-conversations`, and `deepseekv4.1-flash-1017` show Sarvam's introductory rates, which apply [through the end of 2026](https://docs.sarvam.ai/api/getting-started/pricing). See [Sarvam Token Factory pricing](https://www.sarvam.ai/token-factory/pricing) for the current INR rates.

LiteLLM sends `sarvam-105b` and `sarvam-105b-conversations` to `https://api.sarvam.ai/v1`, the API they used before, and every other model to `https://api.sarvam.ai/v2`. Sarvam's `/v1` API serves only those two models, so remove any `api_base` that points at `https://api.sarvam.ai/v1` from the other models. Before v1.112.0, LiteLLM sends every `sarvam/` model to `/v1`, so only `sarvam-105b` and `sarvam-105b-conversations` work on older versions.

Sarvam retired the legacy `sarvam-m` model on both `/v1` and `/v2`. If you are upgrading from `sarvam/sarvam-m`, switch to `sarvam/sarvam-105b`.

On `/v1`, `sarvam-105b-conversations` returns at most 8,192 output tokens, and Sarvam rejects a larger `max_tokens` with a 400 error.

All models support tool calling, streaming, structured output (`response_format`), system messages, `tool_choice`, and parallel tool calls. Prompt caching is supported on all seven models: `sarvam-105b`, `sarvam-105b-conversations`, `glm5.3`, `glm5.3-flash`, `gemma4`, `deepseekv4.1-flash-1017`, and `deepseekv4.1-flash-1017-interactive`.

## Usage

```python
import os
from litellm import completion

# Set your Sarvam API key
os.environ["SARVAM_API_KEY"] = "your-api-key"

messages = [{"role": "user", "content": "Hello"}]

response = completion(
    model="sarvam/sarvam-105b",
    messages=messages,
    max_tokens=1024,
)
print(response)
```

## Responses API

```python
import os
from litellm import responses

os.environ["SARVAM_API_KEY"] = "your-api-key"

response = responses(
    model="sarvam/sarvam-105b",
    input="Hello",
    max_output_tokens=1024,
)
print(response.output_text)
```

LiteLLM sends Responses API calls to Sarvam's chat completions endpoint, because Sarvam does not store conversations. To continue a conversation with `previous_response_id` on the proxy, see [Session Management](../response_api.md#session-management).

## Usage with LiteLLM Proxy Server

Here's how to call a Sarvam.ai model with the LiteLLM Proxy Server.

1. **Modify the `config.yaml`:**

    ```yaml
    model_list:
      - model_name: sarvam-105b
        litellm_params:
          model: sarvam/sarvam-105b  # add sarvam/ prefix to route as Sarvam provider
          api_key: os.environ/SARVAM_API_KEY

    general_settings:
      master_key: os.environ/LITELLM_MASTER_KEY
    ```

2. **Start the proxy:**

    ```bash
    export SARVAM_API_KEY="your-api-key"
    export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
    echo "$LITELLM_MASTER_KEY"
    litellm --config /path/to/config.yaml
    ```

3. **Send a request to LiteLLM Proxy Server:**

    The proxy keeps running in the first terminal. In a new terminal, set the key that step 2 printed:

    ```bash
    export LITELLM_MASTER_KEY="paste-the-key-from-step-2"
    ```

    <Tabs>

    <TabItem value="openai" label="OpenAI Python v1.0.0+">

    ```python
    import os

    import openai

    client = openai.OpenAI(
        api_key=os.environ["LITELLM_MASTER_KEY"],  # or a virtual key
        base_url="http://0.0.0.0:4000"    # litellm-proxy-base url
    )

    response = client.chat.completions.create(
        model="sarvam-105b",
        messages=[
            {
                "role": "user",
                "content": "what llm are you"
            }
        ],
        max_tokens=1024,
    )

    print(response)
    ```
    </TabItem>

    <TabItem value="curl" label="curl">

    ```shell
    curl --location 'http://0.0.0.0:4000/chat/completions' \
        --header "Authorization: Bearer $LITELLM_MASTER_KEY" \
        --header 'Content-Type: application/json' \
        --data '{
        "model": "sarvam-105b",
        "messages": [
            {
            "role": "user",
            "content": "what llm are you"
            }
        ],
        "max_tokens": 1024
    }'
    ```
    </TabItem>

    </Tabs>

## Reasoning

Most models return reasoning in `reasoning_content`. Reasoning tokens count toward `max_tokens` and are billed as output. `sarvam-105b-conversations` does not return reasoning, so LiteLLM rejects `reasoning_effort` on it unless you set `drop_params`. On `gemma4`, reasoning is off by default and only runs when `reasoning_effort` is set. Some models accept only some levels. Since v1.112.0, LiteLLM rounds any other level up to the next level the model accepts, or down to its strongest level. `sarvam-105b` accepts `low`, `medium`, or `high`, so `minimal` is sent as `low` and `xhigh` or `max` as `high`. `glm5.3` and `glm5.3-flash` accept `low`, `high`, or `max`, so `medium` is sent as `high`. LiteLLM never changes `reasoning_effort="none"`. On `sarvam-105b`, `glm5.3`, and `glm5.3-flash`, Sarvam rejects it with a 400 error, and LiteLLM drops it instead when you set `drop_params`, so reasoning stays on. To turn reasoning off on `sarvam-105b`, point it at `https://api.sarvam.ai/v2` with `api_base` and leave `drop_params` off. Some calls there stall, so follow the timeout advice under Limitations. This call asks `gemma4` to reason:

```python
response = completion(
    model="sarvam/gemma4",
    messages=[{"role": "user", "content": "Is 221 a prime number?"}],
    reasoning_effort="low",
    max_tokens=2048,
)
print(response.choices[0].message.reasoning_content)
```

## Token limits

- When `max_tokens` is not set, `glm5.3` stops at 2048 output tokens, and its reasoning can use all of them, which leaves `content` empty. `gemma4` and `deepseekv4.1-flash-1017` returned longer answers in our tests. Set `max_tokens` explicitly on every model.
- The Responses API follows the same defaults, since LiteLLM sends those calls to Sarvam's chat completions endpoint. Set `max_output_tokens` explicitly.
- Reasoning tokens count toward the output budget and are billed as output.

## Limitations

- Images must be sent as base64 data URIs; remote `http(s)` URLs are rejected.
- Beta models require beta access and are not listed above.
- Some `/v2` requests to `sarvam-105b` stall without an answer, so LiteLLM keeps `sarvam-105b` and `sarvam-105b-conversations` on `/v1`. If you point either model at `/v2` with `api_base`, also set `timeout` a little above your longest expected response together with `num_retries`, so LiteLLM retries a stalled call instead of waiting for its default timeout, which is 600 seconds on the SDK and 6000 seconds on the proxy. Each stalled attempt still waits the full `timeout` before the retry starts:

    ```yaml
    model_list:
      - model_name: sarvam-105b
        litellm_params:
          model: sarvam/sarvam-105b
          api_key: os.environ/SARVAM_API_KEY
          api_base: https://api.sarvam.ai/v2
          timeout: 120
          num_retries: 2
    ```
