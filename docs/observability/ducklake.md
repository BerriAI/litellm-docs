---
title: DuckLake
---

# DuckLake

Log LiteLLM Proxy request telemetry to a [DuckLake](https://ducklake.select/) lakehouse over Arrow Flight SQL, so spend and latency land in Parquet on your own object store and are queryable with SQL as soon as they arrive.

This is a community integration maintained outside the LiteLLM repo: [`litellm-ducklake-sink`](https://github.com/starlake-ai/litellm-ducklake-sink) (Apache-2.0). It is a standard `CustomLogger` callback.

## Quick Start

Install the package into the same environment that runs the proxy:

```shell
pip install litellm-ducklake-sink
```

Reference the callback instance in your proxy config:

```yaml title="config.yaml"
litellm_settings:
  callbacks: litellm_ducklake_sink.callback.instance
```

Point it at any DuckLake database exposed through an Arrow Flight SQL endpoint:

```shell
export DUCKLAKE_SINK_ENDPOINT="grpc+tls://your-flight-sql-host:31338"
export DUCKLAKE_SINK_USERNAME="litellm"
export DUCKLAKE_SINK_PASSWORD="..."
```

Start the proxy and send a request:

```shell
litellm --config config.yaml
```

No DDL is needed. On its first flush the sink creates `llm_requests` (and `llm_payloads`, if payload capture is enabled), partitioned by day, then starts appending.

## Query your logs

```sql
SELECT model,
       count(*)   AS calls,
       sum(cost)  AS spend
FROM llm_requests
WHERE request_day >= today() - 7
GROUP BY 1
ORDER BY spend DESC;
```

Because the tables are plain DuckLake tables, anything that speaks DuckDB or Arrow Flight SQL (a BI tool, a notebook) can read them directly. Nothing leaves your infrastructure.

## Configuration

All settings come from `DUCKLAKE_SINK_*` environment variables.

| Env var | Default | Description |
| --- | --- | --- |
| `DUCKLAKE_SINK_ENDPOINT` | required | Arrow Flight SQL endpoint, e.g. `grpc+tls://host:31338` |
| `DUCKLAKE_SINK_USERNAME` / `_PASSWORD` | required | Flight SQL credentials |
| `DUCKLAKE_SINK_SCHEMA_NAME` | `main` | Target schema (must already exist) |
| `DUCKLAKE_SINK_ENABLED` | `true` | Turn the sink off without removing the callback |
| `DUCKLAKE_SINK_CAPTURE_PAYLOADS` | `false` | Also store prompts/responses in `llm_payloads` |
| `DUCKLAKE_SINK_BATCH_ROWS` | `1000` | Rows per batch |
| `DUCKLAKE_SINK_BATCH_INTERVAL` | `10` | Seconds between flushes |
| `DUCKLAKE_SINK_SPOOL_DIR` | temp dir | Disk spool used when the endpoint is unreachable |
| `DUCKLAKE_SINK_RETENTION_DAYS` | `30` | Used by the out-of-band retention job |

See the [README](https://github.com/starlake-ai/litellm-ducklake-sink) for the full table, including tuning knobs for batch size limits, payload truncation, spool capacity, and flush retries.

## Notes

- **Batching.** Writes are batched by row count and interval, so the logging path stays off the request hot path.
- **Delivery.** At-least-once. Duplicates are possible if a drain times out or a worker is killed mid-flush;
  deduplicate by `request_id` for exact spend accounting.
- **Buffering.** Batches that cannot be delivered are spooled to disk and replayed on a later flush cycle.
  Multi-worker deployments share one spool safely.
- **Retention.** Run `python -m litellm_ducklake_sink.retention` from cron or a Kubernetes CronJob to delete rows older than `DUCKLAKE_SINK_RETENTION_DAYS`.

## Backends

Any DuckDB-with-DuckLake database reachable over Arrow Flight SQL works. The sink emits ordinary
`CREATE TABLE IF NOT EXISTS`, `INSERT`, and `DELETE`, plus DuckLake's `ALTER TABLE ... SET PARTITIONED BY` at bootstrap. [QoD](https://qod.starlake.ai) is one such server, and the package has a few optional QoD-specific settings (tenant routing, managed maintenance); they are unset by default and unnecessary on other servers.