import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Sensitive Data Routing

Reroute a request to an on-premise model when a guardrail detects sensitive data, instead of blocking or redacting it. This is a routing action available to any [custom guardrail](./custom_guardrail); it is configured with `on_sensitive_data: route` on the guardrail's `litellm_params`.

**When to use?** When sensitive prompts must be served by an on-premise model rather than a cloud provider, and the user workflow has to stay uninterrupted.

## Overview

| Property | Details |
|----------|---------|
| Description | A guardrail that detects sensitive data reroutes the request to an on-premise model. Once sensitive data appears in a session, every following turn in that session is also routed on-premise. |
| Configured on | Any `CustomGuardrail` subclass, via `on_sensitive_data`, `sensitive_data_route_to_model`, `sticky_session_routing` |
| Action | Reroute to an on-premise model (never blocks or redacts) |
| Supported Modes | `pre_call` |
| Performance | Runs locally, no external API calls beyond what your guardrail itself makes |

## How it works

Your guardrail runs in `pre_call`. When it detects sensitive data it calls `self.handle_sensitive_data_detection(request_data)`. With `on_sensitive_data: route` configured, LiteLLM rewrites the target model to your `sensitive_data_route_to_model` so the request is served on-premise. The prompt is sent through unchanged, so nothing is blocked or redacted and the conversation continues normally. With `on_sensitive_data: block` (the default), the same call blocks the request instead.

With `sticky_session_routing` enabled (the default), the first time sensitive data is seen in a session the session is pinned to the on-premise model. Every later turn in that session is then routed on-premise as well, even turns that contain no sensitive data, so a conversation that once touched sensitive data never leaves the on-premise model. Pinning relies on a stable session id sent by the client (see [Session stickiness](#session-stickiness)).

`sensitive_data_route_to_model` is just a model group in your `model_list`. Point it at whatever on-premise deployment you run (vLLM, Ollama, a self-hosted OpenAI-compatible endpoint, and so on).

## Quick Start

### Step 1: Write a guardrail that calls `handle_sensitive_data_detection`

Create a file called `custom_guardrail.py`:

```python showLineNumbers title="custom_guardrail.py"
import re
from typing import TYPE_CHECKING, Literal, Optional

from litellm.integrations.custom_guardrail import CustomGuardrail
from litellm.types.utils import GenericGuardrailAPIInputs

if TYPE_CHECKING:
    from litellm.litellm_core_utils.litellm_logging import Logging as LiteLLMLoggingObj

SSN_PATTERN = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")


class sensitiveDataGuardrail(CustomGuardrail):
    async def apply_guardrail(
        self,
        inputs: GenericGuardrailAPIInputs,
        request_data: dict,
        input_type: Literal["request", "response"],
        logging_obj: Optional["LiteLLMLoggingObj"] = None,
    ) -> GenericGuardrailAPIInputs:
        for text in inputs.get("texts") or []:
            if SSN_PATTERN.search(text):
                # routes when on_sensitive_data=route, blocks otherwise
                self.handle_sensitive_data_detection(
                    request_data=request_data,
                    detection_info={"entity": "us_ssn"},
                )
        return inputs
```

### Step 2: Define the guardrail and an on-premise model in config.yaml

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
      guardrail: custom_guardrail.sensitiveDataGuardrail
      mode: "pre_call"
      default_on: true

      # Route instead of block when sensitive data is detected
      on_sensitive_data: route

      # The model group (from model_list above) to route sensitive requests to
      sensitive_data_route_to_model: "on-prem-model"

      # Keep the whole session on-premise once sensitive data is seen
      sticky_session_routing: true
```

### Step 3: Start the proxy

```bash
litellm --config config.yaml --detailed_debug
```

### Step 4: Send a clean request (served by the cloud model)

```bash showLineNumbers
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cloud-model",
    "messages": [{"role": "user", "content": "What is the capital of France?"}],
    "metadata": {"session_id": "abc-123"}
  }'
```

The response `model` field reflects the cloud model.

### Step 5: Send a request with sensitive data (rerouted on-premise)

```bash showLineNumbers
curl http://localhost:4000/v1/chat/completions \
  -H "Authorization: Bearer sk-1234" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cloud-model",
    "messages": [{"role": "user", "content": "My SSN is 123-45-6789, summarize my record"}],
    "metadata": {"session_id": "abc-123"}
  }'
```

The request is served by `on-prem-model`. Because `sticky_session_routing` is on and the same `session_id` is used, every later request on `abc-123` is also served on-premise, even if it contains no sensitive data.

## Configuration

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `on_sensitive_data` | `block` \| `route` | `block` | Action taken by `handle_sensitive_data_detection`. `route` reroutes the request to `sensitive_data_route_to_model`; `block` raises a guardrail exception |
| `sensitive_data_route_to_model` | string | none | Model group (from `model_list`) to route sensitive requests to. Required when `on_sensitive_data` is `route` |
| `sticky_session_routing` | bool | `true` | Keep the whole session on-premise after sensitive data is first detected |

How long a pinned session stays on-premise is controlled by the `LITELLM_SENSITIVE_ROUTING_TTL` environment variable (seconds, default `3600`), not by a per-guardrail param.

## Session stickiness

Stickiness pins a session to the on-premise model after the first detection. The session is identified by `litellm_session_id`, `metadata.session_id`, or `litellm_metadata.session_id` on the request, so the client must send a stable id across turns for stickiness to apply.

When a Redis cache is configured on the proxy, the pin is shared across all proxy workers and instances, so stickiness holds for the whole deployment and not just a single worker.

If no session id is sent, routing is not possible and `handle_sensitive_data_detection` falls back to blocking the request; turns without a session id are never rerouted or pinned.
