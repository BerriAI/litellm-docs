# TinyFish Agent

Call the [TinyFish Agent API](https://docs.tinyfish.ai/agent-api) (goal-based web automation) via LiteLLM's A2A Gateway.

| Property | Details |
|----------|---------|
| Description | TinyFish runs a natural-language goal on a real website in a cloud browser and returns the result as JSON. LiteLLM submits runs, polls them to completion, and prices spend from the run's actual step count. |
| Provider Route on LiteLLM | A2A Gateway (`custom_llm_provider: tinyfish`) |
| Supported Endpoints | `/a2a/{agent_name}/message/send`, `/a2a/{agent_name}` (`message/stream`) |
| Provider Doc | [TinyFish Agent API ↗](https://docs.tinyfish.ai/agent-api) |

## Quick Start

### 1. Get a TinyFish API key

Create a key at [agent.tinyfish.ai/api-keys](https://agent.tinyfish.ai/api-keys) and export it as `TINYFISH_API_KEY`.

### 2. Register the agent on the proxy

```yaml title="config.yaml"
agents:
  - agent_name: tinyfish-agent
    agent_card_params:
      name: tinyfish-agent
      description: TinyFish goal-based web automation
      url: https://agent.tinyfish.ai
      capabilities: {streaming: true}
    litellm_params:
      custom_llm_provider: tinyfish
      api_key: os.environ/TINYFISH_API_KEY
      cost_per_step: 0.016   # spend logged per run = num_of_steps x this rate
```

```bash
litellm --config config.yaml
```

### 3. Run a web automation

The message's text part is the TinyFish `goal`. The target `url` (required) and any other [TinyFish request fields](https://docs.tinyfish.ai/agent-api/reference) (`output_schema`, `browser_profile`, `proxy_config`, `agent_config`, ...) go in the message's `metadata` and are forwarded as-is.

```bash
curl -s http://localhost:4000/a2a/tinyfish-agent/message/send \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "messageId": "m1",
        "parts": [{"kind": "text", "text": "Extract the first 2 product names and prices. Return JSON."}],
        "metadata": {"url": "https://scrapeme.live/shop"}
      }
    }
  }'
```

The response carries the run result as a structured `data` part plus a JSON text part, and `metadata` with `tinyfish_run_id`, `tinyfish_status`, and `tinyfish_num_of_steps` for correlating with TinyFish's own logs.

As a convenience, a single text part that is a JSON object with a `goal` key is used as the TinyFish request body directly:

```json
{"kind": "text", "text": "{\"goal\": \"Extract the page title\", \"url\": \"https://example.com\"}"}
```

### Streaming

Send `method: message/stream` to `POST /a2a/tinyfish-agent` to get live progress as A2A stream events: the run's browser actions arrive as `status-update` events (including a watch-live browser URL), the result as an `artifact-update`, then a final `completed` or `failed` status.

## Spend tracking

Each run is spend-logged against the calling key and team. With `cost_per_step` set, spend is the run's actual `num_of_steps` times that rate (TinyFish's published rate is $0.016 per step). Alternatively set `cost_per_query` for a flat per-run rate. With neither set, runs log $0.

## litellm_params

| Param | Required | Description |
|-------|----------|-------------|
| `custom_llm_provider` | Yes | Must be `tinyfish` |
| `api_key` | No | TinyFish API key; falls back to the `TINYFISH_API_KEY` environment variable |
| `cost_per_step` | No | USD logged per run step (`num_of_steps x cost_per_step`) |
| `cost_per_query` | No | Flat USD per run, used when `cost_per_step` is not set |
| `polling_timeout_seconds` | No | Max seconds to poll a run before it is cancelled and the request errors (default 600) |
| `default_request_params` | No | TinyFish request fields merged under every caller request (e.g. pin `browser_profile: stealth`) |
| `allow_authenticated_runs` | No | Allow callers to pass `use_vault`, `credential_item_ids`, `use_profile`, `profile_id`. Off by default because every caller shares the agent's TinyFish account |

The upstream base URL comes from `agent_card_params.url`, or the `TINYFISH_AGENT_API_BASE` environment variable, and defaults to `https://agent.tinyfish.ai`.
