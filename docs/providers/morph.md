# Morph

Use [Morph](https://www.morphllm.com/) through LiteLLM for open-weight chat models and Fast Apply code edits. Set `MORPH_API_KEY` and prefix the model ID with `morph/`. LiteLLM uses `https://api.morphllm.com/v1` by default.

## Quickstart

Create a key in the [Morph dashboard](https://www.morphllm.com/dashboard/api-keys), then set it in your environment.

```bash
pip install -U 'litellm[proxy]'
export MORPH_API_KEY="<your-morph-api-key>"
```

```python
from litellm import completion

response = completion(
    model="morph/morph-dsv41flash",
    messages=[{"role": "user", "content": "Write a Python function that adds two numbers."}],
)
print(response.choices[0].message.content)
```

## Open-weight models

Morph documents a 1M-token context window for these models. Use the exact LiteLLM model string in SDK calls or proxy configuration.

| Model | LiteLLM model string |
| --- | --- |
| Kimi K3 | `morph/morph-kimik3` |
| Kimi K3 Fast | `morph/morph-kimik3-fast` |
| GLM-5.3 | `morph/morph-glm53-744b` |
| GLM-5.3-Flash | `morph/morph-glm53flash` |
| DeepSeek V4.1 Flash | `morph/morph-dsv41flash` |
| DeepSeek V4.1 Flash 1017 | `morph/morph-dsv41flash-1017` |
| DeepSeek V4.1 Flash Abliterated | `morph/morph-dsv41flash-abliterated` |
| DeepSeek V4 Flash 0731 | `morph/morph-dsv4flash` |

The abliterated model requires [approval from Morph](https://docs.morphllm.com/sdk/components/fast-models#deepseek-uncensored). Model access also depends on your account quota and available provider capacity.

Open-weight models accept tools, `response_format`, and `reasoning_effort`. DeepSeek V4.1 Flash enables reasoning by default. Use `reasoning_effort="none"` to disable it, or omit the parameter to use Morph's default.

## Use the AI Gateway

Add this deployment to `config.yaml`.

```yaml
model_list:
  - model_name: morph-deepseek
    litellm_params:
      model: morph/morph-dsv41flash
      api_key: os.environ/MORPH_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
```

Generate a gateway key, then start the gateway with both keys exported in the same environment. The Morph key authenticates the upstream request; the LiteLLM key authenticates your application to the gateway.

```bash
export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
litellm --config config.yaml --port 4000
```

Send a request to the local gateway. The response includes the model's answer in `choices[0].message.content` and token counts in `usage`.

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "morph-deepseek",
    "messages": [{"role": "user", "content": "Reply with exactly OK."}],
    "reasoning_effort": "none"
  }'
```

For a shared deployment, give applications [virtual keys](../proxy/virtual_keys.md) instead of the gateway's master key.

## Streaming and prefix caching

Morph caches matching prompt prefixes automatically. Keep the system prompt, tool definitions, and existing messages unchanged between turns. Send a unique `x-session-id` for each conversation to improve worker affinity.

```python
from uuid import uuid4
from litellm import completion

session_id = str(uuid4())

response = completion(
    model="morph/morph-dsv41flash",
    messages=[{"role": "user", "content": "Explain Python generators."}],
    extra_headers={"x-session-id": session_id},
    stream=True,
    stream_options={"include_usage": True},
)

for chunk in response:
    if chunk.choices:
        print(chunk.choices[0].delta.content or "", end="")
    if chunk.usage:
        print(chunk.usage)
```

Reuse `session_id` for later turns in that conversation. Do not share one value across unrelated conversations. `prompt_cache_key` is also supported, but Morph documents it as a region-placement hint, while `x-session-id` selects a worker.

`usage.prompt_tokens` includes both cached and uncached input. `usage.prompt_tokens_details.cached_tokens` counts reused tokens. LiteLLM calculates cost from the model's catalog rates:

```text
uncached input = prompt_tokens - cached_tokens
cost = uncached input * input rate
     + cached_tokens * cache-read rate
     + completion_tokens * output rate
```

Morph charges new prefixes at the normal input rate, with no cache-write surcharge. It does not report a separate cache-creation token count on the Chat Completions responses tested here. LiteLLM does not infer that every uncached token was stored. Reasoning tokens count toward billed output.

See Morph's [pricing page](https://www.morphllm.com/pricing) and [caching guide](https://docs.morphllm.com/sdk/components/caching). The catalog uses the direct pricing page and caching guide. Morph's [machine-readable catalog](https://www.morphllm.com/api/models/json) currently lists different rates for several models. Treat LiteLLM's calculated cost as an estimate until Morph reconciles those sources, and verify charges against your Morph account.

## Tools and structured output

Use the OpenAI tool format for `tools` and `tool_choice`. For a strict response shape, pass a JSON schema.

```python
from litellm import completion

response = completion(
    model="morph/morph-dsv41flash",
    messages=[{"role": "user", "content": "Return JSON with status equal to ok."}],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "status",
            "strict": True,
            "schema": {
                "type": "object",
                "properties": {"status": {"type": "string", "enum": ["ok"]}},
                "required": ["status"],
                "additionalProperties": False,
            },
        },
    },
)
print(response.choices[0].message.content)
```

## Fast Apply

`morph/morph-v3-fast` and `morph/morph-v3-large` apply edits to existing code. Give them an instruction, the original code, and the proposed update. They use a different prompt from the chat models and do not support the chat-only options above.

```python
from litellm import completion

response = completion(
    model="morph/morph-v3-fast",
    messages=[{
        "role": "user",
        "content": """<instruction>Change the greeting to Hello, world!</instruction>
<code>print("Hello")</code>
<update>print("Hello, world!")</update>""",
    }],
)
print(response.choices[0].message.content)
```

Use `stream=True` to stream the edit. See [Morph's Fast Apply guide](https://docs.morphllm.com/sdk/components/fast-apply) for prompt requirements.

## Endpoint and error handling

Override the API base with `api_base` or `MORPH_API_BASE`. Pass an explicit key with `api_key` when you do not use the environment variable.

A `401` indicates an authentication problem. A `402` with `Monthly quota exceeded` requires more Morph quota. A `429` can indicate a rate limit or unavailable model capacity; respect the provider's retry guidance.
