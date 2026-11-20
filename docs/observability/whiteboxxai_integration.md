---
title: "WhiteBoxXAI Logging for LiteLLM AI Gateway"
sidebar_label: "WhiteBoxXAI"
description: "Send LiteLLM request logs, token counts and costs to WhiteBoxXAI from the Python SDK or AI Gateway for AI governance and audit evidence."
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# WhiteBoxXAI

Send LiteLLM request logs, token counts and costs to WhiteBoxXAI for AI governance, compliance and observability.

[WhiteBoxXAI](https://whiteboxxai.com/) is an AI governance and observability platform that turns production AI traffic into compliance evidence. The built-in `whiteboxxai` callback streams every LiteLLM request, including model, cost, latency, prompts, responses and attribution metadata, to WhiteBoxXAI.

:::info
We want to learn how we can make the callbacks better! Meet the LiteLLM [founders](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version) or
join our [discord](https://discord.gg/wuPM9dRgDw)
:::

## Pre-Requisites

1. Log in to your [WhiteBoxXAI dashboard](https://whiteboxxai.com/) and open **Settings** > **Integrations** > **LLM Gateway (LiteLLM)**.
2. Click **Connect Gateway** to generate a gateway token that starts with `wbx_lgw_`.
3. Copy your ingest URL. Shared cloud uses `https://api.whiteboxxai.com/api/v1/llm/gateways/litellm/ingest`. Business cloud silos use `https://<tenant-subdomain>.whiteboxxai.com/api/v1/llm/gateways/litellm/ingest`.

```shell
uv add litellm
```

## Quick Start

Set `WHITEBOXXAI_INGEST_URL` and `WHITEBOXXAI_API_KEY`, then add `whiteboxxai` to your callbacks.

<Tabs>
<TabItem value="python" label="SDK">

```python
import os
import litellm

os.environ["WHITEBOXXAI_INGEST_URL"] = "https://api.whiteboxxai.com/api/v1/llm/gateways/litellm/ingest"
os.environ["WHITEBOXXAI_API_KEY"] = "wbx_lgw_your_token_here"

# LLM API Keys
os.environ["OPENAI_API_KEY"] = ""

litellm.callbacks = ["whiteboxxai"]

response = litellm.completion(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello, how are you?"}],
)
```

</TabItem>
<TabItem value="proxy" label="AI Gateway">

1. Add `whiteboxxai` to your `config.yaml`.

```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: ["whiteboxxai"]

environment_variables:
  WHITEBOXXAI_INGEST_URL: "https://api.whiteboxxai.com/api/v1/llm/gateways/litellm/ingest"
  WHITEBOXXAI_API_KEY: "wbx_lgw_your_token_here"
```

2. Start the proxy.

```bash
litellm --config config.yaml
```

3. Send a test request.

```bash
curl -X POST 'http://0.0.0.0:4000/chat/completions' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer sk-1234' \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

</TabItem>
</Tabs>

By default a caller can skip logging for a request by passing `no-log=True` in the request body. If WhiteBoxXAI is your audit trail, set `global_disable_no_log_param: true` under `litellm_settings` so every request is logged. See [Turn off all tracking/logging](../proxy/logging.md#turn-off-all-trackinglogging).

## Retries and Timeouts

The built-in `whiteboxxai` callback makes one attempt per batch. To retry failed batches with exponential backoff, define the callback yourself with `callback_settings`. This overrides the built-in entry of the same name.

```yaml
litellm_settings:
  callbacks: ["whiteboxxai"]

callback_settings:
  whiteboxxai:
    callback_type: generic_api
    endpoint: https://api.whiteboxxai.com/api/v1/llm/gateways/litellm/ingest
    headers:
      Authorization: Bearer wbx_lgw_your_token_here
    event_types: ["llm_api_success", "llm_api_failure"]
    max_retries: 3
    retry_delay: 2
    timeout: 30
```

`retry_delay` is the first delay in seconds and doubles on each retry. See [Generic API Callback](./generic_api.md) for the other settings.

## What Data is Logged?

LiteLLM sends the [Standard Logging Payload](../proxy/logging_spec.md) for successful calls (`llm_api_success`) and failed calls (`llm_api_failure`). The payload includes the model, input messages, response or error, token counts, latency, the calculated response cost, and metadata such as team, key alias, user ID and tags. WhiteBoxXAI uses the metadata to attribute traffic to registered AI systems.

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `WHITEBOXXAI_INGEST_URL` | Full URL of the WhiteBoxXAI ingest endpoint | Yes |
| `WHITEBOXXAI_API_KEY` | Gateway token that starts with `wbx_lgw_`, sent as a Bearer token | Yes |
