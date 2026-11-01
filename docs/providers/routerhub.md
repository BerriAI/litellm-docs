---
title: RouterHub
description: Connect RouterHub GLM models through LiteLLM with a private API key, Chat Completions, proxy configuration and live pricing references.
---

# RouterHub

{/* keep-version-note */}

[RouterHub](https://routerhub.si) is a prepaid API gateway. Its GLM abliterated entries use OpenAI-compatible Chat Completions at `https://routerhub.si/v1`. Create a private key in the [RouterHub dashboard](https://routerhub.si/dashboard/keys) and store it in `ROUTERHUB_API_KEY` on the process that sends requests.

:::caution Draft integration
The proposed `routerhub/` provider prefix is not available in released LiteLLM versions until the corresponding provider change is merged and released. The generic `openai/` configuration below uses the existing OpenAI-compatible adapter. Ordinary and streamed requests with the named provider were verified against real RouterHub inference on the integration branch on November 1, 2026. This does not make the prefix available in a released package.
:::

## SDK setup

Install `litellm`, set the environment variable privately, and use an exact Chat Completions model ID from [Models and pricing](https://routerhub.si/models). Requests consume prepaid RouterHub credits.

```python
import os

from litellm import completion

response = completion(
    model="openai/glm-5.3-abliterated",
    api_base="https://routerhub.si/v1",
    api_key=os.environ["ROUTERHUB_API_KEY"],
    messages=[{"role": "user", "content": "Reply with hello."}],
    max_tokens=64,
)
print(response.choices[0].message.content)
```

`openai/` selects LiteLLM's compatible adapter. It does not send the request to OpenAI when `api_base` points to RouterHub. See [OpenAI-compatible endpoints](openai_compatible.md) for the adapter contract.

## Proposed named provider

On a checkout containing the pending RouterHub provider integration, the provider reads `ROUTERHUB_API_KEY` and sets its default API base automatically.

```python
from litellm import completion

response = completion(
    model="routerhub/glm-5.3-abliterated",
    messages=[{"role": "user", "content": "Reply with hello."}],
    max_tokens=64,
)
print(response.choices[0].message.content)
```

The initial catalogue proposal contains `routerhub/glm-5.3-abliterated` and `routerhub/glm-5.3-flash-abliterated`. RouterHub currently labels both entries as preview. Both entries passed ordinary and streamed SDK checks with returned usage and matching token-cost calculations. This does not verify every agent feature or an account-level debit.

## Streaming

On the integration branch, request usage in the final streamed chunk.

```python
from litellm import completion

stream = completion(
    model="routerhub/glm-5.3-abliterated",
    messages=[{"role": "user", "content": "Reply with hello."}],
    max_tokens=64,
    stream=True,
    stream_options={"include_usage": True},
)
for chunk in stream:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
    if getattr(chunk, "usage", None):
        print(chunk.usage)
```

## Proxy setup

Install `litellm[proxy]`. Set `ROUTERHUB_API_KEY` and a strong `LITELLM_MASTER_KEY` on the proxy process. The RouterHub key authenticates upstream requests. The master key authenticates clients to the local proxy.

Merge this deployment into an existing configuration or save it as `config.yaml` for a new proxy.

```yaml
model_list:
  - model_name: routerhub-glm
    litellm_params:
      model: openai/glm-5.3-abliterated
      api_base: https://routerhub.si/v1
      api_key: os.environ/ROUTERHUB_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

```bash
litellm --config config.yaml --host 127.0.0.1 --port 4000
```

From a second terminal with `LITELLM_MASTER_KEY` set, a Chat Completions request takes this form.

```bash
curl http://127.0.0.1:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"routerhub-glm","messages":[{"role":"user","content":"Reply with hello."}],"max_tokens":64}'
```

After the named provider is available, use `routerhub/glm-5.3-abliterated` in `litellm_params.model` and omit `api_base`. Keep the upstream and proxy keys separate.

The named-provider branch passed ordinary and streamed requests through a real loopback proxy for both proposed GLM entries. Returned token usage and proxy cost calculations matched the published rates. This check did not verify account-level charges, Redis coordination or multiple active workers.

## Pricing and limits

Use the [live models page](https://routerhub.si/models) or [public JSON catalogue](https://routerhub.si/models.json) for current IDs, protocols, rates and published limits. RouterHub publishes USD per million tokens. LiteLLM's pricing map stores USD per token. A combined context budget does not mean the entire budget is available independently for input and output.

When the provider reports cached input usage, LiteLLM can use the published cached-input rate. A lower published rate does not establish that a particular request will hit a cache. The generic `openai/` fallback does not automatically select the proposed `routerhub/` pricing entries, so configure custom pricing if needed before the named provider is released.

## Scope and troubleshooting

This proposal covers Chat Completions only. It does not advertise native Responses, Messages, tool calls, structured output or reasoning controls for these entries. Streaming was checked on the integration branch for the two listed IDs. Verify any additional feature against the exact model and installed LiteLLM version before relying on it. A catalogue listing alone is not evidence of successful inference.

For `401`, check that the proxy or SDK process has the RouterHub key. For `402`, check prepaid credits. For `404`, check the exact ID and supported protocol. For `429`, follow the service's retry guidance. Do not change your application to another protocol based only on a shared model family name.
