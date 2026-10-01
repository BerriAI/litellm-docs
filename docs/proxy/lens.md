# LiteLLM Lens

<p>
  <a className="button button--primary button--lg" href="https://forms.gle/3GC1Ner4vjthGWi18">Join the waitlist now</a>
</p>

Once your agents are in production, you cannot manually review every trace.

LiteLLM Lens uses AI agents to analyze your agent traces and find recurring problems. You specify the expected behavior. Lens investigates failures, groups similar problems, and links each finding to the original traces.

Use **Logs > Agent Traces** to manually inspect individual runs. Use **Lens** to investigate a set of runs, on demand or on a schedule.

## Setup {#quick-start}

### Set up LiteLLM and ClickHouse

Lens needs ClickHouse to store traces and PostgreSQL to store investigation results. Deploy ClickHouse where your LiteLLM proxy can reach it, then [enable tracing on your proxy](#configure-an-existing-proxy).

If you are starting a new deployment, the [tracing Docker Compose stack](https://github.com/BerriAI/litellm/blob/main/docker/docker-compose.tracing.yml) starts ClickHouse, PostgreSQL, and LiteLLM together.

Open the dashboard at `https://<your-litellm-proxy>/ui/`. In the examples below, replace `https://<your-litellm-proxy>` with your LiteLLM proxy URL.

### Connect your agent

Point your agent's OpenTelemetry OTLP/HTTP exporter to LiteLLM:

| Setting | Value |
| --- | --- |
| Trace endpoint | `https://<your-litellm-proxy>/v1/traces` |
| HTTP header | `Authorization: Bearer <your-litellm-key>` |

Use a LiteLLM key to authenticate. Record the agent's task, steps, tool calls, inputs, and final answer. Lens uses this content to check what happened.

For a working example, use [DeepLite](https://github.com/BerriAI/deeplite). Set `LITELLM_DEV_BASE=https://<your-litellm-proxy>/v1/traces` and `LITELLM_DEV_KEY=<your-litellm-key>` in its `.env` file, then run the agent.

## View your first trace

Open **Logs > Agent Traces**. Select a time range that includes your run, then open it. Select a step to read its input, output, and attributes.

![An agent trace with its step tree, timeline, and selected step input and output.](/img/lens/trace-detail.png)

Check that you can see the task, tool results, and final answer. If these are missing, update your agent's instrumentation before running an investigation.

## Run your first investigation

### Connect the analyzer

Sign in as a proxy administrator and open **Lens** under **Observability**. Click **Set up analysis** at the top of the page. Check your LiteLLM deployment URL, then click **Generate setup command**.

Run the Docker command on a server that can reach your LiteLLM deployment. Keep the command private because it contains the worker token. Wait for **Connected · ready to analyze**.

![Lens analyzer setup showing a connected worker ready to analyze.](/img/lens/analyzer-connected.png)

This worker runs on your infrastructure. It checks LiteLLM for scheduled or requested investigations and sends the results back. It calls your chosen model through LiteLLM and keeps running when you close the dashboard.

### Choose the traces

Click **Set up your first lens**, or **New lens**. In **Activity**, name the lens and choose **Agent runs**. Select an application or add metadata conditions to narrow the investigation. **Application** matches the recorded OpenTelemetry `service.name`. Metadata conditions match recorded keys and values exactly.

Set **Review the last** to the time window for the first investigation.

![Activity selection filtered by application and metadata, with matching runs on the right.](/img/lens/activity-selection.png)

Check the matching runs in the preview. Click **Open run** to inspect an example before you continue. Newly received traces need a two-minute settling period before they appear here.

### Describe what to check

Click **Continue** to open **Questions**. In **What does a good run look like?**, describe what your agent should do.

For example:

> The research agent answers the user's question with sources. It checks the sources before writing the final answer and states when it cannot verify a claim.

In **Questions & checks**, add the questions you want Lens to answer, one per line. You can edit the suggested questions or write your own:

```text
Find claims that conflict with the retrieved sources.
Find tool failures that the agent does not recover from.
Find repeated searches that add no new information.
```

After setup, you can review and edit these under **Questions & checks**.

![Saved agent context and checks for a research agent.](/img/lens/questions-and-checks.png)

### Start the run

Click **Continue** to open **Review & run**. Choose an **Analysis model**, set a **Monthly limit (USD)**, and set **Maximum runs to review**. If more runs match, Lens reviews a sample. Trace content goes to the selected model through LiteLLM.

Choose **Run once, then manually** or **Run now and keep monitoring**. For monitoring, set **Check every** to the interval you want. Click **Run analysis** or **Start monitoring**.

Lens reviews the selected runs in parallel, groups similar observations, and checks the original evidence before saving findings.

Use **Analyze now** to start another investigation. To review recent history again, open **Questions & checks** and click **Recheck the last 24 hours**. Use **Pause** to stop scheduled investigations.

## Read the findings

Open **Findings** when the investigation finishes. **Needs attention** shows problems, ordered by priority. **Patterns** shows other observations, including successful recovery and useful behavior.

Open a finding to read what happened and the suggested next step. Expand **Evidence by run** to read the quotes. Click **Open original step** to see the cited step in its trace.

![A finding showing what happened, what to do next, and links to the supporting runs.](/img/lens/finding-detail.png)

Open **Runs** to see the traces selected for the current or most recent investigation. Open **Scans** to see investigation history.

Findings describe the reviewed sample. **Linked runs** counts cited runs, which can include counterexamples; it is not a count of all failures.

### Give feedback

If Lens flags expected behavior, explain why in **Feedback** and click **Dismiss**. Lens uses that feedback in later investigations for the same lens.

After you fix an issue, click **Mark resolved**. Lens can reopen it if the same issue appears in new runs.

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
  "https://<your-litellm-proxy>/v1/traces"
```

Proxy administrators can read all traces. Team keys can read their team's traces. Keys without a team can read traces sent with that key. Read-only proxy administrators cannot ingest traces.

## Lens API {#use-the-api}

Your agents can start Lens investigations and read findings through the same API as the dashboard. These endpoints are on your existing LiteLLM proxy, under `/engine`:

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
