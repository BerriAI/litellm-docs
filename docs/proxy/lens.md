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

Lens runs alongside LiteLLM. The worker investigates recorded activity, ClickHouse stores traces, and PostgreSQL stores findings and settings. The worker only needs access to LiteLLM, with no provider keys or database credentials

![LiteLLM Lens architecture: your agent sends LLM calls and traces to LiteLLM, which stores traces in ClickHouse; the Lens worker polls LiteLLM for investigations.](/img/lens-architecture.svg)

Choose your starting point below. New installations can start all four services with Docker Compose. Existing users can keep their deployment and add only the services they need. If Lens is already installed, go to [upgrading](#upgrade-litellm-and-the-worker)

<Tabs groupId="lens-install" queryString="install">
<TabItem value="compose" label="New installation" default>

This Docker Compose bundle includes LiteLLM, PostgreSQL, ClickHouse, and the Lens worker. Start the first three, then connect the worker once through the dashboard

#### 1. Start LiteLLM

Install [Docker with Compose](https://docs.docker.com/compose/install/). Choose a [LiteLLM release](https://github.com/BerriAI/litellm/releases) that includes the coordinated worker release, and replace `X.Y.Z` below with its version, without `v`

```bash
mkdir litellm-lens
cd litellm-lens
LENS_RELEASE=X.Y.Z
curl -fSLo compose.yaml "https://raw.githubusercontent.com/BerriAI/litellm/v${LENS_RELEASE}/deploy/lens/stack.yaml"
curl -fSLo config.yaml "https://raw.githubusercontent.com/BerriAI/litellm/v${LENS_RELEASE}/deploy/lens/config.yaml"
umask 077
printf 'LITELLM_VERSION=%s\nLITELLM_MASTER_KEY=sk-%s\nLITELLM_SALT_KEY=sk-%s\n' \
  "$LENS_RELEASE" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
printf 'POSTGRES_PASSWORD=%s\nCLICKHOUSE_PASSWORD=%s\n' \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" >> .env
docker compose up -d
```

This starts LiteLLM, PostgreSQL, and ClickHouse from published images. Open [http://localhost:4000/ui/](http://localhost:4000/ui/), sign in as `admin` with the `LITELLM_MASTER_KEY` from `.env`, and [add an analysis model](./docker_quick_start.md#3-add-your-first-model)

#### 2. Connect the worker

Go to **Lens > Investigations > Connect worker**, choose the model and monthly budget, then **Get install command**. Expand **Using Docker Compose or Helm?**, copy the worker token, and add it to `.env`:

![Copy the private worker token for Docker Compose or Helm](/img/lens/worker-install.png)

```bash title="Add to .env"
LENS_WORKER_TOKEN=<paste-your-worker-token>
```

Start the worker:

```bash
docker compose --profile lens up -d
```

When the dashboard shows **Worker connected**, continue to [send your first trace](#send-your-first-trace). Setup is performed once; the same version setting controls LiteLLM and the worker

Keep `.env` private and preserve its salt key and both database volumes. This local stack exposes LiteLLM on localhost. For a public production deployment, use your normal ingress and managed databases

</TabItem>
<TabItem value="existing" label="Existing LiteLLM">

Keep your existing LiteLLM installation and PostgreSQL database. Upgrade LiteLLM to a release that includes the coordinated worker release

There is no need to switch deployment tools or start a second proxy. Preserve your configuration, `DATABASE_URL`, `LITELLM_MASTER_KEY`, and `LITELLM_SALT_KEY`. If your proxy runs without PostgreSQL, [connect a database](./virtual_keys.md#setup) before enabling Lens

If you already use Compose, add the [worker service](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) to your existing project and use the same release version for LiteLLM and the worker. Keep the existing database volumes and project name; the new-installation recipe creates fresh databases and keys

#### 1. Enable trace storage

If tracing already works, skip to the worker. Otherwise, run ClickHouse where LiteLLM can reach it:

```bash
docker run -d --name litellm-clickhouse --restart unless-stopped \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD=<clickhouse-password> \
  -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
  -v clickhouse_data:/var/lib/clickhouse \
  -p 8123:8123 \
  clickhouse/clickhouse-server:26.9.6.6
```

[Enable tracing](#configure-an-existing-proxy) with `CLICKHOUSE_URL=http://default:<clickhouse-password>@<clickhouse-host>:8123`, then restart LiteLLM. Keep the ClickHouse port accessible only to your proxy

#### 2. Connect the worker

In the dashboard, go to **Lens > Investigations > Connect worker**, choose an analysis model and monthly budget, then **Get install command**. Copy and run the command on any Docker host that can reach your proxy

The command already contains the matching image, proxy URL, and a limited worker token. No source checkout or second LiteLLM deployment is needed. Wait for **Worker connected**, then [send your first trace](#send-your-first-trace)

<details>
<summary>Standalone image, Render, and worker-only Compose</summary>

The worker is available independently from [GHCR](https://github.com/BerriAI/litellm/pkgs/container/litellm-lens-worker) and [Docker Hub](https://hub.docker.com/r/litellm/litellm-lens-worker), with tag `vX.Y.Z` matching LiteLLM release `X.Y.Z`. Images support amd64 and arm64, including matching RC and dev versions

On Render or another container host, create a background worker using that image. Set `LITELLM_URL` to your proxy's reachable base URL and `LENS_WORKER_TOKEN` to the token copied from **Using Docker Compose or Helm?** in setup. The worker needs outbound access to LiteLLM and no inbound port

To manage just the worker with Compose, download [`deploy/lens/compose.yaml`](https://github.com/BerriAI/litellm/blob/main/deploy/lens/compose.yaml) and put these values in a private `.env` file:

```bash
LITELLM_VERSION=X.Y.Z
LITELLM_URL=https://your-litellm-proxy
LENS_WORKER_TOKEN=<paste-your-worker-token>
```

Copy the token from **Using Docker Compose or Helm?** in worker setup, then run `docker compose up -d`. `LITELLM_URL` is the proxy's base URL without `/v1`. For another registry, set `LENS_WORKER_IMAGE` instead of `LITELLM_VERSION`. Setting `LENS_WORKER_IMAGE` on the proxy also changes the image shown in its setup command

</details>

</TabItem>
<TabItem value="helm" label="Kubernetes (Helm)">

Use the componentized [LiteLLM Helm deployment](./deploy.md#deploy-with-helm). The chart includes the optional worker; PostgreSQL and ClickHouse are configured separately. For a new installation, deploy LiteLLM and its database connections first. For an existing installation, keep your release, values, and databases

Configure [ClickHouse tracing](#configure-an-existing-proxy), then open **Lens > Investigations > Connect worker** and get a worker token. If you use a different chart or manage Kubernetes manifests yourself, you can keep that setup and deploy the standalone worker image instead

Store the token in a Secret named `litellm-lens-worker`, under key `token`, in the same namespace as LiteLLM. Use your existing secret manager, or save `token=<paste-your-worker-token>` in a private file and create the Secret:

```bash
kubectl -n litellm create secret generic litellm-lens-worker \
  --from-env-file=/path/to/private/lens-worker.env
```

Add this to your existing Helm values:

```yaml title="values.yaml"
lensWorker:
  enabled: true
  tokenSecret:
    name: litellm-lens-worker
    key: token
```

Upgrade to the matching chart version, replacing `X.Y.Z` and using your existing release name and namespace:

```bash
helm upgrade --install litellm oci://ghcr.io/berriai/litellm/chart/litellm \
  --namespace litellm --version X.Y.Z -f values.yaml
```

The chart selects matching gateway and worker images and connects the worker to the backend. Keep the values and Secret for future upgrades. `lensWorker.replicaCount` controls simultaneous investigations; `lensWorker.image.repository`, `lensWorker.image.tag`, and `lensWorker.url` support private registries and external proxies

</TabItem>
</Tabs>

### Upgrade LiteLLM and the worker

You choose when to upgrade. Publishing a new release does not update existing containers. Keep LiteLLM and the worker on matching release versions; PostgreSQL and ClickHouse have their own versions and do not need upgrading with every LiteLLM release

Read the release notes, back up your databases, pause scheduled investigations, and let active investigations finish before upgrading. Preserve your configuration, database volumes, master key, salt key, and worker token. Worker setup is performed once; you do not need a new token for each release

<Tabs groupId="lens-upgrade">
<TabItem value="compose" label="Docker Compose" default>

For the bundled stack, stop the worker and change `LITELLM_VERSION` in the existing `.env` file to the new release, without `v`. Then pull and restart:

```bash
docker compose --profile lens stop lens-worker
# Change LITELLM_VERSION in .env
docker compose --profile lens pull
docker compose --profile lens up -d
```

This updates LiteLLM and the worker together while retaining the databases. Do not repeat the first-install key-generation step or run `down -v`

If you added the worker to your own Compose project, follow the same process with your existing files and shared version setting. Omit `--profile lens` if your worker does not use that profile. If Compose manages only the worker, upgrade LiteLLM separately first, update the worker's `LITELLM_VERSION` or explicit `LENS_WORKER_IMAGE`, then run `docker compose pull` and `docker compose up -d`

</TabItem>
<TabItem value="standalone" label="Docker or hosted worker">

Stop the worker after active investigations finish, then upgrade LiteLLM using your usual deployment process. Recreate the worker with image `ghcr.io/berriai/litellm-lens-worker:vX.Y.Z`, replacing `X.Y.Z` with the upgraded LiteLLM release. The same tag is available on Docker Hub

For a worker started with `docker run`, use your saved install command with the new image tag and remove the stopped container after its replacement connects. Keep its proxy URL, token, and runtime options. For Render or another container host, update the existing worker service's image tag and redeploy it, keeping its environment settings

</TabItem>
<TabItem value="helm" label="Helm">

Upgrade the componentized chart using your existing release name, namespace, values, and token Secret. Replace `X.Y.Z` with the target chart version. Keep workers paused until all LiteLLM pods have finished upgrading, then restore the worker count from your values:

```bash
helm upgrade litellm oci://ghcr.io/berriai/litellm/chart/litellm \
  --namespace litellm --version X.Y.Z -f values.yaml \
  --set lensWorker.replicaCount=0 --wait

kubectl -n litellm wait --for=delete pod \
  -l app.kubernetes.io/instance=litellm,app.kubernetes.io/component=lens-worker \
  --timeout=120s

helm upgrade litellm oci://ghcr.io/berriai/litellm/chart/litellm \
  --namespace litellm --version X.Y.Z -f values.yaml --wait
```

The chart selects matching LiteLLM and worker images. The first Helm command pauses investigations while the gateway and backend update. Wait for the old worker pods to stop, then the final command resumes them with the same token. Use your own release name in the pod selector if it differs from `litellm`. Avoid running different LiteLLM versions against the same Lens data after investigations resume

If you explicitly set image tags in your values, update those overrides too so they do not hold either component on an older version. Custom charts and separately managed worker deployments must update both image versions through their normal deployment process

</TabItem>
</Tabs>

After any upgrade, check for **Worker connected** in the dashboard, run an investigation, and restore any schedules you paused. The gateway checks compatibility before handing out work. An outdated worker waits with an upgrade message, leaving queued investigations untouched; update its image to resume work

RC and dev releases follow the same process using matching version suffixes. Hourly development deployments build the gateway and worker from the same selected commit

### Deploy with a coding agent

<AgentDeployPrompt prompt={`Deploy LiteLLM Lens on this machine by following https://docs.litellm.ai/docs/proxy/lens

1. If a LiteLLM proxy is already running, keep it and its PostgreSQL database. Otherwise choose a published release containing the coordinated Lens worker release and follow the New installation tab. Download its stack and configuration from that release; do not build from source.
2. For an existing proxy, configure ClickHouse tracing using the Existing LiteLLM tab. Check POST /v1/traces and GET /v1/traces with a LiteLLM key.
3. Ask me to open Lens > Investigations > Connect worker, select a model and budget, and get a worker token. For the bundled stack, save it in the private .env file and start the lens profile. For an existing proxy, use its generated Docker command.
4. Confirm the dashboard shows "Worker connected". Keep LiteLLM and the worker on the same release for future upgrades.

Never print or commit keys, worker tokens, or passwords. Ask me before replacing an existing container, database, or config.`} />

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

Run the Docker command on a server that can reach your LiteLLM deployment, or copy the token under **Using Docker Compose or Helm?** into your existing worker configuration. Keep the token private. Wait for **Worker connected**. Investigation creation unlocks when the worker is ready.

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
