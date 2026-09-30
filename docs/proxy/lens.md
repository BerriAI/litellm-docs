# LiteLLM Lens

Lens stores agent traces and LiteLLM request spend in ClickHouse, then shows agent runs in the proxy UI

![LiteLLM Lens architecture](/img/lens-architecture.svg)

## Quick start

Clone LiteLLM and start the [tracing Docker Compose stack](https://github.com/BerriAI/litellm/blob/main/docker/docker-compose.tracing.yml), which includes LiteLLM, Postgres, and ClickHouse

```bash
git clone https://github.com/BerriAI/litellm.git
cd litellm/docker
export OPENAI_API_KEY=sk-...
docker compose -f docker-compose.tracing.yml up --build
```

Send OTLP/HTTP traces to `http://localhost:4002/v1/traces` using `Authorization: Bearer local-tracing-master-key`. Open `http://localhost:4002/ui/?page=logs` to inspect a run

For a working agent example, [DeepLite](https://github.com/BerriAI/deeplite) uses an OpenTelemetry OTLP/HTTP exporter pointed at that full `/v1/traces` URL with a bearer key. Its `.env` settings are `LITELLM_DEV_BASE=http://localhost:4002/v1/traces` and `LITELLM_DEV_KEY=local-tracing-master-key` for the Compose stack

## Landing your first trace

With the stack from the quick start running, send a trace from a demo agent

```bash
curl -O https://docs.litellm.ai/lens/first_trace.py
pip install requests
python first_trace.py
```

The [script](https://docs.litellm.ai/lens/first_trace.py) runs one agent with 20 tool calls and 2 LLM calls through the proxy, then exports the spans to `/v1/traces`. It reads `LITELLM_URL` (default `http://localhost:4002`) and `LITELLM_KEY` (default `local-tracing-master-key`). Set `MODEL` to a model in your config; the Compose stack's default is `gpt-6.1-sol`

Open `http://localhost:4002/ui/?page=logs`, select the **Agent Traces** tab, and click the run. You should see the agent's spans on a timeline, with tool calls grouped and request cost on the LLM calls

![Agent trace in the LiteLLM UI](/img/lens-first-trace.png)

## Configure an existing proxy

Add tracing to your `config.yaml` under `general_settings`

```yaml
general_settings:
  tracing:
    store: clickhouse
```

Set `CLICKHOUSE_URL` to the ClickHouse HTTP endpoint reachable by the proxy, for example `http://default:<password>@clickhouse:8123` in Docker Compose. `CLICKHOUSE_DATABASE` is optional and defaults to `litellm`. `CLICKHOUSE_READER_URL` is optional; when omitted, trace reads use `CLICKHOUSE_URL`

The [tracing Compose file](https://github.com/BerriAI/litellm/blob/main/docker/docker-compose.tracing.yml) and its [config file](https://github.com/BerriAI/litellm/blob/main/docker/tracing-config.yaml) show a complete local setup. If tracing is not enabled or ClickHouse initialization fails, the tracing endpoints return HTTP 501

## Agent tracing API

All four endpoints require proxy authentication. Send a proxy key in the `Authorization: Bearer <key>` header

| Endpoint | Purpose |
| --- | --- |
| `POST /v1/traces` | Ingest OTLP/HTTP trace exports as protobuf (`application/x-protobuf`) or JSON (`application/json`); gzip is supported with `Content-Encoding: gzip` |
| `GET /v1/traces` | List trace summaries. Optional `start_ms` and `end_ms` are Unix milliseconds; the default window is the last 24 hours. Pass `cursor` to fetch the next page |
| `GET /v1/traces/{trace_id}` | Get a trace's `summary`, `agents`, and `spans`. Accepts optional `trace_ref` |
| `GET /v1/traces/{trace_id}/spans/{span_id}` | Get a span's `input`, `output`, and `attributes`. Accepts optional `trace_ref` |

The list response contains `data` and `next_cursor`, with 50 summaries per page by default. Pass a non-null `next_cursor` back as `cursor`; use a summary's `trace_ref` when fetching that trace or one of its spans

```bash
curl -H "Authorization: Bearer <proxy-key>" \
  "http://localhost:4002/v1/traces"
```

Proxy admins can read all traces. Team keys can read their team's traces; keys without a team can read traces sent with that key. Read-only proxy admins cannot ingest traces
