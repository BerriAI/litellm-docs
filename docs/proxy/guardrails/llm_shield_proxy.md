import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LLM Shield Proxy

The LLM Shield Proxy guardrail replaces personal data in each request with realistic stand-in values before it reaches the model, then puts the original values back into the reply. The stand-ins and the values behind them are held in a session vault inside your own [LLM Shield Proxy](https://github.com/ninadphalak/LLM-Shield-Proxy) deployment, so the provider never receives the originals while the caller still sees them.

Because the substitution is reversible, both halves belong on one guardrail entry: `pre_call` redacts the request and `post_call` restores the reply. With `pre_call` alone the request is redacted and the stand-ins are handed straight back to the caller. The Admin UI preset for LLM Shield Proxy sets both modes.

The guardrail fails closed. If your Shield deployment is unreachable, times out, or answers with an error status, the request is blocked rather than forwarded, since a redaction guardrail that failed open would send the very data it exists to protect to the provider.

It covers `/v1/chat/completions`, `/v1/completions`, `/v1/responses`, and `/v1/messages`, streaming and non-streaming.

## Quick Start

### 1. Run LLM Shield Proxy

```shell
docker run -d --name llm-shield -p 8000:8000 \
  -e VALID_VIRTUAL_KEYS=sk-shield-change-me \
  ghcr.io/ninadphalak/llm-shield-proxy:latest
```

`VALID_VIRTUAL_KEYS` is the key LiteLLM presents to the Shield. Restoring values returns plaintext, so the Shield refuses guardrail calls without one. The Shield is also on PyPI as `llm-shield-proxy`.

### 2. Add LLM Shield Proxy to your LiteLLM config.yaml

```yaml title="config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: llm-shield
    litellm_params:
      guardrail: llm_shield_proxy
      mode: [pre_call, post_call]
      default_on: true
      api_base: http://localhost:8000
      api_key: os.environ/LLM_SHIELD_PROXY_API_KEY
```

The same fields are available in the Admin UI under **Guardrails > Add Guardrail > LLM Shield Proxy**.

### 3. Start LiteLLM Proxy

```shell
export OPENAI_API_KEY=sk-...
export LLM_SHIELD_PROXY_API_KEY=sk-shield-change-me
litellm --config config.yaml
```

### 4. Make your first request

<Tabs>
<TabItem label="Redacted and restored" value="restored">

```shell
curl -sSLX POST 'http://0.0.0.0:4000/v1/chat/completions' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{
  "model": "{{openai_small}}",
  "messages": [
    {"role": "user", "content": "Repeat exactly: email jane.doe@example.com about card 4111 1111 1111 1111"}
  ]
}'
```

The provider receives stand-ins such as `john10@example.net` and `6567211639751374` in place of the address and card number. The reply you get back carries `jane.doe@example.com` and `4111 1111 1111 1111` again.

</TabItem>
<TabItem label="Streaming" value="streaming">

```shell
curl -sSLX POST 'http://0.0.0.0:4000/v1/chat/completions' \
--header 'Authorization: Bearer sk-1234' \
--header 'Content-Type: application/json' \
--data '{
  "model": "{{openai_small}}",
  "stream": true,
  "messages": [
    {"role": "user", "content": "Repeat exactly: email jane.doe@example.com"}
  ]
}'
```

Tokens are forwarded as they arrive rather than buffered to the end of the response. The Shield holds back only the trailing characters that could still be part of a stand-in, so a value split across two chunks is restored whole and never emitted in pieces.

</TabItem>
<TabItem label="Shield unreachable" value="blocked">

```json
{
  "error": {
    "message": "Guardrail raised an exception, Guardrail: llm-shield, Message: LLM Shield Proxy is unreachable; blocking the request.",
    "type": "invalid_request_error",
    "param": null,
    "code": "400"
  }
}
```

</TabItem>
</Tabs>

## What is redacted and what is restored

On the request side the guardrail collects message text and tool-call arguments in chat, Responses `input`, Completions `prompt` and `suffix`, and Anthropic messages, including nested tool results. Also walked: Anthropic document parts (their `title`, `context`, and the text of a `text` source), Responses function-call outputs (a string or `output_text` parts), custom tool-call `input`, code-interpreter `code`, typed prompt variables, and anything under `extra_body`, which LiteLLM merges over the transformed request just before sending it. An unredacted `messages` or `system` there would replace the redacted one on the wire. Each request gets a fresh vault id minted by LiteLLM and namespaced to the process; nothing the caller sends is used to name a vault, so a caller cannot reach another request's values by getting a stand-in echoed back.

Text the application wrote rather than the caller is redacted into a second vault that is never restored from: `system` and `developer` turns, `system` and `developer` items in Responses `input`, Anthropic's top-level `system`, Responses `instructions`, tool descriptions and parameter schemas, structured-output schemas, web-search user locations, and the `user` and `safety_identifier` fields. The exception is `enum` and `const` values in a schema, which go to the caller's vault so that a tool call or structured output that uses them comes back with the real value. A request nested deeper than the walk's bound is refused rather than forwarded partly unredacted.

On the reply side the guardrail restores message content, tool-call arguments, Completions `text`, Anthropic text and `tool_use` input, and Responses output items, both in full replies and in streams. Each stream (each choice's content, each tool call, each Anthropic content block, each Responses delta family) keeps its own window, so text held back for one never lands in another. Image and audio parts carry no text and pass through untouched.

## Using it with the LiteLLM SDK

Outside the proxy, attach the guardrail as a model-level callback and name it per call. The request is redacted in the deployment pre-call hook and the reply restored in the deployment post-call hook:

```python
import litellm
from litellm.proxy.guardrails.guardrail_hooks.llm_shield_proxy import LLMShieldProxyGuardrail

litellm.callbacks.append(
    LLMShieldProxyGuardrail(
        api_base="http://localhost:8000",
        api_key="sk-shield-change-me",
        event_hook=["pre_call", "post_call"],
    )
)

response = await litellm.acompletion(
    model="openai/gpt-4.1-mini",
    messages=[{"role": "user", "content": "Email jane.doe@example.com the invoice"}],
    guardrails=["llm_shield_proxy"],
)
```

The name passed to `guardrails` must match the guardrail's `guardrail_name` (`llm_shield_proxy` unless you set your own). Two limits on this path:

- **Streaming is refused.** Nothing restores an SDK stream, so a `stream=True` request here fails closed with `LLM Shield Proxy cannot restore a streamed reply for a model-level guardrail outside the LiteLLM proxy`. Send streamed requests through the proxy, which restores them incrementally.
- **The response cache is bypassed.** A cache hit returns before any post-call hook runs, and a reply stored after restoration would hand one caller's values to the next caller whose redacted request matches, so model-level guardrail requests are neither read from nor written to the cache.

## Caching and telemetry through the proxy

Through the proxy, LiteLLM caches the redacted reply. Restoration happens after the cache write, so the response cache never holds plaintext. Guardrail telemetry likewise records the stand-ins the guardrail sent, not the restored values.

## Supported parameters

| Parameter | Default | Description |
|---|---|---|
| `api_base` | `http://localhost:8000` | Base URL of your LLM Shield Proxy deployment. Falls back to `LLM_SHIELD_PROXY_API_BASE` |
| `api_key` | `None` | One of the Shield's `VALID_VIRTUAL_KEYS`, sent as the bearer credential. Falls back to `LLM_SHIELD_PROXY_API_KEY` |

Each call to the Shield times out after 10 seconds, and a timeout blocks the request like any other Shield failure.

## Supported modes

| Mode | What it does |
|---|---|
| `pre_call` | Replaces personal data in the request with stand-ins held in a vault inside your Shield deployment |
| `post_call` | Restores the original values in the reply, streaming and non-streaming. The vault stays in your deployment; LiteLLM never stores the plaintext |

## Further reading

- [LLM Shield Proxy on GitHub](https://github.com/ninadphalak/LLM-Shield-Proxy)
- [llm-shield-proxy on PyPI](https://pypi.org/project/llm-shield-proxy/)
