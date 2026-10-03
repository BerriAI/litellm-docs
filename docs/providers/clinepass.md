# ClinePass

Use ClinePass (the Cline API) with LiteLLM by routing requests through the `clinepass/` prefix, for example `clinepass/deepseek-v4-flash`. LiteLLM speaks the OpenAI chat completions schema on your side and handles the two places where the Cline API diverges from it (a response envelope and a required model qualifier), so ClinePass models behave like any other OpenAI-compatible provider in LiteLLM.

ClinePass documentation: https://docs.cline.bot/

## Authentication

Get an API key from the Cline dashboard and export it:

```python
import os

os.environ["CLINEPASS_API_KEY"] = "your-clinepass-api-key"
```

## Environment Variables

| Variable | Description | Required |
| --- | --- | --- |
| `CLINEPASS_API_KEY` | API key sent as the bearer token on every request | Yes |
| `CLINEPASS_API_BASE` | API base URL. Defaults to `https://api.cline.bot/api/v1` | No |

## Usage

```python
import os
from litellm import completion

os.environ["CLINEPASS_API_KEY"] = "your-clinepass-api-key"

response = completion(
    model="clinepass/deepseek-v4-flash",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)

print(response.choices[0].message.content)
```

### Alternative Usage - Explicit API Key

```python
from litellm import completion

response = completion(
    model="clinepass/deepseek-v4-flash",
    api_key="your-clinepass-api-key",
    api_base="https://api.cline.bot/api/v1",  # optional, this is the default
    messages=[{"content": "Hello, how are you?", "role": "user"}],
)
```

## Usage - Streaming

```python
from litellm import completion

response = completion(
    model="clinepass/deepseek-v4-flash",
    messages=[{"content": "Hello, how are you?", "role": "user"}],
    stream=True,
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")
```

## Usage - Async Streaming

```python
import asyncio
from litellm import acompletion


async def completion_call():
    response = await acompletion(
        model="clinepass/deepseek-v4-flash",
        messages=[{"content": "Hello, how are you?", "role": "user"}],
        stream=True,
    )
    async for chunk in response:
        print(chunk.choices[0].delta.content or "", end="")


asyncio.run(completion_call())
```

## Usage - LiteLLM Proxy

```yaml
model_list:
  - model_name: clinedeepseek
    litellm_params:
      model: clinepass/deepseek-v4-flash
      api_key: os.environ/CLINEPASS_API_KEY
      # api_base: os.environ/CLINEPASS_API_BASE  # optional, defaults to https://api.cline.bot/api/v1
```

Run the proxy with `litellm --config config.yaml`, then call the model by its `model_name` on `/v1/chat/completions`. The proxy also accepts Anthropic-format `/v1/messages` and OpenAI `/v1/responses` calls for this model, translating both to a ClinePass chat completion.

## Model Names: `clinepass/` vs `cline-pass/`

These two prefixes are easy to confuse because they differ by a single hyphen, and they play completely different roles:

`clinepass/` is LiteLLM's routing prefix. It is what you write in your code, and LiteLLM strips it before the request is built. It never reaches ClinePass.

`cline-pass/` is the model namespace ClinePass expects on the wire. The API rejects a bare model id with HTTP 400 (`invalid model format. Expected format: modelType/model`), so after stripping its own prefix LiteLLM restores this qualifier on any id that no longer has one:

| You call LiteLLM with | LiteLLM sends to ClinePass |
| --- | --- |
| `clinepass/deepseek-v4-flash` | `cline-pass/deepseek-v4-flash` |
| `clinepass/openrouter/llama-4-scout` | `openrouter/llama-4-scout` (already qualified, passed through) |

Always call the bare model under `clinepass/` and let LiteLLM add `cline-pass/`. Do not hand-write the namespace in the model string: ClinePass only validates the *shape* of a model id, so a wrong namespace is accepted with HTTP 200 but can silently resolve to a different underlying model (for example a date-pinned snapshot rather than the current one).

## Supported Endpoints

| Endpoint | Supported |
| --- | --- |
| `/chat/completions` (including streaming) | Yes |
| `/messages` (Anthropic Messages format) | Yes, translated by LiteLLM |
| `/responses` | Yes, translated by LiteLLM |
| `/embeddings` | No |
| `/image/generations` | No |
| `/audio/transcriptions` and `/audio/speech` | No |
| `/moderations` | No |
| `/batches` | No |
| `/rerank` | No |

Speech and audio, embeddings, and image generation are not supported. Pass those calls to a provider that implements them.

## Notes

Non-streaming ClinePass responses arrive wrapped in a `data` envelope (`{"data": {"choices": [...]}, "success": true}`). LiteLLM unwraps this before parsing, so `response.choices` works as with any other provider. Streaming chunks are not wrapped and need no handling.

ClinePass accepts the legacy `max_tokens` spelling only. You can pass `max_completion_tokens` to LiteLLM and it is mapped to `max_tokens` on the wire.

When a completion is cut off by `max_tokens`, LiteLLM reports `finish_reason: "length"` even if ClinePass labels the truncation `"stop"`, provided the returned usage shows the cap was reached and there is a single choice.

ClinePass exposes no model catalog endpoint (`GET /models` returns HTTP 404), so `litellm.get_models()` returns an empty list for the provider. Check the Cline documentation for available model ids.

An invalid API key surfaces as a LiteLLM `AuthenticationError` (HTTP 401), not a generic connection error.
