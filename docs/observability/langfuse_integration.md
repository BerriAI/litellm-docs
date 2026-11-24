---
title: "Langfuse Tracing for LiteLLM: Setup"
sidebar_label: "Langfuse"
description: "Send LiteLLM traces to Langfuse from the Python SDK or AI Gateway, set trace IDs, user IDs, tags and metadata per request, and redact messages."
---
import Image from '@theme/IdealImage';

# Langfuse

## What is Langfuse?

Langfuse ([GitHub](https://github.com/langfuse/langfuse)) is an open source LLM engineering platform for model [tracing](https://langfuse.com/docs/tracing), [prompt management](https://langfuse.com/docs/prompts/get-started) and application [evaluation](https://langfuse.com/docs/scores/overview). It's a platform that enables teams to collaboratively debug, analyse and iterate on their LLM applications. 


Example trace in Langfuse using multiple models via LiteLLM:
<Image img={require('../../img/langfuse-example-trace-multiple-models-min.png')} />


:::tip[Recommended: Use OpenTelemetry v2]

For Langfuse v3 and v4 we'd recommend using the `langfuse_otel` preset as per the [OpenTelemetry v2 guide](./opentelemetry_v2#2-send-traces-to-a-specific-tool-presets). That gives you better span quality, lower latency and native OpenTelemetry semantics.

Moving from the SDK based `langfuse` callback? Read the [Langfuse SDK to OpenTelemetry v2 migration guide](./langfuse_to_otel_v2_migration) first on ingestion costs, server compatibility, content capture and metadata changes. Use `llm_only` unless you specifically need the full request tree in Langfuse.

The SDK callback below (`langfuse`) is SDK v4 of the Langfuse Python SDK (`langfuse>=4.7,<5`). It pushes traces via LiteLLM's own OpenTelemetry pipeline to Langfuse's OTLP endpoint so they appear in near real time and makes use of the SDK's REST client only for prompt management and credential checks. Batch size and prompt cache TTL are set via `LANGFUSE_FLUSH_AT` and `LANGFUSE_PROMPT_CACHE_DEFAULT_TTL_SECONDS` (see [config settings](../proxy/config_settings)).

Self-hosted Langfuse must be 3.63.0 or later for SDK v4 (see [Langfuse compatibility matrix](https://langfuse.com/self-hosting/upgrade/versioning#sdk-server)). OSS v2 servers don't serve the `/api/public/otel/v1/traces` route that the callback exports to so traces are rejected 404 and the proxy logs the rejection. You must upgrade the server prior to upgrading LiteLLM or stick with the previous version of LiteLLM until then. If you have an ingress or reverse proxy in front of Langfuse with a request body limit then it will return 413 for a large batch. The callback will split that batch in half and re-send it and only a single span that individually exceeds the limit will be dropped (with an error logged).

:::


## Usage with LiteLLM Proxy (LLM Gateway)

[**Follow this link to start sending logs to langfuse with LiteLLM Proxy server**](../proxy/logging)

To route different teams/virtual keys to different Langfuse projects see [Team/Key Based Logging](../proxy/team_logging). Team defaults are in trusted `config.yaml` (where `os.environ/...` references get resolved at the gateway) and per-key callbacks are provisioned via `/key/generate` or `/key/update` with the resolved credential values. The credential values are stored as settings on the key, not as per-request credentials.


## Usage with LiteLLM Python SDK

:::note

This section looks at the `langfuse` callback using the Langfuse Python SDK v4. You could alternatively use the [OpenTelemetry v2 integration](./opentelemetry_v2#2-send-traces-to-a-specific-tool-presets).

:::

### Pre-Requisites
Ensure you have run `uv add langfuse` for this integration
```shell
uv add "langfuse>=4.7,<5" litellm
```

### Quick Start
Use just 2 lines of code, to instantly log your responses **across all providers** with Langfuse:

<a target="_blank" href="https://colab.research.google.com/github/BerriAI/litellm/blob/89a6b5fbb26b632ef0faf633b0d3cf317d73deaa/cookbook/logging_observability/LiteLLM_Langfuse.ipynb">
  <img src="https://colab.research.google.com/assets/colab-badge.svg" alt="Open In Colab"/>
</a>

Get your Langfuse API Keys from https://cloud.langfuse.com/
```python
litellm.success_callback = ["langfuse"]
litellm.failure_callback = ["langfuse"] # logs errors to langfuse
```
```python
# uv add langfuse 
import litellm
import os

# from https://cloud.langfuse.com/
os.environ["LANGFUSE_PUBLIC_KEY"] = ""
os.environ["LANGFUSE_SECRET_KEY"] = ""
# Optional, defaults to https://cloud.langfuse.com
os.environ["LANGFUSE_HOST"] # optional

# LLM API Keys
os.environ['OPENAI_API_KEY']=""

# set langfuse as a callback, litellm will send the data to langfuse
litellm.success_callback = ["langfuse"] 
 
# openai call
response = litellm.completion(
  model="{{openai_small}}",
  messages=[
    {"role": "user", "content": "Hi - i'm openai"}
  ]
)
```

### Advanced
#### Set Custom Generation Names, pass Metadata

Pass `generation_name` in `metadata`

```python
import litellm
from litellm import completion
import os

# from https://cloud.langfuse.com/
os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-..."
os.environ["LANGFUSE_SECRET_KEY"] = "sk-..."


# OpenAI and Cohere keys 
# You can use any of the litellm supported providers: https://docs.litellm.ai/docs/providers
os.environ['OPENAI_API_KEY']="sk-..."

# set langfuse as a callback, litellm will send the data to langfuse
litellm.success_callback = ["langfuse"] 
 
# openai call
response = completion(
  model="{{openai_small}}",
  messages=[
    {"role": "user", "content": "Hi - i'm openai"}
  ],
  metadata = {
    "generation_name": "litellm-ishaan-gen", # set langfuse generation name
    # custom metadata fields
    "project": "litellm-proxy" 
  }
)
 
print(response)

```

#### Set Custom Trace ID, Trace User ID, Trace Metadata, Trace Version, Trace Release and Tags

Pass `trace_id`, `trace_user_id`, `trace_metadata`, `trace_version`, `trace_release`, `tags` in `metadata`


```python
import litellm
from litellm import completion
import os

# from https://cloud.langfuse.com/
os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-..."
os.environ["LANGFUSE_SECRET_KEY"] = "sk-..."

os.environ['OPENAI_API_KEY']="sk-..."

# set langfuse as a callback, litellm will send the data to langfuse
litellm.success_callback = ["langfuse"] 

# set custom langfuse trace params and generation params
response = completion(
  model="{{openai_small}}",
  messages=[
    {"role": "user", "content": "Hi - i'm openai"}
  ],
  metadata={
      "generation_name": "ishaan-test-generation",  # set langfuse Generation Name
      "generation_id": "gen-id22",                  # set langfuse Generation ID 
      "parent_observation_id": "obs-id9",           # set langfuse Parent Observation ID
      "version":  "test-generation-version",        # set langfuse Generation Version
      "trace_user_id": "user-id2",                  # set langfuse Trace User ID
      "session_id": "session-1",                    # set langfuse Session ID
      "tags": ["tag1", "tag2"],                     # set langfuse Tags
      "trace_name": "new-trace-name",               # set langfuse Trace Name
      "trace_id": "trace-id22",                     # set langfuse Trace ID (non-hex IDs are deterministically hashed, see note below)
      "trace_metadata": {"key": "value"},           # set langfuse Trace Metadata
      "trace_version": "test-trace-version",        # set langfuse Version. v4 has a single version attribute - on a new trace, trace_version takes precedence over version
      "trace_release": "test-trace-release",        # set langfuse Trace Release
      ### OR ### 
      "existing_trace_id": "trace-id22",            # if generation is continuation of past trace. This prevents default behaviour of setting a trace name
      ### OR enforce that certain fields are trace overwritten in the trace during the continuation ###
      "existing_trace_id": "trace-id22",
      "trace_metadata": {"key": "updated_trace_value"},            # The new value to use for the langfuse Trace Metadata
      "update_trace_keys": ["input", "output", "trace_metadata"],  # Updates the trace input & output to be this generations input & output (written via observation fields in v4) and updates the Trace Metadata to match the passed in value. Requires `langfuse_enable_update_trace_keys: true`
      "debug_langfuse": True,                                      # Will log the scalar metadata sent to litellm for the trace/generation as `metadata_passed_to_litellm` 
  },
)

print(response)

```

:::info[Langfuse v4 semantics]

- **Custom `trace_id`**: Langfuse v4 requires W3C trace IDs (32 lowercase hex chars). LiteLLM will take your `trace_id`, lowercase it and remove any hyphens so a UUID like `01234567-89AB-CDEF-0123-456789ABCDEF` becomes `0123456789abcdef0123456789abcdef` and is used as such. Anything that isn't 32 hex chars after that is deterministically hashed to one (via `Langfuse.create_trace_id(seed=<your id>)`). The same `trace_id` will always map to the same Langfuse trace, but the ID you see in Langfuse is the normalised/hashed version rather than your original string.
- **`version` / `trace_version`**: Langfuse v4 has a single `version` attribute. On a new trace `trace_version` wins over `version`; on an `existing_trace_id` continuation `version` still goes to the generation.
- **Continued traces**: the v4 server takes the trace name/input/output from the most recent root observation in the trace. `update_trace_keys` with `input`/`output` is still honoured in that the values are written via the observation fields.

:::

You can also pass `metadata` as part of the request header with a `langfuse_*` prefix:

```shell
curl --location --request POST 'http://0.0.0.0:4000/chat/completions' \
    --header 'Content-Type: application/json' \
    --header "Authorization: Bearer $LITELLM_API_KEY" \
    --header 'langfuse_trace_id: trace-id2' \
    --header 'langfuse_trace_user_id: user-id2' \
    --header 'langfuse_trace_metadata: {"key":"value"}' \
    --data '{
    "model": "{{openai_small}}",
    "messages": [
        {
        "role": "user",
        "content": "what llm are you"
        }
    ]
}'
```


#### Trace ID with `langfuse_otel`

Calls sent via `langfuse_otel` end up in a single Langfuse trace if they name that same trace. A call will name a trace with any of the following on both of the OpenTelemetry integrations (`LITELLM_OTEL_V2` unset or `true`):

| What the request sends | Where |
|---|---|
| `trace_id` or `existing_trace_id` | `metadata` or `litellm_metadata` in the request body |
| `langfuse_trace_id` or `langfuse_existing_trace_id` | Request header |
| W3C `traceparent` | Request header |

Every call that sends the same `trace_id` lands in the same Langfuse trace:

```shell
curl --location 'http://0.0.0.0:4000/chat/completions' \
    --header 'Content-Type: application/json' \
    --header "Authorization: Bearer $LITELLM_API_KEY" \
    --data '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "what llm are you"}],
    "metadata": {"trace_id": "0af76519-16cd-43dd-8448-eb211c80319c"}
}'
```

- The ID is normalised in the same way as for the `langfuse` callback: lowercased, hyphens removed and hashed to 32 hex chars if it's not a UUID or 32 hex chars. The trace ID you see in Langfuse is the normalized form.
- A `traceparent` header wins if the request has both. The call will be in the `traceparent` trace and `trace_id` will not be used for grouping.
- Send a separate `trace_id` for each unit of work that you want to be its own trace. Calls that re-use the same value (e.g. a constant) are merged into a single trace.
- A trace ID that LiteLLM pulls from a session header (e.g. `x-litellm-session-id`) will not group the calls. The calls will all share the session and will each have their own trace.
- With `LITELLM_OTEL_V2=true` this applies to requests sent via the LiteLLM Proxy with a JSON body of up to 16MB on every endpoint (`/v1/chat/completions`, `/v1/responses`, `/v1/messages` and all the rest). The entire request (including its auth and routing spans) will be part of the named trace and the `traceresponse` response header will contain that trace ID. Calls made via the Python SDK directly will be grouped under the active OpenTelemetry span.
- The earlier versions of the code just set `trace_id` as a span attribute (or else omitted it entirely with `LITELLM_OTEL_V2=true`) so each call ended up in its own trace.

#### Trace & Generation Parameters

##### Trace Specific Parameters

* `trace_id` - the trace id, must use `existing_trace_id` rather than `trace_id` if this is an existing trace (generated automatically by default). The IDs are all lower case and hyphens removed. Anything that's still not 32 hex chars is deterministically hashed to a 32 hex W3C trace id (see note above).
* `trace_name`     - Name of the trace, auto-generated by default
* `session_id`     - Session identifier for the trace, defaults to `None`
* `trace_version` - the trace version, defaults to the value of `version`. Langfuse v4 has a single `version` attribute: `trace_version` takes precedence on a new trace.
* `trace_release`  - Release for the trace, defaults to `None`
* `trace_metadata` - Metadata for the trace, defaults to `None`
* `trace_user_id`  - User identifier for the trace, defaults to completion argument `user`
* `tags`           - Tags for the trace, defaults to `None`

#### Generation Specific Parameters

* `generation_id`         - Identifier for the generation, auto-generated by default
* `generation_name`       - Identifier for the generation, auto-generated by default
* `parent_observation_id` - Identifier for the parent observation, defaults to `None`
* `prompt`                - Langfuse prompt object used for the generation, defaults to `None`


Any other key value pairs that you pass into the metadata are logged on the generation under `requester_metadata`. On the proxy this happens automatically for whatever you put in the request body. From the SDK you need to nest them so that they are picked up:

```python
response = litellm.completion(
    model="{{openai_large}}",
    messages=[{"role": "user", "content": "Hi"}],
    metadata={"metadata": {"my_key": "my_value"}},   # arrives as requester_metadata
)
```

#### Multiple Langfuse Projects (Per-Request Credentials)

You can send traces to different Langfuse projects per request by passing the credentials directly into `completion()` or `acompletion()`. This works in conjunction with (or indeed instead of) the global env vars and is useful when different teams or different business processes are using different Langfuse projects.

Pass **`langfuse_public_key`**, **`langfuse_secret_key`** (or **`langfuse_secret`**), and optionally **`langfuse_host`** as keyword arguments:

```python
import litellm
from litellm import completion

# Optional: set a default via env for requests that don't pass credentials
# os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-default..."
# os.environ["LANGFUSE_SECRET_KEY"] = "sk-default..."

litellm.success_callback = ["langfuse"]
litellm.failure_callback = ["langfuse"]

# Request 1 → Langfuse Project A
response_a = completion(
    model="{{openai_small}}",
    messages=[{"role": "user", "content": "Hello from team A"}],
    langfuse_public_key="pk-lf-project-a...",
    langfuse_secret_key="sk-lf-project-a...",
    langfuse_host="https://us.cloud.langfuse.com",  # optional
)

# Request 2 → Langfuse Project B (different project)
response_b = completion(
    model="{{openai_small}}",
    messages=[{"role": "user", "content": "Hello from team B"}],
    langfuse_public_key="pk-lf-project-b...",
    langfuse_secret_key="sk-lf-project-b...",
    langfuse_host="https://eu.cloud.langfuse.com",  # optional, can differ per project
)
```

Async usage with per-request credentials:

```python
import litellm
from litellm import acompletion

litellm.success_callback = ["langfuse"]
litellm.failure_callback = ["langfuse"]

response = await acompletion(
    model="{{openai_small}}",
    messages=[{"role": "user", "content": "Hi"}],
    langfuse_public_key="pk-lf-...",
    langfuse_secret_key="sk-lf-...",
    langfuse_host="https://us.cloud.langfuse.com",  # optional
)
```

- **`langfuse_public_key`** – Langfuse project public key (required for per-request override)
- **`langfuse_secret_key`** or **`langfuse_secret`** – Langfuse secret key (either one will do).
- **`langfuse_host`** – Langfuse host URL (e.g. `https://us.cloud.langfuse.com`); optional, defaults to env or Langfuse cloud.

When these are passed the request will use this project (and host) for the Langfuse callback. If they are omitted the callback will use the global Langfuse client (from the env vars if set). LiteLLM will cache a Langfuse client per credential set so as not to create a new client on every request.

#### Disable Logging - Specific Calls

To disable logging for particular calls use the `no-log` flag. 

`completion(messages = ..., model = ...,  **{"no-log": True})`


### Use LangChain ChatLiteLLM + Langfuse
Pass `trace_user_id`, `session_id` in model_kwargs
```python
import os
from langchain.chat_models import ChatLiteLLM
from langchain.schema import HumanMessage
import litellm

# from https://cloud.langfuse.com/
os.environ["LANGFUSE_PUBLIC_KEY"] = "pk-..."
os.environ["LANGFUSE_SECRET_KEY"] = "sk-..."

os.environ['OPENAI_API_KEY']="sk-..."

# set langfuse as a callback, litellm will send the data to langfuse
litellm.success_callback = ["langfuse"] 

chat = ChatLiteLLM(
  model="{{openai_small}}",
  model_kwargs={
      "metadata": {
        "trace_user_id": "user-id2", # set langfuse Trace User ID
        "session_id": "session-1" ,  # set langfuse Session ID
        "tags": ["tag1", "tag2"] 
      }
    }
  )
messages = [
    HumanMessage(
        content="what model are you"
    )
]
chat(messages)
```

### Redacting Messages, Response Content from Langfuse Logging 

#### Redact Messages and Responses from all Langfuse Logging

Set `litellm.turn_off_message_logging=True`. This will stop the messages and responses from being logged to Langfuse (request metadata will still be logged).

#### Redact Messages and Responses from specific Langfuse Logging

In the metadata that's normally passed along for text completion or embedding calls you can set certain keys to hide the messages and responses for that particular call.

Setting `mask_input` to `True` will mask the input from being logged for this call 

Set `mask_output` to `True` and the output will be logged for that call.

Be aware that if you're continuing an existing trace and you set `update_trace_keys` to include either `input` or `output` and you also set the corresponding `mask_input` or `mask_output` then that trace will have its existing input and/or output replaced with a redacted message. This only applies when `langfuse_enable_update_trace_keys` is on.

## Troubleshooting & Errors
Is data not getting logged to Langfuse? 
- Ensure you're on the latest version of langfuse `uv add langfuse -U`. The latest version allows litellm to log JSON input/outputs to langfuse
- Follow [this checklist](https://langfuse.com/faq/all/missing-traces) if you don't see any traces in langfuse.

## Support & Talk to Founders

- [Schedule Demo](https://calendly.com/d/4mp-gd3-k5k/berriai-1-1-onboarding-litellm-hosted-version)
- [Community Discord](https://discord.gg/wuPM9dRgDw)
- Our emails ishaan@berri.ai / krrish@berri.ai
