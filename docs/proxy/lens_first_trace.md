---
title: Sending your first trace
---

# Sending your first trace

Run this DeepAgents example, then open its trace in LiteLLM. It sends the agent's steps, question, and answer so you can inspect the run and investigate it with Lens.

Your proxy needs [tracing enabled](./lens_deployment.md#configure-an-existing-proxy) and a chat model configured. You do not need a Lens worker to send or view traces.

## Run the example

Install the dependencies in your Python environment:

```bash
pip install deepagents langchain-openai openinference-instrumentation-langchain opentelemetry-exporter-otlp-proto-http
```

Set your proxy address, a LiteLLM key with access to your model, and the model name shown in **Models + Endpoints**. Use the proxy address without `/ui` or `/v1`.

```bash
export LITELLM_PROXY_URL="http://localhost:4002"
export LITELLM_API_KEY="<your-litellm-key>"
export LITELLM_MODEL="<your-model-name>"
```

Save this as `first_trace.py`, or [download the file](/examples/lens/first_trace.py). Change `AGENT_NAME` to name your agent.

```python
import json
import os

from deepagents import create_deep_agent
from langchain_openai import ChatOpenAI
from openinference.instrumentation.langchain import LangChainInstrumentor
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

AGENT_NAME = "research_agent"
proxy_url = os.environ["LITELLM_PROXY_URL"].rstrip("/")
api_key = os.environ["LITELLM_API_KEY"]

provider = TracerProvider(resource=Resource.create({"service.name": AGENT_NAME}))
provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(
    endpoint=f"{proxy_url}/v1/traces",
    headers={"Authorization": f"Bearer {api_key}"},
)))
trace.set_tracer_provider(provider)
LangChainInstrumentor().instrument(tracer_provider=provider)

agent = create_deep_agent(
    name=AGENT_NAME,
    model=ChatOpenAI(
        model=os.environ["LITELLM_MODEL"],
        base_url=f"{proxy_url}/v1",
        api_key=api_key,
    ),
    system_prompt="Answer the question briefly. Do not use tools for this task.",
)

messages = [{"role": "user", "content": "What is an agent trace?"}]
try:
    with trace.get_tracer(__name__).start_as_current_span(AGENT_NAME) as span:
        span.set_attribute("gen_ai.operation.name", "invoke_agent")
        span.set_attribute("gen_ai.agent.name", AGENT_NAME)
        span.set_attribute("gen_ai.input.messages", json.dumps(messages))
        result = agent.invoke({"messages": messages})
        answer = result["messages"][-1].content
        span.set_attribute("gen_ai.output.messages", json.dumps([
            {"role": "assistant", "content": answer},
        ]))
        print(answer)
finally:
    provider.shutdown()

```

The outer span gives the whole run its agent name and records the final answer. The instrumentor records the steps inside it.

```bash
python first_trace.py
```

## See the trace

Open **Lens > Traces** and select **research_agent**. You should see the question, the model call, and the answer. The screenshot below shows a run from this example.

![A research_agent run with its question, model call, and answer.](/img/lens/first-agent-trace.png)

## Investigate this agent

Open **Lens > Investigations**. Connect a worker if prompted, then select **New investigation**. Choose **research_agent** from **Agent**, describe what it should do, and run the investigation. If the new run has not appeared in the preview yet, allow two minutes for its trace to settle.

If no trace appears, use **Send a test trace** on the Traces tab to check ingestion. Then check the export URL and key used by this script.
