# LiteLLM Lens

LiteLLM Lens uses AI agents to analyze your agent traces and find recurring problems. You specify the expected behavior. Lens investigates failures, groups similar problems, and links each finding to the original traces.

Use **Logs > Agent Traces** to manually inspect individual runs. Use **Lens** to investigate a set of runs, on demand or on a schedule.

## Setup {#quick-start}

### Start LiteLLM

Lens stores traces in ClickHouse and investigation results in PostgreSQL. The [tracing Docker Compose stack](https://github.com/BerriAI/litellm/blob/main/docker/docker-compose.tracing.yml) starts both databases and LiteLLM:

```bash
git clone https://github.com/BerriAI/litellm.git
cd litellm/docker
export OPENAI_API_KEY=sk-...
docker compose -f docker-compose.tracing.yml up --build
```

Open the dashboard at `http://localhost:4002/ui/`. This stack uses local example credentials. If you already run LiteLLM, see [Configure an existing proxy](#configure-an-existing-proxy).

### Connect your agent

Point your agent's OpenTelemetry OTLP/HTTP exporter to LiteLLM:

| Setting | Local Compose value |
| --- | --- |
| Trace endpoint | `http://localhost:4002/v1/traces` |
| HTTP header | `Authorization: Bearer local-tracing-master-key` |

For your own deployment, use its proxy URL and a LiteLLM key. Record the agent's task, steps, tool calls, inputs, and final answer. Lens uses this content to check what happened.

For a working example, use [DeepLite](https://github.com/BerriAI/deeplite). Set `LITELLM_DEV_BASE=http://localhost:4002/v1/traces` and `LITELLM_DEV_KEY=local-tracing-master-key` in its `.env` file, then run the agent.

## View your first trace

Open **Logs > Agent Traces**. Select a time range that includes your run, then open it. Select a step to read its input, output, and attributes.

![An agent trace with its step tree, timeline, and selected step input and output.](/img/lens/trace-detail.png)

Check that you can see the task, tool results, and final answer. If these are missing, update your agent's instrumentation before running an investigation.

## Run your first investigation

### Connect the analyzer

Sign in as a proxy administrator and open **Lens** under **Observability**. Click **Connect analyzer** in the setup guide, or **Set up analysis** at the top of the page. Check your LiteLLM deployment URL, then click **Generate setup command**.

Run the Docker command on a server that can reach your LiteLLM deployment. Keep the command private because it contains the worker token. Wait for **Connected · ready to analyze**.

![Lens analyzer setup showing a connected worker ready to analyze.](/img/lens/analyzer-connected.png)

This worker runs on your infrastructure. It checks LiteLLM for scheduled or requested investigations and sends the results back. It calls your chosen model through LiteLLM and keeps running when you close the dashboard.

### Choose the traces

Click **Set up your first lens**, or **New lens**. In **Activity**, name the lens and choose **Agent runs**. Select an application, team, or metadata conditions to narrow the investigation. **Application** matches the recorded OpenTelemetry `service.name`. Metadata conditions match recorded keys and values exactly.

Set **Review the last** to your time window. Set **Sample (%)** to the portion you want to review. Use **Maximum runs** to add a limit, or leave it empty. To review all matching traces, select 100% with no maximum.

![Activity selection filtered by application and metadata, with matching runs on the right.](/img/lens/activity-selection.png)

Check the matching runs in the preview. You can open a run or select particular runs to investigate. Newly received traces need a two-minute settling period before they appear here.

### Describe what to check

Click **Continue** to open **Questions**. Describe what your agent should do and what a good run looks like.

For example:

> The research agent answers the user's question with sources. It checks the sources before writing the final answer and states when it cannot verify a claim.

Add **Specific checks** if needed, one per line:

```text
Find claims that conflict with the retrieved sources.
Find tool failures that the agent does not recover from.
Find repeated searches that add no new information.
```

After setup, you can review and edit these under **Questions & checks**.

![Saved agent context and checks for a research agent.](/img/lens/questions-and-checks.png)

### Start the run

In **Review & run**, choose an **Analysis model**, a **Monthly limit (USD)**, and **Runs analyzed at once**. Trace content goes to the selected model through LiteLLM. Parallelism controls how much analysis runs at once; sampling controls how many traces are selected.

Choose **Run once, then manually** or **Run now and keep monitoring**. For monitoring, set **Check every** to the interval you want. Click **Run analysis** or **Start monitoring**.

Lens reviews the selected runs in parallel, groups similar observations, and checks the original evidence before saving findings.

Use **Run now** to repeat the investigation with its saved settings. Scheduled runs use those same settings over a new time window. Use **Duplicate** to investigate a different subset, or **Pause** to stop future scheduled runs.

## Read the findings

Open **Findings** when the investigation finishes. **Needs attention** shows problems, ordered by priority. **Patterns** shows other observations, including successful recovery and useful behavior.

Open a finding to read what happened and the suggested next step. Expand **Evidence by run** to read the quotes. Click **Open original step** to see the cited step in its trace.

![A finding showing what happened, what to do next, and links to the supporting runs.](/img/lens/finding-detail.png)

Use the batch selector or **Scans** to return to an earlier investigation. Each batch keeps its settings, selected runs, findings, coverage, and cost. **Runs** shows the traces reviewed in that batch.

Findings describe the reviewed sample. **Linked runs** counts cited runs, which can include counterexamples; it is not a count of all failures.

### Give feedback

If Lens flags expected behavior, explain why under **What should Lens remember?** and click **This is expected**. Lens uses that feedback in later investigations for the same lens.

After you fix an issue, click **Mark resolved**. Lens can reopen it if the same issue appears in new runs.

## Lens API (coming soon) {#use-the-api}

API access for your agents to start Lens investigations and read findings is coming soon. The dashboard already uses these endpoints on your existing LiteLLM proxy, under `/engine`:

| Action | Endpoint |
| --- | --- |
| Preview matching runs and sample size | `POST /engine/preview/sample` |
| Create a lens and start its first investigation | `POST /engine` |
| Run again with the saved settings | `POST /engine/{id}/runs` with `{}` |
| Run once with different settings or selected runs | `POST /engine/{id}/runs` with a `settings` override |
| List previous investigations | `GET /engine/{id}/runs` |
| Get an investigation's progress, findings, and selected runs | `GET /engine/{id}/runs/{run_id}` |
| Read supporting trace content | `GET /engine/{id}/executions/{execution_id}` |
| Mark a finding as expected and explain why | `PATCH /engine/{id}/findings/{finding_id}` |

An agent follows the same flow as the UI: preview the matching runs, create or start an investigation, check its progress, then read the findings. Scheduling is part of the saved settings.

Creating, changing, starting, cancelling, and giving feedback require proxy administrator access.

## Configure an existing proxy

Add this to `config.yaml`:

```yaml
general_settings:
  tracing:
    store: clickhouse
```

Set `CLICKHOUSE_URL` to the ClickHouse HTTP address your proxy can reach. `CLICKHOUSE_DATABASE` defaults to `litellm`. You can set `CLICKHOUSE_READER_URL` to use a separate read-only account; otherwise reads use `CLICKHOUSE_URL`.

Investigations also need PostgreSQL, a configured analysis model, and a connected Lens worker. Keep the proxy and worker versions compatible. See the [tracing config](https://github.com/BerriAI/litellm/blob/main/docker/tracing-config.yaml) and [worker setup guide](https://github.com/BerriAI/litellm/blob/litellm_lens_parallel_analysis/deploy/lens/README.md) for deployment details.

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
  "http://localhost:4002/v1/traces"
```

Proxy administrators can read all traces. Team keys can read their team's traces. Keys without a team can read traces sent with that key. Read-only proxy administrators cannot ingest traces.
