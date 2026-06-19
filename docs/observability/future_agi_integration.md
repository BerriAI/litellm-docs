import Image from '@theme/IdealImage';

# Future AGI

[Future AGI](https://futureagi.com) is an observability and evaluation platform for LLM applications. The [`traceAI-litellm`](https://pypi.org/project/traceAI-litellm/) package auto-instruments LiteLLM and exports every `completion`, `acompletion`, `embedding`, and tool call to your Future AGI project as OpenTelemetry spans, where you can inspect prompts, completions, parameters, token usage, latency, and run experiments and evaluations.

<Image img={require('../../img/future_agi.png')} />

## Pre-Requisites

1. Sign up at [app.futureagi.com](https://app.futureagi.com).
2. From your dashboard, copy your `FI_API_KEY` and `FI_SECRET_KEY`.

## Quick Start

Install the instrumentation. `traceAI-litellm` declares `litellm>=1.43.0` as a runtime dependency, so it installs transitively.

```bash
pip install traceAI-litellm
```

Register the Future AGI tracer once at startup and attach the `LiteLLMInstrumentor` **before** making any LiteLLM calls. Every subsequent `litellm.completion` / `litellm.acompletion` / `litellm.embedding` invocation is captured automatically.

```python
import os
import litellm

from fi_instrumentation import register
from fi_instrumentation.fi_types import ProjectType
from traceai_litellm import LiteLLMInstrumentor

# Future AGI credentials
os.environ["FI_API_KEY"] = "<your-fi-api-key>"
os.environ["FI_SECRET_KEY"] = "<your-fi-secret-key>"

# LLM provider credentials (LiteLLM passes through to the upstream provider)
os.environ["OPENAI_API_KEY"] = "<your-openai-api-key>"

# Register the Future AGI tracer
trace_provider = register(
    project_type=ProjectType.OBSERVE,
    project_name="litellm_app",
)

# Instrument LiteLLM
LiteLLMInstrumentor().instrument(tracer_provider=trace_provider)

# Use LiteLLM normally — every call is now traced
response = litellm.completion(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": "What's the capital of France?"}],
)
print(response.choices[0].message.content)
```

`LiteLLMInstrumentor` captures `litellm.completion`, `litellm.acompletion`, `litellm.completion_with_retries`, `litellm.embedding`, and `litellm.aembedding`, along with tool calls and streamed responses.

## View Traces in the Dashboard

Run your application, then open your project in the [Future AGI dashboard](https://app.futureagi.com) to inspect prompts, completions, model parameters, token usage, latency, and tool call inputs and outputs.

## Resources

- [`traceAI-litellm` on PyPI](https://pypi.org/project/traceAI-litellm/)
- [`traceAI` on GitHub](https://github.com/future-agi/traceAI/tree/main/python/frameworks/litellm)
- [Future AGI documentation](https://docs.futureagi.com)
