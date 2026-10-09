---
title: Moyai
description: Connect Moyai, the open source self-hosted coding agent, to your LiteLLM AI Gateway for model access, budgets, and spend tracking.
---

import Image from '@theme/IdealImage';

# Moyai

[Moyai](https://github.com/BerriAI/moyai) is an open source coding agent that you host on your infrastructure. You give it a task in the browser or in Slack. Moyai edits the code, runs the tests, and opens a pull request for review.

The LiteLLM team built Moyai as its internal coding agent. The team gives all its code tasks to Moyai. Moyai also decreases the cost of external tools. Before Moyai, the team used Devin. For the same work in 31 days, Devin cost $101,872 and Moyai cost approximately $21,700, 79% less. For the full story, refer to [Moyai is now open source](/blog/moyai-open-source).

Moyai sends all its model requests through a LiteLLM AI Gateway. The provider API keys stay on the gateway, and the agent sandbox does not get them.

**Source code:** [github.com/BerriAI/moyai](https://github.com/BerriAI/moyai)

<Image
  img={require('../../img/moyai_hero.png')}
  alt="Moyai, an open source cloud agent, with the harnesses and providers that it supports"
  style={{width: '100%', display: 'block', margin: '1.5rem 0'}}
/>

## How Moyai uses LiteLLM

Moyai runs each task with an agent harness. Each harness sends its requests to a different API on the gateway:

| Harness | Gateway API |
|---|---|
| Claude Agent SDK (default) | `/v1/messages` |
| Codex | `/v1/responses` |
| Hermes, OpenCode, Deep Agents, Tool Loop | `/v1/chat/completions` |

Moyai sends each request in the API format of its harness, with no changes. LiteLLM converts the request to the format of the model provider. You can use a model from a different provider with each harness. For example, the Claude Agent SDK harness can use an OpenAI model. The model must support tool calls.

Moyai sends all requests with one virtual key. Moyai records the spend for each teammate. It reads the cost of each response from the `x-litellm-response-cost` header that the gateway returns.

## Prerequisites

- A LiteLLM AI Gateway at an HTTPS address that Moyai can connect to. Moyai runs in the cloud (on Modal by default). A `localhost` address does not work.
- A proxy admin key for the gateway.
- A Moyai installation. Refer to [Getting started](https://github.com/BerriAI/moyai#getting-started) in the Moyai repository.

## Step 1: Add the models

Add the models that Moyai will use to the gateway. The `model_name` of each model is the alias that Moyai sends.

```yaml title="config.yaml"
model_list:
  - model_name: openai/gpt-6-astra
    litellm_params:
      model: openai/gpt-6-astra
      api_key: os.environ/OPENAI_API_KEY
  - model_name: claude-sonnet-5-5
    litellm_params:
      model: anthropic/claude-sonnet-5-5
      api_key: os.environ/ANTHROPIC_API_KEY
```

The default model of Moyai is `openai/gpt-6-astra`. If you use a different alias, set `AGENT_MODEL` to that alias in Step 3.

## Step 2: Create a virtual key for Moyai

Create one virtual key for Moyai. Give the key access to the models from Step 1, and set a budget.

```bash
curl -X POST "$PROXY_BASE_URL/key/generate" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key_alias": "moyai",
    "models": ["openai/gpt-6-astra", "claude-sonnet-5-5"],
    "max_budget": 100
  }'
```

The gateway stops the requests on this key when its spend gets to `max_budget`. The Moyai documentation recommends a key with a budget, because limits on requests and output do not limit the cost.

## Step 3: Set the gateway in Moyai

Add these values to the `.env` file of Moyai:

```dotenv
LITELLM_API_BASE=https://your-gateway.example.com/v1
LITELLM_API_KEY=sk-...   # the virtual key from Step 2
AGENT_MODEL=openai/gpt-6-astra
```

Make sure that `LITELLM_API_BASE` ends in `/v1`. Do not add `/messages` to it. Moyai adds `/messages`, `/responses`, or `/chat/completions` for each request.

Then deploy Moyai again. Refer to [Deploy and sign in](https://github.com/BerriAI/moyai#3-deploy-and-sign-in).

## Step 4: Do a test of the connection

Send a request in the same format as the Claude Agent SDK harness of Moyai:

```bash
curl -i -X POST "https://your-gateway.example.com/v1/messages" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "openai/gpt-6-astra",
    "max_tokens": 256,
    "messages": [{"role": "user", "content": "hello"}]
  }'
```

The gateway returns `HTTP/1.1 200 OK` and an `x-litellm-response-cost` header. Moyai uses this header to record the spend.

## Track spend

Moyai administrators can see the cost for each user, session, and model in **Settings** > **Spend**. These values come from the gateway.

On the gateway, all Moyai requests use the `moyai` virtual key. To see them, open **Logs** in the Admin UI. Click **Filters**, and set **Key Alias** to `moyai`.

<Image
  img={require('../../img/moyai_gateway_logs.png')}
  dark={require('../../img/moyai_gateway_logs_dark.png')}
  alt="Request Logs in the LiteLLM Admin UI, filtered to the moyai key alias"
  style={{width: '100%', display: 'block', margin: '1.5rem 0'}}
/>

Moyai also sends its request ID in the spend log metadata:

```json
"spend_logs_metadata": {"moyai_request_id": "<Moyai request ID>"}
```

Moyai sends the same ID in the `x-litellm-call-id` header. Use this ID to find a Moyai request in the gateway logs.

## Troubleshooting

| Error from the gateway | Cause | Fix |
|---|---|---|
| `401` | The virtual key is not correct. | Set `LITELLM_API_KEY` to the key from Step 2. |
| `403` `The requested model ... is not available for this API key` | The key does not have access to the model. | Add the model alias to the `models` of the key. |
| `404` | `LITELLM_API_BASE` is not correct. | Make sure that the value ends in `/v1`, without `/messages`. |
| `422` `Budget has been exceeded` | The key spent its `max_budget`. | Increase the budget of the key. |
| Moyai cannot connect to the gateway | Moyai cannot get to the gateway address. | Use an HTTPS address that Moyai can connect to from the cloud. |

The gateway examines the budget before each request. The last request before the stop can make the spend go above `max_budget`.

## More information

The Moyai repository has the full guides for [setup](https://github.com/BerriAI/moyai/blob/main/docs/getting-started.md), [harnesses](https://github.com/BerriAI/moyai/blob/main/docs/harnesses.md), [Slack](https://github.com/BerriAI/moyai/blob/main/docs/slack.md), [deployment](https://github.com/BerriAI/moyai/blob/main/docs/deployment.md), and [costs](https://github.com/BerriAI/moyai/blob/main/docs/costs.md).
