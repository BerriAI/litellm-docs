---
title: Global Control Plane Audit Logs
sidebar_label: Audit Logs
toc_max_heading_level: 2
description: Export Global Control Plane audit records to Splunk, Microsoft Sentinel, S3, or an OpenTelemetry collector.
---

# Audit Logs

{/* keep-version-note */}

The control plane records password login attempts, authentication and permission failures, and calls through the management proxy. Records include the caller, target data plane, operation, outcome, and trace ID. It exports these events as OCSF 1.5 records. Successful fleet and usage queries appear in request traces when tracing is enabled.

## Destinations

Set `CONTROL_PLANE_AUDIT_SINKS` to a JSON array. Each destination receives its own copy of every record. Add these settings to the control plane's environment through your secret manager.

| Destination | Sink name | Output |
| --- | --- | --- |
| Process logs | `log` | One OCSF JSON record per log line. Enabled by default. |
| OpenTelemetry collector | `otlp` | OTLP logs containing OCSF records. |
| Amazon S3 | `s3` | NDJSON objects with optional Object Lock retention. |
| Splunk | `splunk_hec` | HEC events with `ocsf:authentication` or `ocsf:api_activity` sourcetypes. |
| Microsoft Sentinel | `sentinel` | Rows in a Log Analytics custom table. |

### Splunk HEC

Create an [HTTP Event Collector token](https://help.splunk.com/en/splunk-enterprise/get-data-in/collect-http-event-data/http-event-collector-rest-api-endpoints) that can write to your audit index.

```bash
export CONTROL_PLANE_AUDIT_SINKS='["log","splunk_hec"]'
export CONTROL_PLANE_AUDIT_SPLUNK_URL=https://splunk-hec.internal.example.com:8088
export CONTROL_PLANE_AUDIT_SPLUNK_TOKEN=REPLACE_WITH_HEC_TOKEN
export CONTROL_PLANE_AUDIT_SPLUNK_INDEX=litellm_audit
```

Use the base HEC URL. LiteLLM appends `/services/collector/event`. Each event contains the OCSF record and uses `litellm-control-plane` as its source by default.

### Microsoft Sentinel

Create a Log Analytics custom table, data collection rule (DCR), and ingestion endpoint. Register an Entra application and grant it **Monitoring Metrics Publisher** on the DCR. Follow the [Azure Monitor setup guide](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/tutorial-logs-ingestion-portal/).

Use this schema for the DCR input stream and the `LiteLLMControlPlaneAudit_CL` table. Configure the DCR to send the input stream to that table with the `source` transformation.

| Type | Columns |
| --- | --- |
| `datetime` | `TimeGenerated` |
| `int` | `ClassUid`, `ActivityId`, `StatusId`, `SeverityId`, `ResponseCode` |
| `long` | `Sequence` |
| `string` | `ClassName`, `ActivityName`, `ActorUid`, `ActorEmail`, `DataplaneId`, `HttpMethod`, `UrlPath`, `Decision`, `Detail`, `TraceId`, `Hash`, `PrevHash`, `Ocsf` |
| `boolean` | `Truncated` |

```bash
export CONTROL_PLANE_AUDIT_SINKS='["log","sentinel"]'
export CONTROL_PLANE_AUDIT_SENTINEL_ENDPOINT=https://YOUR_DCE.ingest.monitor.azure.com
export CONTROL_PLANE_AUDIT_SENTINEL_DCR_IMMUTABLE_ID=dcr-YOUR_IMMUTABLE_ID
export CONTROL_PLANE_AUDIT_SENTINEL_STREAM_NAME=Custom-LiteLLMControlPlaneAudit_CL
export CONTROL_PLANE_AUDIT_SENTINEL_TENANT_ID=YOUR_TENANT_ID
export CONTROL_PLANE_AUDIT_SENTINEL_CLIENT_ID=YOUR_CLIENT_ID
export CONTROL_PLANE_AUDIT_SENTINEL_CLIENT_SECRET=REPLACE_WITH_CLIENT_SECRET
```

Use the DCR's immutable ID, not its resource name. The stream name must match the DCR input stream. LiteLLM obtains an Entra token and sends records through the Logs Ingestion API.

Query the flat columns directly. Parse `Ocsf` when you need the full event:

```kusto
LiteLLMControlPlaneAudit_CL
| where TimeGenerated > ago(1h)
| summarize arg_max(TimeGenerated, *) by Hash
| project TimeGenerated, ActorUid, DataplaneId, UrlPath, Decision, Ocsf
```

Retries can produce duplicates. Use `Hash` to deduplicate. Large records can set `Truncated` and shorten or omit `Detail` and `Ocsf` to fit the ingestion limits.

### Amazon S3

Create an audit bucket. Give the control plane's IAM role `s3:PutObject` on the audit prefix. LiteLLM uses the AWS credential chain, including workload credentials.

```bash
export CONTROL_PLANE_AUDIT_SINKS='["log","s3"]'
export CONTROL_PLANE_AUDIT_S3_BUCKET=YOUR_AUDIT_BUCKET
export CONTROL_PLANE_AUDIT_S3_REGION=us-east-1
export CONTROL_PLANE_AUDIT_S3_PREFIX=control-plane-audit
```

To retain immutable audit objects, enable versioning and [S3 Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) on the bucket. Grant `s3:PutObjectRetention` and set the retention mode and duration:

```bash
export CONTROL_PLANE_AUDIT_S3_OBJECT_LOCK_MODE=COMPLIANCE
export CONTROL_PLANE_AUDIT_S3_RETENTION_DAYS=365
```

`COMPLIANCE` prevents deletion or shorter retention until the period ends. Use `GOVERNANCE` if your policy allows authorized retention overrides. LiteLLM writes a separate NDJSON object for each batch.

### OpenTelemetry

Point the logs exporter at your collector's OTLP endpoint:

```bash
export CONTROL_PLANE_AUDIT_SINKS='["log","otlp"]'
export OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=https://otel.internal.example.com/v1/logs
```

Set `OTEL_EXPORTER_OTLP_HEADERS` if the collector requires authentication. For request traces, also set:

```bash
export CONTROL_PLANE_OTEL_ENABLED=true
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://otel.internal.example.com/v1/traces
```

Traces identify the control plane caller and downstream data plane calls. Set `CONTROL_PLANE_OTEL_IDENTITY_ATTRIBUTES=false` to omit the caller's ID and roles from spans. This does not remove identity from audit records.

## Delivery and retention

Each sink has a bounded in-memory queue. Delivery retries use exponential backoff. By default, a full queue drops the oldest queued record and logs the loss. A process restart can lose undelivered records.

Set strict mode to stop management writes when any sink has no queue capacity or has permanently rejected records:

```bash
export CONTROL_PLANE_AUDIT_STRICT=true
export CONTROL_PLANE_AUDIT_QUEUE_SIZE=10000
export CONTROL_PLANE_AUDIT_DRAIN_SECONDS=5
```

Strict mode returns HTTP `503` before forwarding a write. It requires at least one sink and does not make the queue durable. Unauthenticated failures can still be dropped from sink queues under load. On shutdown, LiteLLM drains the queues for the configured time and logs the number of undelivered records.

Records contain a sequence number, hash, and previous-record hash. The chain is local to one process and restarts with it. Store exported records in your audit system for retention across restarts and replicas.

## Read recent records

Call `/api/v1/audit` for event summaries or `/api/v1/audit/ocsf` for OCSF records. Both require `audit:read`. You can filter by `dataplane` and `actor`.

```bash
curl 'https://control-plane.internal.example.com/api/v1/audit/ocsf?dataplane=us-prod&limit=100' \
  --header "Authorization: Bearer $CONTROL_PLANE_TOKEN"
```

These endpoints read the current replica's memory. A data-plane-bound caller sees only records for its allowed data planes. Only a fleet-wide caller can read control plane authentication events.

## Configuration reference

### Delivery and tracing

| Variable | Default | Purpose |
| --- | --- | --- |
| `CONTROL_PLANE_AUDIT_SINKS` | `["log"]` | JSON array of enabled destinations. |
| `CONTROL_PLANE_AUDIT_CAPACITY` | `10000` | Capacity of each recent-event buffer. |
| `CONTROL_PLANE_AUDIT_QUEUE_SIZE` | `10000` | Queue capacity per destination. Minimum `2`. |
| `CONTROL_PLANE_AUDIT_BATCH_SIZE` | `100` | Maximum records in a delivery batch. |
| `CONTROL_PLANE_AUDIT_DRAIN_SECONDS` | `5` | Queue drain time at shutdown. |
| `CONTROL_PLANE_AUDIT_STRICT` | `false` | Refuse management writes when audit capacity is unavailable. |
| `CONTROL_PLANE_OTEL_ENABLED` | Automatic | Enable traces. Automatically enabled when an OTLP base or trace endpoint is set. |
| `CONTROL_PLANE_OTEL_SERVICE_NAME` | `litellm-control-plane` | OpenTelemetry service name. |
| `CONTROL_PLANE_OTEL_IDENTITY_ATTRIBUTES` | `true` | Include caller ID and roles in trace attributes. |

### Destination settings

Names below omit the `CONTROL_PLANE_AUDIT_` prefix.

| Variable suffix | Default | Purpose |
| --- | --- | --- |
| `SPLUNK_URL`, `SPLUNK_TOKEN` | Required for Splunk | Base HEC URL and token. |
| `SPLUNK_INDEX` | Token default | Destination index. |
| `SPLUNK_SOURCE` | `litellm-control-plane` | HEC source. |
| `SPLUNK_TIMEOUT_SECONDS` | `30` | HEC request timeout. |
| `SENTINEL_ENDPOINT` | Required for Sentinel | Logs ingestion base endpoint. |
| `SENTINEL_DCR_IMMUTABLE_ID` | Required for Sentinel | DCR immutable ID. |
| `SENTINEL_STREAM_NAME` | `Custom-LiteLLMControlPlaneAudit_CL` | DCR input stream. |
| `SENTINEL_TENANT_ID`, `SENTINEL_CLIENT_ID`, `SENTINEL_CLIENT_SECRET` | Required for Sentinel | Entra application credentials. |
| `SENTINEL_AUTHORITY_HOST` | `https://login.microsoftonline.com` | Entra token authority. |
| `SENTINEL_TOKEN_SCOPE` | Derived from authority | Azure Monitor scope. Public Azure uses `https://monitor.azure.com/.default`. |
| `SENTINEL_TIMEOUT_SECONDS` | `30` | Token and ingestion request timeout. |
| `S3_BUCKET` | Required for S3 | Destination bucket. |
| `S3_PREFIX` | `control-plane-audit` | Object key prefix. |
| `S3_REGION` | AWS region configuration | Bucket region. |
| `S3_ENDPOINT_URL` | AWS S3 endpoint | Override for an S3-compatible service. |
| `S3_OBJECT_LOCK_MODE` | Unset | `COMPLIANCE` or `GOVERNANCE` retention. |
| `S3_RETENTION_DAYS` | `365` | Retention period when a lock mode is set. |
| `S3_TIMEOUT_SECONDS` | `30` | Object upload timeout. |
| `S3_ALLOW_INSECURE_HTTP`, `SPLUNK_ALLOW_INSECURE_HTTP` | `false` | Allow HTTP for an in-cluster destination. |

Sink URLs use HTTPS by default. LiteLLM rejects startup if an enabled sink lacks required settings.
