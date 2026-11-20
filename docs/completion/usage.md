# Usage 

LiteLLM returns the OpenAI compatible usage object across all providers.

```bash
"usage": {
    "prompt_tokens": int,
    "completion_tokens": int,
    "total_tokens": int
  }
```

## Quick Start 

```python
from litellm import completion
import os

## set ENV variables
os.environ["OPENAI_API_KEY"] = "your-api-key"

response = completion(
  model="{{openai_small}}",
  messages=[{ "content": "Hello, how are you?","role": "user"}]
)

print(response.usage)
```
> **Note:** LiteLLM supports endpoint bridging. If a model does not natively support a requested endpoint, LiteLLM will automatically route the call to the correct supported endpoint (such as bridging `/chat/completions` to `/responses` or vice versa) based on the model's `mode`set in `model_prices_and_context_window`.

## Streaming Usage

if `stream_options={"include_usage": True}` is set, an additional chunk will be streamed before the data: [DONE] message. The usage field on this chunk shows the token usage statistics for the entire request, and the choices field will always be an empty array. All other chunks will also include a usage field, but with a null value.


```python
from litellm import completion 

completion = completion(
  model="{{openai_large}}",
  messages=[
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  stream=True,
  stream_options={"include_usage": True}
)

for chunk in completion:
  if chunk.choices:
    print(chunk.choices[0].delta)
  else:
    print(chunk.usage)

```

### Proxy: Always Include Streaming Usage

When using the LiteLLM Proxy, you can configure it to automatically include usage information in all streaming responses, even if the client doesn't send `stream_options={"include_usage": True}`.

#### Configuration

Add the following to your config.yaml:

```yaml
general_settings:
  always_include_stream_usage: true
```

Alternatively, configure it through the UI:

1. Navigate to the LiteLLM Proxy UI
2. Go to `Settings` >  `Router Settings` > `General`
3. Find the `always_include_stream_usage` setting
4. Toggle it to `true`
5. Click `Update` to save

#### How it works

When `always_include_stream_usage` is enabled:
- All streaming requests will automatically have `stream_options={"include_usage": True}` added
- Clients will receive usage information in the final chunk, even if they didn't explicitly request it
- If a client already provides `stream_options`, `include_usage: True` will be added without overwriting other options
- Non-streaming requests are not affected

#### Example

With this setting enabled, a simple streaming request like:

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": true
  }'
```

Will automatically receive usage information in the response, without needing to explicitly include `stream_options`.

### Proxy: Include Cost in Streaming Usage

Chat completions and Responses API streams carry computed `usage.cost` by default, as do Anthropic Messages streams in their final `message_delta` usage. No switch is needed for these SDK or proxy responses. See [response cost](./token_usage.md#response-cost) for the event locations and examples.

The switches below remain available for extra proxy-side cost injection, including supported Anthropic and OpenAI pass-through streaming routes. The injected value is the same bill LiteLLM writes to `LiteLLM_SpendLogs`.

#### Configuration

The global switch applies to every stream the proxy serves:

```yaml
litellm_settings:
  include_cost_in_streaming_usage: true
```

The per-request switch is the `x-litellm-include-cost-in-streaming-usage: true` header. It enables extra proxy-side injection only for the request that carries it. It is not required to receive the default `usage.cost` described above. Only the value `true` counts. <SinceVersion v="1.110.0" />

#### Example

```bash
curl -N http://localhost:4000/v1/messages \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "x-litellm-include-cost-in-streaming-usage: true" \
  -H "content-type: application/json" \
  -d '{"model": "claude-haiku-4-5", "max_tokens": 16, "stream": true, "messages": [{"role": "user", "content": "hi"}]}'
```

```text
event: message_delta
data: {"type": "message_delta", "delta": {"stop_reason": "max_tokens", ...}, "usage": {"input_tokens": 8, "output_tokens": 16, "cost": 8.8e-05}}
```

Any key that can call the proxy can send the header, and there is no key or team setting that refuses it. Leave the global switch off when only some requests need extra proxy-side injection.
