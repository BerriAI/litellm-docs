# Sensitive Data Routing

Sensitive data routing lets a guardrail reroute a request to another model group (typically an on-premise model) instead of blocking it when the guardrail detects sensitive data. There is no standalone `sensitive_data_routing` guardrail type; routing is a set of params you add to a [custom guardrail](./custom_guardrail) whose detection logic calls `handle_sensitive_data_detection`.

**When to use?** When sensitive prompts must be served by an on-premise model rather than a cloud provider, and the user workflow has to stay uninterrupted.

## Overview

| Property | Details |
|----------|---------|
| Description | A custom guardrail detects sensitive data and the proxy reroutes the request to `sensitive_data_route_to_model`. With sticky routing, every later turn in the same session is also routed there. |
| Guardrail Name | Any custom guardrail class (`guardrail: <module>.<Class>`) |
| Action | Reroute when a session id is present; block with HTTP 400 when it is missing |
| Supported Modes | `pre_call` |

Built-in detection guardrails such as the [LiteLLM Content Filter](./litellm_content_filter) do not act on `on_sensitive_data: route` yet; they keep their own block or mask behavior.

## How it works

The guardrail runs before model selection. When your detection logic finds sensitive data it calls `self.handle_sensitive_data_detection(request_data=data)`. If the guardrail is configured with `on_sensitive_data: route`, the proxy rewrites the target model to `sensitive_data_route_to_model` and sends the prompt through unchanged. Otherwise the request is blocked.

Routing needs a session id, read from `litellm_session_id`, `metadata.session_id`, or `litellm_metadata.session_id`. A request that contains sensitive data but carries no session id is not routed; it is blocked with HTTP 400 and the message `Sensitive data detected by <guardrail_name> (routing skipped: request has no session_id)`.

With `sticky_session_routing` enabled (the default), the first detection pins the session to the routed model, so every later turn in that session is routed there as well, even turns that contain no sensitive data.

`sensitive_data_route_to_model` is just a model group in your `model_list`. Point it at whatever on-premise deployment you run (vLLM, Ollama, a self-hosted OpenAI-compatible endpoint, and so on).

## Quick Start

### Step 1: Write the detection guardrail

```python showLineNumbers title="sensitive_router.py"
import re

from litellm.integrations.custom_guardrail import CustomGuardrail

SSN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")


class SensitiveRouter(CustomGuardrail):
    async def async_pre_call_hook(self, user_api_key_dict, cache, data, call_type):
        for message in data.get("messages") or []:
            content = message.get("content")
            if isinstance(content, str) and SSN.search(content):
                self.handle_sensitive_data_detection(request_data=data, detection_info={"entity": "us_ssn"})
        return data
```

`detection_info` is stored in request metadata and logs, so never put the raw sensitive value in it.

### Step 2: Define the guardrail and an on-premise model in config.yaml

Place `sensitive_router.py` next to `config.yaml`.

```yaml showLineNumbers title="config.yaml"
model_list:
  - model_name: cloud-model
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

  - model_name: on-prem-model
    litellm_params:
      model: hosted_vllm/meta-llama/Llama-3.1-8B-Instruct
      api_base: http://your-on-prem-host:8000/v1

guardrails:
  - guardrail_name: "sensitive-data-routing"
    litellm_params:
      guardrail: sensitive_router.SensitiveRouter
      mode: "pre_call"
      default_on: true

      # Route instead of block when sensitive data is detected
      on_sensitive_data: "route"
      # The model group (from model_list above) to route sensitive requests to
      sensitive_data_route_to_model: "on-prem-model"
      # Keep the whole session on the routed model once sensitive data is seen
      sticky_session_routing: true
```

### Step 3: Start the proxy

```bash
litellm --config config.yaml --detailed_debug
```

### Step 4: Send a clean request (served by the cloud model)

```bash showLineNumbers
curl -i http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cloud-model",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "metadata": {"session_id": "abc-123"}
  }'
```

The `x-litellm-model-group` response header is `cloud-model`. The response body `model` field echoes the requested model name, so use the header to see which model group served the request.

### Step 5: Send a request with sensitive data (rerouted on-premise)

```bash showLineNumbers
curl -i http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cloud-model",
    "messages": [{"role": "user", "content": "My SSN is 123-45-6789, summarize my record"}],
    "metadata": {"session_id": "abc-123"}
  }'
```

The request is served by `on-prem-model` and `x-litellm-model-group` is `on-prem-model`. Because `sticky_session_routing` is on and the same `session_id` is used, every later request on `abc-123` is also served on-premise, even if it contains no sensitive data.

## Configuration

These params go under the guardrail's `litellm_params`.

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `on_sensitive_data` | `block` or `route` | `block` behavior when unset | `route` reroutes on detection, `block` blocks |
| `sensitive_data_route_to_model` | string | none | Model group (from `model_list`) to route sensitive requests to. Required when `on_sensitive_data` is `route` |
| `sticky_session_routing` | bool | `true` | Keep the whole session on the routed model after sensitive data is first detected |

How long a session stays pinned is set with the `LITELLM_SENSITIVE_ROUTING_TTL` environment variable, in seconds, default `3600`.

## Session stickiness

Stickiness pins a session to the routed model after the first detection. The session is identified by `litellm_session_id`, `metadata.session_id`, or `litellm_metadata.session_id` on the request, and the pin is scoped to the calling key, so the client must send a stable id across turns with the same key for stickiness to apply.

When a Redis cache is configured on the proxy, the pin is shared across all proxy workers and instances, so stickiness holds for the whole deployment and not just a single worker.

If no session id is sent, a request containing sensitive data is blocked with HTTP 400 rather than routed. Requests without sensitive data and without a session id go to the requested model as usual
