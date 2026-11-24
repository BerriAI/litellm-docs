---
title: "TrendAI Guardrails on LiteLLM AI Gateway"
sidebar_label: "TrendAI Guard"
description: "Integrate the TrendAI Vision One AI Guard API with LiteLLM to enforce content guardrails and PII redaction on LLM requests and responses."
---

# TrendAI Guard

<SinceVersion v="1.112.0" />

Integrate the TrendAI Vision One AI Guard API with LiteLLM to enforce content guardrails on large language model requests and responses.

## Prerequisites

### Obtain an API Key

1. In the Vision One console, navigate to **Workflow and Automation** > **Third-Party Integrations** > **LiteLLM**.
2. Click **Generate Token** to create an API key.

**Note:** The account used to generate the API key should be in the same V1 region where your LiteLLM deployment resides.

### Obtain the AI Guard base URL

On the LiteLLM third-party integrations page in Vision One, copy **Endpoint URL**.

## Quick start

### Example Configuration

Add the following to your `config.yaml` file:

```yaml
guardrails:
  - guardrail_name: "trendai-guard"
    litellm_params:
      guardrail: trendai                                       # Required
      mode: [pre_call, post_call]                              # Required
      api_base: https://api.xdr.trendmicro.com/v3.0/aiSecurity # Required; adjust URL for your deployment
      api_key: os.environ/TMV1_API_KEY                         # Required; set environment variable
      app_name: litellm                                        # Optional; customize for your application
      default_on: true                                         # Optional; enable by default
      fallback_on_error: block                                 # Optional; block requests on API errors
      timeout: 5.0                                             # Optional; request timeout in seconds
```

### Start LiteLLM Proxy

```bash
export TMV1_API_KEY="<your-api-key>"
export LITELLM_MASTER_KEY="sk-$(openssl rand -hex 32)"
litellm --config config.yaml
```

### Test the Guardrail

Send a request through the proxy:

```bash
curl -i http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "{{openai_small}}",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Requests that violate an active Vision One policy return HTTP `400` with the violation reason from TrendAI. When PII redaction is enabled in your policy, allowed prompts and non-streamed responses are redacted in place.

```json
{
  "error": {
    "message": "Blocked by Trend AI Guard. Security violation: <reason>",
    "type": "invalid_request_error",
    "param": null,
    "code": "400"
  }
}
```

You can also confirm that `trendai-guard` is registered under **Guardrails** in the [LiteLLM Admin UI](../ui.md) and test prompts directly in the [Test Playground](./test_playground.md).

## Parameters

### Required Parameters

| Parameter | Description | Use |
|-----------|-------------|-----|
| `guardrail` | Specifies the guardrail integration. | Set to `trendai`. |
| `mode` | Specifies when the guardrail runs. | Set to `[pre_call, post_call]` to scan prompts and responses. Also supports `during_call` and `logging_only`. |
| `api_base` | Base URL for the AI Guard API. | Example: `https://api.xdr.trendmicro.com/v3.0/aiSecurity`. Falls back to `TRENDAI_AI_GUARD_BASE_URL`. |
| `api_key` | API key for authenticating with the AI Guard API. | Set as `os.environ/TMV1_API_KEY` or via the `TMV1_API_KEY` environment variable. |

### Optional Parameters

| Parameter | Description | Use |
|-----------|-------------|-----|
| `app_name` | Application name for policy assignment and tracking in Vision One. | Falls back to `TMV1_APPLICATION_NAME`, then `litellm`. |
| `default_on` | Whether the guardrail runs on every request without explicit selection. | Default: `false`. |
| `fallback_on_error` | Policy for handling AI Guard API errors. | Specify `block` to reject with HTTP `503` or `allow` to permit requests. Default: `block`. |
| `timeout` | Timeout for AI Guard API requests, in seconds. | Default: `5.0`. |
| `streaming_buffer_until_moderated` | Buffer streamed `post_call` responses until moderation completes. | Set to `false` for incremental delivery. Default: `true`. |
| `response_content_chunk_size_bytes` | Target UTF-8 byte size per response scan window. | Default: `49500`. |
| `stream_overlap_size` | Character overlap between response scan windows. | Default: `256`. |

