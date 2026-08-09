import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Dash Security

[Dash Security](https://www.dash.security/) integrates with [LiteLLM Proxy](https://docs.litellm.ai) via the [Generic Guardrail API](https://docs.litellm.ai/docs/adding_provider/generic_guardrail_api), providing AI gateway visibility and policy enforcement for LiteLLM traffic.

- **Gateway visibility**: Centralize LiteLLM proxy traffic in Dash for detection, session grouping, and audit
- **Pre-LLM enforcement**: Block unsafe prompts and tool definitions before they reach the model
- **Post-response enforcement**: Redact or block model output and generated tool calls after the LLM responds
- **Tenant policies**: Apply Dash detection and response policies configured for your organization
- **Identity-aware sessions**: Correlate traffic to LiteLLM virtual keys, end users, teams, and trace IDs

:::info Integration type
Dash Security uses LiteLLM's built-in `guardrail: generic_guardrail_api`. There is no native `guardrail: dash_security` provider in LiteLLM.
:::

## Prerequisites

Before you begin, ensure you have:

1. **Dash Security account** — access to the [Dash dashboard](https://www.dash.security/)
2. **LiteLLM integration in Dash** — create a LiteLLM integration under **Integrations → AI Gateway** in Dash. The setup wizard generates your `api_base`, API token, and a copy-paste `config.yaml` snippet
3. **LiteLLM Proxy** — a running LiteLLM proxy you can edit and restart

## Quick Start

### 1. Create the LiteLLM integration in Dash

In Dash, open **Integrations → AI Gateway → LiteLLM** and create an integration. Copy the generated guardrail block. It includes:

- `api_base` — your tenant-specific Dash DDC base URL for this integration (see below)
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
      api_base: "https://<your-ddc-host>/api/v1/litellm/<integration-id>"
      api_key: os.environ/DASH_LITELLM_TOKEN
      default_on: true
      unreachable_fallback: fail_open
      fail_on_error: false
```

:::warning Important
- The value `guardrail: generic_guardrail_api` must not be changed. This is the LiteLLM built-in guardrail type. You may customize `guardrail_name`.
- **`api_base` is tenant- and integration-specific.** Copy it from the Dash LiteLLM integration UI. It points at your Dash DDC endpoint for that integration (for example `https://<your-ddc-host>/api/v1/litellm/<integration-id>`). LiteLLM appends `/beta/litellm_basic_guardrail_api` automatically — do not include that suffix in `api_base`.
- Do not hard-code a shared public Dash URL. Each customer integration has its own route and credential.
:::

Set the token in your environment:

```bash
export DASH_LITELLM_TOKEN="your-dash-litellm-integration-token"
```

### 3. Start LiteLLM Proxy

```bash
litellm --config config.yaml --port 4000
```

### 4. Test the integration

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

## Guardrail Modes

Dash Security supports all Generic Guardrail API execution modes:

| Mode | When it runs | What Dash evaluates | Typical use |
|------|--------------|---------------------|-------------|
| **`pre_call`** | Before the LLM call | User/system input, structured messages, and **tool definitions** on supported chat endpoints | Block unsafe prompts and disallowed tools before the model runs |
| **`during_call`** | In parallel with the LLM call | Same inputs as `pre_call` | Lower added latency when you still want pre-flight inspection |
| **`post_call`** | After the LLM response | Model output text and **generated tool calls** on supported chat endpoints | Redact or block unsafe completions and tool invocations |

:::tip Recommended
Use `mode: [pre_call, post_call]` for complete input and output coverage. Each LLM call is evaluated twice (before and after the model).
:::

### Tool and MCP coverage

On supported LLM endpoints (`/v1/chat/completions`, `/v1/messages`, `/v1/responses`), the Generic Guardrail API can forward:

- **`tools`** (pre_call only) — tool definitions available to the model, so Dash can inspect schemas before the call
- **`tool_calls`** (pre_call and post_call) — generated tool invocations, so Dash can block dangerous calls after the model responds

**Not supported today:** LiteLLM proxy-brokered MCP traffic on `/mcp` is **not** sent through the Generic Guardrail API. MCP gateway hooks require future Generic API support. Configure MCP enforcement through Dash's supported integration paths instead of expecting `/mcp` to flow through this guardrail.

## Failure controls

Two LiteLLM settings control behavior when Dash is unreachable or returns an error. They compose with the Generic Guardrail API defaults documented in [Generic Guardrail API — Error handling](https://docs.litellm.ai/docs/adding_provider/generic_guardrail_api#error-handling-unreachable_fallback-and-fail_on_error).

| Setting | Fail-open (Dash default) | Fail-closed |
|---------|------------------------|-------------|
| `unreachable_fallback` | `fail_open` — proceed if Dash is unreachable (network error, timeout, or upstream 502/503/504) | `fail_closed` — block when Dash cannot be reached |
| `fail_on_error` | `false` — proceed on any guardrail error (malformed body, non-2xx, serialization errors, etc.) | `true` — block on any guardrail error |

**Fail-open (recommended for gateway availability):** Dash's generated configuration defaults to `unreachable_fallback: fail_open` and `fail_on_error: false` so a Dash or DDC outage does not take down LiteLLM. Errors are still logged by LiteLLM at critical level when fail-open applies.

**Fail-closed (recommended for strict security):** Enable **Fail closed** when creating the LiteLLM integration in Dash, or set `unreachable_fallback: fail_closed` and `fail_on_error: true` manually. Use this when Dash is a hard security boundary and you prefer blocking traffic over bypassing the guardrail.

:::danger
With `fail_on_error: false`, any guardrail failure is bypassed for that request. A valid `BLOCKED` response from Dash still blocks. Choose fail-closed only when you accept blocking LiteLLM traffic on Dash errors.
:::

<Tabs>
<TabItem value="fail-open" label="Fail-open (default)">

```yaml
guardrails:
  - guardrail_name: dash-security
    litellm_params:
      guardrail: generic_guardrail_api
      mode: [pre_call, post_call]
      api_base: "https://<your-ddc-host>/api/v1/litellm/<integration-id>"
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
      api_base: "https://<your-ddc-host>/api/v1/litellm/<integration-id>"
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
      api_base: "https://<your-ddc-host>/api/v1/litellm/<integration-id>"
      api_key: os.environ/DASH_LITELLM_TOKEN
      default_on: true
      unreachable_fallback: fail_open
      fail_on_error: false
```

</TabItem>
</Tabs>

## Identity and session tracking

Dash groups LiteLLM traffic into sessions for detection and dashboards. Provide stable identity signals on each request:

1. **`user` field** — pass an end-user identifier on `/v1/chat/completions` (and other supported endpoints). Without it, LiteLLM may send the placeholder `default_user_id`, which limits user-level visibility in Dash.
2. **LiteLLM virtual keys** — set `user_id`, email, team, or org metadata on the virtual key. LiteLLM forwards these in `request_data` (`user_api_key_user_email`, `user_api_key_team_alias`, `user_api_key_end_user_id`, etc.).
3. **`litellm_trace_id`** — when present, Dash prefers it for conversation grouping across turns. If omitted, Dash can fall back to a virtual-key time window or `litellm_call_id` per turn.

Example with explicit user and trace metadata:

```bash
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-master-key" \
  -d '{
    "model": "gpt-4o",
    "user": "alice@example.com",
    "messages": [{"role": "user", "content": "Summarize our Q3 roadmap"}],
    "metadata": {
      "litellm_trace_id": "conversation-456"
    }
  }'
```

## Configuration reference

| Parameter | Description |
|-----------|-------------|
| `guardrail` | Must be `generic_guardrail_api` |
| `api_base` | Dash DDC base URL for your integration (from the Dash UI). LiteLLM appends `/beta/litellm_basic_guardrail_api`. |
| `api_key` | Integration token from Dash (sent as `x-api-key`) |
| `mode` | `pre_call`, `post_call`, `during_call`, or an array such as `[pre_call, post_call]` |
| `default_on` | When `true`, apply to all requests unless overridden per call |
| `unreachable_fallback` | `fail_open` or `fail_closed` when Dash is unreachable |
| `fail_on_error` | `true` (fail closed on any error) or `false` (fail open on errors) |

## Support and resources

- [Dash Security](https://www.dash.security/)
- [Dash documentation](https://docs.dash.security/)
- [LiteLLM Generic Guardrail API](https://docs.litellm.ai/docs/adding_provider/generic_guardrail_api)
- [LiteLLM Proxy documentation](https://docs.litellm.ai/docs/proxy/quick_start)
