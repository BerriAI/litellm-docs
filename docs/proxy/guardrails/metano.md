import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Metano

The Metano guardrail screens prompts and model responses against your organization's policy, blocking or redacting secrets, PII and prompt injection before the model sees them.

It runs through the [Generic Guardrail API](../../adding_provider/generic_guardrail_api.md), so the LiteLLM proxy you already run calls [Metano](https://metano.ai) on every request and Metano answers with allow, redact, or block. Metano never sits in the data path as a proxy of its own.

Metano is an AI agent security platform, so the guardrail is one half of the integration. The other half is a logging callback that records every call, including the clean ones, which gives you an inventory of the applications behind your proxy, their sessions, their tool calls, and their spend. Most guardrails only report when a rule fires, and a page of triggers with no denominator cannot answer which applications are calling, or how often.

Policy is configured in the Metano portal under Policies, and the rules are evaluated against the scanner set below. Each rule names a scanner, a stage of `input` or `output`, and an action of `block` or `redact`, and runs in either enforce or monitor mode.

| Scanner | What it looks for |
|---|---|
| `secrets` | API keys, tokens, and other credentials in a prompt or a response |
| `pii` | Emails, phone numbers, national ids, and other personal data |
| `prompt_injection` | Instructions that try to override the system prompt |
| `invisible_text` | Zero-width and bidirectional characters used to hide instructions |
| `toxicity`, `bias`, `sentiment`, `no_refusal` | Content classification on the prompt or the response |
| `word_filter`, `regex`, `topic`, `json` | Deterministic rules you define |
| `token_limit` | Prompts above a size you set |
| `mcp_server` | Calls that reach an MCP server your policy does not allow |

## Quick start

### 1. Get an API key

Create an organization API key in the Metano portal under Settings, then export it:

```bash
export METANO_API_KEY=your-metano-api-key
export OPENAI_API_KEY=your-openai-api-key
```

### 2. Configure LiteLLM

The guardrail reads your organization key from the static `headers` block rather than from `api_key`, because the key selects whose policy is enforced. `api_base` is a host only, since LiteLLM appends `/beta/litellm_basic_guardrail_api` itself.

```yaml
model_list:
  - model_name: {{openai_large}}
    litellm_params:
      model: openai/{{openai_large}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: metano
    litellm_params:
      guardrail: generic_guardrail_api
      mode: pre_call
      default_on: true
      api_base: https://guardrails.prod.metano.ai
      headers:
        x-metano-api-key: os.environ/METANO_API_KEY
      extra_headers:
        - x-metano-session
        - x-metano-agent
        - x-metano-framework
      fail_on_error: false
      unreachable_fallback: fail_open
```

:::warning[Put the guardrails block at the top level]
`guardrails` is a top-level key. Nesting it under `litellm_settings` selects the older guardrail format, which expects a different shape, and the proxy exits at startup with `argument after ** must be a mapping, not str`.
:::

### 3. Start the proxy

```bash
litellm --config config.yaml --port 4000
```

### 4. Test it

```bash
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-master-key" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "Here is my key: sk-test-abc123, summarise it"}]
  }'
```

With a `secrets` rule set to block, the call never reaches the model and LiteLLM returns a 400 carrying the reason Metano gave:

```json
{
  "error": {
    "message": "Request blocked by your organization's guardrail policy.",
    "type": null,
    "param": null,
    "code": "400"
  }
}
```

A rule set to redact returns the prompt with the matched spans replaced, and the model sees the redacted text. A call that matches nothing passes through untouched.

## Regions

Metano runs separate regional deployments and your data stays in the one your organization belongs to. Point `api_base` at the region that issued your key.

| Region | `api_base` |
|---|---|
| United States | `https://guardrails.prod.metano.ai` |
| India | `https://guardrails.in.metano.ai` |

## Configuration reference

| Parameter | Description |
|---|---|
| `guardrail` | Must be `generic_guardrail_api` |
| `api_base` | The regional host from the table above, with no path |
| `headers` | Must carry `x-metano-api-key`. This is the organization key, set once per proxy |
| `extra_headers` | Caller headers to forward per request, for attribution |
| `mode` | `pre_call`, `post_call`, `during_call`, or an array such as `[pre_call, post_call]` |
| `default_on` | Run the guardrail on every request rather than only when named in the call |
| `fail_on_error` | Set `false` so a Metano error passes traffic instead of failing the call |
| `unreachable_fallback` | Set `fail_open` so a network problem passes traffic |

Both failure settings default to fail-closed in LiteLLM, which means a guardrail outage would block every call through your proxy. Set them explicitly to the posture you want rather than inheriting the default.

### Attribution

The key in `headers` is per proxy, so on its own every audit record from every application behind that proxy shares one identity. `extra_headers` forwards each caller's own headers per request, which is where a real session and application name come from. The [Metano SDK](https://metano.ai) sets them, and any client can set them directly:

```bash
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-master-key" \
  -H "x-metano-agent: billing-assistant" \
  -H "x-metano-session: conversation-456" \
  -H "x-metano-framework: langchain" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Headers not named in `extra_headers` still arrive, but LiteLLM replaces the value with the literal string `[present]`, so leaving `x-metano-session` off the list means every record is anchored to one phantom session.

`x-metano-api-key` and `x-metano-user` are deliberately not forwardable. Both decide which policy applies, and a caller that could set either could choose the policy it is judged by.

## Guardrail modes

| Mode | When it runs | What it sees | Use it for |
|---|---|---|---|
| `pre_call` | Before the model call | The prompt | Blocking or redacting input before the model sees it |
| `during_call` | In parallel with the model call | The prompt | Input monitoring with less added latency |
| `post_call` | After the model responds | The response | Catching secrets or personal data in output |

Run `[pre_call, post_call]` to cover both directions. Use `pre_call` rather than `during_call` when a rule is set to block, since a parallel check cannot stop a prompt that has already been sent.

## Telemetry

The `guardrails` block enforces. This one records, and they are different LiteLLM extension points on purpose. A guardrail is called per text evaluation and answers with an action, so it has nowhere to put a model name or a token count, and it only fires when a rule matches. Without the block below, a clean call leaves no trace, so Metano can show you triggers but not the applications, sessions, or spend behind them.

```yaml
litellm_settings:
  callbacks: ["metano"]

callback_settings:
  metano:
    callback_type: generic_api
    endpoint: https://guardrails.prod.metano.ai/v1/gateway/litellm/logs
    headers:
      x-metano-api-key: os.environ/METANO_API_KEY
    log_format: json_array
    batch_size: 20
    flush_interval: 10
```

`callback_settings` is a top-level key, like `guardrails`. The `headers` map is required even for an endpoint that needs no auth, because without it the callback is skipped and the proxy then tries to import the name as a module and exits with `ValueError: Empty module name`.

`log_format` must be `json_array`. The defaults of `batch_size: 100` and `flush_interval: 60` are sized for a bulk log sink, so a turn takes a minute to appear in a session view; the values above trade a few more requests for a view that keeps up with someone watching it.

## Verifying enforcement is on

A guardrail that is not working looks exactly like a guardrail with nothing to report, so confirm it once after setup. Send a prompt you expect to be blocked and check that you get a 400 rather than a completion. If the key is missing or wrong, Metano finds no policy, returns `{"action": "NONE"}`, and your traffic passes unguarded with nothing in either log to say so.

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-master-key" \
  -d '{
    "model": "{{openai_large}}",
    "messages": [{"role": "user", "content": "my aws key is AKIAIOSFODNN7EXAMPLE"}]
  }'
```

## Support

Write to support@metano.ai, or see [metano.ai](https://metano.ai) for the portal and documentation.
