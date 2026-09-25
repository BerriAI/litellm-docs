# Databricks Zerobus

LiteLLM can write one row per proxy request straight into a Unity Catalog Delta table through [Databricks Zerobus Ingest](https://www.databricks.com/product/data-engineering/lakeflow-connect/zerobus-ingest). Rows are buffered in the proxy and posted in batches to the Zerobus REST endpoint, authenticated with a Databricks service principal, so there is no Kafka, no staging bucket, and no separate ingestion job between the gateway and the table you query.

## Overview

| Property | Details |
|----------|---------|
| Callback name | `zerobus` |
| Destination | a Unity Catalog Delta table, via the Zerobus Ingest REST API |
| Data format | JSON rows, one per request, matching the schema in [Table schema](#table-schema) |
| Upload trigger | every `flush_interval` seconds, or as soon as `batch_size` rows are queued |
| Authentication | service principal OAuth (client credentials), scoped to the target table |

## Prerequisites

You need a Databricks workspace with Unity Catalog and Zerobus Ingest enabled, plus a service principal with an OAuth secret. Create the target table, then grant the service principal the privileges the Zerobus token requires. Grant them to the principal directly: privileges it only inherits from a group such as `account users` are not accepted when the token is minted.

```sql
CREATE TABLE my_catalog.my_schema.litellm_traces (
  id STRING,
  trace_id STRING,
  session_id STRING,
  litellm_call_id STRING,
  call_type STRING,
  status STRING,
  model STRING,
  model_group STRING,
  model_id STRING,
  custom_llm_provider STRING,
  api_base STRING,
  stream BOOLEAN,
  cache_hit BOOLEAN,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  completion_start_time TIMESTAMP,
  response_time DOUBLE,
  prompt_tokens BIGINT,
  completion_tokens BIGINT,
  total_tokens BIGINT,
  response_cost DOUBLE,
  saved_cache_cost DOUBLE,
  api_key_hash STRING,
  api_key_alias STRING,
  team_id STRING,
  team_alias STRING,
  user_id STRING,
  org_id STRING,
  end_user STRING,
  requester_ip_address STRING,
  user_agent STRING,
  request_tags STRING,
  messages STRING,
  response STRING,
  error_str STRING,
  error_information STRING,
  metadata STRING,
  model_parameters STRING,
  hidden_params STRING,
  guardrail_information STRING,
  cost_breakdown STRING
);

GRANT USE CATALOG ON CATALOG my_catalog TO `<service-principal-application-id>`;
GRANT USE SCHEMA ON SCHEMA my_catalog.my_schema TO `<service-principal-application-id>`;
GRANT SELECT, MODIFY ON TABLE my_catalog.my_schema.litellm_traces TO `<service-principal-application-id>`;
```

The same statement is available from Python, so the DDL always matches the LiteLLM version you run:

```python
from litellm.integrations.zerobus.row import create_table_sql

print(create_table_sql("my_catalog.my_schema.litellm_traces"))
```

The Zerobus endpoint is separate from the workspace URL and is specific to your workspace ID and cloud region, for example `https://<workspace-id>.zerobus.<region>.cloud.databricks.com` on AWS or `https://<workspace-id>.zerobus.<region>.azuredatabricks.net` on Azure. Find it in the Zerobus section of your workspace settings. The workspace ID is the numeric `o=` value in the workspace URL after you log in, also returned as the `x-databricks-org-id` response header on any request to the workspace URL; the region is the one the workspace was deployed in, not the region of another workspace in the same account.

## Setup

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ZEROBUS_WORKSPACE_URL` | Yes | Workspace URL, e.g. `https://dbc-xxxxxxxx-xxxx.cloud.databricks.com`. Used to mint the OAuth token |
| `ZEROBUS_SERVER_ENDPOINT` | Yes | Zerobus Ingest endpoint for the workspace, e.g. `https://<workspace-id>.zerobus.<region>.cloud.databricks.com` |
| `ZEROBUS_CLIENT_ID` | Yes | Service principal application ID |
| `ZEROBUS_CLIENT_SECRET` | Yes | Service principal OAuth secret |
| `ZEROBUS_TABLE_NAME` | Yes | Fully qualified `catalog.schema.table` |

### Proxy config

```yaml
model_list:
  - model_name: {{openai_small}}
    litellm_params:
      model: openai/{{openai_small}}
      api_key: os.environ/OPENAI_API_KEY

litellm_settings:
  callbacks: ["zerobus"]
```

```bash
export ZEROBUS_WORKSPACE_URL="https://dbc-xxxxxxxx-xxxx.cloud.databricks.com"
export ZEROBUS_SERVER_ENDPOINT="https://<workspace-id>.zerobus.<region>.cloud.databricks.com"
export ZEROBUS_CLIENT_ID="<application-id>"
export ZEROBUS_CLIENT_SECRET="<oauth-secret>"
export ZEROBUS_TABLE_NAME="my_catalog.my_schema.litellm_traces"
litellm --config /path/to/config.yaml
```

### Setup on the UI

You can enable the callback from the admin UI instead of `config.yaml`. Open `Settings`, then `Logging & Alerts`, add `Databricks Zerobus`, and fill in the five fields above. The client secret is stored as a masked value. See the [admin UI docs](https://docs.litellm.ai/docs/proxy/ui) for how to reach these screens.

## Tuning the batching

All settings are optional and can be given under `zerobus_params`. Secrets can be referenced with `os.environ/`.

```yaml
litellm_settings:
  callbacks: ["zerobus"]
  zerobus_params:
    workspace_url: os.environ/ZEROBUS_WORKSPACE_URL
    server_endpoint: os.environ/ZEROBUS_SERVER_ENDPOINT
    client_id: os.environ/ZEROBUS_CLIENT_ID
    client_secret: os.environ/ZEROBUS_CLIENT_SECRET
    table_name: my_catalog.my_schema.litellm_traces
    batch_size: 100
    flush_interval: 10
```

| Setting | Default | Description |
|---------|---------|-------------|
| `workspace_url` | unset | Falls back to `ZEROBUS_WORKSPACE_URL` |
| `server_endpoint` | unset | Falls back to `ZEROBUS_SERVER_ENDPOINT` |
| `client_id` | unset | Falls back to `ZEROBUS_CLIENT_ID` |
| `client_secret` | unset | Falls back to `ZEROBUS_CLIENT_SECRET` |
| `table_name` | unset | Falls back to `ZEROBUS_TABLE_NAME`. Must be `catalog.schema.table` |
| `batch_size` | `100` | Queued rows that trigger a flush before the interval elapses |
| `flush_interval` | `10` | Seconds between flushes |

The callback refuses to start when any of the five connection values is missing, so a misconfigured proxy fails at boot instead of silently logging nothing.

### Redacting prompts and responses

Set `turn_off_message_logging` to keep `messages` and `response` out of the table, on failed requests as well as successful ones. Model, token counts, latency, spend, and the key, team, and user columns are still written.

```yaml
litellm_settings:
  callbacks: ["zerobus"]
  zerobus_params:
    turn_off_message_logging: true
```

## Table schema

Scalar fields land in typed columns so you can filter and aggregate without parsing. Nested fields (`request_tags`, `messages`, `response`, `error_information`, `metadata`, `model_parameters`, `hidden_params`, `guardrail_information`, `cost_breakdown`) are stored as JSON strings; use `from_json` or the `:` operator in Databricks SQL to read into them.

| Column | Type | Source |
|--------|------|--------|
| `id` | STRING | response ID, or the LiteLLM call ID for failed requests |
| `status` | STRING | `success` or `failure` |
| `model`, `model_group`, `model_id`, `custom_llm_provider`, `api_base` | STRING | the deployment that served the request |
| `stream`, `cache_hit` | BOOLEAN | request shape |
| `start_time`, `end_time`, `completion_start_time` | TIMESTAMP | request timing; `completion_start_time` is the time to first token on streams |
| `prompt_tokens`, `completion_tokens`, `total_tokens` | BIGINT | usage |
| `response_cost`, `saved_cache_cost` | DOUBLE | spend in USD |
| `api_key_hash`, `api_key_alias`, `team_id`, `team_alias`, `user_id`, `org_id`, `end_user` | STRING | who made the request, from the virtual key |
| `requester_ip_address`, `user_agent` | STRING | client |
| `error_str` | STRING | the error message on failed requests |

```sql
SELECT team_alias, model, count(*) AS requests, sum(response_cost) AS spend
FROM my_catalog.my_schema.litellm_traces
WHERE start_time > current_timestamp() - INTERVAL 1 DAY
GROUP BY ALL
ORDER BY spend DESC;
```

## How it works

Each flush mints or reuses a service principal OAuth token whose `authorization_details` name exactly the catalog, schema, and table above, then POSTs the queued rows as a JSON array to `/zerobus/v1/tables/<catalog.schema.table>/insert`. The token is cached until shortly before it expires and is discarded on a 401, so a rotated secret or a revoked grant is picked up on the next flush.

Delivery is at-least-once. A failure that is worth retrying (timeouts, 408, 429, 500, 502, 503, and 504) keeps the batch queued for the next flush, which can write a row twice; a rejection Databricks would refuse again, such as a missing grant or a schema mismatch, drops that batch and logs why rather than blocking every row queued behind it. The queue is capped at 50,000 rows, and logging never raises into the request path, so a Databricks outage degrades to lost traces, not failed LLM calls.

## Verification

Run the proxy with `LITELLM_LOG=DEBUG`, send a request, and query the table after `flush_interval` seconds:

```sql
SELECT id, status, model, prompt_tokens, completion_tokens, response_cost, error_str, start_time
FROM my_catalog.my_schema.litellm_traces
ORDER BY start_time DESC
LIMIT 10;
```

Failures are logged on the `zerobus:` prefix, including whether the batch was kept for a later flush or dropped. A `token request returned 401: invalid_authorization_details` error means the service principal is missing one of the grants in [Prerequisites](#prerequisites), or holds it only through a group. An `insert returned 400` with no message body means the Zerobus endpoint does not belong to the workspace that minted the token; check the workspace ID and region in `ZEROBUS_SERVER_ENDPOINT`. An `insert returned 400` with a `Record decoder/encoder error` means a row value does not match the column type, which happens when the table was created with a different DDL than `create_table_sql(...)` prints.

## Related links

- [Databricks Zerobus Ingest](https://www.databricks.com/product/data-engineering/lakeflow-connect/zerobus-ingest)
- [Proxy logging guide](https://docs.litellm.ai/docs/proxy/logging)
