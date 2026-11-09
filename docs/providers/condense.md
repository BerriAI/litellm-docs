import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# condense.chat

{/* keep-version-note */}

[condense.chat](https://condense.chat) is a drop-in proxy that sits between your app or agent and the LLM provider. It manages the context sent on each call and trims context the agent no longer needs, then forwards the request to the provider.

LiteLLM needs no separate provider for this. You keep using the `anthropic/` and `openai/` providers, point `api_base` at condense, and add the `X-Condense-Auth-Token` header.

## Overview

| Property | Details |
|-------|-------|
| Description | Proxy that manages the context sent on each LLM call before forwarding it to the provider |
| Provider Route on LiteLLM | `anthropic/` and `openai/` with a condense `api_base` |
| Link to Provider Doc | [condense.chat Documentation ↗](https://condense.chat/docs/) |
| Anthropic `api_base` | `https://api.condense.chat/anthropic` |
| OpenAI `api_base` | `https://api.condense.chat/openai/v1` |

## How authentication works

Each request carries two keys. Your condense key goes in the `X-Condense-Auth-Token` header and starts with `ck_api_`. Your provider key is sent the way LiteLLM already sends it, `x-api-key` for Anthropic and `Authorization: Bearer` for OpenAI, and condense forwards it to the provider unchanged. condense does not store the provider key, only a sha256 fingerprint of it.

## Required Variables

```python showLineNumbers title="Environment Variables"
import os

os.environ["CONDENSE_AUTH_TOKEN"] = "ck_api_..."  # your condense key
os.environ["ANTHROPIC_API_KEY"] = "sk-ant-..."  # your Anthropic key, for Claude models
os.environ["OPENAI_API_KEY"] = "sk-..."  # your OpenAI key, for OpenAI models
```

API access is enabled for organization accounts after a short call, which you can book at https://cal.com/condense.chat/15min. See [sign-up](https://condense.chat/docs/api/#signup) for details.

## Usage - LiteLLM Python SDK

<Tabs>

<TabItem value="anthropic" label="Anthropic models">

Set `api_base` to `https://api.condense.chat/anthropic`, without `/v1`. LiteLLM adds `/v1/messages` to a custom Anthropic `api_base`, so the request goes to `https://api.condense.chat/anthropic/v1/messages`. A base that already ends in `/v1` would turn into `/anthropic/v1/v1/messages`.

```python showLineNumbers title="Claude through condense"
import os
from litellm import completion

response = completion(
    model="anthropic/{{anthropic}}",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
    api_base="https://api.condense.chat/anthropic",
    extra_headers={"X-Condense-Auth-Token": os.environ["CONDENSE_AUTH_TOKEN"]},
)
print(response)
```

</TabItem>

<TabItem value="openai" label="OpenAI models">

Set `api_base` to `https://api.condense.chat/openai/v1`.

```python showLineNumbers title="OpenAI through condense"
import os
from litellm import completion

response = completion(
    model="openai/{{openai_small}}",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
    api_base="https://api.condense.chat/openai/v1",
    extra_headers={"X-Condense-Auth-Token": os.environ["CONDENSE_AUTH_TOKEN"]},
)
print(response)
```

</TabItem>

</Tabs>

## Usage - LiteLLM Proxy

Set `api_base` and `extra_headers` under `litellm_params` on each deployment. Values written as `os.environ/NAME` inside `extra_headers` are read from the environment when the proxy loads the config.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: claude-condense
    litellm_params:
      model: anthropic/{{anthropic}}
      api_base: https://api.condense.chat/anthropic
      api_key: os.environ/ANTHROPIC_API_KEY
      extra_headers:
        X-Condense-Auth-Token: os.environ/CONDENSE_AUTH_TOKEN
  - model_name: openai-condense
    litellm_params:
      model: openai/{{openai_small}}
      api_base: https://api.condense.chat/openai/v1
      api_key: os.environ/OPENAI_API_KEY
      extra_headers:
        X-Condense-Auth-Token: os.environ/CONDENSE_AUTH_TOKEN
```

Start the proxy.

```bash showLineNumbers title="Start LiteLLM Proxy"
litellm --config config.yaml
```

Send a request.

```bash showLineNumbers title="condense via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -d '{
    "model": "claude-condense",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

## Group requests into a session

condense accepts an optional `X-Condense-Session-Id` header that groups requests into one session. The value can be a UUID or your own id of up to 128 characters. With the SDK, add it next to the auth header.

```python showLineNumbers title="Session header"
import os
from litellm import completion

response = completion(
    model="anthropic/{{anthropic}}",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
    api_base="https://api.condense.chat/anthropic",
    extra_headers={
        "X-Condense-Auth-Token": os.environ["CONDENSE_AUTH_TOKEN"],
        "X-Condense-Session-Id": "my-session-123",
    },
)
```

On the proxy, the session usually changes per request, so let clients send the header themselves. Turn on [header forwarding](/docs/proxy/forward_client_headers#enable-for-a-model-group) for the condense model groups, and the proxy passes `x-` headers from the client request on to condense.

```yaml showLineNumbers title="config.yaml"
litellm_settings:
  model_group_settings:
    forward_client_headers_to_llm_api:
      - claude-condense
      - openai-condense
```

```bash showLineNumbers title="Session header via Proxy - cURL"
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "X-Condense-Session-Id: my-session-123" \
  -d '{
    "model": "claude-condense",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

condense also reads `X-Condense-Tenant`, `X-Condense-End-User`, `X-Condense-Feature`, `X-Condense-Env` and `X-Condense-Tags`, which are sent the same way. The [API reference](https://condense.chat/docs/reference/) lists their formats and the response headers condense adds.

## Other endpoints

condense also has endpoints for Claude and Gemini on Vertex AI, for Amazon Bedrock, and a US endpoint at `https://api.us.condense.chat`. See the [condense quickstart](https://condense.chat/docs/quickstart/) for those.
