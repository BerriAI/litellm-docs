---
title: "Data & More DLP Guardrails on LiteLLM AI Gateway"
sidebar_label: "Data & More"
description: "Block or mask sensitive personal data in prompts and responses with Data & More DLP on the LiteLLM AI Gateway, using the same policies as your Microsoft 365 DLP."
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Data & More

[Data & More](https://www.dataandmore.com) DLP integrates with LiteLLM Proxy as a first-class guardrail provider. On every call it classifies prompt and response text against your existing document classes and can **block** or **mask** sensitive values before they reach the model or the client.

Data & More detects and enforces using your workspace policies:

- Personal identifiers and other document classes you already use for email, OneDrive, SharePoint and Teams
- Log, alert, mask, or block per policy
- Optional checks on model replies (`post_call`)

Data & More implements [LiteLLM's Generic Guardrail API](https://docs.litellm.ai/docs/adding_provider/generic_guardrail_api) contract. Use `guardrail: dataandmore` in config instead of hand-rolling `generic_guardrail_api` settings.

:::info
**Text only.** Images and files in chats are not checked. The customer runs LiteLLM; Data & More is the guardrail behind it.
:::

## Quick Start

### 1. Get your Data & More guardrail key

In Data & More (DGM), open **DLP → AI gateway**, generate a guardrail key (`dgmg_*`), and copy the `api_base` for your deployment (for example `https://dgm.dataandmore.com/api/dlp/ai-gateway/litellm` or your EU / partner host). Store the key as `DGM_GUARDRAIL_KEY`.

### 2. Add Data & More to your LiteLLM config.yaml

`api_base` is **required** and must point at your DGM host. LiteLLM appends `/beta/litellm_basic_guardrail_api`.

```yaml title="config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

guardrails:
  - guardrail_name: dataandmore-dlp
    litellm_params:
      guardrail: dataandmore
      mode: [pre_call, post_call]      # post_call only when "Check model replies" is on in DGM
      api_base: https://<your-dgm-host>/api/dlp/ai-gateway/litellm
      api_key: os.environ/DGM_GUARDRAIL_KEY
      default_on: true
      timeout: 10
      unreachable_fallback: fail_open  # DGM down: chats continue
      fail_on_error: true              # Block and rejected keys still fail the call
      streaming_buffer_until_moderated: true
```

To add it from the Admin UI instead, open the Guardrails page and pick the **Data & More** card.

### 3. Start LiteLLM Proxy

```shell
export OPENAI_API_KEY=sk-...
export DGM_GUARDRAIL_KEY=dgmg_...
litellm --config config.yaml
```

### 4. Make your first request

The blocked example assumes a matching **block** policy is enabled for the AI gateway source in your Data & More workspace.

<Tabs>
<TabItem value="blocked" label="Blocked">

```shell
curl -sSLX POST 'http://0.0.0.0:4000/v1/chat/completions' \
--header 'Content-Type: application/json' \
--data '{
  "model": "{{openai_small}}",
  "messages": [
    {"role": "user", "content": "My national ID is 010190-1234"}
  ]
}'
```

```json
{
  "error": {
    "message": "Sensitive personal data detected",
    "type": "invalid_request_error",
    "param": null,
    "code": "400"
  }
}
```

The message is the `blocked_reason` returned by Data & More (class names in the workspace language; never the raw values).

</TabItem>
<TabItem value="allowed" label="Allowed">

```shell
curl -sSLX POST 'http://0.0.0.0:4000/v1/chat/completions' \
--header 'Content-Type: application/json' \
--data '{
  "model": "{{openai_small}}",
  "messages": [
    {"role": "user", "content": "What is the capital of Japan?"}
  ]
}'
```

The request reaches the model and the response is returned unchanged.

</TabItem>
</Tabs>

## Mask vs block

| Policy action in Data & More | LiteLLM action |
|---|---|
| Log / Alert | `NONE` (chat continues; audited in DGM) |
| Mask (prompts) | `GUARDRAIL_INTERVENED` with redacted `texts` / `structured_messages` (one-to-one) |
| Block | `BLOCKED` with `blocked_reason` |
| Mask on a model reply | Escalates to `BLOCKED` (replies cannot be masked) |

## Supported parameters

| Parameter | Default | Description |
|---|---|---|
| `api_key` | `DGM_GUARDRAIL_KEY` env var | Data & More AI gateway guardrail key (`dgmg_*`). Sent as the `x-api-key` header |
| `api_base` | `DGM_GUARDRAIL_API_BASE` env var (**required**) | Your DGM host + `/api/dlp/ai-gateway/litellm`. LiteLLM appends `/beta/litellm_basic_guardrail_api`. There is no single global Data & More API host — use your DK, EU, or partner domain |
| `unreachable_fallback` | `fail_open` (recommended) | Behavior when Data & More cannot be reached, times out, or answers 502/503/504: `fail_open` lets the call through; `fail_closed` fails it |
| `fail_on_error` | `true` | If `true`, other errors (e.g. rejected key) fail the call. `BLOCKED` always blocks |
| `timeout` | `10` (recommended) | Seconds to wait for Data & More on each check |
| `default_on` | `false` | Apply this guardrail to all requests by default |
| `streaming_buffer_until_moderated` | `true` (with reply checks) | Required when checking streamed model replies |

A 4xx from Data & More, such as a rejected API key, is not treated as unreachable, so it fails the call even with `fail_open`.

## Supported modes

| Mode | When it runs | Typical use |
|---|---|---|
| `pre_call` | Before the LLM call | Screen prompts; apply mask or block |
| `post_call` | After the LLM response | Screen replies when enabled in DGM |
| `during_call` | In parallel with the LLM call | Lower-latency input monitoring |

## Further reading

- [Data & More](https://www.dataandmore.com)
- [Generic Guardrail API](https://docs.litellm.ai/docs/adding_provider/generic_guardrail_api)
- [LiteLLM guardrails overview](https://docs.litellm.ai/docs/proxy/guardrails/quick_start)
