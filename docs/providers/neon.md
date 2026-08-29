import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Neon AI Gateway

[Neon AI Gateway](https://neon.com/docs/ai-gateway/overview) is an OpenAI-compatible inference endpoint built into Neon. One Neon credential gives you access to models from OpenAI, Google, Meta, Databricks, and Alibaba without separate provider accounts.

:::info

LiteLLM has no dedicated `neon/` provider. Neon serves an OpenAI-compatible `/v1` API, so call it with the `openai/` prefix and point `api_base` at your branch gateway host. See [OpenAI-Compatible Endpoints](/docs/providers/openai_compatible) for the general pattern.

:::

:::note

Neon AI Gateway is in beta. It requires a paid Neon plan and a project in the AWS US East (Ohio) region (`aws-us-east-2`).

:::

## Prerequisites

Every Neon branch gets its own gateway host, so there is no single upstream URL that works for all accounts. You need two values:

| Variable | Value |
|---|---|
| `NEON_AI_GATEWAY_TOKEN` | Neon credential with the `ai_gateway:invoke` scope (`nt_live_...`) |
| `NEON_AI_GATEWAY_BASE_URL` | Bare branch host, for example `https://br-winter-pond-aptw82ef-api.ai.c-2.us-east-2.aws.neon.tech` |

Create the credential in the Neon Console under **Credentials**, or with the Neon API. `neon env pull --file .env` writes both variables for the current branch. Refer to [AI Gateway authentication](https://neon.com/docs/ai-gateway/authentication) for scopes and branch binding.

A credential is valid on the branch it was created on and on any branch descended from it, so one credential created on `main` covers preview and CI branches forked from it.

## Usage - completion

Append `/v1` to the branch host. LiteLLM uses the OpenAI client, which adds `/chat/completions` itself.

```python
import os
from litellm import completion

response = completion(
    model="openai/gpt-5-mini",
    api_key=os.environ["NEON_AI_GATEWAY_TOKEN"],
    api_base=f"{os.environ['NEON_AI_GATEWAY_BASE_URL']}/v1",
    messages=[{"role": "user", "content": "Explain serverless Postgres."}],
)

print(response.choices[0].message.content)
```

## Usage - streaming

```python
import os
from litellm import completion

response = completion(
    model="openai/gpt-5-mini",
    api_key=os.environ["NEON_AI_GATEWAY_TOKEN"],
    api_base=f"{os.environ['NEON_AI_GATEWAY_BASE_URL']}/v1",
    messages=[{"role": "user", "content": "Write a short poem about branching."}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## Usage with LiteLLM Proxy Server

1. Add the branch host to `config.yaml`. Create one entry per branch you want to route to.

  ```yaml
  model_list:
    - model_name: neon-gpt-5-mini
      litellm_params:
        model: openai/gpt-5-mini
        api_base: os.environ/NEON_AI_GATEWAY_BASE_URL_V1
        api_key: os.environ/NEON_AI_GATEWAY_TOKEN
    - model_name: neon-gemini-3-flash
      litellm_params:
        model: openai/gemini-3-flash
        api_base: os.environ/NEON_AI_GATEWAY_BASE_URL_V1
        api_key: os.environ/NEON_AI_GATEWAY_TOKEN
  ```

  `NEON_AI_GATEWAY_BASE_URL_V1` must include the `/v1` suffix, for example `https://br-winter-pond-aptw82ef-api.ai.c-2.us-east-2.aws.neon.tech/v1`.

2. Start the proxy.

  ```bash
  $ litellm --config /path/to/config.yaml
  ```

3. Send a request.

  <Tabs>

  <TabItem value="openai" label="OpenAI Python v1.0.0+">

  ```python
  import openai

  client = openai.OpenAI(
      api_key="sk-1234",
      base_url="http://0.0.0.0:4000",
  )

  response = client.chat.completions.create(
      model="neon-gpt-5-mini",
      messages=[{"role": "user", "content": "what llm are you"}],
  )

  print(response)
  ```
  </TabItem>

  <TabItem value="curl" label="curl">

  ```shell
  curl --location 'http://0.0.0.0:4000/chat/completions' \
      --header 'Authorization: Bearer sk-1234' \
      --header 'Content-Type: application/json' \
      --data '{
      "model": "neon-gpt-5-mini",
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

## Supported models

Neon uses short model IDs such as `gpt-5-mini`, `gemini-3-flash`, `llama-4-maverick`, and `qwen3-next-80b-a3b-instruct`. The catalog your branch can reach is returned by `GET /v1/models`:

```bash
curl "$NEON_AI_GATEWAY_BASE_URL/v1/models" \
  -H "Authorization: Bearer $NEON_AI_GATEWAY_TOKEN"
```

The [Neon model catalog](https://neon.com/docs/ai-gateway/models) lists context windows, pricing, and which endpoint each model supports. The same catalog is published as the [`neon` provider on Models.dev](https://models.dev/providers/neon/), which is useful for looking up model IDs and capabilities outside the Neon Console.

## Limitations

The `/v1` base URL covers chat completions and `GET /v1/models`. Neon documents no embeddings endpoint, and image generation runs through its Responses API at `/openai/v1`, so `litellm.embedding()` and `litellm.image_generation()` do not work against this base URL. Codex variants such as `gpt-5-3-codex` also require the Responses API, so sending one to chat completions returns `400 Bad Request`.

For a few models, including `gemini-3-5-flash`, `gemini-3-1-pro`, `gpt-oss-120b`, and `qwen35-122b-a10b`, `message.content` comes back as an array of content blocks instead of a string. Handle both shapes if you swap models.

Cost tracking uses LiteLLM's model map, and these are Neon-specific short model IDs routed through the `openai/` provider. Set [custom pricing](/docs/proxy/custom_pricing) if you need spend numbers for them.
