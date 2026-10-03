---
image: /img/lens/lens_hero_labeled.gif
---

import AgentDeployPrompt from '@site/src/components/AgentDeployPrompt';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# LiteLLM Lens

<p>
  <a className="button button--primary button--sm" href="https://forms.gle/3GC1Ner4vjthGWi18">Early access</a>
</p>

![Agent swarms flow through the LiteLLM gateway into one trace per run, and LiteLLM Lens feeds improvements back.](/img/lens/lens_hero_labeled.gif)

Once your agents are in production, you cannot manually review every trace.

LiteLLM Lens uses AI agents to analyze your agent traces and find recurring problems. You specify the expected behavior. Lens investigates failures, groups similar problems, and links each finding to the original traces.

Use **Lens > Traces** to manually inspect individual runs. Use **Lens > Investigations** to investigate a set of runs, on demand or on a schedule.

Before setup, click **Preview sample** beside the Lens title to explore sample traces, investigations, and linked evidence. **Exit demo** returns to your own workspace.

## Deployment {#quick-start}

![LiteLLM Lens architecture: your agent sends LLM calls and traces to LiteLLM, which stores traces in ClickHouse; the Lens worker polls LiteLLM for investigations.](/img/lens-architecture.svg)

Lens adds two things to your LiteLLM stack: ClickHouse and the Lens worker. PostgreSQL is the same database your proxy already uses.

| Component | What it does | What we use |
| --- | --- | --- |
| LiteLLM proxy | Receives traces, serves the Lens UI and API | [`ghcr.io/berriai/litellm`](https://github.com/BerriAI/litellm/pkgs/container/litellm) with [tracing enabled](#configure-an-existing-proxy) |
| ClickHouse (new) | Stores traces and request logs | [`clickhouse/clickhouse-server:26.9.6.6`](https://hub.docker.com/r/clickhouse/clickhouse-server/tags?name=26.9.6.6) |
| Lens worker (new) | Runs investigations on your infrastructure. It polls LiteLLM over HTTPS and needs no database access or provider keys | [`ghcr.io/berriai/litellm-lens-worker`](https://github.com/BerriAI/litellm/pkgs/container/litellm-lens-worker), [`deploy/lens/compose.yaml`](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) |
| PostgreSQL | Stores lenses, findings, and keys | Your existing LiteLLM database |

### One-click Docker

For a new deployment, the [tracing Docker Compose stack](https://github.com/BerriAI/litellm/blob/main/docker/docker-compose.tracing.yml) starts LiteLLM, PostgreSQL, and ClickHouse together:

```bash
git clone https://github.com/BerriAI/litellm.git
cd litellm/docker
export OPENAI_API_KEY=sk-...
docker compose -f docker-compose.tracing.yml up --build
```

Open `http://localhost:4002/ui/` and sign in with username `admin` and password `local-tracing-master-key`. Then [connect the analyzer](#connect-the-analyzer) to start the Lens worker.

For an existing proxy, deploy ClickHouse where the proxy can reach it, then [enable tracing on your proxy](#configure-an-existing-proxy). In the examples below, replace `https://<your-litellm-proxy>` with your LiteLLM proxy URL.

### Deploy with a coding agent

<AgentDeployPrompt prompt={`Deploy LiteLLM Lens on this machine by following https://docs.litellm.ai/docs/proxy/lens

1. If a LiteLLM proxy is already running, keep it and its PostgreSQL database. Otherwise clone https://github.com/BerriAI/litellm and start docker/docker-compose.tracing.yml, which runs LiteLLM, PostgreSQL, and ClickHouse.
2. For an existing proxy, run ClickHouse (clickhouse/clickhouse-server:26.9.6.6) where the proxy can reach it. Add general_settings.tracing.store:
      type: clickhouse to the proxy config, set CLICKHOUSE_URL (and optionally a SELECT-only CLICKHOUSE_READER_URL), and restart the proxy.
3. Check tracing works: POST an OTLP/HTTP trace to <proxy>/v1/traces with Authorization: Bearer <key>, then GET <proxy>/v1/traces and confirm it is listed.
4. Ask me to open the dashboard, go to Observability > Lens > Investigations > Connect worker, and paste the generated worker command. Run it, or use https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml with LITELLM_URL and LENS_WORKER_TOKEN.
5. Confirm the dashboard shows "Worker connected".

Never print or commit keys, worker tokens, or passwords. Ask me before replacing an existing container, database, or config.`} />

### Docker deployment

Use these steps to add Lens to a LiteLLM proxy you already run. If you don't have one yet, follow the [Docker quick start](./docker_quick_start.md) or [production deployment](./deploy.md) guide first. Lens also needs the PostgreSQL database configured through `DATABASE_URL`.

#### 1. Deploy ClickHouse

Run ClickHouse where your proxy can reach port `8123`:

```bash
docker run -d --name litellm-clickhouse --restart unless-stopped \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD=<clickhouse-password> \
  -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
  -v clickhouse_data:/var/lib/clickhouse \
  -p 8123:8123 \
  clickhouse/clickhouse-server:26.9.6.6
```

The URL your proxy needs is `http://default:<clickhouse-password>@<clickhouse-host>:8123`. LiteLLM creates the `litellm` database and tables on startup.

#### 2. Point LiteLLM at ClickHouse

Add this to your proxy's `config.yaml`:

```yaml
general_settings:
  tracing:
    store:
      type: clickhouse
```

Set these environment variables on the proxy, then restart it:

| Variable | Value |
| --- | --- |
| `CLICKHOUSE_URL` | `http://default:<clickhouse-password>@<clickhouse-host>:8123` |
| `CLICKHOUSE_READER_URL` | Optional. A SELECT-only ClickHouse user, same URL format. Defaults to `CLICKHOUSE_URL` |
| `CLICKHOUSE_DATABASE` | Optional. Defaults to `litellm` |

Check that tracing is on: `curl -H "Authorization: Bearer <your-litellm-key>" https://<your-litellm-proxy>/v1/traces` returns `{"data": [...]}`.

#### 3. Deploy the Lens worker

Open `https://<your-litellm-proxy>/ui/`, go to **Observability > Lens > Investigations**, click **Connect worker**, choose the analysis model and monthly limit, then **Get install command**. Run the generated command on any server that can reach your proxy over HTTPS. It looks like this:

```bash
docker run -d --restart unless-stopped --read-only --cap-drop ALL \
  --tmpfs /tmp:rw,noexec,nosuid,size=1g \
  --security-opt no-new-privileges --platform linux/amd64 --add-host host.docker.internal:host-gateway \
  -e LITELLM_URL=https://<your-litellm-proxy> \
  -e LENS_WORKER_TOKEN=<worker-token-from-the-dashboard> \
  <worker-image-from-your-dashboard>
```

| Variable | Value |
| --- | --- |
| `LITELLM_URL` | Your proxy's base URL, without `/v1`, for example `https://litellm.example.com`. Use `http://host.docker.internal:4000` if the proxy runs on the same machine |
| `LENS_WORKER_TOKEN` | The worker token from **Get install command**. Keep it private |

The worker needs outbound access to `LITELLM_URL` only. It needs no inbound ports, provider keys, or database access. Use [`deploy/lens/compose.yaml`](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) instead if you manage containers with Compose. The dashboard shows **Worker connected** once the worker checks in.

Copy the full command from your dashboard, including its pinned worker image. After upgrading the gateway, use its compatible worker image and recreate the worker with the same proxy URL and token. A running container does not update automatically.

### Connect your agent

Point your agent's OpenTelemetry OTLP/HTTP exporter to LiteLLM:

| Setting | Value |
| --- | --- |
| Trace endpoint | `https://<your-litellm-proxy>/v1/traces` |
| HTTP header | `Authorization: Bearer <your-litellm-key>` |

Use a LiteLLM key to authenticate. Record the agent's task, steps, tool calls, inputs, and final answer. Lens uses this content to check what happened.

For a working example, use [DeepLite](https://github.com/BerriAI/deeplite). Set `LITELLM_DEV_BASE=https://<your-litellm-proxy>/v1/traces` and `LITELLM_DEV_KEY=<your-litellm-key>` in its `.env` file, then run the agent.

## Send your first trace

Use your existing model configuration. Set the trace destination once, then choose your framework below. Replace `research_agent` with your agent's name.

```bash
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="https://<your-litellm-proxy>/v1/traces"
export OTEL_EXPORTER_OTLP_TRACES_HEADERS="Authorization=Bearer <your-litellm-key>"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_METRICS_EXPORTER="none"
export OTEL_LOGS_EXPORTER="none"
```

Each tab shows the core setup. Open its full example for dependencies and a runnable project. The Python examples initialize OpenTelemetry before creating the agent. If your app already configures a tracer provider, keep it and point its exporter at the destination above instead.

<Tabs groupId="lens-framework" queryString="framework" className="lens-framework-tabs">

<TabItem value="deepagents" label="DeepAgents">

```python title="Send a trace"
from opentelemetry.instrumentation.auto_instrumentation import initialize

initialize()

from deepagents import create_deep_agent

agent = create_deep_agent(name="research_agent", model=model, tools=[])
result = agent.invoke({"messages": [{"role": "user", "content": "What is an agent trace?"}]})
print(result["messages"][-1].content)
```

[Full example](https://github.com/BerriAI/litellm-lens-example/tree/main/deepagents)

</TabItem>

<TabItem value="langgraph" label="LangGraph">

```python title="Send a trace"
from opentelemetry.instrumentation.auto_instrumentation import initialize

initialize()

# Use your existing StateGraph.
agent = graph.compile(name="research_agent")
result = agent.invoke({"messages": [{"role": "user", "content": "What is an agent trace?"}]})
print(result["messages"][-1].content)
```

[Full example](https://github.com/BerriAI/litellm-lens-example/tree/main/langgraph)

</TabItem>

<TabItem value="langchain" label="LangChain">

```python title="Send a trace"
from opentelemetry.instrumentation.auto_instrumentation import initialize

initialize()

from langchain.agents import create_agent

agent = create_agent(name="research_agent", model=model, tools=[])
result = agent.invoke({"messages": [{"role": "user", "content": "What is an agent trace?"}]})
print(result["messages"][-1].content)
```

[Full example](https://github.com/BerriAI/litellm-lens-example/tree/main/langchain)

</TabItem>

<TabItem value="openai-agents" label="OpenAI Agents">

```python title="Send a trace"
from opentelemetry.instrumentation.auto_instrumentation import initialize

initialize()

from agents import Agent, Runner

agent = Agent(name="research_agent", model=model)
result = Runner.run_sync(agent, "What is an agent trace?")
print(result.final_output)
```

[Full example](https://github.com/BerriAI/litellm-lens-example/tree/main/openai-agents)

</TabItem>

<TabItem value="claude" label="Claude Agent SDK">

```python title="Send a trace"
import asyncio
import os

os.environ["OTEL_RESOURCE_ATTRIBUTES"] = "gen_ai.agent.name=research_agent"

from opentelemetry.instrumentation.auto_instrumentation import initialize

initialize()

from claude_agent_sdk import ResultMessage, query

async def main():
    async for message in query(prompt="What is an agent trace?"):
        if isinstance(message, ResultMessage):
            print(message.result)

asyncio.run(main())
```

Uses your Claude Agent SDK authentication and model settings. This captures SDK input and output; internal model calls are not exposed by this instrumentor.

[Full example](https://github.com/BerriAI/litellm-lens-example/tree/main/claude-agent-sdk)

</TabItem>

<TabItem value="crewai" label="CrewAI">

```python title="Send a trace"
from opentelemetry.instrumentation.auto_instrumentation import initialize

initialize()

from crewai import Agent, Crew, Task

agent = Agent(
    role="research_agent",
    goal="Answer questions clearly",
    backstory="You explain technical concepts.",
    llm=model,
)
task = Task(description="What is an agent trace?", expected_output="A short answer", agent=agent)
print(Crew(agents=[agent], tasks=[task]).kickoff())
```

[Full example](https://github.com/BerriAI/litellm-lens-example/tree/main/crewai)

</TabItem>

<TabItem value="pydantic-ai" label="Pydantic AI">

```python title="Send a trace"
from opentelemetry.instrumentation.auto_instrumentation import initialize

initialize()

from pydantic_ai import Agent

Agent.instrument_all()
agent = Agent(model, name="research_agent")
print(agent.run_sync("What is an agent trace?").output)
```

[Full example](https://github.com/BerriAI/litellm-lens-example/tree/main/pydantic-ai)

</TabItem>

<TabItem value="llamaindex" label="LlamaIndex">

```python title="Send a trace"
import os

os.environ["OTEL_RESOURCE_ATTRIBUTES"] = "gen_ai.agent.name=research_agent"

from opentelemetry.instrumentation.auto_instrumentation import initialize

initialize()

from openinference.instrumentation.llama_index import LlamaIndexInstrumentor

LlamaIndexInstrumentor().instrument()
from llama_index.core.agent.workflow import FunctionAgent

agent = FunctionAgent(name="research_agent", llm=model, tools=[])
result = await agent.run(user_msg="What is an agent trace?")
print(result)
```

The resource attribute supplies the agent name because this instrumentor does not export `FunctionAgent.name`. Run this example in your existing async application.

[Full example](https://github.com/BerriAI/litellm-lens-example/tree/main/llamaindex)

</TabItem>

<TabItem value="adk" label="Google ADK">

```python title="Send a trace"
import asyncio
import os

os.environ["OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT"] = "SPAN_ONLY"

from opentelemetry.instrumentation.auto_instrumentation import initialize

initialize()

from google.adk.agents import Agent
from google.adk.runners import InMemoryRunner

agent = Agent(name="research_agent", model=model)
asyncio.run(InMemoryRunner(agent=agent).run_debug("What is an agent trace?"))
```

`SPAN_ONLY` records the messages needed to inspect and investigate the run.

[Full example](https://github.com/BerriAI/litellm-lens-example/tree/main/google-adk)

</TabItem>

<TabItem value="strands" label="Strands">

```python title="Send a trace"
import os

os.environ["OTEL_SEMCONV_STABILITY_OPT_IN"] = "gen_ai_latest_experimental,gen_ai_span_attributes_only"

from opentelemetry.instrumentation.auto_instrumentation import initialize

initialize()

from strands import Agent

agent = Agent(name="research_agent", model=model)
print(agent("What is an agent trace?"))
```

The semantic-convention setting enables message content in spans.

[Full example](https://github.com/BerriAI/litellm-lens-example/tree/main/strands)

</TabItem>

<TabItem value="vercel" label="Vercel AI SDK">

```typescript title="Send a trace"
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OpenTelemetry } from "@ai-sdk/otel";
import { generateText, registerTelemetry } from "ai";

const sdk = new NodeSDK({ traceExporter: new OTLPTraceExporter() });
sdk.start();
registerTelemetry(new OpenTelemetry());

try {
  const { text } = await generateText({
    model,
    prompt: "What is an agent trace?",
    telemetry: { functionId: "research_agent" },
  });
  console.log(text);
} finally {
  await sdk.shutdown();
}
```

[Full example](https://github.com/BerriAI/litellm-lens-example/tree/main/vercel-ai-sdk)

</TabItem>

<TabItem value="openclaw" label="OpenClaw">

Enable the [diagnostics-otel plugin](https://docs.openclaw.ai/plugins/reference/diagnostics-otel). Set your agent ID once in `~/.openclaw/openclaw.json`. Keep your existing model and workspace settings when adding the tracing configuration:

```json title="openclaw.json"
{
  "agents": {
    "list": [{ "id": "research_agent" }]
  },
  "plugins": {
    "entries": { "diagnostics-otel": { "enabled": true } }
  },
  "diagnostics": {
    "enabled": true,
    "otel": {
      "enabled": true,
      "tracesEndpoint": "${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT}",
      "headers": { "Authorization": "Bearer ${LITELLM_API_KEY}" },
      "captureContent": true,
      "traces": true,
      "metrics": false,
      "logs": false,
      "sampleRate": 1
    }
  }
}
```

Set `LITELLM_API_KEY` to your LiteLLM key, then run `openclaw agent --local --session-id first-trace --message "What is an agent trace?"`. Select **research_agent** in Lens. Restart an existing gateway after changing the config.

</TabItem>

<TabItem value="hermes" label="Hermes">

Install and enable the community [hermes-otel plugin](https://github.com/briancaffey/hermes-otel#install). Set `LITELLM_API_KEY` to your LiteLLM key, then add this to `~/.hermes/hermes_otel.yaml`:

```yaml title="hermes_otel.yaml"
resource_attributes:
  gen_ai.agent.name: research_agent
content_capture: full
backends:
  - type: otlp
    endpoint: ${OTEL_EXPORTER_OTLP_TRACES_ENDPOINT}
    headers:
      Authorization: "Bearer ${LITELLM_API_KEY}"
    metrics: false
    logs: false
```

Start a new Hermes session and ask a question. The configured name **research_agent** appears in Lens. Hermes' built-in diagnostic telemetry alone does not include the conversation content needed for investigations.

</TabItem>

<TabItem value="otel" label="OpenTelemetry">

```python title="Send a trace"
from opentelemetry.instrumentation.auto_instrumentation import initialize

initialize()

from opentelemetry import trace

with trace.get_tracer(__name__).start_as_current_span("research_agent") as span:
    span.set_attribute("gen_ai.agent.name", "research_agent")
    span.set_attribute("openinference.span.kind", "AGENT")
    span.set_attribute("input.value", "What is an agent trace?")
    answer = agent.run("What is an agent trace?")
    span.set_attribute("output.value", str(answer))
```

[Full example](https://github.com/BerriAI/litellm-lens-example/tree/main/opentelemetry)

</TabItem>

</Tabs>

To try tracing your personal coding sessions, see [Claude Code and Codex setup](./lens/coding_agents.md).

## View your first trace

Open **Lens > Traces**. Select a time range that includes your run, then open it. For the examples above, look for **research_agent**. The same name is available under **Agent** when creating an investigation. Select a step to read its input, output, and attributes.

![A research_agent trace with its question, model call, and final answer.](/img/lens/first-agent-trace.png)

Check that you can see the task, tool results, and final answer. If these are missing, update your agent's instrumentation before running an investigation.

## Run your first investigation

### Connect the analyzer

Sign in as a proxy administrator and open **Lens > Investigations** under **Observability**. Once activity is available, click **Connect worker**. Choose an **Analysis model** and a **Monthly limit**, then click **Get install command**. The default limit is $100 per month. This creates a virtual key restricted to your chosen model; analysis spend appears under that key in **Virtual Keys**. To use an existing virtual key or change the proxy URL, open **Advanced options**. Existing workers can change their virtual key through the worker's **Settings** without replacing their worker token.

Run the Docker command on a server that can reach your LiteLLM deployment. Keep the command private because it contains the worker token. Wait for **Worker connected**. Investigation creation unlocks when the worker is ready.

![Lens worker setup with an analysis model and a monthly limit.](/img/lens/worker-setup.png)

This worker runs on your infrastructure. It checks LiteLLM for scheduled or requested investigations and sends the results back. It calls your chosen model through LiteLLM and keeps running when you close the dashboard.

The generated command starts one worker process, which runs one investigation at a time. Its concurrency setting controls how many traces it reviews within that investigation. Running more worker processes allows more simultaneous investigations; their analysis costs share the assigned virtual key's budget.

### Choose the traces

Click **New investigation**. In **Activity**, name the investigation and choose an **Agent**. The dropdown lists recorded agent names; leave it blank to include all accessible activity. Open **Advanced filters** to choose agent traces, LLM requests, or both, restrict the selection to a team, or add metadata conditions. Request analysis uses the request logs stored in ClickHouse. Metadata conditions match recorded keys and values exactly.

### Describe what to check

Click **Continue** to open **Expectations**. Describe what your agent should do in **What should the agent be doing?**.

For example:

> The research agent answers the user's question with sources. It checks the sources before writing the final answer and states when it cannot verify a claim.

Under **What should we look out for?**, use **Add check** to add questions you want Lens to answer. Expected behavior is checked even when you leave these blank. You can edit the suggested questions or write your own:

```text
Find claims that conflict with the retrieved sources.
Find tool failures that the agent does not recover from.
Find repeated searches that add no new information.
```

After setup, you can review these under **Criteria** and change them through **Edit investigation** in the actions menu.

![Expected behavior and individual checks for an investigation.](/img/lens/investigation-expectations.png)

### Start the run

Click **Continue** to open **Run**. Set the time window and percentage of matching runs to analyze. By default, Lens reviews 100% of matching activity from the last day, with no count limit. The preview shows how many runs match and how many will be analyzed. Click **Open run** to inspect an example. Newly received traces need a two-minute settling period before they appear here.

Lens uses the worker's analysis model by default. To change the model, set a maximum number of runs, or change the monthly limit, open **Advanced options**. Trace content goes to the selected model through LiteLLM.

Click **Run investigation** to run once. For monitoring, enable **Repeat this investigation** in **Advanced options**, set **Repeat every** to the interval you want, then click **Run and monitor**.

Lens reviews the selected runs in parallel, groups similar observations, and checks the original evidence before saving findings.

Use **Run now** to start another investigation with the saved settings. Scheduled investigations use those same settings. Use **Duplicate** in the actions menu to ask a one-off question or investigate a different selection without changing the original lens. Use **Pause monitoring** to stop scheduled investigations.

## Read the findings

Open **Findings** when the investigation finishes. **Needs attention** shows problems, ordered by priority. **Patterns** shows other observations, including successful recovery and useful behavior.

Open a finding to read what happened and the suggested next step. Expand **Evidence by run** to read the quotes. Click **Open original step** to see the cited step in its trace.

![An example finding with a suggested next step and supporting evidence.](/img/lens/investigation-findings.png)

Use **History** to return to a previous run and its findings, settings, progress, total duration, and cost. Duration includes any wait for a worker. **Traces** shows the activity selected for that run; this tab is called **Requests** or **Traces & requests** when those activity types are selected.

Findings describe the reviewed sample. **Linked runs** counts cited supporting runs; it is not a count of all failures. Evidence can also include labeled counterexamples.

### Give feedback

If Lens flags expected behavior, explain why in **Feedback** and click **This is expected**. Lens uses that feedback in later investigations for the same lens.

After you fix an issue, click **Mark resolved**. Lens can reopen it if the same issue appears in new runs.

## Configure an existing proxy

Add this to `config.yaml`:

```yaml
general_settings:
  tracing:
    store:
      type: clickhouse
```

Set `CLICKHOUSE_URL` to the ClickHouse HTTP address your proxy can reach. `CLICKHOUSE_DATABASE` defaults to `litellm`. You can set `CLICKHOUSE_READER_URL` to use a separate read-only account; otherwise reads use `CLICKHOUSE_URL`.

Investigations also need PostgreSQL, a configured analysis model, and a connected Lens worker. Keep the proxy and worker versions compatible. See the [tracing config](https://github.com/BerriAI/litellm/blob/main/docker/tracing-config.yaml) and [worker setup guide](https://github.com/BerriAI/litellm/blob/main/deploy/lens/README.md) for deployment details.

## Agent tracing API

All four endpoints require proxy authentication. Send a proxy key in the `Authorization: Bearer <key>` header.

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/traces` | Ingest OTLP/HTTP traces as protobuf (`application/x-protobuf`) or JSON (`application/json`). Supports gzip with `Content-Encoding: gzip`. |
| `GET /v1/traces` | List trace summaries. Optional `start_ms` and `end_ms` are Unix milliseconds. The default window is the last 24 hours. |
| `GET /v1/traces/{trace_id}` | Read the trace's `summary`, `agents`, and `spans`. Accepts optional `trace_ref`. |
| `GET /v1/traces/{trace_id}/spans/{span_id}` | Read a span's `input`, `output`, and `attributes`. Accepts optional `trace_ref`. |

List responses contain `data` and `next_cursor`, with 50 summaries per page by default. Pass `next_cursor` back as `cursor` to read the next page. Use a summary's `trace_ref` when reading the trace or its spans.

```bash
curl -H "Authorization: Bearer <key>" \
  "https://<your-litellm-proxy>/v1/traces"
```

Proxy administrators can read all traces. Team keys can read their team's traces. Keys without a team can read traces sent with that key. Read-only proxy administrators cannot ingest traces.

## Lens API {#use-the-api}

Start investigations and read findings on your LiteLLM proxy. Send a proxy administrator key in the `Authorization: Bearer <key>` header.

| Endpoint | Purpose |
| --- | --- |
| `GET /lens` | List investigations under `lenses`, plus `workers` and `tracing_enabled`. |
| `POST /lens` | Create an investigation and queue its first run. Send `name`, `model`, and `context` or `checks`; returns the investigation `id` and `jobs`. |
| `GET /lens/{id}` | Read saved `settings`, recent `jobs`, and `findings`. Each job includes `status`, `stage`, `coverage`, and `cost`. |
| `POST /lens/{id}/runs` | Queue another run. Send `{}` to reuse saved settings, or a `settings` object for a one-time override. |

```bash
curl -H "Authorization: Bearer <key>" \
  "https://<your-litellm-proxy>/lens"
```

Read-only proxy administrators can preview activity and read investigations, findings, and history. Team and ordinary virtual keys cannot use this API.
