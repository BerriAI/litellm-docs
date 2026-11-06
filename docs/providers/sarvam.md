# Sarvam.ai

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

LiteLLM supports Sarvam's OpenAI-compatible `/v2` API, including Sarvam 105B and the open-weight models served on Sarvam infrastructure (GLM, Gemma, and DeepSeek).

## Supported models

| Model | Context | Max output | Input | USD per 1M in / out |
| --- | --- | --- | --- | --- |
| `sarvam/sarvam-105b` | 128K | 128K | Text | $0.17 / $0.67 |
| `sarvam/sarvam-105b-conversations` | 32K | 32K | Text | $0.17 / $0.67 |
| `sarvam/glm5.3` | 1M | 1M | Text | $1.40 / $4.33 |
| `sarvam/glm5.3-flash` | 1M | 1M | Text, image | $0.15 / $0.50 |
| `sarvam/gemma4` | 256K | 256K | Text, image | $0.39 / $1.00 |
| `sarvam/deepseekv4.1-flash-1017` | 1M | 1M | Text, image | $0.28 / $1.17 |

Output on `sarvam-105b` and `sarvam-105b-conversations` is also capped by plan: Starter 4,096, Pro 16,384, Business 128,000 (and by the 32K context on `sarvam-105b-conversations`).

All models support tool calling, streaming, structured output (`response_format`), system messages, `tool_choice`, and parallel tool calls. Prompt caching is supported on `sarvam-105b`, `sarvam-105b-conversations`, `gemma4`, and `deepseekv4.1-flash-1017`.

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
)
print(response)
```

## Usage with LiteLLM Proxy Server

Here's how to call a Sarvam.ai model with the LiteLLM Proxy Server.

1. **Modify the `config.yaml`:**

    ```yaml
    model_list:
      - model_name: sarvam-105b
        litellm_params:
          model: sarvam/sarvam-105b  # add sarvam/ prefix to route as Sarvam provider
          api_key: os.environ/SARVAM_API_KEY
    ```

2. **Start the proxy:**

    ```bash
    litellm --config /path/to/config.yaml
    ```

3. **Send a request to LiteLLM Proxy Server:**

    <Tabs>

    <TabItem value="openai" label="OpenAI Python v1.0.0+">

    ```python
    import openai

    client = openai.OpenAI(
        api_key="sk-<your-litellm-api-key>",             # pass litellm proxy key, if you're using virtual keys
        base_url="http://0.0.0.0:4000" # litellm-proxy-base url
    )

    response = client.chat.completions.create(
        model="sarvam-105b",
        messages=[
            {
                "role": "user",
                "content": "what llm are you"
            }
        ],
    )

    print(response)
    ```
    </TabItem>

    <TabItem value="curl" label="curl">

    ```shell
    curl --location 'http://0.0.0.0:4000/chat/completions' \
        --header "Authorization: Bearer $LITELLM_API_KEY" \
        --header 'Content-Type: application/json' \
        --data '{
        "model": "sarvam-105b",
        "messages": [
            {
            "role": "user",
            "content": "what llm are you"
            }
        ]
    }'
    ```
    </TabItem>

    </Tabs>

## Reasoning

Most models return reasoning in `reasoning_content`. Reasoning tokens count toward `max_tokens` and are billed as output. `sarvam-105b-conversations` does not return reasoning.

## Token limits

- On Chat, `max_tokens` defaults to `2048` on `glm5.3` only. Other models have no small default; set it explicitly.
- On the Responses API, `max_output_tokens` has no default cap. Always set it in production.
- Reasoning tokens count toward the output budget and are billed as output.

## Limitations

- Images must be sent as base64 data URIs; remote `http(s)` URLs are rejected.
- Beta models require beta access and are not listed above.
- The API is OpenAI-compatible; no custom transformation is required.

## Security

Use LiteLLM `>=1.106.6` and keep the proxy off the public internet. See the [LiteLLM security advisories](https://github.com/BerriAI/litellm/security/advisories) for the latest guidance. {/* keep-version-note */}
