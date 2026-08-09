import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Dash Security

[Dash Security](https://www.dash.security/) integrates with [LiteLLM Proxy](https://docs.litellm.ai) via the [Generic Guardrail API](https://docs.litellm.ai/docs/adding_provider/generic_guardrail_api), providing AI gateway visibility and policy enforcement for LiteLLM traffic.

- **Gateway visibility**: Centralize LiteLLM proxy traffic in Dash for detection, session grouping, and audit
- **Pre-LLM enforcement**: Block unsafe prompts and inspect tool definitions before they reach the model
- **Post-response enforcement**: Redact or block model output and generated tool calls after the LLM responds
- **Organization policies**: Apply the detection and response policies configured for your organization in Dash
- **Identity-aware sessions**: Group traffic by stable caller identity (virtual key, end user, or email)

:::info Integration type
Dash Security integrates through LiteLLM's built-in `guardrail: generic_guardrail_api`.
:::

## Prerequisites

Before you begin, ensure you have:

1. **Dash Security account** — access to the [Dash dashboard](https://www.dash.security/)
2. **LiteLLM integration in Dash** — create a LiteLLM integration under **Integrations → AI Gateway** in Dash. The setup wizard generates your `api_base`, API token, and a copy-paste `config.yaml` snippet
3. **LiteLLM Proxy** — a running LiteLLM proxy you can edit and restart

## Quick Start

### 1. Create the LiteLLM integration in Dash

In Dash, open **Integrations → AI Gateway → LiteLLM** and create an integration. Copy the generated guardrail block. It includes:

- `api_base` — the Dash guardrail endpoint URL for this integration (copy from the wizard)
- `api_key` — the integration token LiteLLM sends as `x-api-key`

Store the token securely. Dash shows it once at creation time.

### 2. Configure LiteLLM

Paste the guardrail block under the top-level `guardrails:` list in your LiteLLM `config.yaml`, then restart the proxy.

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: dash-security
    litellm_params:
      guardrail: generic_guardrail_api
      mode: [pre_call, post_call]
      api_base: os.environ/DASH_API_BASE
      api_key: os.environ/DASH_LITELLM_TOKEN
      default_on: true
      unreachable_fallback: fail_open
      fail_on_error: false
```

:::warning Important
- The value `guardrail: generic_guardrail_api` must not be changed. This is the LiteLLM built-in guardrail type. You may customize `guardrail_name`.
- **`api_base` is unique per integration.** Copy it from the Dash LiteLLM integration wizard (or set `DASH_API_BASE` to that value). LiteLLM appends `/beta/litellm_basic_guardrail_api` automatically, so `api_base` does not need to include it.
:::

Set environment variables:

```bash
export DASH_API_BASE="https://<your-dash-guardrail-endpoint>"  # copy from the Dash wizard
export DASH_LITELLM_TOKEN="your-dash-litellm-integration-token"
```

### 3. Start LiteLLM Proxy

```bash
litellm --config config.yaml --port 4000
```

### 4. Test the integration

<Tabs>
<TabItem value="allowed" label="Allowed request">

```bash
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-master-key" \
  -d '{
    "model": "gpt-4o",
    "user": "user-123",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

The call reaches the model and returns a normal chat completion.

</TabItem>
<TabItem value="blocked" label="Blocked request">

When a request violates one of your Dash policies, the guardrail returns `BLOCKED` and LiteLLM rejects the call with HTTP 400:

```json
{
  "error": {
    "message": "Action blocked by security policy",
    "type": "None",
    "param": "None",
    "code": "400"
  }
}
```

`message` is the reason Dash returned. Prompt and model blocks use the message configured on the matching Dash policy, so it is whatever your team wrote. MCP tool blocks name the server and tool, for example `MCP blocked: github/delete_repo`.

</TabItem>
</Tabs>

On the response path Dash redacts instead of erroring: the call still returns `200`, with the offending output replaced.

## Guardrail Modes

Dash Security supports all Generic Guardrail API execution modes:

| Mode | When it runs | What Dash evaluates | Typical use |
|------|--------------|---------------------|-------------|
| **`pre_call`** | Before the LLM call | User/system input, structured messages, tool definitions, and prior assistant tool calls in conversation history on supported chat endpoints | Block unsafe prompts and disallowed tool calls already in the conversation |
| **`during_call`** | In parallel with the LLM call | Same inputs as `pre_call` | Lower added latency when you still want pre-flight inspection |
| **`post_call`** | After the LLM response | Model output text and newly generated tool calls on supported chat endpoints | Redact or block unsafe completions and tool invocations before the client executes them |

:::tip Recommended
Use `mode: [pre_call, post_call]` for complete input and output coverage. Each LLM call is evaluated twice (before and after the model).
:::

### Tool and MCP coverage

On supported LLM endpoints (`/v1/chat/completions`, `/v1/messages`, `/v1/responses`), the Generic Guardrail API forwards tool information so Dash can enforce tool and MCP policies:

- **`pre_call`** — the tool definitions available to the model, so Dash can evaluate which tools and MCP servers are in scope before the call runs
- **`post_call`** — the tool calls the model just generated, so Dash can block a disallowed call before your client executes it

Because blocking a generated tool call requires the response payload, tool and MCP enforcement needs `post_call`. Use `mode: [pre_call, post_call]`; `during_call` alone does not deliver the response.

**Not supported today:** LiteLLM proxy-brokered MCP traffic on `/mcp` is not sent through the Generic Guardrail API.

## Failure controls

Two LiteLLM settings control behavior when the Dash guardrail endpoint is unreachable or returns an error. They compose with the Generic Guardrail API defaults documented in [Generic Guardrail API — Error handling](https://docs.litellm.ai/docs/adding_provider/generic_guardrail_api#error-handling-unreachable_fallback-and-fail_on_error).

| Setting | Fail-open (Dash default) | Fail-closed |
|---------|--------------------------|-------------|
| `unreachable_fallback` | `fail_open` — proceed if the Dash endpoint is unreachable (network error, timeout, or upstream 502/503/504) | `fail_closed` — block when the Dash endpoint cannot be reached |
| `fail_on_error` | `false` — proceed on any guardrail error (malformed body, non-2xx, serialization errors, etc.) | `true` — block on any guardrail error |

**Fail-open (recommended for availability):** Dash's generated configuration defaults to `unreachable_fallback: fail_open` and `fail_on_error: false` so temporary unavailability of the Dash guardrail endpoint does not interrupt LiteLLM Proxy traffic. LiteLLM still logs these errors at critical level when fail-open applies.

**Fail-closed (recommended for strict security):** Enable **Fail closed** when creating the LiteLLM integration in Dash, or set `unreachable_fallback: fail_closed` and `fail_on_error: true` manually. Use this when Dash is a hard security boundary and you prefer blocking traffic over bypassing the guardrail.

:::danger
With `fail_on_error: false`, any guardrail failure is bypassed for that request. A valid `BLOCKED` response from Dash still blocks. Choose fail-closed only if you would rather reject LiteLLM traffic than let a request through unevaluated.
:::

<Tabs>
<TabItem value="fail-open" label="Fail-open (default)">

```yaml
guardrails:
  - guardrail_name: dash-security
    litellm_params:
      guardrail: generic_guardrail_api
      mode: [pre_call, post_call]
      api_base: os.environ/DASH_API_BASE
      api_key: os.environ/DASH_LITELLM_TOKEN
      default_on: true
      unreachable_fallback: fail_open
      fail_on_error: false
```

</TabItem>
<TabItem value="fail-closed" label="Fail-closed">

```yaml
guardrails:
  - guardrail_name: dash-security
    litellm_params:
      guardrail: generic_guardrail_api
      mode: [pre_call, post_call]
      api_base: os.environ/DASH_API_BASE
      api_key: os.environ/DASH_LITELLM_TOKEN
      default_on: true
      unreachable_fallback: fail_closed
      fail_on_error: true
```

</TabItem>
<TabItem value="low-latency" label="Low latency (during_call)">

```yaml
guardrails:
  - guardrail_name: dash-security-parallel
    litellm_params:
      guardrail: generic_guardrail_api
      mode: during_call
      api_base: os.environ/DASH_API_BASE
      api_key: os.environ/DASH_LITELLM_TOKEN
      default_on: true
      unreachable_fallback: fail_open
      fail_on_error: false
```

</TabItem>
</Tabs>

## Identity and session tracking

Dash groups requests from the same caller identity within a rolling 30-minute window into one session. Identity therefore determines how accurate sessions, user attribution, and dashboards are — provide a stable one on every request:

- **`user` field** — pass an end-user identifier on `/v1/chat/completions` (and other supported endpoints). Without it, LiteLLM may send a placeholder user id, which limits user-level visibility in Dash.
- **LiteLLM virtual keys** — configure `user_id`, email, team, or org metadata on the virtual key used as the bearer token so identity is forwarded even when clients omit the `user` field.

Example:

```bash
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-your-virtual-key" \
  -d '{
    "model": "gpt-4o",
    "user": "alice@example.com",
    "messages": [{"role": "user", "content": "Summarize our Q3 roadmap"}]
  }'
```

## Configuration reference

| Parameter | Description |
|-----------|-------------|
| `guardrail` | Must be `generic_guardrail_api` |
| `api_base` | Dash guardrail endpoint URL from the integration wizard (for example via `DASH_API_BASE`). LiteLLM appends `/beta/litellm_basic_guardrail_api`. |
| `api_key` | Integration token from Dash (sent as `x-api-key`) |
| `mode` | `pre_call`, `post_call`, `during_call`, or an array such as `[pre_call, post_call]` |
| `default_on` | When `true`, apply to all requests unless overridden per call |
| `unreachable_fallback` | `fail_open` or `fail_closed` when the Dash endpoint is unreachable |
| `fail_on_error` | `true` (fail closed on any error) or `false` (fail open on errors) |

## Support and resources

- [Dash Security](https://www.dash.security/)
- LiteLLM integration setup — create a LiteLLM integration under **Integrations → AI Gateway** in the Dash dashboard
- [LiteLLM Generic Guardrail API](https://docs.litellm.ai/docs/adding_provider/generic_guardrail_api)
- [LiteLLM Proxy documentation](https://docs.litellm.ai/docs/proxy/quick_start)
