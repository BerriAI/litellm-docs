---
title: Hex
description: Export request-level LiteLLM spend to S3 and query it in Hex through Athena for cost analysis and dashboards.
---

# Hex

<SinceVersion v="1.110.0" />

Use the `hex` callback to export request-level spend records to S3. Connect [Hex to Athena](https://learn.hex.tech/docs/connect-to-data/data-connections/setup-guides/connect-to-amazon-athena) to query those records, ask Hex AI questions, and publish dashboards. The proxy uses AWS credentials and does not need a Hex API key.

If your spend data already reaches a warehouse that Hex supports, connect Hex to that warehouse instead. The callback provides an S3 path for customers who need a separate spend export.

## Enable the callback

Add `hex` to your proxy configuration:

```yaml
litellm_settings:
  callbacks: ["hex"]
```

Configure the destination before you start the proxy:

```bash
export HEX_S3_BUCKET_NAME="your-analytics-bucket"
export HEX_S3_REGION_NAME="us-east-1"
export HEX_S3_PATH="litellm-spend"
```

The bucket must already exist. Give the proxy's AWS IAM role `s3:PutObject` permission on the configured prefix. The callback uses the standard AWS credential chain, including workload credentials. Keep credentials outside the proxy configuration and source control.

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `HEX_S3_BUCKET_NAME` | Yes | None | Destination bucket. |
| `HEX_S3_PATH` | No | `litellm-spend` | Object prefix. Use a dedicated prefix for this export. |
| `HEX_S3_REGION_NAME` | No | `AWS_REGION`, then `us-east-1` | Bucket region. |
| `HEX_S3_ENDPOINT_URL` | No | AWS S3 endpoint | Custom endpoint for S3-compatible storage or local tests. Athena requires an AWS S3 data source. |

The destination is independent of an existing `s3_v2` callback.

## Connect Hex

Run the [Athena table setup](https://github.com/BerriAI/litellm/blob/main/cookbook/logging_observability/hex_spend_table.sql) in your Athena database. Replace both occurrences of `YOUR_BUCKET` and the `litellm-spend` prefix with your configured values. The table uses date partition projection, so new daily folders become queryable without a crawler or `MSCK REPAIR TABLE`.

Create an Athena data connection in Hex. Prefer IAM role authentication with the trust policy and external ID that Hex provides. Grant the role read access to the spend prefix, the Athena and Glue permissions required by Hex, and write access to a separate Athena query-results prefix. Keep query results outside the spend prefix.

Schema discovery needs `athena:ListDatabases`, `athena:ListTableMetadata`, `athena:GetDatabase`, and `athena:GetTableMetadata` on your catalog, plus Glue read permissions on the catalog, database, and table. Query access alone does not make the table visible to Hex AI. Include the query and prepared-statement permissions in the [Hex Athena setup guide](https://learn.hex.tech/docs/connect-to-data/data-connections/setup-guides/connect-to-amazon-athena), and `athena:GetQueryResultsStream` when your client uses streamed results.

After you create the table, refresh the connection schema and confirm that `litellm_hex_spend` appears in Hex's Data browser. Use the connection's schema filters to include only your spend database. You can then ask Hex AI to build a dashboard from that table or import the template below.

Import the [Hex dashboard template](https://github.com/BerriAI/litellm/blob/main/cookbook/logging_observability/hex_spend_dashboard.hex.yaml) as a project. Select your Athena connection for its four SQL cells and use the database that contains `litellm_hex_spend`. Run all cells and publish the App.

The template shows spend, requests, tokens, failures, unknown-cost requests, daily spend, model spend, and team spend for the last 30 UTC calendar days. Configure a Hex scheduled run for your desired refresh interval. Each query reads uploaded records; the dashboard refresh interval is separate from the callback's upload interval. Query-result caching is disabled in the template so a refresh queries S3 again.

Hex's S3 file picker imports selected files. It does not automatically discover each new log object for a historical dashboard. Use Athena for this workflow.

## Exported records

Each request produces one row. Successful, failed, and completed streaming requests use the same schema. The callback batches rows into newline-delimited JSON objects under `<prefix>/YYYY-MM-DD/`. If `s3_v2` is also configured as the proxy's cold-storage logger, the shared uploader uses individual JSON objects; the Athena table reads both formats.

| Fields | Meaning |
| --- | --- |
| `id`, `start_time`, `end_time` | Request identifier and Unix timestamps in seconds. |
| `model`, `model_group`, `custom_llm_provider`, `call_type` | Model, routing group, provider, and operation. |
| `status`, `spend`, `response_time`, `cache_hit` | Outcome, USD cost, latency in seconds, and cache status. Cost can be null when unavailable. |
| `prompt_tokens`, `completion_tokens`, `total_tokens` | Token usage. |
| `team_id`, `organization_id`, `user_id`, `key_alias` | Ownership identifiers for attribution. |

Prompts, responses, raw error messages, arbitrary request metadata, and API keys are excluded. Team/user identifiers and key aliases are included; scope bucket and Hex access to the people who can view that attribution data. Avoid sensitive information in model names or aliases.

## Delivery and scale

The callback uses LiteLLM's S3 upload queue and retry behavior. Records wait in memory until a flush; a process crash can lose records that have not reached S3. This is an asynchronous analytics export, with the same delivery limits as the S3 logger.

The shared defaults are 512 records per batch and a 10-second flush interval. `DEFAULT_S3_BATCH_SIZE` and `DEFAULT_S3_FLUSH_INTERVAL_SECONDS` change those defaults for S3 callbacks. Upload failures are retained for subsequent flushes subject to the S3 logger's queue and retry limits. Monitor callback failures and bucket delivery in your deployment.

At high volume, compact the JSON into partitioned Parquet or load it into your warehouse, then point Hex at that dataset. Set S3 lifecycle rules for your retention requirements. Athena queries incur AWS query costs.
