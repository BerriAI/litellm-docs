import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Airia

The Airia guardrail lets your LiteLLM proxy enforce the guardrails you set up in [Airia](https://airia.com): prompts are checked before they reach the model, responses before they reach the caller, allowing Airia to enforce whether each one is allowed, blocked, or redacted in place.

Airia detects:

- Prompt injection and jailbreak attempts
- Sensitive data (DLP): PII, PCI, PHI, and secrets such as API keys and credentials
- Responsible AI violations: toxic and harmful content

Guardrails also inspect tool calls and tool responses when they are configured to. Typical added latency is under 40 ms, depending on which guardrails are enabled.

## Setup

### 1. Connect LiteLLM in Airia

In Airia, open **Discover → Connections → LiteLLM**. Enable the connection and create an API key for it. Then open **Security → Runtime Security → Guardrails**, and on each guardrail you want enforced add **LiteLLM** as a target, choosing whether each applies to prompts, responses, or both.

A guardrail with no LiteLLM target is not applied to proxy traffic, even if it is enabled elsewhere in Airia.

### 2. Add the guardrail to `config.yaml`

One entry covers both directions. `pre_call` checks the prompt; `post_call` checks the model's response.

```yaml title="config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: airia
    litellm_params:
      guardrail: airia
      mode: [pre_call, post_call]
      default_on: true
      api_base: os.environ/AIRIA_GATEWAY_URL
      api_key: os.environ/AIRIA_API_KEY
```

### 3. Start the proxy

Use the base URL for your Airia region, or your dedicated deployment's URL if you are on a dedicated tenant.

```shell
export OPENAI_API_KEY=sk-...
export AIRIA_GATEWAY_URL=https://gateway.airia.ai
export AIRIA_API_KEY=ak-...
litellm --config config.yaml
```

### 4. Send a request

The examples below assume an Airia guardrail targeted at LiteLLM that blocks secrets and redacts personal data.

<Tabs>
<TabItem label="Blocked" value="blocked">

```shell
curl -sSL http://0.0.0.0:4000/v1/chat/completions \
  -H 'Authorization: Bearer sk-master-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "{{openai_small}}",
    "messages": [{"role": "user", "content": "my aws key is AKIAIOSFODNN7EXAMPLE"}]
  }'
```

```json
{
  "error": {
    "message": "Guardrail raised an exception, Guardrail: airia, Message: Blocked by your organization's content policy.",
    "type": "None",
    "param": "None",
    "code": "400"
  }
}
```

The text after `Message:` is the block message configured on the Airia guardrail that fired. Under `pre_call` the model is never called.

</TabItem>
<TabItem label="Redacted" value="redacted">

```shell
curl -sSL http://0.0.0.0:4000/v1/chat/completions \
  -H 'Authorization: Bearer sk-master-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "{{openai_small}}",
    "messages": [{"role": "user", "content": "Contact me at ada@example.com"}]
  }'
```

The call succeeds. The model receives `Contact me at [EmailAddress1]` and responds normally; the original address never leaves the proxy.

</TabItem>
<TabItem label="Allowed" value="allowed">

```shell
curl -sSL http://0.0.0.0:4000/v1/chat/completions \
  -H 'Authorization: Bearer sk-master-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "{{openai_small}}",
    "messages": [{"role": "user", "content": "Summarize Hamlet in one sentence."}]
  }'
```

The request reaches the model unchanged and the response is returned as-is.

</TabItem>
</Tabs>

## Outcomes

Airia answers each check with one of these outcomes.

| Outcome | What the proxy does |
|---|---|
| **Allow** | The call proceeds unchanged. |
| **Block** | Returns `400` carrying the guardrail's configured message. Under `pre_call` the model is not called; under `post_call` the response is withheld. Under the MCP modes the tool call fails with that message instead. |
| **Redact** | Replaces the flagged spans with placeholders. Under `pre_call` the model sees the redacted prompt; under `post_call` the caller receives the redacted response; under the MCP modes the flagged argument or result text is rewritten in place. Under `during_call` it is enforced as a Block with the default message, `Blocked by your organization's content policy.` |
| **Audit** | The call proceeds unchanged, and the detection is recorded in Airia. |


## Parameters

| Parameter | Environment variable | Description |
|---|---|---|
| `api_base` | `AIRIA_GATEWAY_URL` | Base URL of your Airia AI Gateway. Required. |
| `api_key` | `AIRIA_API_KEY` | The API key created for the LiteLLM connection in Airia. Required. |
| `timeout` | `AIRIA_TIMEOUT` | Seconds to wait for Airia before refusing the request. Default `10`. |

Either the config value or the environment variable must be set for `api_base` and `api_key`; the proxy refuses to start otherwise, rather than failing on the first request.

## Modes

| Mode | Checks | Airia direction |
|---|---|---|
| `pre_call` | The prompt, before the model is called | Prompts |
| `during_call` | The prompt, in parallel with the model call | Prompts |
| `post_call` | The model's response, before it is returned | Responses |
| `pre_mcp_call` | The arguments of an MCP tool call, before the tool runs | Tool calls |
| `post_mcp_call` | The result of an MCP tool call, before it is returned | Tool responses |

`during_call` trades protection for latency. The prompt is sent to the model while Airia checks it, so a **Block** discards the model's response but cannot be relied on to stop the prompt from reaching the provider. A **Redact** outcome is enforced as a **Block** in this mode, because the prompt has already been sent unredacted. Use `pre_call` when sensitive data must never reach the model.

`pre_mcp_call` and `post_mcp_call` apply to tools called through the [LiteLLM MCP gateway](../../mcp_guardrail). Airia checks the tool's arguments with the guardrails set to inspect tool calls, and its result with the guardrails set to inspect tool responses. Under `pre_mcp_call` the tool's description and parameter descriptions are checked with the arguments, on each call and when clients list the tools, as described in [scanning tool descriptions on discovery](../../mcp_guardrail#scanning-tool-descriptions-on-discovery). A guardrail set to inspect only prompts or responses does not run on MCP traffic. A **Block** stops the tool call or withholds its result, and a **Redact** rewrites the flagged argument or result text in place. A tool that fails that check, including when Airia cannot be reached, is hidden from the tool list. Tool calls that the model requests in a chat completion are covered by `pre_call` and `post_call`, and are checked with the guardrails set to inspect tool calls.

The MCP modes need an Airia AI Gateway release with MCP tool-point support. An earlier gateway ignores the tool name and checks MCP arguments with the guardrails set to inspect prompts, and MCP results with those set to inspect responses.


To apply the guardrail to some callers only, leave `default_on` unset and enable it per virtual key with LiteLLM's standard [per-key guardrail controls](./quick_start#-control-guardrails-per-api-key).

## Limitations

- A message with only an image and no text or tool calls is not sent to Airia at all; it passes through unscanned.
- If Airia does not respond within `timeout`, the request is refused (fail closed).
- A streamed `/v1/chat/completions` response is held until it is complete and Airia has answered, then delivered in one delta with any redactions applied. Streamed `/v1/responses` and `/v1/messages` calls cannot carry a rewrite, so the response is held the same way and a **Redact** outcome is enforced as a **Block**; non-streamed calls on those routes are redacted as usual.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Request fails with `Client error '401 Unauthorized'` | The key is not the one on the LiteLLM connection in Airia, or the connection has no key saved. |
| Request fails with `Server error '503 Service Unavailable'` | The LiteLLM connection is disabled in Airia. |
| Requests succeed but nothing is ever blocked or redacted | No guardrail has LiteLLM as a target, or the target's direction does not match the `mode` that ran. |
