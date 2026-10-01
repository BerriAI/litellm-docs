# LiteLLM Lens

<p>
  <a className="button button--primary button--lg" href="https://forms.gle/3GC1Ner4vjthGWi18">Join the waitlist now</a>
</p>

Once your agents are in production, you cannot manually review every trace.

LiteLLM Lens uses AI agents to analyze your agent traces and find recurring problems. You specify the expected behavior. Lens investigates failures, groups similar problems, and links each finding to the original traces.

Use **Logs > Agent Traces** to manually inspect individual runs. Use **Lens** to investigate a set of runs, on demand or on a schedule.

## Requirements

Lens needs the following before you start setup:

- A LiteLLM proxy release that includes Lens
- PostgreSQL, which stores lens configurations, findings, and scan history
- ClickHouse, which stores agent traces and request logs, reachable through `CLICKHOUSE_URL` and `CLICKHOUSE_READER_URL`
- Agent tracing enabled with `general_settings.tracing.store: clickhouse`

This guide was verified against ClickHouse `clickhouse/clickhouse-server:25.8` (server build 25.8.33.6). To run it locally:

```bash
docker run -d --name litellm-clickhouse \
  -e CLICKHOUSE_USER=default \
  -e CLICKHOUSE_PASSWORD=<password> \
  -e CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1 \
  -p 8123:8123 \
  clickhouse/clickhouse-server:25.8
```

The [tracing Docker Compose stack](https://github.com/BerriAI/litellm/blob/main/docker/docker-compose.tracing.yml) in the LiteLLM repo currently pins `clickhouse/clickhouse-server:26.9.6.6`. Version 25.8 is the one verified against this guide.

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

Sign in as a proxy administrator and open **Lens** under **Observability**. Click **Set up analysis** at the top of the page. Check your LiteLLM deployment URL, choose an existing virtual key or click **Create worker key**, then click **Generate setup command**. Analysis spend appears under that key in **Virtual Keys**, and its model permissions, budgets, and rate limits apply. Existing workers can use **Billing key** to assign a key without replacing their worker token.

Run the Docker command on a server that can reach your LiteLLM deployment. Keep the command private because it contains the worker token. Wait for **Connected · ready to analyze**.

![Lens analyzer setup showing a connected worker ready to analyze.](/img/lens/analyzer-connected.png)

This worker runs on your infrastructure. It checks LiteLLM for scheduled or requested investigations and sends the results back. It calls your chosen model through LiteLLM and keeps running when you close the dashboard.

### Describe what to check

Click **Set up your first lens**, or **New lens**. In **Expectations**, name the lens and describe what your agent should do in **What does a good run look like?**.

For example:

> The research agent answers the user's question with sources. It checks the sources before writing the final answer and states when it cannot verify a claim.

In **Specific checks (optional)**, add questions you want Lens to answer, one per line. Expected behavior is checked even when you leave these blank. You can edit the suggested questions or write your own:

```text
Find claims that conflict with the retrieved sources.
Find tool failures that the agent does not recover from.
Find repeated searches that add no new information.
```

After setup, you can review and edit these under **Questions & checks**.

![Saved agent context and checks for a research agent.](/img/lens/questions-and-checks.png)

### Choose the traces

Click **Continue** to open **Activity**. Choose **Agent runs**, **Individual LLM requests**, or **Agent runs and LLM requests**. Request analysis uses the request logs stored in ClickHouse. You can also restrict the selection to a team. Select an application or add metadata conditions to narrow the investigation. **Application** matches the recorded OpenTelemetry `service.name`. Metadata conditions match recorded keys and values exactly.

Set the time window and the percentage of matching runs to analyze. Leave the count limit blank to apply no cap: **100% with no count limit analyzes all matching runs**. You can also select particular runs in the preview.

![Activity selection filtered by application and metadata, with matching runs on the right.](/img/lens/activity-selection.png)

The preview shows how many runs match and how many will be analyzed. Page through the matching runs to check your selection. Click **Open run** to inspect an example before you continue. Newly received traces need a two-minute settling period before they appear here.

### Start the run

Click **Continue** to open **Review & run**. Choose an **Analysis model**, set a **Monthly limit (USD)**, and choose how many runs to analyze in parallel. Your selection and sample size are summarized here. Trace content goes to the selected model through LiteLLM.

Choose **Run once, then manually** or **Run now and keep monitoring**. For monitoring, set **Check every** to the interval you want. Click **Run analysis** or **Start monitoring**.

Lens reviews the selected runs in parallel, groups similar observations, and checks the original evidence before saving findings.

Use **Run now** to start another investigation with the saved settings. Scheduled investigations use those same settings. Use **Duplicate** to ask a one-off question or investigate a different selection without changing the original lens. Use **Pause** to stop scheduled investigations.

## Read the findings

Open **Findings** when the investigation finishes. **Needs attention** shows problems, ordered by priority. **Patterns** shows other observations, including successful recovery and useful behavior.

Open a finding to read what happened and the suggested next step. Expand **Evidence by run** to read the quotes. Click **Open original step** to see the cited step in its trace.

![A finding showing what happened, what to do next, and links to the supporting runs.](/img/lens/finding-detail.png)

Use the batch selector to return to a previous investigation and its findings, settings, progress, total duration, and cost. Duration includes any wait for an analyzer. **Runs** shows the activity selected for that batch. **Scans** shows investigation history.

Findings describe the reviewed sample. **Linked runs** counts cited supporting runs; it is not a count of all failures. Evidence can also include labeled counterexamples.

### Give feedback

If Lens flags expected behavior, explain why in **Feedback** and click **This is expected**. Lens uses that feedback in later investigations for the same lens.

After you fix an issue, click **Mark resolved**. Lens can reopen it if the same issue appears in new runs.

## Configure an existing proxy

Add this to `config.yaml`:

```yaml
general_settings:
  tracing:
    store: clickhouse
```

Set both ClickHouse URLs in the proxy environment. `CLICKHOUSE_DATABASE` defaults to `litellm`.

```bash
export CLICKHOUSE_URL="http://default:<password>@<clickhouse-host>:8123"
export CLICKHOUSE_READER_URL="http://litellm_reader:<reader-password>@<clickhouse-host>:8123"
```

`CLICKHOUSE_URL` is used to create tables and write spans and request logs. `CLICKHOUSE_READER_URL` is used for every read, including **Logs > Agent Traces**, the `/v1/traces` read endpoints, and Lens. Both are required. If `CLICKHOUSE_READER_URL` is unset, reads do not fall back to `CLICKHOUSE_URL`. Agent tracing stays off entirely: the proxy logs `Agent tracing unavailable` at startup, writes no spans or request logs to ClickHouse, and returns `501` from `/v1/traces` and from Lens activity reads.

You can point both variables at the same account for local testing. In production, use a separate SELECT-only user for `CLICKHOUSE_READER_URL`. Lens and the trace viewer run read queries on behalf of dashboard users, so a reader that can only SELECT from the trace tables limits what a bad query can do. LiteLLM also sets `readonly=1` and row and time limits on each read query. Do not give the reader a `readonly` setting of its own, because ClickHouse then rejects those per-query settings and every read fails. With `CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT=1`, you can create the reader with SQL after the proxy has created the tables:

```sql
CREATE USER litellm_reader IDENTIFIED BY '<reader-password>';
GRANT SELECT ON litellm.otel_traces TO litellm_reader;
GRANT SELECT ON litellm.agent_traces_by_key TO litellm_reader;
GRANT SELECT ON litellm.spend_logs TO litellm_reader;
```

To analyze individual LLM requests, Lens reads the request and response content that the proxy logs to ClickHouse. With tracing enabled, the proxy writes these request logs automatically, so you do not need to add `clickhouse` to `litellm_settings.callbacks`. Keep message logging on. When `turn_off_message_logging` is `true`, request inputs and outputs are stored empty and Lens has nothing to review:

```yaml
general_settings:
  tracing:
    store: clickhouse

litellm_settings:
  turn_off_message_logging: false
```

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

Your agents can start Lens investigations and read findings through the same API as the dashboard. These endpoints are on your existing LiteLLM proxy, under `/lens`:

| Action | Endpoint |
| --- | --- |
| Preview matching runs and sample size | `POST /lens/preview/sample` |
| List lenses and their latest state | `GET /lens` |
| Read a lens and its findings | `GET /lens/{id}` |
| Update the saved settings | `PUT /lens/{id}` |
| Create a lens and start its first investigation | `POST /lens` |
| Run again with the saved settings | `POST /lens/{id}/runs` with `{}` |
| Run once with different settings or selected runs | `POST /lens/{id}/runs` with a `settings` override |
| List previous investigations | `GET /lens/{id}/runs` |
| Get an investigation's progress, findings, and selected runs | `GET /lens/{id}/runs/{run_id}` |
| Read supporting trace content | `GET /lens/{id}/executions/{execution_id}` |
| Cancel the active investigation | `POST /lens/{id}/cancel` |
| Mark a finding as expected and explain why | `PATCH /lens/{id}/findings/{finding_id}` |

An agent follows the same flow as the UI: preview the matching runs, create or start an investigation, check its progress, then read the findings. Scheduling is part of the saved settings. Run history returns 50 investigations per page; pass `offset=50` for the next page. To mark a finding as expected, send `{"status":"dismissed","reason":"Why this behavior is acceptable"}` to its feedback endpoint.

Creating, changing, starting, cancelling, and giving feedback require proxy administrator access. Read-only proxy administrators can preview activity and read lenses, findings, and history. Team and ordinary virtual keys cannot use the Lens API. The worker uses its own generated credential.

For example, save this as `lens.json`. Use an analysis model configured on your proxy:

```json
{
  "name": "Research quality",
  "context": "Answer the user's question with sources. State when a claim cannot be verified.",
  "checks": [
    {"id": "accuracy", "instruction": "Find claims that conflict with retrieved sources."}
  ],
  "source": "traces",
  "lookback_hours": 24,
  "service": "research-agent",
  "sample_percent": 100,
  "sample_size": null,
  "concurrency": 8,
  "model": "<your-analysis-model>",
  "monthly_budget": 20,
  "enabled": false
}
```

With an analyzer connected, preview the matching activity, then create the lens and run its first investigation. These commands use `jq` to read the returned IDs:

```bash
export LITELLM_URL="https://<your-litellm-proxy>"
export LITELLM_API_KEY="<proxy-admin-key>"

jq '{settings: .}' lens.json | curl -fsS \
  -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" \
  -d @- "$LITELLM_URL/lens/preview/sample"

result=$(curl -fsS -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" -d @lens.json "$LITELLM_URL/lens")
lens_id=$(echo "$result" | jq -r '.id')
run_id=$(echo "$result" | jq -r '.jobs[0].id')

curl -fsS -H "Authorization: Bearer $LITELLM_API_KEY" \
  "$LITELLM_URL/lens/$lens_id/runs/$run_id" \
  | jq '{status, stage, coverage, cost, findings}'
```

Repeat the last command to check progress and read the completed findings. Start another investigation or browse previous ones:

```bash
curl -fsS -H "Authorization: Bearer $LITELLM_API_KEY" \
  -H "Content-Type: application/json" -d '{}' \
  "$LITELLM_URL/lens/$lens_id/runs"

curl -fsS -H "Authorization: Bearer $LITELLM_API_KEY" \
  "$LITELLM_URL/lens/$lens_id/runs?offset=0"
```

The preview returns `eligible`, `selected`, and a page of `executions`. Send its `next_offset` as `offset` alongside `settings` to see the next page. Creation returns the lens `id` and its queued investigation in `jobs`. Poll `GET /lens/{id}/runs/{run_id}` for `status`, `stage`, `coverage`, `cost`, and `findings`.

Set `enabled` to `true` and `interval_minutes` to `1440` for daily investigations. To run once with different settings, send `{"settings": <complete settings object>}` to `POST /lens/{id}/runs`. An optional `execution_ids` array in those settings restricts analysis to IDs returned by the preview. This override does not change the saved settings.

:::note Upgrading an existing Lens setup

The renamed API uses `/lens`, lists lenses under `lenses`, and returns `lens_id` in worker claims. Stop workers after active scans finish, upgrade all proxy instances together, and recreate workers using the upgraded dashboard command. Saved lenses and results are preserved by the database migration. Existing API clients must update their paths and response fields.

:::
