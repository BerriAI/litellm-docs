# HoneyHive

[HoneyHive](https://www.honeyhive.ai) is an agent observability platform for tracing, evaluating, and monitoring LLM applications from development through production. It is available as a managed cloud service or self-hosted in your own environment.

HoneyHive traces LiteLLM through the OpenInference `LiteLLMInstrumentor`, which wraps the LiteLLM SDK and sends OpenTelemetry spans to HoneyHive. It records completions, embeddings, and image generation calls with inputs, outputs, token usage, and the model and provider LiteLLM routed to. This page covers the Python SDK. For the full HoneyHive reference, see the [HoneyHive LiteLLM integration guide](https://docs.honeyhive.ai/v2/integrations/litellm).

## Pre-Requisites

Create an ingestion API key in HoneyHive under **Settings > Project > API Keys** (Ingestion tab). The key selects the project that receives your traces. Install the HoneyHive SDK and the instrumentor next to LiteLLM:

```shell
uv add litellm honeyhive openinference-instrumentation-litellm
```

## Quick Start

```python
import litellm
import os

from honeyhive import HoneyHiveTracer
from openinference.instrumentation.litellm import LiteLLMInstrumentor

# from Settings > Project > API Keys in HoneyHive (Ingestion tab)
os.environ["HH_INGESTION_API_KEY"] = ""

# LLM API Keys
os.environ["OPENAI_API_KEY"] = ""

# Optional, for self-hosted or dedicated HoneyHive deployments
# os.environ["HH_API_URL"] = "https://<your-honeyhive-api-host>"

# start the tracer, then send LiteLLM spans to it
tracer = HoneyHiveTracer.init()
LiteLLMInstrumentor().instrument(tracer_provider=tracer.provider)

# openai call
response = litellm.completion(
  model="openai/{{openai_small}}",
  messages=[
    {"role": "user", "content": "Hi, I'm using OpenAI through LiteLLM"}
  ]
)
```

Open your project in HoneyHive and go to the **Traces** page to see the call.

:::note
The instrumentor patches module-level functions, so call `litellm.completion()` rather than `from litellm import completion`.
:::

## Multiple providers

HoneyHive records the same span shape for every provider LiteLLM routes to, so a call to a second provider needs no extra setup.

```python
import litellm
import os

from honeyhive import HoneyHiveTracer
from openinference.instrumentation.litellm import LiteLLMInstrumentor

os.environ["HH_INGESTION_API_KEY"] = ""
os.environ["OPENAI_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""

tracer = HoneyHiveTracer.init()
LiteLLMInstrumentor().instrument(tracer_provider=tracer.provider)

# openai call
litellm.completion(
  model="openai/{{openai_small}}",
  messages=[{"role": "user", "content": "What is the capital of France?"}],
  max_tokens=50,
)

# anthropic call, traced the same way
litellm.completion(
  model="anthropic/{{anthropic}}",
  messages=[{"role": "user", "content": "Tell me a fun fact about Paris."}],
  max_tokens=100,
)
```

## Avoid duplicate spans

Do not also install a provider-specific instrumentor, such as `OpenAIInstrumentor`, for providers you call through LiteLLM. Both instrumentors would record the same call, and you would see duplicate spans.

## Troubleshooting

If traces do not appear, check that `HH_INGESTION_API_KEY` is set, and that `LiteLLMInstrumentor().instrument()` receives `tracer_provider=tracer.provider`. Calling it without the tracer provider sends spans to the default OpenTelemetry provider instead of HoneyHive. Also confirm that your code calls `litellm.completion()` through the module, as noted above.

HoneyHive reads `HH_API_KEY` when `HH_INGESTION_API_KEY` is not set. A value in `HH_INGESTION_API_KEY` must be an ingestion key, which starts with `hh_ingst_`; any other value raises an error when the tracer starts.
