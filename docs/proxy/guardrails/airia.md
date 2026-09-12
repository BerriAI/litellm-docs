import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Airia

The Airia guardrail lets your LiteLLM proxy enforce the guardrails you set up in [Airia](https://airia.com): prompts are checked before they reach the model, responses before they reach the caller, allowing Airia to enforce whether each one is allowed, blocked, or redacted in place.

## Setup

### 1. Connect LiteLLM in Airia

In Airia, open **Discover → Connections → LiteLLM**. Enable the connection and create an API key for it. Then open the guardrails you want enforced and add **LiteLLM** as a target, choosing whether each applies to prompts, responses, or both.

A guardrail with no LiteLLM target is not applied to proxy traffic, even if it is enabled elsewhere in Airia.

### 2. Add the guardrail to `config.yaml`

One entry covers both directions. `pre_call` checks the prompt; `post_call` checks the model's response.

```yaml title="config.yaml"
model_list:
  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
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
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4o-mini",
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
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Contact me at ada@example.com"}]
  }'
```

The call succeeds. The model receives `Contact me at [EmailAddress1]` and responds normally; the original address never leaves the proxy.

</TabItem>
<TabItem label="Allowed" value="allowed">

```shell
curl -sSL http://0.0.0.0:4000/v1/chat/completions \
  -H 'Authorization: Bearer sk-1234' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Summarize Hamlet in one sentence."}]
  }'
```

The request reaches the model unchanged and the response is returned as-is.

</TabItem>
</Tabs>

## Outcomes

Airia answers each check with one of three outcomes.

| Outcome | What the proxy does |
|---|---|
| **Allow** | The call proceeds unchanged. |
| **Block** | Returns `400` carrying the guardrail's configured message. Under `pre_call` the model is not called; under `post_call` the response is withheld. |
| **Redact** | Replaces the flagged spans with placeholders. Under `pre_call` the model sees the redacted prompt; under `post_call` the caller receives the redacted response. |


## Parameters

| Parameter | Environment variable | Description |
|---|---|---|
| `api_base` | `AIRIA_GATEWAY_URL` | Base URL of your Airia AI Gateway. Required. |
| `api_key` | `AIRIA_API_KEY` | The API key created for the LiteLLM connection in Airia. Required. |
| `timeout` | `AIRIA_TIMEOUT` | Seconds to wait for Airia before refusing the request. Default `10`. |

Either the config value or the environment variable must be set for `api_base` and `api_key`; the proxy refuses to start otherwise, rather than failing on the first request.

## Modes

| Mode | Checks |
|---|---|
| `pre_call` | The prompt, before the model is called |
| `post_call` | The model's response, before it is returned |


To apply the guardrail to some callers only, leave `default_on` unset and enable it per virtual key with LiteLLM's standard [per-key guardrail controls](./quick_start#-control-guardrails-per-api-key).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Request fails with `Client error '401 Unauthorized'` | The key is not the one on the LiteLLM connection in Airia, or the connection has no key saved. |
| Request fails with `Server error '503 Service Unavailable'` | The LiteLLM connection is disabled in Airia. |
| Requests succeed but nothing is ever blocked or redacted | No guardrail has LiteLLM as a target, or the target's direction does not match the `mode` that ran. |
