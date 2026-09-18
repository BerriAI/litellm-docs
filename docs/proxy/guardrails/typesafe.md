import Image from '@theme/IdealImage';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# TypeSafe Compaction

AI agents often carry earlier search results, file contents, and other tool output into every new request. As a conversation grows, these results consume input tokens even when they are no longer relevant to the current task.

The [TypeSafe](https://typesafe.ai) guardrail reduces this repeated context. It uses TypeSafe's Jev model to identify tool results that are no longer needed and replaces them with a short removal notice before LiteLLM sends the request to the LLM. This can reduce input token usage and the cost of long agent conversations.

Use this guide to configure the guardrail, test it with a complete Chat Completions request, and enable it for an application's virtual key.

## Prerequisites

- A LiteLLM Proxy deployment that includes the `typesafe` guardrail.
- A TypeSafe API key and outbound access from the proxy to `https://api.typesafe.ai`.
- A configured LLM and its provider credentials. The configuration example uses OpenAI.
- For Admin UI setup and virtual keys, a proxy connected to a database.

LiteLLM sends the system prompt, latest user message, and tool exchanges selected for evaluation to TypeSafe. The guardrail changes tool result content in the request; system and user messages remain unchanged.

## Set up TypeSafe

Choose one setup method. Both register a guardrail named `typesafe-compaction` that you can enable for individual requests or virtual keys.

<Tabs>
<TabItem value="config" label="Configuration file" default>

### 1. Set your API keys

Set these environment variables on the machine or container running the proxy. Replace the example values with your credentials.

```shell
export TYPESAFE_API_KEY="your-typesafe-api-key"
export OPENAI_API_KEY="your-openai-api-key"
export LITELLM_MASTER_KEY="sk-your-litellm-master-key"
```

### 2. Configure the proxy

Save the following as `config.yaml`. For an existing deployment, add the `guardrails` entry to your configuration and keep your existing models and authentication settings.

```yaml title="config.yaml"
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY

guardrails:
  - guardrail_name: typesafe-compaction
    litellm_params:
      guardrail: typesafe
      mode: pre_call
      api_key: os.environ/TYPESAFE_API_KEY
```

`pre_call` applies compaction before the request reaches the LLM. This configuration leaves compaction off until you enable it for a request or virtual key.

### 3. Start the proxy

```shell
litellm --config config.yaml
```

Restart an existing deployment to load the updated configuration.

</TabItem>
<TabItem value="ui" label="Admin UI">

Your proxy must be connected to a database with `store_model_in_db: true` under `general_settings`.

### 1. Add the guardrail

Open your proxy's **Admin UI → Guardrails → Add New Guardrail → Add Provider Guardrail**.

Set **Guardrail Name** to `typesafe-compaction`, select **TypeSafe (Jev) Compaction** as the provider, and use `pre_call` mode. Leave **Always On** set to **No** to enable compaction only for selected requests or keys.

<Image img={require('../../../img/typesafe_guardrail_provider.png')} />

### 2. Enter your TypeSafe credentials

Enter your TypeSafe API key. To read the key from the proxy's environment, enter `os.environ/TYPESAFE_API_KEY`.

Keep the default API base URL, model, and failure behavior, then click **Next**.

<Image img={require('../../../img/typesafe_guardrail_settings.png')} />

### 3. Create the guardrail

Leave the optional parameters at their defaults and click **Create Guardrail**. Confirm that `typesafe-compaction` appears in the guardrail list.

</TabItem>
</Tabs>

## Try an example request

This example represents an operations assistant that has retrieved a weather report, a stock quote, and a deployment runbook. The user's latest question asks only about the runbook. Compaction can remove the earlier weather and stock results from the request sent to the LLM.

Set your proxy URL and LiteLLM API key in the terminal where you will send the request. Use a valid virtual key for your deployment. For a local test with the configuration above, you can use the master key you configured.

```shell
export LITELLM_PROXY_URL="http://localhost:4000"
export LITELLM_API_KEY="sk-your-litellm-key"
```

Save the following request as `payload.json`. If you use an existing deployment, replace the `model` value with one available to your key. The `guardrails` field enables TypeSafe for this request.

<details>
<summary>Complete example: payload.json</summary>

```json title="payload.json"
{
  "model": "{{openai_small}}",
  "guardrails": [
    "typesafe-compaction"
  ],
  "tool_choice": "none",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful operations assistant. Answer the latest user question using the relevant tool result. Be concise and do not invent values."
    },
    {
      "role": "user",
      "content": "First check the weather in Lisbon and a stock quote, then read the deployment runbook. I will ask a follow-up about the runbook."
    },
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "call_weather",
          "type": "function",
          "function": {
            "name": "get_weather",
            "arguments": "{\"city\":\"Lisbon\"}"
          }
        }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "call_weather",
      "content": "Lisbon weather station report: temperature 23 C, feels like 24 C, humidity 61 percent, wind from the northwest at 14 km/h. Skies are mostly clear with scattered coastal clouds. The afternoon forecast expects a high of 26 C and less than 5 percent chance of rain. Sunset is at 19:42 local time. Visibility is 12 km and barometric pressure is steady at 1017 hPa. Outdoor walking conditions are comfortable; bring a light jacket for the evening waterfront breeze."
    },
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "call_stock",
          "type": "function",
          "function": {
            "name": "get_stock_quote",
            "arguments": "{\"symbol\":\"ACME\"}"
          }
        }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "call_stock",
      "content": "Market quote for synthetic ticker ACME: last trade 142.35 USD, change +1.12 USD, daily change +0.79 percent. The session opened at 141.20, reached a high of 143.10 and a low of 140.85. Trading volume is 2,430,000 shares, with a bid of 142.34 and ask of 142.36. The prior close was 141.23. The 52-week trading range is 112.40 to 156.80. This delayed quote is intended for a market overview only and does not contain infrastructure settings or deployment instructions."
    },
    {
      "role": "assistant",
      "content": null,
      "tool_calls": [
        {
          "id": "call_runbook",
          "type": "function",
          "function": {
            "name": "read_file",
            "arguments": "{\"path\":\"/runbooks/deployment.md\"}"
          }
        }
      ]
    },
    {
      "role": "tool",
      "tool_call_id": "call_runbook",
      "content": "Deployment runbook, revision 12. The production application is deployed in AWS region eu-west-1. Operational request logs must be retained for 30 days and then deleted by the lifecycle policy. Deployments use a blue-green rollout with readiness checks before traffic switches. On-call engineers verify health metrics and error rates during the first fifteen minutes. Roll back to the previous image if the error budget alert fires. Database backups run daily and are verified separately."
    },
    {
      "role": "user",
      "content": "Ignore the earlier weather and stock quote. According only to the deployment runbook, which AWS region is production in and how many days are operational request logs retained? Answer in one sentence."
    }
  ],
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "get_weather",
        "description": "Get a city weather report",
        "parameters": {
          "type": "object",
          "properties": {
            "city": {
              "type": "string"
            }
          },
          "required": [
            "city"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "get_stock_quote",
        "description": "Get a market quote",
        "parameters": {
          "type": "object",
          "properties": {
            "symbol": {
              "type": "string"
            }
          },
          "required": [
            "symbol"
          ]
        }
      }
    },
    {
      "type": "function",
      "function": {
        "name": "read_file",
        "description": "Read an operations runbook",
        "parameters": {
          "type": "object",
          "properties": {
            "path": {
              "type": "string"
            }
          },
          "required": [
            "path"
          ]
        }
      }
    }
  ]
}
```

</details>

Send the request:

```shell
curl "$LITELLM_PROXY_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  --data-binary @payload.json
```

The response should identify `eu-west-1` as the production region and `30 days` as the log retention period. The runbook is preserved in this example, while the weather and stock results are eligible for removal.

## Verify the result

In the Admin UI, open **Logs** and select the request. Under **Guardrails & Policy Compliance**, find `typesafe-compaction`. When compaction removes results, **Raw Guardrail Response** includes:

| Field | What it tells you |
| --- | --- |
| `exchanges_evaluated` | Number of tool exchanges evaluated by TypeSafe. |
| `exchanges_dropped` | Number of exchanges whose tool results were replaced. |
| `chars_removed` | Approximate reduction in tool result characters. |

A tool exchange consists of an assistant tool call and its corresponding tool results.

<Image img={require('../../../img/typesafe_logs_counters.png')} />

To compare input token usage, send the same payload again without the `guardrails` field, using a key with no guardrail attached and leaving `default_on` disabled.

In the example run shown below, prompt tokens decreased from **604 to 406**, approximately **33%**, and the answer was unchanged. The total token counts also include the 25-token response. Results vary with conversation history and TypeSafe's relevance evaluation.

<Image img={require('../../../img/typesafe_logs_token_comparison.png')} />

## Enable compaction for an application

Attach the guardrail to a virtual key to apply compaction without adding a `guardrails` field to each request. Set `LITELLM_MASTER_KEY` to your deployment's administrator key and replace the model with one configured on your proxy, then create the virtual key:

```shell
curl "$LITELLM_PROXY_URL/key/generate" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "key_alias": "operations-agent",
    "models": ["{{openai_small}}"],
    "guardrails": ["typesafe-compaction"]
  }'
```

Configure your application to use the returned virtual key. LiteLLM then evaluates eligible tool results on requests made with that key. To apply compaction by default across the proxy, set `default_on: true` under the guardrail's `litellm_params`.

## Configuration reference

These settings belong under the guardrail's `litellm_params`.

| Setting | Default | Description |
| --- | --- | --- |
| `guardrail` | Required | Set to `typesafe`. |
| `mode` | Required | Set to `pre_call`. |
| `api_key` | `TYPESAFE_API_KEY` environment variable | Your TypeSafe API key. Required in the configuration or environment. |
| `api_base` | `https://api.typesafe.ai` | TypeSafe API base URL. Also configurable with `TYPESAFE_API_BASE`. |
| `model` | `jev-latest` | TypeSafe model used to evaluate relevance. Your application's LLM is configured separately. |
| `default_on` | `false` | Apply compaction by default without attaching the guardrail to a key or request. |
| `unreachable_fallback` | `fail_open` | On a TypeSafe service failure, `fail_open` forwards the request without compaction. `fail_closed` returns HTTP 502. |

To adjust which results are evaluated and removed, add `optional_params`:

```yaml title="config.yaml"
guardrails:
  - guardrail_name: typesafe-compaction
    litellm_params:
      guardrail: typesafe
      mode: pre_call
      api_key: os.environ/TYPESAFE_API_KEY
      optional_params:
        relevance_threshold: 0.2
        min_chars_to_evaluate: 200
        max_result_chars_in_state: 4000
```

| Setting | Default | Description |
| --- | --- | --- |
| `relevance_threshold` | `0.2` | Remove results when TypeSafe's relevance score falls below this value. Accepts values from 0 to 1; higher values allow more results to be removed. |
| `min_chars_to_evaluate` | `200` | Skip tool exchanges whose combined result text is shorter than this number of characters. |
| `max_result_chars_in_state` | `4000` | Maximum characters of combined result text sent to TypeSafe per exchange. This does not shorten results retained in the LLM request. |

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| No reduction in token usage | The request needs earlier, completed tool exchanges that are eligible for evaluation. Plain text conversations have no tool results to compact. Results shorter than `min_chars_to_evaluate` are skipped, and TypeSafe may determine that all evaluated results are still relevant. |
| No compaction counters in Logs | Counters are recorded only when results are removed. Confirm that the guardrail is enabled for the request or key. |
| Requests continue without compaction during a TypeSafe outage | This is the default `fail_open` behavior. Check proxy logs for the service error. |
| Requests return HTTP 502 during a TypeSafe outage | Check whether `unreachable_fallback` is set to `fail_closed`. |
