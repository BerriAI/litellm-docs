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
